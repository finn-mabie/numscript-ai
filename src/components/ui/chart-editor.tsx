"use client";

import * as React from "react";
import { Upload, FileText, Check, AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { parseChartYaml, DEFAULT_CHART_YAML } from "@/lib/chart-of-accounts";

interface ChartEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ChartEditor({ value, onChange, className }: ChartEditorProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [isValid, setIsValid] = React.useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Validate on change
  React.useEffect(() => {
    if (!value.trim()) {
      setError(null);
      setIsValid(false);
      return;
    }
    
    const result = parseChartYaml(value);
    if (result.success) {
      setError(null);
      setIsValid(true);
    } else {
      setError(result.error);
      setIsValid(false);
    }
  }, [value]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onChange(content);
    };
    reader.readAsText(file);
    
    // Reset input so same file can be uploaded again
    e.target.value = "";
  };

  const handleReset = () => {
    onChange(DEFAULT_CHART_YAML);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-400">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">Chart of Accounts (YAML)</span>
          {isValid && value.trim() && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Check className="h-3 w-3" />
              Valid
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 px-2 text-xs"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-7 px-2 text-xs"
          >
            <Upload className="h-3 w-3" />
            Upload YAML
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Editor */}
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full min-h-[300px] rounded-xl border bg-zinc-900/50 px-4 py-3 font-mono text-sm text-zinc-300 shadow-sm transition-colors placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:border-transparent resize-none",
            error
              ? "border-red-500/50 focus-visible:ring-red-500"
              : "border-zinc-700 focus-visible:ring-emerald-500"
          )}
          placeholder="# Enter your Chart of Accounts in YAML format..."
          spellCheck={false}
        />
        
        {/* Line numbers gutter effect */}
        <div className="absolute left-0 top-0 w-10 h-full rounded-l-xl bg-zinc-800/50 pointer-events-none" />
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-zinc-600">
        Define account groups with paths. Use <code className="bg-zinc-800 px-1 rounded">$id</code> as a placeholder for dynamic IDs.
      </p>
    </div>
  );
}

