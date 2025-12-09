"use client";

import * as React from "react";
import {
  CreditCard,
  ShieldCheck,
  Banknote,
  RotateCcw,
  CheckCircle,
  FileText,
  CircleCheck,
  AlertTriangle,
  CircleDollarSign,
  Percent,
  ArrowRightLeft,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TRANSACTION_TEMPLATES, type TransactionTemplate } from "@/lib/templates";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "credit-card": CreditCard,
  "shield-check": ShieldCheck,
  "banknote": Banknote,
  "rotate-ccw": RotateCcw,
  "check-circle": CheckCircle,
  "file-text": FileText,
  "circle-check": CircleCheck,
  "alert-triangle": AlertTriangle,
  "circle-dollar-sign": CircleDollarSign,
  "percent": Percent,
  "arrow-right-left": ArrowRightLeft,
  "check-check": CheckCheck,
};

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  setup: { label: "Setup", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  authorization: { label: "Authorization", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  clearing: { label: "Clearing", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  billing: { label: "Billing", color: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
  settlement: { label: "Settlement", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
};

interface TemplateSelectorProps {
  onSelect: (template: TransactionTemplate) => void;
  className?: string;
}

export function TemplateSelector({ onSelect, className }: TemplateSelectorProps) {
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);

  const categories = [...new Set(TRANSACTION_TEMPLATES.map((t) => t.category))];
  
  const filteredTemplates = selectedCategory
    ? TRANSACTION_TEMPLATES.filter((t) => t.category === selectedCategory)
    : TRANSACTION_TEMPLATES;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
            !selectedCategory
              ? "bg-zinc-700 border-zinc-600 text-white"
              : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600"
          )}
        >
          All
        </button>
        {categories.map((cat) => {
          const { label, color } = CATEGORY_LABELS[cat] || { label: cat, color: "" };
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                selectedCategory === cat
                  ? color
                  : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Templates Grid */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => {
          const Icon = ICON_MAP[template.icon] || CreditCard;
          const { label, color } = CATEGORY_LABELS[template.category] || {};
          
          return (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="group flex flex-col items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-left transition-all hover:border-emerald-500/50 hover:bg-zinc-900/50"
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 transition-colors group-hover:bg-emerald-500/20 group-hover:text-emerald-400">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", color)}>
                  {label}
                </span>
              </div>
              <div>
                <h4 className="font-medium text-zinc-200 text-sm leading-tight">
                  {template.name}
                </h4>
                <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">
                  {template.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
