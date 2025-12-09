import yaml from "js-yaml";
import { z } from "zod";

/**
 * Chart of Accounts Schema
 * Validates the YAML structure for account definitions.
 */

const AccountPathSchema = z.record(z.string(), z.string());

const AccountGroupSchema = z.object({
  description: z.string().optional(),
  paths: AccountPathSchema,
});

export const ChartOfAccountsSchema = z.record(z.string(), AccountGroupSchema);

export type ChartOfAccounts = z.infer<typeof ChartOfAccountsSchema>;

/**
 * Default example Chart of Accounts
 */
export const DEFAULT_CHART_YAML = `# Stablecoin Issuance Platform
# On-ramp (fiat→stablecoin), Off-ramp (stablecoin→fiat)

psp:
  description: "Payment Service Provider accounts (assets)"
  paths:
    main: "psp:$psp_id:main"

banks:
  description: "Bank reserve accounts (assets)"
  paths:
    main: "banks:$bank_id:main"
    withdrawal: "banks:$bank_id:withdrawal:$transfer_ref"

blockchain:
  description: "Blockchain supply tracking (liabilities)"
  paths:
    circulating: "blockchain:$network:circulating"
    mint_in_flight: "blockchain:$network:mint_in_flight"
    burn_in_flight: "blockchain:$network:burn_in_flight"

clients:
  description: "Client stablecoin balances (liabilities)"
  paths:
    stablecoin: "clients:$client_id:stablecoin"

platform:
  description: "Platform operational accounts"
  paths:
    pivot: "platform:pivot:stablecoin_issuance"
    gas_fees: "platform:expenses:gas_fees"
    payment_fees: "platform:expenses:payment_fees"
    transaction_fees: "platform:revenue:transaction_fees"
    backing: "platform:reserves:backing_stablecoins"
    pending_withdrawal: "platform:reserves:pending_withdrawal"

world:
  description: "Unlimited source"
  paths:
    source: "world"
`;

/**
 * Parses YAML string into ChartOfAccounts
 */
export function parseChartYaml(yamlString: string): {
  success: true;
  data: ChartOfAccounts;
} | {
  success: false;
  error: string;
} {
  try {
    const parsed = yaml.load(yamlString);
    const validated = ChartOfAccountsSchema.parse(parsed);
    return { success: true, data: validated };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation error: ${err.errors.map((e) => e.message).join(", ")}`,
      };
    }
    if (err instanceof Error && err.name === "YAMLException") {
      return { success: false, error: `YAML syntax error: ${err.message}` };
    }
    return { success: false, error: "Unknown parsing error" };
  }
}

/**
 * Formats ChartOfAccounts as context string for AI prompt
 */
export function formatChartForPrompt(chart: ChartOfAccounts): string {
  const lines: string[] = ["## Chart of Accounts (Strict Mapping)", ""];

  for (const [groupName, group] of Object.entries(chart)) {
    const title = groupName.charAt(0).toUpperCase() + groupName.slice(1);
    lines.push(`### ${title}`);
    if (group.description) {
      lines.push(`_${group.description}_`);
    }
    for (const [pathName, pathTemplate] of Object.entries(group.paths)) {
      lines.push(`- ${pathTemplate} → ${pathName}`);
    }
    lines.push("");
  }

  lines.push("**Rules:**");
  lines.push("- Replace $id with the actual identifier from user input");
  lines.push('- "user 123" or "cardholder 123" → use the cardholders group with id=123');
  lines.push('- "fees" or "platform fees" → platform:revenue:fees');
  lines.push('- When no ID specified for banks, use "main" as default');

  return lines.join("\n");
}

/**
 * Extracts all valid account paths from a Chart of Accounts
 */
export function extractAccountPaths(chart: ChartOfAccounts): string[] {
  const paths: string[] = [];
  for (const group of Object.values(chart)) {
    for (const path of Object.values(group.paths)) {
      paths.push(path);
    }
  }
  return paths;
}
