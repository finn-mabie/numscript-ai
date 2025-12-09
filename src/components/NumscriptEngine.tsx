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
  ChevronDown,
  ChevronRight,
  Database,
  FileCode,
  PenLine,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CodeBlock } from "@/components/ui/code-block";
import { ChartEditor } from "@/components/ui/chart-editor";
import { ChartBuilder } from "@/components/ui/chart-builder";
import { Toggle } from "@/components/ui/toggle";
import { TemplateSelector } from "@/components/ui/template-selector";
import { SimulationPanel } from "@/components/ui/simulation-panel";
import { DEFAULT_CHART_YAML, parseChartYaml } from "@/lib/chart-of-accounts";
import { CHART_PRESETS, type TransactionTemplate, type ChartPreset } from "@/lib/templates";
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

const CUSTOM_CHART_YAML = `# Your Chart of Accounts
# Add accounts using the form above

world:
  description: "Unlimited source"
  paths:
    source: "world"
`;

export function NumscriptEngine() {
  const [prompt, setPrompt] = React.useState("");
  const [chartYaml, setChartYaml] = React.useState(DEFAULT_CHART_YAML);
  const [selectedPreset, setSelectedPreset] = React.useState<string>("stablecoin-issuance");
  const [showChartEditor, setShowChartEditor] = React.useState(false);
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
  };

  const handleChartPresetSelect = (preset: ChartPreset) => {
    setChartYaml(preset.yaml);
    setSelectedPreset(preset.id);
    setShowChartEditor(false);
    setResult(null);
    setPrompt("");
  };

  const handleBuildYourOwn = () => {
    setChartYaml(CUSTOM_CHART_YAML);
    setSelectedPreset("custom");
    setShowChartEditor(true);
    setResult(null);
    setPrompt("");
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Step 1: Chart of Accounts */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold">
            1
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <Database className="h-5 w-5" />
              Choose Your Chart of Accounts
            </h2>
            <p className="text-sm text-zinc-500">Select an industry model to define your account structure</p>
          </div>
        </div>

        {/* Chart Preset Cards */}
        <div className="grid gap-3 sm:grid-cols-4">
          {CHART_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleChartPresetSelect(preset)}
              className={`group relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
                selectedPreset === preset.id
                  ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/50"
                  : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50"
              }`}
            >
              {selectedPreset === preset.id && (
                <div className="absolute top-3 right-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
              )}
              <h3 className={`font-semibold ${selectedPreset === preset.id ? "text-emerald-400" : "text-zinc-200"}`}>
                {preset.name}
              </h3>
              <p className="text-xs text-zinc-500 line-clamp-2">{preset.description}</p>
            </button>
          ))}
          
          {/* Build Your Own Option */}
          <button
            onClick={handleBuildYourOwn}
            className={`group relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
              selectedPreset === "custom"
                ? "border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/50"
                : "border-dashed border-zinc-700 bg-zinc-900/20 hover:border-zinc-600 hover:bg-zinc-900/40"
            }`}
          >
            {selectedPreset === "custom" && (
              <div className="absolute top-3 right-3">
                <CheckCircle2 className="h-5 w-5 text-purple-400" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <PenLine className={`h-4 w-4 ${selectedPreset === "custom" ? "text-purple-400" : "text-zinc-500"}`} />
              <h3 className={`font-semibold ${selectedPreset === "custom" ? "text-purple-400" : "text-zinc-400"}`}>
                Build Your Own
              </h3>
            </div>
            <p className="text-xs text-zinc-500 line-clamp-2">Create a custom chart of accounts</p>
          </button>
        </div>

        {/* Custom: Show ChartBuilder | Presets: Show toggle for raw YAML */}
        {selectedPreset === "custom" ? (
          <div className="rounded-xl border border-purple-500/30 bg-purple-950/10 p-4">
            <ChartBuilder value={chartYaml} onChange={setChartYaml} />
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowChartEditor(!showChartEditor)}
              className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
            >
              {showChartEditor ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Settings2 className="h-3 w-3" />
              <span>Edit chart YAML</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${isChartValid ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                {isChartValid ? "Valid" : "Invalid"}
              </span>
            </button>

            {showChartEditor && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                <ChartEditor value={chartYaml} onChange={setChartYaml} />
              </div>
            )}
          </>
        )}
      </section>

      {/* Step 2: Transaction Templates */}
      {selectedPreset !== "custom" && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-sm font-bold">
              2
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                Test an Example Transaction
              </h2>
              <p className="text-sm text-zinc-500">
                Choose an example transaction or write your own below
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
            <TemplateSelector 
              onSelect={handleTemplateSelect} 
              selectedChartPreset={selectedPreset}
            />
          </div>
        </section>
      )}

      {/* Step 3 (or 2 if custom): Generate */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 text-sm font-bold">
              {selectedPreset === "custom" ? "2" : "3"}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Generate Numscript
              </h2>
              <p className="text-sm text-zinc-500">Edit the prompt if needed, then generate</p>
            </div>
          </div>
          <Toggle
            checked={explainMode}
            onChange={setExplainMode}
            label="Explain Mode"
            description="Get explanations"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Panel - Input */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Terminal className="h-4 w-4" />
              <span className="text-sm font-medium">Natural Language Input</span>
            </div>

            <Textarea
              placeholder="Describe your financial transaction in plain English...

e.g., &quot;Transfer $100 from client user_123 to merchant acme with 2% fee&quot;"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 min-h-[160px]"
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
                    Select a template or enter a description above.
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
      </section>

      {/* Step 4: Simulate */}
      {result?.success && result.numscript && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold">
              {selectedPreset === "custom" ? "3" : "4"}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <Play className="h-5 w-5" />
                Simulate Transaction
              </h2>
              <p className="text-sm text-zinc-500">
                Set initial balances and run the script to see resulting postings
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
            <SimulationPanel numscript={result.numscript} />
          </div>
        </section>
      )}
    </div>
  );
}
