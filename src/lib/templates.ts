/**
 * Transaction Templates and Chart of Accounts Presets
 * All templates are based on real-world Formance use cases.
 */

export interface TransactionTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "setup" | "authorization" | "clearing" | "billing" | "settlement" | "refund" | "onramp" | "offramp";
  chartPreset?: string;
  prompt: string;
  exampleNumscript: string;
}

export const TRANSACTION_TEMPLATES: TransactionTemplate[] = [
  // ============================================================
  // CARD ACQUIRING - Templates
  // ============================================================
  
  {
    id: "CARD_AUTH",
    name: "Card Authorization",
    description: "Credit client wallet from acquirer on card authorization",
    icon: "credit-card",
    category: "authorization",
    chartPreset: "card-acquiring",
    prompt: `1. Process a $75 EUR card authorization from acquirer stripe
2. Credit the funds to client user_123
3. Set metadata: type = card_authorization, authorization_id = AUTH-2024-001`,
    exampleNumscript: `send [EUR/2 7500] (
  source = @acquirers:stripe:main allowing unbounded overdraft
  destination = @clients:user_123:main
)
set_tx_meta("type", "card_authorization")
set_tx_meta("authorization_id", "AUTH-2024-001")`,
  },
  {
    id: "CARD_REFUND",
    name: "Card Refund",
    description: "Debit client and credit acquirer for refund",
    icon: "rotate-ccw",
    category: "refund",
    chartPreset: "card-acquiring",
    prompt: `1. Process a $50 EUR refund from client user_123
2. Send the funds back to acquirer stripe
3. Set metadata: type = refund, refund_id = REF-001, original_authorization_id = AUTH-2024-001`,
    exampleNumscript: `send [EUR/2 5000] (
  source = @clients:user_123:main
  destination = @acquirers:stripe:main
)
set_tx_meta("type", "refund")
set_tx_meta("refund_id", "REF-001")
set_tx_meta("original_authorization_id", "AUTH-2024-001")`,
  },
  {
    id: "ACQUIRER_SETTLEMENT",
    name: "Acquirer Settlement",
    description: "Settle acquirer balance from bank with fee handling",
    icon: "banknote",
    category: "settlement",
    chartPreset: "card-acquiring",
    prompt: `1. Settle $9,700 EUR net from bank iban_main to acquirer stripe
2. Platform acme covers $300 EUR in processing fees
3. Set metadata: type = acquirer_settlement, settlement_ref = SETTLE-2024-001`,
    exampleNumscript: `send [EUR/2 970000] (
  source = @banks:iban_main:main allowing unbounded overdraft
  destination = @acquirers:stripe:main
)
send [EUR/2 30000] (
  source = @platform:acme:fees allowing unbounded overdraft
  destination = @acquirers:stripe:main
)
set_tx_meta("type", "acquirer_settlement")
set_tx_meta("settlement_ref", "SETTLE-2024-001")`,
  },
  {
    id: "CHARGEBACK",
    name: "Chargeback",
    description: "Process chargeback with fee handling",
    icon: "alert-triangle",
    category: "refund",
    chartPreset: "card-acquiring",
    prompt: `1. Process a $100 EUR chargeback from client user_123 to acquirer stripe
2. Platform acme pays $15 EUR chargeback fee to acquirer
3. Set metadata: type = chargeback, chargeback_id = CB-001, original_authorization_id = AUTH-2024-001`,
    exampleNumscript: `send [EUR/2 10000] (
  source = @clients:user_123:main allowing unbounded overdraft
  destination = @acquirers:stripe:main
)
send [EUR/2 1500] (
  source = @platform:acme:chargeback_fees allowing unbounded overdraft
  destination = @acquirers:stripe:main
)
set_tx_meta("type", "chargeback")
set_tx_meta("chargeback_id", "CB-001")
set_tx_meta("original_authorization_id", "AUTH-2024-001")`,
  },

  // ============================================================
  // CARD ISSUING (Debit) - Templates
  // ============================================================
  
  {
    id: "AUTH_HOLD",
    name: "Authorization Hold",
    description: "Move funds from main to hold account",
    icon: "shield-check",
    category: "authorization",
    chartPreset: "card-issuing",
    prompt: `1. Create a $100 USD authorization hold for cardholder acc_123
2. Move funds from main to hold account AUTH-001
3. Allow overdraft up to $50 if needed
4. Set metadata: type = authorization, authorization_id = AUTH-001`,
    exampleNumscript: `send [USD/2 10000] (
  source = @cardholder:acc_123:main allowing overdraft up to [USD/2 5000]
  destination = @cardholder:acc_123:hold:AUTH-001
)
set_tx_meta("type", "authorization")
set_tx_meta("authorization_id", "AUTH-001")`,
  },
  {
    id: "AUTH_REVERSAL",
    name: "Authorization Reversal",
    description: "Release held funds back to main",
    icon: "rotate-ccw",
    category: "authorization",
    chartPreset: "card-issuing",
    prompt: `1. Reverse authorization AUTH-001 for cardholder acc_123
2. Release $100 USD from hold back to main account
3. Set metadata: type = authorization_reversal, authorization_id = AUTH-001, reversal_id = REV-001`,
    exampleNumscript: `send [USD/2 10000] (
  source = @cardholder:acc_123:hold:AUTH-001
  destination = @cardholder:acc_123:main
)
set_tx_meta("type", "authorization_reversal")
set_tx_meta("authorization_id", "AUTH-001")
set_tx_meta("reversal_id", "REV-001")`,
  },
  {
    id: "HOLD_REVERSAL_FULL",
    name: "Full Hold Release",
    description: "Release all remaining funds from expired hold",
    icon: "rotate-ccw",
    category: "authorization",
    chartPreset: "card-issuing",
    prompt: `1. Release all remaining funds from expired auth AUTH-001
2. Move entire balance (*) from hold to cardholder acc_123 main
3. Set metadata: type = hold_expiry, authorization_id = AUTH-001`,
    exampleNumscript: `send [USD/2 *] (
  source = @cardholder:acc_123:hold:AUTH-001
  destination = @cardholder:acc_123:main
)
set_tx_meta("type", "hold_expiry")
set_tx_meta("authorization_id", "AUTH-001")`,
  },
  {
    id: "PRESENTMENT",
    name: "Presentment/Clearing",
    description: "Move from hold to scheme liability",
    icon: "check-circle",
    category: "clearing",
    chartPreset: "card-issuing",
    prompt: `1. Clear $100 USD from cardholder acc_123 hold AUTH-001
2. Send to scheme visa
3. Set metadata: type = presentment, authorization_id = AUTH-001, presentment_id = PRES-001`,
    exampleNumscript: `send [USD/2 10000] (
  source = @cardholder:acc_123:hold:AUTH-001
  destination = @schemes:visa:main
)
set_tx_meta("type", "presentment")
set_tx_meta("authorization_id", "AUTH-001")
set_tx_meta("presentment_id", "PRES-001")`,
  },
  {
    id: "PRESENTMENT_WITH_TIP",
    name: "Presentment with Tip",
    description: "Clear with additional tip amount from main",
    icon: "check-circle",
    category: "clearing",
    chartPreset: "card-issuing",
    prompt: `1. Clear $100 USD from auth hold AUTH-001 to scheme visa
2. Add $20 USD tip from cardholder acc_123 main balance to scheme visa
3. Set metadata: type = presentment_with_tip, authorization_id = AUTH-001, presentment_id = PRES-001, tip_amount = 2000`,
    exampleNumscript: `send [USD/2 10000] (
  source = @cardholder:acc_123:hold:AUTH-001
  destination = @schemes:visa:main
)
send [USD/2 2000] (
  source = @cardholder:acc_123:main
  destination = @schemes:visa:main
)
set_tx_meta("type", "presentment_with_tip")
set_tx_meta("authorization_id", "AUTH-001")
set_tx_meta("presentment_id", "PRES-001")
set_tx_meta("tip_amount", "2000")`,
  },
  {
    id: "OFFLINE_PRESENTMENT",
    name: "Offline Transaction",
    description: "Presentment without prior authorization",
    icon: "check-circle",
    category: "clearing",
    chartPreset: "card-issuing",
    prompt: `1. Process $50 USD offline transaction for cardholder acc_123
2. Send to scheme visa (allow unbounded overdraft since no prior auth)
3. Set metadata: type = offline_presentment, presentment_id = PRES-OFFLINE-001, authorization_mode = offline`,
    exampleNumscript: `send [USD/2 5000] (
  source = @cardholder:acc_123:main allowing unbounded overdraft
  destination = @schemes:visa:main
)
set_tx_meta("type", "offline_presentment")
set_tx_meta("presentment_id", "PRES-OFFLINE-001")
set_tx_meta("authorization_mode", "offline")`,
  },
  {
    id: "REFUND_AUTHORIZATION",
    name: "Refund Authorization",
    description: "Credit to pending refund account",
    icon: "rotate-ccw",
    category: "refund",
    chartPreset: "card-issuing",
    prompt: `1. Authorize $50 USD refund for cardholder acc_123
2. Credit from scheme visa to pending refund account REF-AUTH-001
3. Set metadata: type = refund_authorization, refund_auth_id = REF-AUTH-001, refund_status = pending`,
    exampleNumscript: `send [USD/2 5000] (
  source = @schemes:visa:main allowing unbounded overdraft
  destination = @cardholder:acc_123:refund:pending:REF-AUTH-001
)
set_tx_meta("type", "refund_authorization")
set_tx_meta("refund_auth_id", "REF-AUTH-001")
set_tx_meta("refund_status", "pending")`,
  },
  {
    id: "REFUND_POSTING",
    name: "Refund Posting",
    description: "Release refund to cardholder main",
    icon: "rotate-ccw",
    category: "refund",
    chartPreset: "card-issuing",
    prompt: `1. Post $50 USD refund REF-AUTH-001 for cardholder acc_123
2. Move from pending refund to main account
3. Set metadata: type = refund_posting, refund_auth_id = REF-AUTH-001, refund_posting_id = POST-001, refund_status = completed`,
    exampleNumscript: `send [USD/2 5000] (
  source = @cardholder:acc_123:refund:pending:REF-AUTH-001
  destination = @cardholder:acc_123:main
)
set_tx_meta("type", "refund_posting")
set_tx_meta("refund_auth_id", "REF-AUTH-001")
set_tx_meta("refund_posting_id", "POST-001")
set_tx_meta("refund_status", "completed")`,
  },
  {
    id: "CHARGEBACK_ACCEPTANCE",
    name: "Chargeback Acceptance",
    description: "Credit cardholder from scheme chargeback",
    icon: "alert-triangle",
    category: "refund",
    chartPreset: "card-issuing",
    prompt: `1. Accept chargeback CB-001 for $100 USD
2. Credit cardholder acc_123 from scheme visa chargeback account
3. Set metadata: type = chargeback_acceptance, chargeback_id = CB-001, original_presentment_id = PRES-001, chargeback_status = accepted`,
    exampleNumscript: `send [USD/2 10000] (
  source = @schemes:visa:chargeback allowing unbounded overdraft
  destination = @cardholder:acc_123:main
)
set_tx_meta("type", "chargeback_acceptance")
set_tx_meta("chargeback_id", "CB-001")
set_tx_meta("original_presentment_id", "PRES-001")
set_tx_meta("chargeback_status", "accepted")`,
  },
  {
    id: "SECOND_PRESENTMENT",
    name: "Second Presentment",
    description: "Chargeback reversal - debit cardholder",
    icon: "alert-triangle",
    category: "refund",
    chartPreset: "card-issuing",
    prompt: `1. Reverse chargeback CB-001 via second presentment
2. Debit $100 USD from cardholder acc_123 to scheme visa
3. Allow unbounded overdraft
4. Set metadata: type = second_presentment, chargeback_id = CB-001, second_presentment_id = SP-001, chargeback_status = reversed`,
    exampleNumscript: `send [USD/2 10000] (
  source = @cardholder:acc_123:main allowing unbounded overdraft
  destination = @schemes:visa:main
)
set_tx_meta("type", "second_presentment")
set_tx_meta("chargeback_id", "CB-001")
set_tx_meta("second_presentment_id", "SP-001")
set_tx_meta("chargeback_status", "reversed")`,
  },
  {
    id: "STIP_ADVICE",
    name: "STIP Advice",
    description: "Stand-In Processing during issuer downtime",
    icon: "alert-triangle",
    category: "clearing",
    chartPreset: "card-issuing",
    prompt: `1. Process STIP advice for $75 USD (approved during issuer downtime)
2. Debit cardholder acc_123 to scheme visa
3. Allow unbounded overdraft
4. Set metadata: type = stip_advice, stip_advice_id = STIP-001, authorization_mode = stand_in`,
    exampleNumscript: `send [USD/2 7500] (
  source = @cardholder:acc_123:main allowing unbounded overdraft
  destination = @schemes:visa:main
)
set_tx_meta("type", "stip_advice")
set_tx_meta("stip_advice_id", "STIP-001")
set_tx_meta("authorization_mode", "stand_in")`,
  },

  // ============================================================
  // STABLECOIN ISSUANCE - Templates
  // ============================================================
  
  {
    id: "ONRAMP_PAYMENT_CREDIT",
    name: "On-Ramp: Payment & Credit",
    description: "Receive fiat payment, credit stablecoin to user",
    icon: "banknote",
    category: "onramp",
    chartPreset: "stablecoin-issuance",
    prompt: `1. Receive $100 USD payment from PSP stripe to pivot account
2. Credit 100 USDC (USDC/6 = 100000000 units) from pivot to client user_123
3. Set metadata: type = payment_stablecoin_credit, authorization_id = AUTH-PSP-001, client_id = user_123`,
    exampleNumscript: `send [USD/2 10000] (
  source = @psp:stripe:main allowing unbounded overdraft
  destination = @platform:pivot:stablecoin_issuance
)
send [USDC/6 100000000] (
  source = @platform:pivot:stablecoin_issuance allowing unbounded overdraft
  destination = @clients:user_123:stablecoin
)
set_tx_meta("type", "payment_stablecoin_credit")
set_tx_meta("authorization_id", "AUTH-PSP-001")
set_tx_meta("client_id", "user_123")`,
  },
  {
    id: "MINT_INSTRUCTION",
    name: "On-Ramp: Mint Instruction",
    description: "Track blockchain mint in-flight",
    icon: "banknote",
    category: "onramp",
    chartPreset: "stablecoin-issuance",
    prompt: `1. Initiate mint of 100 USDC (USDC/6 = 100000000 units) on ethereum
2. Track as in-flight from mint_in_flight to pivot account
3. Set metadata: type = mint_instruction, mint_tx_hash = 0xabc123def456, network = ethereum`,
    exampleNumscript: `send [USDC/6 100000000] (
  source = @blockchain:ethereum:mint_in_flight allowing unbounded overdraft
  destination = @platform:pivot:stablecoin_issuance
)
set_tx_meta("type", "mint_instruction")
set_tx_meta("mint_tx_hash", "0xabc123def456")
set_tx_meta("network", "ethereum")`,
  },
  {
    id: "MINT_CONFIRMATION",
    name: "On-Ramp: Mint Confirmation",
    description: "Confirm mint, add to circulating supply",
    icon: "check-circle",
    category: "onramp",
    chartPreset: "stablecoin-issuance",
    prompt: `1. Confirm mint of 100 USDC on ethereum at block 12345678
2. Clear in-flight by moving from circulating to mint_in_flight
3. Set metadata: type = mint_confirmation, mint_tx_hash = 0xabc123def456, block_number = 12345678, network = ethereum`,
    exampleNumscript: `send [USDC/6 100000000] (
  source = @blockchain:ethereum:circulating allowing unbounded overdraft
  destination = @blockchain:ethereum:mint_in_flight
)
set_tx_meta("type", "mint_confirmation")
set_tx_meta("mint_tx_hash", "0xabc123def456")
set_tx_meta("block_number", "12345678")
set_tx_meta("network", "ethereum")`,
  },
  {
    id: "PSP_SETTLEMENT",
    name: "On-Ramp: PSP Settlement",
    description: "Settle net amount from bank, platform covers fees",
    icon: "banknote",
    category: "settlement",
    chartPreset: "stablecoin-issuance",
    prompt: `1. Settle $97 USD net from bank iban_main to pivot account
2. Platform covers $3 USD payment fee to PSP stripe
3. Set metadata: type = psp_settlement, settlement_ref = SETTLE-PSP-001`,
    exampleNumscript: `send [USD/2 9700] (
  source = @banks:iban_main:main allowing unbounded overdraft
  destination = @platform:pivot:stablecoin_issuance
)
send [USD/2 300] (
  source = @platform:expenses:payment_fees allowing unbounded overdraft
  destination = @psp:stripe:main
)
set_tx_meta("type", "psp_settlement")
set_tx_meta("settlement_ref", "SETTLE-PSP-001")`,
  },
  {
    id: "BURN_INSTRUCTION",
    name: "Off-Ramp: Burn Instruction",
    description: "Lock user's stablecoins for burn",
    icon: "banknote",
    category: "offramp",
    chartPreset: "stablecoin-issuance",
    prompt: `1. Lock 100 USDC (USDC/6 = 100000000 units) from client user_123 for withdrawal
2. Move to burn_in_flight on ethereum network
3. Set metadata: type = burn_instruction, burn_tx_hash = 0xdef789, client_id = user_123, network = ethereum`,
    exampleNumscript: `send [USDC/6 100000000] (
  source = @clients:user_123:stablecoin
  destination = @blockchain:ethereum:burn_in_flight
)
set_tx_meta("type", "burn_instruction")
set_tx_meta("burn_tx_hash", "0xdef789")
set_tx_meta("client_id", "user_123")
set_tx_meta("network", "ethereum")`,
  },
  {
    id: "BURN_CONFIRMATION",
    name: "Off-Ramp: Burn Confirmation",
    description: "Confirm burn, release fiat from backing",
    icon: "check-circle",
    category: "offramp",
    chartPreset: "stablecoin-issuance",
    prompt: `1. Confirm burn of 100 USDC on ethereum at block 12345680
2. Clear burn_in_flight to circulating
3. Release $100 USD from backing_stablecoins to pending_withdrawal
4. Set metadata: type = burn_confirmation, burn_tx_hash = 0xdef789, block_number = 12345680, client_id = user_123`,
    exampleNumscript: `send [USDC/6 100000000] (
  source = @blockchain:ethereum:burn_in_flight
  destination = @blockchain:ethereum:circulating
)
send [USD/2 10000] (
  source = @platform:reserves:backing_stablecoins
  destination = @platform:reserves:pending_withdrawal
)
set_tx_meta("type", "burn_confirmation")
set_tx_meta("burn_tx_hash", "0xdef789")
set_tx_meta("block_number", "12345680")
set_tx_meta("client_id", "user_123")`,
  },
  {
    id: "FIAT_WITHDRAWAL",
    name: "Off-Ramp: Fiat Withdrawal",
    description: "Initiate bank transfer to client",
    icon: "banknote",
    category: "offramp",
    chartPreset: "stablecoin-issuance",
    prompt: `1. Withdraw $100 USD for client user_123
2. Move from pending_withdrawal to bank iban_main withdrawal account TRF-001
3. Set metadata: type = fiat_withdrawal, transfer_ref = TRF-001, client_id = user_123`,
    exampleNumscript: `send [USD/2 10000] (
  source = @platform:reserves:pending_withdrawal
  destination = @banks:iban_main:withdrawal:TRF-001
)
set_tx_meta("type", "fiat_withdrawal")
set_tx_meta("transfer_ref", "TRF-001")
set_tx_meta("client_id", "user_123")`,
  },
];

// ============================================================
// Chart of Accounts Presets
// ============================================================

export interface ChartPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  yaml: string;
}

export const CHART_PRESETS: ChartPreset[] = [
  {
    id: "stablecoin-issuance",
    name: "Stablecoin Issuance",
    description: "On-ramp/off-ramp with PSP and blockchain",
    icon: "banknote",
    yaml: `# Stablecoin Issuance Platform
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
`,
  },
  {
    id: "card-acquiring",
    name: "Card Acquiring",
    description: "Payment processing with acquirers and client wallets",
    icon: "credit-card",
    yaml: `# Card Acquiring / Payment Processing
# Real-time authorization with settlement flow

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
  description: "Unlimited source"
  paths:
    source: "world"
`,
  },
  {
    id: "card-issuing",
    name: "Card Issuing (Debit)",
    description: "Full card issuing with auth holds, presentments, refunds",
    icon: "credit-card",
    yaml: `# Card Issuing (Debit Card Model)
# Authorization holds, presentments, refunds, chargebacks

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
  description: "Platform operational accounts"
  paths:
    fees: "platform:$platform:fees"
    revenue: "platform:$platform:revenue"
    chargeback_fees: "platform:$platform:chargeback_fees"

world:
  description: "Unlimited source"
  paths:
    source: "world"
`,
  },
];
