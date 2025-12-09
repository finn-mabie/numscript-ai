"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

/**
 * Applies syntax highlighting to Numscript code
 */
function highlightNumscript(code: string): React.ReactNode[] {
  const lines = code.split("\n");
  
  return lines.map((line, lineIndex) => {
    // Comment lines
    if (line.trim().startsWith("//")) {
      return (
        <div key={lineIndex} className="comment">
          {line}
        </div>
      );
    }

    // Tokenize and highlight
    const tokens: React.ReactNode[] = [];
    let remaining = line;
    let keyCounter = 0;

    const patterns: Array<{ regex: RegExp; className: string }> = [
      { regex: /^(send|source|destination|allowing|unbounded|overdraft|remaining|to)(?=\s|$|=)/, className: "keyword" },
      { regex: /^(@[\w:]+)/, className: "account" },
      { regex: /^\[([^\]]+)\]/, className: "amount" },
      { regex: /^(\{|\}|\(|\))/, className: "bracket" },
      { regex: /^(=|%)/, className: "operator" },
      { regex: /^(\d+%?)/, className: "amount" },
    ];

    while (remaining.length > 0) {
      let matched = false;

      // Try each pattern
      for (const { regex, className } of patterns) {
        const match = remaining.match(regex);
        if (match) {
          tokens.push(
            <span key={`${lineIndex}-${keyCounter++}`} className={className}>
              {match[0]}
            </span>
          );
          remaining = remaining.slice(match[0].length);
          matched = true;
          break;
        }
      }

      // If no pattern matched, consume whitespace or single character
      if (!matched) {
        const wsMatch = remaining.match(/^\s+/);
        if (wsMatch) {
          tokens.push(<span key={`${lineIndex}-${keyCounter++}`}>{wsMatch[0]}</span>);
          remaining = remaining.slice(wsMatch[0].length);
        } else {
          tokens.push(<span key={`${lineIndex}-${keyCounter++}`}>{remaining[0]}</span>);
          remaining = remaining.slice(1);
        }
      }
    }

    return <div key={lineIndex}>{tokens}</div>;
  });
}

export function CodeBlock({ code, language = "numscript", className }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightedCode = language === "numscript" ? highlightNumscript(code) : code;

  return (
    <div className={cn("relative group", className)}>
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-zinc-700 bg-zinc-800/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-zinc-600" />
            <div className="h-3 w-3 rounded-full bg-zinc-600" />
            <div className="h-3 w-3 rounded-full bg-zinc-600" />
          </div>
          <span className="ml-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
            {language}
          </span>
        </div>
        <button
          onClick={copyToClipboard}
          className="flex h-7 items-center gap-1.5 rounded-md bg-zinc-700/50 px-2.5 text-xs text-zinc-400 transition-all hover:bg-zinc-700 hover:text-zinc-200"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      
      {/* Code */}
      <pre className="overflow-x-auto rounded-b-xl border border-zinc-700 bg-zinc-900/80 p-4">
        <code className="numscript-code text-sm leading-relaxed">
          {highlightedCode}
        </code>
      </pre>
    </div>
  );
}

