/**
 * Enfuce Credit Card Lifecycle Templates
 * Real-world credit card processing flow with advanced Numscript features.
 */

export interface TransactionTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "setup" | "authorization" | "clearing" | "billing" | "settlement";
  prompt: string;
  exampleNumscript: string;
}

export const TRANSACTION_TEMPLATES: TransactionTemplate[] = [
  // Setup
  {
    id: "ASSIGN_CREDIT_LIMIT",
    name: "Assign Credit Limit",
    description: "Create credit limit for a new cardholder using CREDIT/2 asset",
    icon: "credit-card",
    category: "setup",
    prompt: "Assign a $5,000 credit limit to cardholder account 12345 from platform acme_bank. Card number is 4111-XXXX-1234, approval reference CR-2024-001.",
    exampleNumscript: `vars {
  asset $asset
  number $credit_limit
  account $account_id
  account $platform_name
  string $card_number
  string $credit_approval_reference
}
send [CREDIT/2 $credit_limit](
  source = @platform:$platform_name:credit_grants allowing unbounded overdraft
  destination = @cardholder:$account_id:credit_line
)
set_tx_meta("card_number", $card_number)
set_tx_meta("credit_approval_reference", $credit_approval_reference)`,
  },

  // Authorization
  {
    id: "AUTHORIZATION_STANDARD",
    name: "Standard Authorization",
    description: "Authorization request - validates balance and creates pending hold",
    icon: "shield-check",
    category: "authorization",
    prompt: "Authorize $150 EUR for cardholder 12345. Authorization ID is AUTH-98765, card 4111-XXXX-1234. Transaction details: Amazon purchase.",
    exampleNumscript: `vars {
  asset $asset
  number $amount
  account $account_id
  number $credit_line = get_amount(balance(@cardholder:$account_id:credit_line, CREDIT/2))
  number $current = get_amount(overdraft(@cardholder:$account_id:current, $asset))
  number $credit_limit = $credit_line - $current 
  string $authorization_id
  string $card_number
  string $trx_details
}
send [$asset $amount] (
  source = @cardholder:$account_id:available allowing overdraft up to [$asset $credit_limit]
  destination = @cardholder:$account_id:pending:$authorization_id
)
set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("card_number", $card_number)
set_tx_meta("trx_details", $trx_details)
set_tx_meta("transaction_type", "authorization")
set_tx_meta("interest_bearing", "false")`,
  },
  {
    id: "AUTHORIZATION_ATM_WITH_FEE",
    name: "ATM Authorization with Fee",
    description: "ATM withdrawal with 1.5% markup fee, interest-bearing",
    icon: "banknote",
    category: "authorization",
    prompt: "ATM authorization for $200 EUR for cardholder 12345 with 1.5% fee ($3). Auth ID ATM-55555, card 4111-XXXX-1234.",
    exampleNumscript: `vars {
  asset $asset
  number $amount
  number $fee_amount
  account $account_id
  number $credit_line = get_amount(balance(@cardholder:$account_id:credit_line, CREDIT/2))
  number $current = get_amount(overdraft(@cardholder:$account_id:current, EUR/2))
  number $credit_limit = $credit_line - $current 
  string $authorization_id
  string $card_number
  string $trx_details
}
send [$asset $amount] (
  source = @cardholder:$account_id:available allowing overdraft up to [$asset $credit_limit]
  destination = @cardholder:$account_id:pending:$authorization_id
)
send [$asset $fee_amount] (
  source = @cardholder:$account_id:available allowing overdraft up to [$asset $credit_limit]
  destination = @cardholder:$account_id:fees:markup
)
set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("transaction_type", "authorization_atm")
set_tx_meta("fee_rate", "1.5%")
set_tx_meta("interest_bearing", "true")`,
  },
  {
    id: "AUTHORIZATION_REVERSAL",
    name: "Authorization Reversal",
    description: "Release authorization hold back to available balance",
    icon: "rotate-ccw",
    category: "authorization",
    prompt: "Reverse authorization AUTH-98765 for $150 EUR for cardholder 12345. Reversal ID REV-11111.",
    exampleNumscript: `vars {
  asset $asset
  number $amount
  account $account_id
  string $authorization_id
  string $reversal_id
  string $trx_details
}
send [$asset $amount] (
  source = @cardholder:$account_id:pending:$authorization_id
  destination = @cardholder:$account_id:available
)
set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("reversal_id", $reversal_id)
set_tx_meta("transaction_type", "authorization_reversal")`,
  },

  // Clearing
  {
    id: "CLEARING_STANDARD",
    name: "Standard Clearing",
    description: "Clearing file received - closes auth and books cleared transaction",
    icon: "check-circle",
    category: "clearing",
    prompt: "Clear $148.50 EUR for cardholder 12345, auth AUTH-98765. Clearing ref CLR-77777, scheme visa_eu.",
    exampleNumscript: `vars {
  asset $asset
  number $cleared_amount
  account $account_id
  string $authorization_id
  number $credit_line = get_amount(balance(@cardholder:$account_id:credit_line, CREDIT/2))
  number $current = get_amount(overdraft(@cardholder:$account_id:current, $asset))
  number $credit_limit = $credit_line - $current           
  string $clearing_reference
  account $scheme_id
  string $trx_details
}
send [$asset *] (
  source = @cardholder:$account_id:pending:$authorization_id
  destination = @cardholder:$account_id:available
)
send [$asset $cleared_amount] (
  source = @cardholder:$account_id:available allowing overdraft up to [$asset $credit_limit]
  destination = @cardholder:$account_id:current
)     
send [$asset $cleared_amount] (
  source = @cardholder:$account_id:current
  destination = @schemes:$scheme_id:main
)
set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("clearing_reference", $clearing_reference)
set_tx_meta("transaction_type", "clearing")`,
  },

  // Billing
  {
    id: "BILLING_CYCLE_CLOSE",
    name: "Close Billing Cycle",
    description: "End of billing period - generate invoice from current cycle",
    icon: "file-text",
    category: "billing",
    prompt: "Close billing cycle for cardholder 12345 with $1,250 EUR due. Invoice INV-2024-001, platform acme_bank, billing period 2024-01, due date 2024-02-15.",
    exampleNumscript: `vars {
  asset $asset
  account $account_id
  number $due_amount = get_amount(overdraft(@cardholder:$account_id:available,$asset))
  number $credit_line = get_amount(balance(@cardholder:$account_id:credit_line, CREDIT/2))
  number $interest_amount = get_amount(balance(@cardholder:$account_id:interest:posted, $asset))
  string $invoice_id
  string $platform_name
  string $billing_period
  string $due_date
}
send [$asset $due_amount] (
  source = @cardholder:$account_id:current allowing overdraft up to [$asset $credit_line]
  destination = @cardholder:$account_id:available
)
send [$asset $due_amount] (
  source = @cardholder:$account_id:billed:$invoice_id allowing unbounded overdraft
  destination = @cardholder:$account_id:billed
)
send [$asset $interest_amount] (
  source= @cardholder:$account_id:billed:$invoice_id allowing unbounded overdraft
  destination = @cardholder:$account_id:billed
)    
send [$asset *] (
  source = @cardholder:$account_id:fees:markup
  destination = @platform:$platform_name:revenue
)
set_tx_meta("invoice_id", $invoice_id)
set_tx_meta("billing_period", $billing_period)
set_tx_meta("due_date", $due_date)
set_tx_meta("transaction_type", "billing_cycle_close")`,
  },
  {
    id: "INVOICE_PAID",
    name: "Invoice Payment",
    description: "Invoice payment received - clear AR/AP and current receivable",
    icon: "circle-check",
    category: "billing",
    prompt: "Payment of $1,250 EUR received for cardholder 12345, invoice INV-2024-001. Bank account bank_main, payment ref PAY-99999, platform acme_bank.",
    exampleNumscript: `vars {
  asset $asset
  number $amount
  account $platform_name
  account $account_id
  number $open_interest_amount = get_amount(overdraft(@platform:$platform_name:interest:$account_id, $asset))
  string $invoice_id
  account $bank_number
  string $payment_reference
}
send [$asset $amount](
  source = @banks:$bank_number:main allowing unbounded overdraft
  destination = {
    max [$asset $open_interest_amount] to @platform:$platform_name:interest:$account_id
    remaining to @cardholder:$account_id:current 
  }
)
send [$asset $amount](
  source = @cardholder:$account_id:billed
  destination = @cardholder:$account_id:billed:$invoice_id
)           
set_tx_meta("invoice_id", $invoice_id)
set_tx_meta("payment_reference", $payment_reference)`,
  },
  {
    id: "INVOICE_OVERDUE",
    name: "Invoice Overdue",
    description: "Invoice past due - move to overdue and start interest accrual",
    icon: "alert-triangle",
    category: "billing",
    prompt: "Mark invoice INV-2024-001 as overdue for cardholder 12345. Amount $1,250 EUR, overdue date 2024-02-16.",
    exampleNumscript: `vars {
  asset $asset
  account $account_id
  string $invoice_id
  string $overdue_date
  number $invoice_amount = get_amount(overdraft(@cardholder:$account_id:billed:$invoice_id, EUR/2))
}
send [$asset $invoice_amount] (
  source = @cardholder:$account_id:overdue allowing unbounded overdraft
  destination = @cardholder:$account_id:billed:$invoice_id
)
set_tx_meta("invoice_id", $invoice_id)
set_tx_meta("overdue_date", $overdue_date)
set_tx_meta("transaction_type", "invoice_overdue")`,
  },
  {
    id: "OVERDUE_INVOICE_PAYMENT",
    name: "Overdue Invoice Payment",
    description: "Overdue invoice payment - stop interest accrual",
    icon: "circle-dollar-sign",
    category: "billing",
    prompt: "Receive $1,300 EUR payment for overdue invoice INV-2024-001, cardholder 12345. Bank bank_main, platform acme_bank, ref PAY-LATE-001.",
    exampleNumscript: `vars {
  asset $asset
  number $amount
  number $open_interest_amount = get_amount(overdraft(@platform:$platform_name:interest:$account_id, $asset))
  account $account_id
  account $bank_number
  account $platform_name
  string $payment_reference
  string $invoice_id
}
send [$asset $amount] (
  source = @banks:$bank_number:main allowing unbounded overdraft
  destination = {
    max [$asset $open_interest_amount] to @platform:$platform_name:interest:$account_id
    remaining to @cardholder:$account_id:current
  }
)
send [$asset $amount](
  source = @cardholder:$account_id:billed
  destination = @cardholder:$account_id:overdue
)   
set_tx_meta("payment_reference", $payment_reference)
set_tx_meta("invoice_id", $invoice_id)
set_tx_meta("transaction_type", "invoice_payment")`,
  },
  {
    id: "INTEREST_ACCRUAL_POST",
    name: "Post Interest",
    description: "Post accumulated overdue interest to current cycle",
    icon: "percent",
    category: "billing",
    prompt: "Post $45.50 EUR interest for cardholder 12345, platform acme_bank. Interest period 2024-01, calculated at 18% APR on $1,250 overdue.",
    exampleNumscript: `vars {
  asset $asset
  number $interest_amount
  account $account_id
  account $platform_name
  string $interest_period
  string $calculation_details
}
send [$asset $interest_amount] (
  source = @cardholder:$account_id:interest:accrued allowing unbounded overdraft
  destination = @cardholder:$account_id:interest:posted
)
send [$asset $interest_amount] (
  source = @cardholder:$account_id:overdue allowing unbounded overdraft
  destination = @cardholder:$account_id:interest:accrued
)
send [$asset $interest_amount] (
  source = @platform:$platform_name:interest:$account_id allowing unbounded overdraft
  destination = @platform:$platform_name:revenue
)
set_tx_meta("interest_period", $interest_period)
set_tx_meta("interest_amount", $interest_amount)
set_tx_meta("transaction_type", "interest_posting")`,
  },

  // Settlement
  {
    id: "SCHEME_SETTLEMENT_PREPARE",
    name: "Scheme Settlement Prepare",
    description: "Daily settlement from scheme to bank - preparation",
    icon: "arrow-right-left",
    category: "settlement",
    prompt: "Prepare settlement of $50,000 EUR from scheme visa_eu to bank bank_main. Settlement ref SETT-2024-001, date 2024-01-15.",
    exampleNumscript: `vars {
  asset $asset
  number $settlement_amount
  account $bank_number
  account $scheme_id
  string $settlement_reference
  string $settlement_date
}
send [$asset $settlement_amount] (
  source = @schemes:$scheme_id:main
  destination = @banks:$bank_number:payout:$settlement_reference
)
set_tx_meta("settlement_reference", $settlement_reference)
set_tx_meta("settlement_date", $settlement_date)
set_tx_meta("transaction_type", "scheme_settlement")`,
  },
  {
    id: "SCHEME_SETTLEMENT_CONFIRM",
    name: "Scheme Settlement Confirm",
    description: "Daily settlement from scheme to bank - confirmation",
    icon: "check-check",
    category: "settlement",
    prompt: "Confirm settlement of $50,000 EUR from payout to bank main. Settlement ref SETT-2024-001, date 2024-01-15.",
    exampleNumscript: `vars {
  asset $asset
  number $settlement_amount
  account $bank_number
  account $scheme_id
  string $settlement_reference
  string $settlement_date
}
send [$asset $settlement_amount] (
  source = @banks:$bank_number:payout:$settlement_reference
  destination = @banks:$bank_number:main
)
set_tx_meta("settlement_reference", $settlement_reference)
set_tx_meta("settlement_date", $settlement_date)
set_tx_meta("transaction_type", "scheme_settlement")`,
  },
];

/**
 * Chart of Accounts Presets - Updated for Credit Card Processing
 */
export interface ChartPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  yaml: string;
}

export const CHART_PRESETS: ChartPreset[] = [
  {
    id: "credit-card-issuing",
    name: "Credit Card Issuing",
    description: "Full credit card lifecycle - Enfuce model",
    icon: "credit-card",
    yaml: `# Credit Card Issuing - Enfuce Model
# Complete lifecycle: setup, auth, clearing, billing, settlement

cardholders:
  description: "Cardholder accounts"
  paths:
    available: "cardholder:$id:available"
    current: "cardholder:$id:current"
    credit_line: "cardholder:$id:credit_line"
    pending: "cardholder:$id:pending:$auth_id"
    billed: "cardholder:$id:billed"
    billed_invoice: "cardholder:$id:billed:$invoice_id"
    overdue: "cardholder:$id:overdue"
    fees_markup: "cardholder:$id:fees:markup"
    interest_accrued: "cardholder:$id:interest:accrued"
    interest_posted: "cardholder:$id:interest:posted"

platform:
  description: "Platform/Issuer accounts"
  paths:
    credit_grants: "platform:$platform:credit_grants"
    revenue: "platform:$platform:revenue"
    interest: "platform:$platform:interest:$account_id"

schemes:
  description: "Card scheme accounts (Visa, MC)"
  paths:
    main: "schemes:$scheme:main"

banks:
  description: "Bank settlement accounts"
  paths:
    main: "banks:$bank:main"
    payout: "banks:$bank:payout:$ref"

world:
  description: "Unlimited source"
  paths:
    source: "world"
`,
  },
  {
    id: "marketplace",
    name: "Marketplace",
    description: "Buyers, sellers, escrow, splits",
    icon: "store",
    yaml: `# Marketplace Chart of Accounts

customers:
  description: "Buyer accounts"
  paths:
    wallet: "customer:$id:wallet"
    pending: "customer:$id:pending"

sellers:
  description: "Seller/merchant accounts"
  paths:
    available: "seller:$id:available"
    pending: "seller:$id:pending"
    payouts: "seller:$id:payouts"

escrow:
  description: "Order escrow accounts"
  paths:
    holding: "escrow:order:$id"

platform:
  description: "Platform accounts"
  paths:
    fees: "platform:revenue:fees"
    refunds: "platform:expenses:refunds"

world:
  description: "Unlimited source"
  paths:
    source: "world"
`,
  },
  {
    id: "simple-wallets",
    name: "Simple Wallets",
    description: "Basic wallet system with fees",
    icon: "wallet",
    yaml: `# Simple Wallet System

users:
  description: "User wallet accounts"
  paths:
    available: "user:$id:available"
    pending: "user:$id:pending"
    cashback: "user:$id:cashback"

merchants:
  description: "Merchant accounts"
  paths:
    main: "merchant:$id:main"

platform:
  description: "Platform accounts"
  paths:
    fees: "platform:fees"
    revenue: "platform:revenue"

world:
  description: "Unlimited source"
  paths:
    source: "world"
`,
  },
];

export function getChartPreset(id: string): ChartPreset | undefined {
  return CHART_PRESETS.find((preset) => preset.id === id);
}

export function getTransactionTemplate(id: string): TransactionTemplate | undefined {
  return TRANSACTION_TEMPLATES.find((template) => template.id === id);
}

export function getTemplatesByCategory(category: TransactionTemplate["category"]): TransactionTemplate[] {
  return TRANSACTION_TEMPLATES.filter((t) => t.category === category);
}
