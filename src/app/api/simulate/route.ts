/**
 * Numscript Simulation API
 * Uses the MCP 'evaluate' tool to run numscript and return postings
 */

import { NextResponse } from "next/server";
import { spawn } from "child_process";

interface SimulationRequest {
  script: string;
  balances: Record<string, Record<string, number>>;
  vars?: Record<string, string>;
}

interface Posting {
  source: string;
  destination: string;
  amount: string;
  asset: string;
}

interface SimulationResult {
  postings: Posting[];
  txMeta: Record<string, unknown>;
  accountsMeta: Record<string, Record<string, string>>;
}

// Compute final balances after applying postings
function computeFinalBalances(
  initialBalances: Record<string, Record<string, number>>,
  postings: Posting[]
): Record<string, Record<string, number>> {
  // Deep clone initial balances
  const finalBalances: Record<string, Record<string, number>> = {};
  for (const [account, assets] of Object.entries(initialBalances)) {
    finalBalances[account] = { ...assets };
  }

  // Apply each posting
  for (const posting of postings) {
    const amount = parseInt(posting.amount, 10);
    const asset = posting.asset;

    // Ensure source account exists
    if (!finalBalances[posting.source]) {
      finalBalances[posting.source] = {};
    }
    if (finalBalances[posting.source][asset] === undefined) {
      finalBalances[posting.source][asset] = 0;
    }

    // Ensure destination account exists
    if (!finalBalances[posting.destination]) {
      finalBalances[posting.destination] = {};
    }
    if (finalBalances[posting.destination][asset] === undefined) {
      finalBalances[posting.destination][asset] = 0;
    }

    // Debit source, credit destination
    finalBalances[posting.source][asset] -= amount;
    finalBalances[posting.destination][asset] += amount;
  }

  return finalBalances;
}

async function callMCPEvaluate(
  script: string,
  balances: Record<string, Record<string, number>>,
  vars: Record<string, string>
): Promise<SimulationResult> {
  return new Promise((resolve, reject) => {
    const mcpPath = "./numscript-mcp/numscript";

    const child = spawn(mcpPath, ["mcp"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let requestId = 1;

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();

      // Try to parse complete JSON-RPC responses
      const lines = stdout.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response = JSON.parse(line);

          // Handle initialization response
          if (response.id === 0 && response.result?.protocolVersion) {
            // Send initialized notification
            const initialized = JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n";
            child.stdin.write(initialized);

            // Now call the evaluate tool
            const evaluateRequest = JSON.stringify({
              jsonrpc: "2.0",
              id: requestId,
              method: "tools/call",
              params: {
                name: "evaluate",
                arguments: {
                  script,
                  balances,
                  vars,
                },
              },
            }) + "\n";
            child.stdin.write(evaluateRequest);
          }

          // Handle tool result
          if (response.id === requestId && response.result) {
            child.stdin.end();
            child.kill();

            const content = response.result.content;
            if (content && content.length > 0) {
              const firstContent = content[0];
              if (firstContent.type === "text") {
                try {
                  const result = JSON.parse(firstContent.text);
                  resolve(result);
                } catch {
                  reject(new Error(`Failed to parse result: ${firstContent.text}`));
                }
              } else {
                reject(new Error(`Unexpected content type: ${firstContent.type}`));
              }
            } else {
              reject(new Error("Empty result from MCP"));
            }
          }

          // Handle errors
          if (response.error) {
            child.stdin.end();
            child.kill();
            reject(new Error(response.error.message || "MCP error"));
          }
        } catch {
          // Not complete JSON yet, continue accumulating
        }
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn MCP process: ${err.message}`));
    });

    child.on("close", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`MCP process exited with code ${code}: ${stderr}`));
      }
    });

    // Send initialization request
    const initRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "numscript-ai-simulate", version: "1.0.0" },
      },
    }) + "\n";

    child.stdin.write(initRequest);

    // Timeout after 10 seconds
    setTimeout(() => {
      child.kill();
      reject(new Error("MCP evaluation timed out"));
    }, 10000);
  });
}

export async function POST(request: Request) {
  try {
    const body: SimulationRequest = await request.json();

    if (!body.script) {
      return NextResponse.json(
        { success: false, error: "Missing required field: script" },
        { status: 400 }
      );
    }

    const balances = body.balances || {};
    const vars = body.vars || {};

    const result = await callMCPEvaluate(body.script, balances, vars);

    // Compute final balances
    const finalBalances = computeFinalBalances(balances, result.postings);

    return NextResponse.json({
      success: true,
      postings: result.postings,
      metadata: result.txMeta,
      accountsMeta: result.accountsMeta,
      initialBalances: balances,
      finalBalances,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Simulation error:", message);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

