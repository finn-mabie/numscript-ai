"use client";

import * as React from "react";
import {
  Sparkles,
  AlertTriangle,
  Loader2,
  Terminal,
  ArrowRight,
  Settings2,
  Lightbulb,
  CheckCircle2,
  LayoutTemplate,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CodeBlock } from "@/components/ui/code-block";
import { ChartEditor } from "@/components/ui/chart-editor";
import { Toggle } from "@/components/ui/toggle";
import { TemplateSelector } from "@/components/ui/template-selector";
import { ChartPresetSelector } from "@/components/ui/chart-preset-selector";
import { DEFAULT_CHART_YAML, parseChartYaml } from "@/lib/chart-of-accounts";
import type { TransactionTemplate, ChartPreset } from "@/lib/templates";
import type { NumscriptIntent } from "@/lib/schema";

interface GenerationResult {
  success: boolean;
  intent?: NumscriptIntent;
  numscript?: string;
  explanation?: string[];
  error?: string;
  lastError?: string;
  details?: Array<{ path: string; message: string }>;
  rawResponse?: string;
  attempts?: number;
  mcpValidation?: { valid: boolean; errors?: string[] };
}

export function NumscriptEngine() {
  const [prompt, setPrompt] = React.useState("");
  const [chartYaml, setChartYaml] = React.useState(DEFAULT_CHART_YAML);
  const [showChart, setShowChart] = React.useState(false);
  const [showTemplates, setShowTemplates] = React.useState(true);
  const [explainMode, setExplainMode] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<GenerationResult | null>(null);

  const isChartValid = React.useMemo(() => {
    if (!chartYaml.trim()) return false;
    const result = parseChartYaml(chartYaml);
    return result.success;
  }, [chartYaml]);

  const handleGenerate = async () => {
    if (!prompt.trim() || !isChartValid) return;

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, chartYaml, explainMode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          success: false,
          error: data.error || "Generation failed",
          lastError: data.lastError,
          details: data.details,
          rawResponse: data.rawResponse,
          attempts: data.attempts,
        });
      } else {
        setResult(data);
      }
    } catch {
      setResult({
        success: false,
        error: "Network error. Please check your connection and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey) {
      handleGenerate();
    }
  };

  const handleTemplateSelect = (template: TransactionTemplate) => {
    setPrompt(template.prompt);
    setResult(null);
    setShowTemplates(false);
  };

  const handleChartPresetSelect = (preset: ChartPreset) => {
    setChartYaml(preset.yaml);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Chart of Accounts Toggle */}
          <button
            onClick={() => setShowChart(!showChart)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Settings2 className="h-4 w-4" />
            <span>Chart of Accounts</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                isChartValid
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {isChartValid ? "Valid" : "Invalid"}
            </span>
          </button>

          {/* Templates Toggle */}
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <LayoutTemplate className="h-4 w-4" />
            <span>Templates</span>
          </button>
        </div>

        {/* Explain Mode Toggle */}
        <Toggle
          checked={explainMode}
          onChange={setExplainMode}
          label="Explain Mode"
          description="Get line-by-line explanations"
        />
      </div>

      {/* Templates Panel */}
      {showTemplates && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-4">
          <div className="flex items-center gap-2 text-zinc-400 mb-3">
            <LayoutTemplate className="h-4 w-4" />
            <span className="text-sm font-medium">Transaction Templates</span>
            <span className="text-xs text-zinc-600">— Click to populate prompt</span>
          </div>
          <TemplateSelector onSelect={handleTemplateSelect} />
        </div>
      )}

      {/* Chart Editor (Collapsible) */}
      {showChart && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-4">
          <ChartEditor value={chartYaml} onChange={setChartYaml} />
          <ChartPresetSelector onSelect={handleChartPresetSelect} />
        </div>
      )}

      {/* Main Interface */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Panel - Input */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Terminal className="h-4 w-4" />
            <span className="text-sm font-medium">Natural Language Input</span>
          </div>

          <Textarea
            placeholder="Describe your financial transaction in plain English...

e.g., &quot;Payout user 123 $100 keeping $5 fee&quot;"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-[180px]"
            disabled={isLoading}
          />

          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || !isChartValid || isLoading}
            size="lg"
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Numscript
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          {!isChartValid && (
            <p className="text-center text-xs text-red-400">
              Please fix the Chart of Accounts before generating.
            </p>
          )}

          <p className="text-center text-xs text-zinc-500">
            Press{" "}
            <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono">⌘</kbd> +{" "}
            <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono">Enter</kbd>{" "}
            to generate
          </p>
        </div>

        {/* Right Panel - Output */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-400">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Generated Numscript</span>
            </div>
            {result?.success && result.mcpValidation?.valid && (
              <div className="flex items-center gap-2">
                {result.attempts && result.attempts > 1 && (
                  <span className="text-xs text-zinc-500">
                    {result.attempts} attempts
                  </span>
                )}
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  MCP Validated
                </div>
              </div>
            )}
          </div>

          {!result && !isLoading && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-8 min-h-[200px]">
              <p className="text-center text-sm text-zinc-500">
                Your generated Numscript will appear here.
                <br />
                <span className="text-zinc-600">
                  Select a template or enter a command.
                </span>
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/50 p-8 min-h-[200px]">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-sm text-zinc-400">
                  {explainMode
                    ? "Parsing intent & generating explanation..."
                    : "Parsing intent & compiling Numscript..."}
                </p>
              </div>
            </div>
          )}

          {result && !isLoading && (
            <div className="flex flex-col gap-4 flex-1">
              {result.success && result.numscript ? (
                <>
                  <CodeBlock code={result.numscript} />

                  {/* Explanation Panel */}
                  {result.explanation && result.explanation.length > 0 && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
                      <div className="flex items-center gap-2 mb-3 text-amber-400">
                        <Lightbulb className="h-4 w-4" />
                        <span className="text-sm font-medium">Explanation</span>
                      </div>
                      <ul className="space-y-2 text-sm text-amber-200/80">
                        {result.explanation.map((line, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-amber-500/60 font-mono text-xs mt-0.5">
                              {i + 1}.
                            </span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Intent Debug */}
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-400">
                      View parsed intent (JSON)
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400">
                      {JSON.stringify(result.intent, null, 2)}
                    </pre>
                  </details>
                </>
              ) : (
                <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="font-medium text-red-400">{result.error}</p>
                      {result.attempts && (
                        <p className="text-xs text-red-300/60">
                          Tried {result.attempts} time{result.attempts > 1 ? "s" : ""} to generate valid Numscript
                        </p>
                      )}
                      {result.lastError && (
                        <p className="text-sm text-red-300/80">
                          Last error: {result.lastError}
                        </p>
                      )}
                      {result.details && (
                        <ul className="list-inside list-disc text-sm text-red-300/80 space-y-1">
                          {result.details.map((detail, i) => (
                            <li key={i}>
                              <code className="text-xs bg-red-900/30 px-1 rounded">
                                {detail.path}
                              </code>
                              : {detail.message}
                            </li>
                          ))}
                        </ul>
                      )}
                      {result.rawResponse && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-red-400/60 hover:text-red-400">
                            View raw AI response
                          </summary>
                          <pre className="mt-2 overflow-x-auto rounded bg-red-950/30 p-2 text-xs text-red-300/70">
                            {result.rawResponse}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
