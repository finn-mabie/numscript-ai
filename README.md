# Numscript AI

Natural Language to Formance Numscript converter. Describe financial transactions in plain English, get valid Numscript code.

![Numscript AI](https://img.shields.io/badge/Formance-Numscript-emerald)

## Features

- **Natural Language Input** → AI-powered parsing → **Valid Numscript**
- **MCP Validation** - Uses Numscript MCP to validate generated code
- **Iterative Refinement** - Automatically retries until valid
- **Explain Mode** - Step-by-step explanations of generated code
- **Templates** - Credit card lifecycle templates (Enfuce model)
- **Chart of Accounts** - YAML-based account configuration

## Architecture

```
User Prompt
    → OpenAI (gpt-4o) generates JSON Intent
    → Compile JSON → Numscript string
    → MCP validates Numscript syntax
    → If invalid, retry with error feedback
    → Return valid Numscript
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **AI**: OpenAI API (gpt-4o)
- **Validation**: Zod + Numscript MCP

## Getting Started

### Prerequisites

- Node.js 18+
- Go 1.21+ (for MCP)
- OpenAI API key

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/numscript-ai.git
cd numscript-ai

# Install dependencies
npm install

# Set up environment
echo 'OPENAI_API_KEY=your-key-here' > .env.local
```

### Set up Numscript MCP

```bash
# Clone the Numscript repo
git clone https://github.com/formancehq/numscript.git numscript-mcp

# Checkout MCP feature branch
cd numscript-mcp
git fetch origin pull/97/head:mcp-feature
git checkout mcp-feature

# Build the binary
go build -o numscript ./cmd/numscript

cd ..
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Templates

Includes credit card lifecycle templates based on the Enfuce model:

| Category | Templates |
|----------|-----------|
| **Setup** | Assign Credit Limit |
| **Authorization** | Standard Auth, ATM with Fee, Reversal |
| **Clearing** | Standard Clearing |
| **Billing** | Cycle Close, Invoice Payment, Overdue, Interest |
| **Settlement** | Scheme Settlement Prepare/Confirm |

## Chart of Accounts

Default chart supports credit card issuing:

```yaml
cardholders:
  available: "cardholder:$id:available"
  credit_line: "cardholder:$id:credit_line"
  pending: "cardholder:$id:pending:$auth_id"
  billed: "cardholder:$id:billed"
  overdue: "cardholder:$id:overdue"

platform:
  credit_grants: "platform:$platform:credit_grants"
  revenue: "platform:$platform:revenue"

schemes:
  main: "schemes:$scheme:main"

banks:
  main: "banks:$bank:main"
```

## Example

**Input:**
> "Authorize $150 EUR for cardholder 12345, auth ID AUTH-98765"

**Output:**
```numscript
vars {
  asset $asset
  number $amount
  account $account_id
  string $authorization_id
}
send [$asset $amount] (
  source = @cardholder:$account_id:available allowing overdraft up to [$asset $credit_limit]
  destination = @cardholder:$account_id:pending:$authorization_id
)
set_tx_meta("authorization_id", $authorization_id)
set_tx_meta("transaction_type", "authorization")
```

## License

MIT

## Links

- [Formance](https://formance.com)
- [Numscript Documentation](https://docs.formance.com/numscript)

