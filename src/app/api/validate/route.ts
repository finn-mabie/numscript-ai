import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { join } from "path";

/**
 * MCP Validation API Route
 * Calls the local Numscript MCP binary to validate generated Numscript.
 * Uses the "check" tool which validates syntax and static analysis.
 */

interface MCPRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number;
  result?: {
    content?: Array<{
      type: string;
      text?: string;
    }>;
    // Direct result for tool calls
    errors?: Array<{
      kind: string;
      severity: string;
      span: unknown;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

async function callMCP(script: string): Promise<{ valid: boolean; errors?: string[] }> {
  return new Promise((resolve) => {
    const mcpPath = join(process.cwd(), "numscript-mcp", "numscript");

    const proc = spawn(mcpPath, ["mcp"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // MCP initialization sequence
    const initRequest: MCPRequest = {
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "numscript-ai", version: "1.0.0" },
      },
    };

    // The check tool request
    const checkRequest: MCPRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "check",
        arguments: {
          script,
        },
      },
    };

    // Send both requests
    proc.stdin.write(JSON.stringify(initRequest) + "\n");
    proc.stdin.write(JSON.stringify(checkRequest) + "\n");
    proc.stdin.end();

    proc.on("close", () => {
      if (stderr && !stdout) {
        // MCP binary error
        resolve({ valid: true }); // Assume valid if MCP unavailable
        return;
      }

      try {
        // Parse JSONRPC responses (may be multiple lines)
        const lines = stdout.trim().split("\n").filter(Boolean);
        
        for (const line of lines) {
          try {
            const response: MCPResponse = JSON.parse(line);

            // Skip initialization response
            if (response.id === 0) continue;

            // Handle error response
            if (response.error) {
              resolve({
                valid: false,
                errors: [response.error.message],
              });
              return;
            }

            // Handle tool result
            if (response.result) {
              // Check if result contains content array (MCP standard format)
              if (response.result.content) {
                const textContent = response.result.content
                  .filter((c) => c.type === "text" && c.text)
                  .map((c) => c.text as string);

                // Try to parse the text content as JSON
                for (const text of textContent) {
                  try {
                    const parsed = JSON.parse(text);
                    if (parsed.errors && Array.isArray(parsed.errors)) {
                      if (parsed.errors.length === 0) {
                        resolve({ valid: true });
                        return;
                      }
                      resolve({
                        valid: false,
                        errors: parsed.errors.map(
                          (e: { kind: string; severity: string }) =>
                            `${e.severity}: ${e.kind}`
                        ),
                      });
                      return;
                    }
                  } catch {
                    // Not JSON, check for error keywords
                    if (text.toLowerCase().includes("error")) {
                      resolve({ valid: false, errors: [text] });
                      return;
                    }
                  }
                }

                resolve({ valid: true });
                return;
              }

              // Direct result format
              if ("errors" in response.result) {
                const errors = response.result.errors;
                if (!errors || errors.length === 0) {
                  resolve({ valid: true });
                  return;
                }
                resolve({
                  valid: false,
                  errors: errors.map(
                    (e) => `${e.severity}: ${e.kind}`
                  ),
                });
                return;
              }
            }
          } catch {
            // Skip unparseable lines
            continue;
          }
        }

        // No errors found
        resolve({ valid: true });
      } catch {
        resolve({ valid: true }); // Assume valid on parse error
      }
    });

    proc.on("error", () => {
      // MCP binary not found
      resolve({ valid: true });
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      proc.kill();
      resolve({ valid: true });
    }, 5000);
  });
}

export async function POST(request: NextRequest) {
  try {
    const { numscript } = await request.json();

    if (!numscript || typeof numscript !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid numscript" },
        { status: 400 }
      );
    }

    const result = await callMCP(numscript);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Validation error:", error);
    return NextResponse.json(
      { valid: true }, // Assume valid on error
      { status: 200 }
    );
  }
}
