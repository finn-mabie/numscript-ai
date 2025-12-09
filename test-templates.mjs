/**
 * Test script to run templates through the Numscript AI engine
 * Tests all three chart presets with natural language prompts including metadata
 * 
 * Run: node test-templates.mjs
 */

const API_URL = "http://localhost:3000/api/generate";

// ============================================================
// CHART PRESETS
// ============================================================

const CHARTS = {
  cardAcquiring: `# Card Acquiring
acquirers:
  description: "Acquirer authorization promises (assets)"
  paths:
    main: "acquirers:$acquirer_id:main"
banks:
  description: "Bank settlement accounts (assets)"
  paths:
    main: "banks:$bank_id:main"
clients:
  description: "Client wallet balances (liabilities)"
  paths:
    main: "clients:$client_id:main"
platform:
  description: "Platform operational accounts"
  paths:
    fees: "platform:$platform:fees"
    revenue: "platform:$platform:revenue"
    chargeback_fees: "platform:$platform:chargeback_fees"
world:
  paths:
    source: "world"`,

  cardIssuing: `# Card Issuing (Debit)
cardholder:
  description: "Cardholder accounts"
  paths:
    main: "cardholder:$account_id:main"
    hold: "cardholder:$account_id:hold:$authorization_id"
    refund_pending: "cardholder:$account_id:refund:pending:$refund_auth_id"
schemes:
  description: "Card scheme liability accounts"
  paths:
    main: "schemes:$scheme_id:main"
    chargeback: "schemes:$scheme_id:chargeback"
banks:
  description: "Bank reserve accounts (assets)"
  paths:
    main: "banks:$bank_id:main"
platform:
  paths:
    fees: "platform:$platform:fees"
    revenue: "platform:$platform:revenue"
world:
  paths:
    source: "world"`,

  stablecoin: `# Stablecoin Issuance
psp:
  description: "Payment Service Provider accounts"
  paths:
    main: "psp:$psp_id:main"
banks:
  description: "Bank reserve accounts"
  paths:
    main: "banks:$bank_id:main"
    withdrawal: "banks:$bank_id:withdrawal:$transfer_ref"
blockchain:
  description: "Blockchain supply tracking"
  paths:
    circulating: "blockchain:$network:circulating"
    mint_in_flight: "blockchain:$network:mint_in_flight"
    burn_in_flight: "blockchain:$network:burn_in_flight"
clients:
  description: "Client stablecoin balances"
  paths:
    stablecoin: "clients:$client_id:stablecoin"
platform:
  paths:
    pivot: "platform:pivot:stablecoin_issuance"
    payment_fees: "platform:expenses:payment_fees"
    backing: "platform:reserves:backing_stablecoins"
    pending_withdrawal: "platform:reserves:pending_withdrawal"
world:
  paths:
    source: "world"`,
};

// ============================================================
// TEST CASES - Natural language prompts with metadata
// ============================================================

const TEST_CASES = [
  // CARD ACQUIRING
  {
    id: "CA_1_AUTH",
    name: "[Card Acquiring] Authorization with Metadata",
    chart: "cardAcquiring",
    prompt: "Process card authorization of $75 EUR for client user_123 from acquirer stripe. Add metadata for the transaction type as card_authorization and authorization_id as AUTH-2024-001.",
    expectedPatterns: ["send", "[EUR/2 7500]", "@acquirers:stripe:main", "@clients:user_123:main", "allowing unbounded overdraft", "set_tx_meta"],
  },
  {
    id: "CA_2_REFUND",
    name: "[Card Acquiring] Refund with Metadata",
    chart: "cardAcquiring",
    prompt: "Process refund of $50 EUR from client user_123 back to acquirer stripe. Set the transaction type to refund, refund_id to REF-001, and original_authorization_id to AUTH-2024-001.",
    expectedPatterns: ["send", "[EUR/2 5000]", "@clients:user_123:main", "@acquirers:stripe:main", "set_tx_meta"],
    forbiddenPatterns: ["overdraft"],
  },
  {
    id: "CA_3_SETTLEMENT",
    name: "[Card Acquiring] Settlement with Fees",
    chart: "cardAcquiring",
    prompt: "Settle $9,700 EUR net from bank iban_main to acquirer stripe. Platform acme covers $300 in processing fees. Add metadata for type as acquirer_settlement and settlement_ref as SETTLE-2024-001.",
    expectedPatterns: ["send", "@banks:iban_main:main", "@acquirers:stripe:main", "@platform:acme:fees", "set_tx_meta"],
  },

  // CARD ISSUING
  {
    id: "CI_1_AUTH_HOLD",
    name: "[Card Issuing] Authorization Hold with Overdraft",
    chart: "cardIssuing",
    prompt: "Create authorization hold of $100 USD for cardholder acc_123 with auth ID AUTH-001. Allow overdraft up to $50 if needed. Record the transaction type as authorization.",
    expectedPatterns: ["send", "[USD/2 10000]", "@cardholder:acc_123:main", "@cardholder:acc_123:hold:AUTH-001", "overdraft up to", "set_tx_meta"],
  },
  {
    id: "CI_2_AUTH_REVERSAL",
    name: "[Card Issuing] Authorization Reversal",
    chart: "cardIssuing",
    prompt: "Reverse authorization AUTH-001 for $100 USD for cardholder acc_123. Record this as a reversal with reversal_id REV-001.",
    expectedPatterns: ["send", "[USD/2 10000]", "@cardholder:acc_123:hold:AUTH-001", "@cardholder:acc_123:main", "set_tx_meta"],
  },
  {
    id: "CI_3_PRESENTMENT",
    name: "[Card Issuing] Presentment/Clearing",
    chart: "cardIssuing",
    prompt: "Clear $100 USD from cardholder acc_123 auth AUTH-001 to scheme visa. Record presentment_id as PRES-001.",
    expectedPatterns: ["send", "[USD/2 10000]", "@cardholder:acc_123:hold:AUTH-001", "@schemes:visa:main", "set_tx_meta"],
  },
  {
    id: "CI_4_OFFLINE",
    name: "[Card Issuing] Offline Transaction",
    chart: "cardIssuing",
    prompt: "Process offline transaction of $50 USD for cardholder acc_123 to scheme visa. Allow unbounded overdraft since there's no prior auth. Set authorization_mode to offline.",
    expectedPatterns: ["send", "[USD/2 5000]", "@cardholder:acc_123:main", "@schemes:visa:main", "unbounded overdraft", "set_tx_meta"],
  },

  // STABLECOIN ISSUANCE
  {
    id: "SC_1_ONRAMP",
    name: "[Stablecoin] On-Ramp Payment & Credit",
    chart: "stablecoin",
    prompt: "Process a $100 USD payment from PSP stripe and immediately credit 100 USDC (USDC/6 = 100000000 units) to client user_123. Record authorization_id as AUTH-PSP-001 and type as payment_stablecoin_credit.",
    expectedPatterns: ["send", "@psp:stripe:main", "@clients:user_123:stablecoin", "set_tx_meta"],
  },
  {
    id: "SC_2_BURN",
    name: "[Stablecoin] Burn Instruction",
    chart: "stablecoin",
    prompt: "Client user_123 wants to withdraw. Lock 100 USDC from their balance to burn_in_flight on ethereum. Record the burn_tx_hash as 0xdef789 and client_id.",
    expectedPatterns: ["send", "@clients:user_123:stablecoin", "@blockchain:ethereum:burn_in_flight", "set_tx_meta"],
  },
  {
    id: "SC_3_FIAT_WITHDRAWAL",
    name: "[Stablecoin] Fiat Withdrawal",
    chart: "stablecoin",
    prompt: "Withdraw $100 USD for client user_123. Move from pending_withdrawal to bank iban_main withdrawal account with transfer_ref TRF-001.",
    expectedPatterns: ["send", "[USD/2 10000]", "@platform:reserves:pending_withdrawal", "@banks:iban_main:withdrawal:TRF-001", "set_tx_meta"],
  },
];

async function runTest(testCase) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`TEST: ${testCase.name}`);
  console.log(`${"=".repeat(70)}`);
  console.log(`\nPrompt: "${testCase.prompt}"\n`);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: testCase.prompt,
        chartYaml: CHARTS[testCase.chart],
        explainMode: false,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.log(`❌ FAILED: ${data.error || "Unknown error"}`);
      if (data.lastError) console.log(`   Last error: ${data.lastError}`);
      if (data.attempts) console.log(`   Attempts: ${data.attempts}`);
      if (data.lastNumscript) {
        console.log(`\n   Last generated Numscript:\n`);
        console.log(data.lastNumscript.split('\n').map(l => `   ${l}`).join('\n'));
      }
      return { passed: false, error: data.error || data.lastError, testCase };
    }

    console.log(`✅ Generated (${data.attempts || 1} attempt${data.attempts > 1 ? 's' : ''}):`);
    console.log("```numscript");
    console.log(data.numscript);
    console.log("```\n");

    const numscript = data.numscript;
    const issues = [];

    // Check required patterns
    const missingPatterns = (testCase.expectedPatterns || []).filter(
      (p) => !numscript.includes(p)
    );
    if (missingPatterns.length > 0) {
      issues.push(`Missing patterns: ${missingPatterns.join(", ")}`);
    }

    // Check forbidden patterns
    const foundForbidden = (testCase.forbiddenPatterns || []).filter(
      (p) => numscript.includes(p)
    );
    if (foundForbidden.length > 0) {
      issues.push(`Forbidden patterns found: ${foundForbidden.join(", ")}`);
    }

    if (issues.length > 0) {
      console.log(`⚠️ ISSUES:`);
      issues.forEach((i) => console.log(`   - ${i}`));
      return { passed: false, issues, numscript, testCase };
    }

    console.log(`✅ All checks passed!`);
    return { passed: true, numscript, testCase };
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { passed: false, error: error.message, testCase };
  }
}

async function main() {
  console.log("🚀 Numscript AI Template Tests\n");
  console.log(`API: ${API_URL}`);
  console.log(`Tests: ${TEST_CASES.length}`);
  console.log(`Charts: Card Acquiring, Card Issuing, Stablecoin Issuance\n`);

  const results = [];

  for (const testCase of TEST_CASES) {
    const result = await runTest(testCase);
    results.push(result);
    await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  console.log(`\n\n${"=".repeat(70)}`);
  console.log("SUMMARY");
  console.log(`${"=".repeat(70)}\n`);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log(`\nFailed tests:`);
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        const reason = r.error || r.issues?.join("; ") || "Unknown";
        console.log(`  - ${r.testCase.name}: ${reason}`);
      });
  }

  console.log("\n");
  process.exit(failed > 0 ? 1 : 0);
}

main();
