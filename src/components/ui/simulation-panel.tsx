"use client";

import * as React from "react";
import {
  Play,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BalanceEntry {
  id: string;
  account: string;
  asset: string;
  amount: number;
}

interface Posting {
  source: string;
  destination: string;
  amount: string;
  asset: string;
}

interface SimulationResult {
  success: boolean;
  postings?: Posting[];
  metadata?: Record<string, unknown>;
  initialBalances?: Record<string, Record<string, number>>;
  finalBalances?: Record<string, Record<string, number>>;
  error?: string;
}

interface SimulationPanelProps {
  numscript: string;
  className?: string;
}

export function SimulationPanel({ numscript, className }: SimulationPanelProps) {
  const [balances, setBalances] = React.useState<BalanceEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<SimulationResult | null>(null);

  // Extract accounts from numscript and calculate exact amounts needed
  React.useEffect(() => {
    if (!numscript) {
      setBalances([]);
      return;
    }

    // Pattern to match: send [ASSET/SCALE AMOUNT] ( source = @account
    // We need to capture the asset, amount, and account
    const sendPattern = /send\s+\[([A-Z0-9]+\/\d+)\s+(\d+|\*)\]\s*\(\s*source\s*=\s*@([a-zA-Z0-9_:$-]+)/g;
    
    // Map: account -> Map<asset, totalAmount>
    const accountNeeds = new Map<string, Map<string, number>>();
    
    let match;
    while ((match = sendPattern.exec(numscript)) !== null) {
      const asset = match[1];
      const amountStr = match[2];
      const account = match[3];
      
      // Skip world and variables
      if (account === "world" || account.startsWith("$")) continue;
      
      // Skip wildcard amounts (*)
      if (amountStr === "*") continue;
      
      const amount = parseInt(amountStr, 10);
      
      if (!accountNeeds.has(account)) {
        accountNeeds.set(account, new Map());
      }
      
      const assetMap = accountNeeds.get(account)!;
      const currentAmount = assetMap.get(asset) || 0;
      assetMap.set(asset, currentAmount + amount);
    }

    // Convert to balance entries
    const entries: BalanceEntry[] = [];
    let id = 0;
    
    for (const [account, assetMap] of accountNeeds) {
      for (const [asset, amount] of assetMap) {
        entries.push({
          id: `balance-${id++}`,
          account,
          asset,
          amount, // Exact amount needed
        });
      }
    }

    setBalances(entries);
    setResult(null);
  }, [numscript]);

  const addBalance = () => {
    setBalances([
      ...balances,
      {
        id: `balance-${Date.now()}`,
        account: "",
        asset: "USD/2",
        amount: 0,
      },
    ]);
  };

  const removeBalance = (id: string) => {
    setBalances(balances.filter((b) => b.id !== id));
  };

  const updateBalance = (id: string, field: keyof BalanceEntry, value: string | number) => {
    setBalances(
      balances.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
  };

  const runSimulation = async () => {
    if (!numscript) return;

    setIsLoading(true);
    setResult(null);

    try {
      const balanceMap: Record<string, Record<string, number>> = {};
      for (const entry of balances) {
        if (!entry.account) continue;
        if (!balanceMap[entry.account]) {
          balanceMap[entry.account] = {};
        }
        balanceMap[entry.account][entry.asset] = entry.amount;
      }

      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: numscript,
          balances: balanceMap,
          vars: {},
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Simulation failed",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (amount: number | string, asset: string) => {
    const numAmount = typeof amount === "string" ? parseInt(amount, 10) : amount;
    const scale = parseInt(asset.split("/")[1] || "2", 10);
    const currency = asset.split("/")[0];
    const formatted = (numAmount / Math.pow(10, scale)).toLocaleString(undefined, {
      minimumFractionDigits: Math.min(scale, 2),
      maximumFractionDigits: scale,
    });
    return `${currency} ${formatted}`;
  };

  // Build unified table data combining initial and final balances
  const buildTableData = () => {
    if (!result?.success || !result.finalBalances) return [];
    
    const rows: Array<{
      account: string;
      asset: string;
      initial: number;
      final: number;
      diff: number;
    }> = [];

    // Get all accounts from both initial and final
    const allAccounts = new Set([
      ...Object.keys(result.initialBalances || {}),
      ...Object.keys(result.finalBalances),
    ]);

    for (const account of allAccounts) {
      const initialAssets = result.initialBalances?.[account] || {};
      const finalAssets = result.finalBalances[account] || {};
      const allAssets = new Set([...Object.keys(initialAssets), ...Object.keys(finalAssets)]);

      for (const asset of allAssets) {
        const initial = initialAssets[asset] || 0;
        const final = finalAssets[asset] || 0;
        rows.push({
          account,
          asset,
          initial,
          final,
          diff: final - initial,
        });
      }
    }

    return rows;
  };

  const tableData = buildTableData();

  return (
    <div className={cn("space-y-5", className)}>
      {/* Initial Balances Input */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-300">Set Initial Balances</h3>
          <button
            onClick={addBalance}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Account
          </button>
        </div>

        {balances.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-sm text-zinc-600">
            No accounts detected. Add accounts to set initial balances.
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-900/80">
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Account</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-zinc-500 uppercase tracking-wider w-24">Asset</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider w-32">Amount</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {balances.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-3 py-2">
                      <div className="flex items-center">
                        <span className="text-cyan-600 mr-1">@</span>
                        <input
                          type="text"
                          value={entry.account}
                          onChange={(e) => updateBalance(entry.id, "account", e.target.value)}
                          placeholder="account:path"
                          className="w-full bg-transparent text-sm text-zinc-200 font-mono placeholder:text-zinc-700 focus:outline-none"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.asset}
                        onChange={(e) => updateBalance(entry.id, "asset", e.target.value)}
                        className="w-full bg-zinc-800/50 rounded px-2 py-1 text-xs text-zinc-400 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-600/50 text-center"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.amount}
                        onChange={(e) => updateBalance(entry.id, "amount", parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-zinc-800/50 rounded px-2 py-1 text-sm text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-600/50 text-right"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => removeBalance(entry.id)}
                        className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Run Button */}
      <Button
        onClick={runSimulation}
        disabled={!numscript || isLoading || balances.length === 0}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Simulating...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            Run Simulation
          </>
        )}
      </Button>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {result.success ? (
            <>
              {/* Success indicator */}
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Simulation Complete</span>
              </div>

              {/* Results Table */}
              <div className="rounded-lg border border-zinc-800 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-zinc-900/80">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Account</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Initial</th>
                      <th className="px-4 py-3 text-center text-[11px] font-semibold text-zinc-400 uppercase tracking-wider w-8"></th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Final</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {tableData.map((row, i) => (
                      <tr 
                        key={`${row.account}-${row.asset}`} 
                        className={cn(
                          "transition-colors",
                          i % 2 === 0 ? "bg-zinc-900/30" : "bg-transparent"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm text-zinc-200 font-mono">
                              <span className="text-cyan-500">@</span>{row.account}
                            </span>
                            <span className="text-[10px] text-zinc-600 mt-0.5">{row.asset}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-zinc-400 font-mono">
                            {formatAmount(row.initial, row.asset)}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <ArrowRight className="h-3.5 w-3.5 text-zinc-600 inline" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-zinc-200 font-mono font-medium">
                            {formatAmount(row.final, row.asset)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            "text-sm font-mono font-medium",
                            row.diff > 0 ? "text-emerald-400" : row.diff < 0 ? "text-red-400" : "text-zinc-600"
                          )}>
                            {row.diff > 0 ? "+" : ""}{formatAmount(row.diff, row.asset)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Simulation Failed</p>
                  <p className="text-sm text-red-300/70 mt-1">{result.error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
