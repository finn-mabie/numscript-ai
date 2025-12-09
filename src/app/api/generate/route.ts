import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { safeValidateIntent, type NumscriptIntent } from "@/lib/schema";
import { compileToNumscript } from "@/lib/compiler";
import { parseChartYaml, formatChartForPrompt } from "@/lib/chart-of-accounts";
import { spawn } from "child_process";
import { join } from "path";

const MAX_RETRIES = 5;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildSystemPrompt(chartContext: string, explainMode: boolean): string {
  const basePrompt = `You are a Numscript expert. Convert natural language into valid Numscript JSON.

${chartContext}

## JSON OUTPUT SCHEMA

\`\`\`json
{
  "summary": "Brief description",
  "postings": [
    {
      "source": "account_path or 'world'",
      "source_overdraft": "none | unbounded | limited",
      "overdraft_limit": "20000",
      "destination_type": "simple | split",
      "simple_destination": "account_path",
      "split_rules": [...],
      "asset": "USD/2",
      "amount": "10000"
    }
  ],
  "metadata": [
    {"key": "transaction_type", "value": "payment"},
    {"key": "authorization_id", "value": "AUTH-12345"}
  ]
}
\`\`\`

## CRITICAL RULES

### 1. Amounts (ALWAYS in cents)
- $100.00 = "10000"
- $2,500 = "250000"  
- $249.99 = "24999"
- For "entire balance", use amount: "*"

### 2. Source Overdraft Options
- \`"source_overdraft": "none"\` - No overdraft allowed
- \`"source_overdraft": "unbounded"\` - Unlimited overdraft
- \`"source_overdraft": "limited", "overdraft_limit": "20000"\` - Overdraft up to $200 (20000 cents)

⚠️ NEVER add overdraft to "world" - it's already unlimited!

### 3. Simple Destination
\`\`\`json
{"destination_type": "simple", "simple_destination": "merchant:123:main"}
\`\`\`

### 4. Split Destination - TWO DIFFERENT TYPES (cannot mix!)

**TYPE A: Allotment (percentages) - use for "X% to account"**
\`\`\`json
"split_rules": [
  {"target": "platform:fees", "amount_mode": "fraction", "value": "10%"},
  {"target": "merchant:main", "amount_mode": "remaining", "value": ""}
]
\`\`\`

**TYPE B: Inorder (max caps) - use for "up to $X to account"**
\`\`\`json
"split_rules": [
  {"target": "user:cashback", "amount_mode": "max", "value": "1000"},
  {"target": "merchant:main", "amount_mode": "remaining", "value": ""}
]
\`\`\`

⚠️ **CRITICAL: You CANNOT mix "fraction" and "max" in the same split!**
- Use ONLY fractions (percentages) together, OR
- Use ONLY max caps together
- "remaining" can be used with either type

### 5. SPLIT EXAMPLES

**Percentage split:** "Send 80% to merchant, 15% to fees, rest to reserves"
\`\`\`json
"split_rules": [
  {"target": "merchant:main", "amount_mode": "fraction", "value": "80%"},
  {"target": "platform:fees", "amount_mode": "fraction", "value": "15%"},
  {"target": "platform:reserves", "amount_mode": "remaining", "value": ""}
]
\`\`\`

**Max cap split:** "Up to $10 cashback, up to $5 bonus, rest to merchant"
\`\`\`json
"split_rules": [
  {"target": "user:cashback", "amount_mode": "max", "value": "1000"},
  {"target": "user:bonus", "amount_mode": "max", "value": "500"},
  {"target": "merchant:main", "amount_mode": "remaining", "value": ""}
]
\`\`\`

### 6. LIMITED OVERDRAFT EXAMPLE  
"Allow overdraft up to $200 on credit account"
\`\`\`json
{
  "source": "account:credit",
  "source_overdraft": "limited",
  "overdraft_limit": "20000",
  ...
}
\`\`\`

### 7. Split Rules Order
1. fraction OR max rules first (but NOT both!)
2. remaining MUST be LAST

### 8. Multiple Postings for Complex Flows
Break complex requests into separate postings:
- Posting 1: Seed/fund accounts
- Posting 2: Process transaction with splits

### 9. Transaction Metadata
Add metadata to track transaction details. Common metadata keys:
- "transaction_type": Type of transaction (e.g., "payment", "refund", "authorization", "mint", "burn")
- "authorization_id": Reference ID for authorizations
- "settlement_ref": Settlement reference number
- "client_id": Customer/client identifier
- "mint_tx_hash" / "burn_tx_hash": Blockchain transaction hashes
- "block_number": Blockchain block number
- "type": General transaction classification

If the user mentions IDs, references, or wants to track specific data, include relevant metadata.

## OUTPUT FORMAT
Output ONLY valid JSON. No markdown code blocks.
"target" must always be a STRING account path.${explainMode ? `
Include "explanation" array with step-by-step breakdown.` : ""}`;

  return basePrompt;
}

function buildFixPrompt(
  originalPrompt: string,
  generatedNumscript: string,
  validationErrors: string[]
): string {
  return `Your generated Numscript has errors. Fix them.

## Original Request
${originalPrompt}

## Generated Numscript (has errors)
\`\`\`
${generatedNumscript}
\`\`\`

## Validation Errors
${validationErrors.map((e) => `- ${e}`).join("\n")}

## Common Fixes

### "Type mismatch (expected 'portion', got 'monetary')"
- For percentages: amount_mode: "fraction", value: "10%"
- For capped amounts: amount_mode: "max", value: "1000" (cents)
- DON'T use [USD/2 X] in split rules

### "'remaining' should be last"
- Put remaining as the LAST rule in split_rules array

### "@world is already set to be overdraft"  
- For source "world", set source_overdraft: "none"

### For capped amounts like "cashback capped at $10"
Use: {"target": "...", "amount_mode": "max", "value": "1000"}

Re-analyze the original request and output corrected JSON.`;
}

function buildSchemaFixPrompt(originalPrompt: string, schemaError: string): string {
  return `Your JSON structure was invalid. Here's the error:

${schemaError}

## CORRECT SCHEMA STRUCTURE

For simple destinations:
\`\`\`json
{
  "destination_type": "simple",
  "simple_destination": "merchant:123:main"
}
\`\`\`

For split destinations (percentages only):
\`\`\`json
{
  "destination_type": "split",
  "split_rules": [
    {"target": "platform:fees", "amount_mode": "fraction", "value": "10%"},
    {"target": "merchant:main", "amount_mode": "remaining", "value": ""}
  ]
}
\`\`\`

## IMPORTANT RULES
1. "target" must be a STRING (account path), never an object
2. For complex multi-level splits, just use multiple split_rules with different percentages
3. Do NOT nest objects inside target - keep it flat
4. All percentages must add up correctly (use "remaining" for the last recipient)

## Original Request
${originalPrompt}

## SIMPLIFIED APPROACH
Instead of nested splits, break into multiple postings:
- Posting 1: Main transaction with top-level split
- Posting 2: Secondary splits if needed

Output corrected JSON now. Keep it simple - avoid nested structures.`;
}

// MCP Validation function
async function validateWithMCP(script: string): Promise<{ valid: boolean; errors: string[] }> {
  return new Promise((resolve) => {
    const mcpPath = join(process.cwd(), "numscript-mcp", "numscript");

    const proc = spawn(mcpPath, ["mcp"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    const initRequest = {
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "numscript-ai", version: "1.0.0" },
      },
    };

    const checkRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "check",
        arguments: { script },
      },
    };

    proc.stdin.write(JSON.stringify(initRequest) + "\n");
    proc.stdin.write(JSON.stringify(checkRequest) + "\n");
    proc.stdin.end();

    proc.on("close", () => {
      try {
        const lines = stdout.trim().split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            if (response.id === 0) continue;

            if (response.error) {
              resolve({ valid: false, errors: [response.error.message] });
              return;
            }

            if (response.result) {
              if (response.result.content) {
                for (const content of response.result.content) {
                  if (content.type === "text" && content.text) {
                    try {
                      const parsed = JSON.parse(content.text);
                      if (parsed.errors && Array.isArray(parsed.errors)) {
                        // Filter out warnings, only fail on errors
                        const errors = parsed.errors.filter(
                          (e: { severity: string }) => e.severity === "Error"
                        );
                        if (errors.length === 0) {
                          resolve({ valid: true, errors: [] });
                          return;
                        }
                        resolve({
                          valid: false,
                          errors: errors.map(
                            (e: { kind: string; severity: string }) =>
                              `${e.severity}: ${e.kind}`
                          ),
                        });
                        return;
                      }
                    } catch {
                      // Not JSON
                    }
                  }
                }
              }

              if ("errors" in response.result) {
                const allErrors = response.result.errors || [];
                const errors = allErrors.filter(
                  (e: { severity: string }) => e.severity === "Error"
                );
                if (errors.length === 0) {
                  resolve({ valid: true, errors: [] });
                  return;
                }
                resolve({
                  valid: false,
                  errors: errors.map(
                    (e: { kind: string; severity: string }) =>
                      `${e.severity}: ${e.kind}`
                  ),
                });
                return;
              }
            }
          } catch {
            continue;
          }
        }

        resolve({ valid: true, errors: [] });
      } catch {
        resolve({ valid: true, errors: [] });
      }
    });

    proc.on("error", () => {
      resolve({ valid: true, errors: [] });
    });

    setTimeout(() => {
      proc.kill();
      resolve({ valid: true, errors: [] });
    }, 5000);
  });
}

async function generateIntent(
  systemPrompt: string,
  userPrompt: string
): Promise<{ intent: NumscriptIntent; explanation?: string[]; raw: string }> {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
  });

  const aiResponse = completion.choices[0]?.message?.content;

  if (!aiResponse) {
    throw new Error("No response from AI model");
  }

  const cleanedResponse = aiResponse
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleanedResponse);
  } catch {
    throw new Error(`JSON parse error. Raw response: ${cleanedResponse.slice(0, 500)}`);
  }

  let explanation: string[] | undefined;
  if (parsed.explanation) {
    explanation = parsed.explanation;
    delete parsed.explanation;
  }

  const validation = safeValidateIntent(parsed);
  if (!validation.success) {
    const errorDetails = validation.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    throw new Error(`SCHEMA_ERROR: ${errorDetails}`);
  }

  return { intent: validation.data, explanation, raw: aiResponse };
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, chartYaml, explainMode = false } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid prompt" },
        { status: 400 }
      );
    }

    if (!chartYaml || typeof chartYaml !== "string") {
      return NextResponse.json(
        { error: "Missing Chart of Accounts" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const chartResult = parseChartYaml(chartYaml);
    if (!chartResult.success) {
      return NextResponse.json(
        { error: `Invalid Chart of Accounts: ${chartResult.error}` },
        { status: 400 }
      );
    }

    const chartContext = formatChartForPrompt(chartResult.data);
    const systemPrompt = buildSystemPrompt(chartContext, explainMode);

    let attempt = 0;
    let lastError: string | null = null;
    let currentPrompt = prompt;
    let explanation: string[] | undefined;
    let lastNumscript: string | undefined;

    while (attempt < MAX_RETRIES) {
      attempt++;

      try {
        const result = await generateIntent(systemPrompt, currentPrompt);
        explanation = result.explanation;

        const numscript = compileToNumscript(result.intent);
        lastNumscript = numscript;

        const validation = await validateWithMCP(numscript);

        if (validation.valid) {
          return NextResponse.json({
            success: true,
            intent: result.intent,
            numscript,
            explanation,
            attempts: attempt,
            mcpValidation: { valid: true },
          });
        }

        lastError = validation.errors.join("; ");
        currentPrompt = buildFixPrompt(prompt, numscript, validation.errors);

        console.log(`Attempt ${attempt} MCP failed:`, validation.errors);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        lastError = errorMsg;
        console.log(`Attempt ${attempt} error:`, lastError);

        if (attempt >= MAX_RETRIES) break;
        
        // Build specific fix prompt based on error type
        if (errorMsg.includes("SCHEMA_ERROR")) {
          currentPrompt = buildSchemaFixPrompt(prompt, errorMsg);
        } else {
          currentPrompt = `Previous attempt failed: ${errorMsg}\n\nOriginal request: ${prompt}\n\nPlease try again with valid JSON.`;
        }
      }
    }

    return NextResponse.json(
      {
        error: `Failed after ${MAX_RETRIES} attempts`,
        lastError,
        lastNumscript,
        attempts: attempt,
      },
      { status: 422 }
    );
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
