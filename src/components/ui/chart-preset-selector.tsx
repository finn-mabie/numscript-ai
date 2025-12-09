"use client";

import * as React from "react";
import { CreditCard, Store, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHART_PRESETS, type ChartPreset } from "@/lib/templates";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "credit-card": CreditCard,
  "store": Store,
  "wallet": Wallet,
};

interface ChartPresetSelectorProps {
  onSelect: (preset: ChartPreset) => void;
  className?: string;
}

export function ChartPresetSelector({ onSelect, className }: ChartPresetSelectorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs text-zinc-500">Load an industry preset:</p>
      <div className="flex flex-wrap gap-2">
        {CHART_PRESETS.map((preset) => {
          const Icon = ICON_MAP[preset.icon] || CreditCard;
          return (
            <button
              key={preset.id}
              onClick={() => onSelect(preset)}
              className="group flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-left transition-all hover:border-emerald-500/50 hover:bg-zinc-800"
            >
              <Icon className="h-4 w-4 text-zinc-500 group-hover:text-emerald-400" />
              <div>
                <span className="text-sm font-medium text-zinc-300">{preset.name}</span>
                <span className="ml-2 text-xs text-zinc-500">{preset.description}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
