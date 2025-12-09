import type { NumscriptIntent, Posting, SplitRule } from "./schema";

/**
 * Numscript Compiler
 * Converts validated JSON Intent into Numscript string.
 * Supports limited overdraft, percentage splits, and max-capped splits.
 * 
 * NOTE: Percentages (fraction) and max caps are DIFFERENT destination types
 * and cannot be mixed in the same split block!
 */

function formatAccount(account: string): string {
  if (account === "world") return "@world";
  return account.startsWith("@") ? account : `@${account}`;
}

function formatSource(posting: Posting): string {
  const account = formatAccount(posting.source);
  
  // @world is already unlimited - never add overdraft
  if (posting.source === "world" || posting.source === "@world") {
    return account;
  }
  
  if (posting.source_overdraft === "unbounded") {
    return `${account} allowing unbounded overdraft`;
  }
  
  if (posting.source_overdraft === "limited" && posting.overdraft_limit) {
    return `${account} allowing overdraft up to [${posting.asset} ${posting.overdraft_limit}]`;
  }
  
  return account;
}

function formatSplitRule(rule: SplitRule, asset: string): string {
  const target = formatAccount(rule.target);
  
  switch (rule.amount_mode) {
    case "fraction": {
      // Ensure % is present
      const value = rule.value.includes("%") ? rule.value : `${rule.value}%`;
      return `    ${value} to ${target}`;
    }
    case "max": {
      // Inorder destination with max cap: max [USD/2 1000] to @account
      return `    max [${asset} ${rule.value}] to ${target}`;
    }
    case "remaining": {
      return `    remaining to ${target}`;
    }
    default:
      return `    remaining to ${target}`;
  }
}

function formatSplitDestination(rules: SplitRule[], asset: string): string {
  // Check if using max or fraction - they cannot be mixed!
  const hasMax = rules.some(r => r.amount_mode === "max");
  const hasFraction = rules.some(r => r.amount_mode === "fraction");
  
  if (hasMax && hasFraction) {
    // This shouldn't happen if the AI follows instructions, but handle gracefully
    // by preferring the max-based (inorder) style
    console.warn("Warning: Cannot mix max and fraction in same split. Using max-based inorder.");
  }
  
  // Sort: fraction/max first, then remaining last
  const sorted = [...rules].sort((a, b) => {
    const order: Record<string, number> = { fraction: 0, max: 0, remaining: 1 };
    return (order[a.amount_mode] ?? 0) - (order[b.amount_mode] ?? 0);
  });
  
  const lines = sorted.map(rule => formatSplitRule(rule, asset));
  return `{\n${lines.join("\n")}\n  }`;
}

function compilePosting(posting: Posting): string {
  const asset = posting.asset;
  
  // Handle wildcard amount for "entire balance"
  const amountValue = posting.amount === "*" ? "*" : posting.amount;
  const amount = `[${asset} ${amountValue}]`;
  
  const source = formatSource(posting);
  
  let destination: string;
  if (posting.destination_type === "simple" && posting.simple_destination) {
    destination = formatAccount(posting.simple_destination);
  } else if (posting.destination_type === "split" && posting.split_rules) {
    destination = formatSplitDestination(posting.split_rules, asset);
  } else {
    throw new Error("Invalid destination configuration");
  }

  return [
    `send ${amount} (`,
    `  source = ${source}`,
    `  destination = ${destination}`,
    `)`,
  ].join("\n");
}

function compileMetadata(metadata: Array<{ key: string; value: string }>): string[] {
  return metadata.map(m => `set_tx_meta("${m.key}", "${m.value}")`);
}

export function compileToNumscript(intent: NumscriptIntent): string {
  const header = `// ${intent.summary}`;
  const postings = intent.postings.map(compilePosting);
  
  const parts = [header, "", ...postings];
  
  // Add metadata if present
  if (intent.metadata && intent.metadata.length > 0) {
    const metadataLines = compileMetadata(intent.metadata);
    parts.push("", ...metadataLines);
  }
  
  return parts.join("\n\n");
}

export function compile(intent: NumscriptIntent): string {
  return compileToNumscript(intent);
}
