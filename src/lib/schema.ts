import { z } from "zod";

/**
 * Zod Schema for Numscript Intent
 * Supports limited overdraft, max (capped) amounts in splits, and transaction metadata.
 */

const SplitRuleSchema = z.object({
  target: z.string().describe("Account path - must be a string"),
  amount_mode: z.enum(["fraction", "max", "remaining"]).describe("fraction for %, max for capped amounts, remaining for leftover"),
  value: z.string().describe("'5%' for fraction, '1000' (cents) for max, '' for remaining"),
});

const PostingSchema = z.object({
  source: z.string().describe("Account path or 'world'"),
  source_overdraft: z.enum(["none", "unbounded", "limited"]).default("none"),
  overdraft_limit: z.string().optional().describe("Amount in cents if source_overdraft is 'limited'"),
  destination_type: z.enum(["simple", "split"]),
  simple_destination: z.string().optional().describe("Account path if destination_type is 'simple'"),
  split_rules: z
    .array(SplitRuleSchema)
    .optional()
    .describe("Split rules if destination_type is 'split'"),
  asset: z.string().default("USD/2").describe("Asset notation e.g. USD/2"),
  amount: z.string().describe("Amount in smallest unit (cents for USD), or '*' for entire balance"),
});

const MetadataSchema = z.object({
  key: z.string().describe("Metadata key name"),
  value: z.string().describe("Metadata value (string)"),
});

export const NumscriptIntentSchema = z.object({
  summary: z.string().describe("Brief description of the transaction"),
  postings: z.array(PostingSchema).min(1),
  metadata: z.array(MetadataSchema).optional().describe("Transaction metadata key-value pairs"),
});

export type SplitRule = z.infer<typeof SplitRuleSchema>;
export type Posting = z.infer<typeof PostingSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type NumscriptIntent = z.infer<typeof NumscriptIntentSchema>;

export function validateIntent(data: unknown): NumscriptIntent {
  return NumscriptIntentSchema.parse(data);
}

export function safeValidateIntent(data: unknown):
  | { success: true; data: NumscriptIntent }
  | { success: false; error: z.ZodError } {
  const result = NumscriptIntentSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
