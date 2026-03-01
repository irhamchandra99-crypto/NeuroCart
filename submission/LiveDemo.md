# NeuroCart — Live Demo Guide
### Chainlink Convergence Hackathon 2026 · CRE & AI Track

**Two characters. One complete flow. From zero to earned ETH.**

---

## CHARACTERS

| | Sani | Fina |
|--|------|------|
| **Role** | AI agent developer / provider | Content creator / client |
| **Goal** | Register SummarizerBot, earn ETH | Hire an AI to summarize articles |
| **Wallet** | Arbitrum Sepolia, ~0.05 ETH | Arbitrum Sepolia, ~0.05 ETH |
| **Address** | `0xSani...` (your provider wallet) | `0xFina...` (your client wallet) |
| **What they prove** | Agents can earn, build reputation, withdraw | Clients pay trustlessly, quality-guaranteed |

---

## PRE-DEMO SETUP

Before the demo, run these once in separate terminals:

```bash
# Terminal 1 — Smart contract environment (already deployed)
# Verify everything is working:
forge test -v
# Expected: 17/17 TESTS PASSING ✅

# Terminal 2 — Sani's SummarizerBot (x402 provider)
cd sdk
python demo_summarizer.py
# Expected output:
# SummarizerBot starting...
# ERC-8004 Identity: 0x4e6575726f...
# Price: 2 USDC | Network: Base Sepolia
# Server running on http://localhost:5000
# Listening for JobCreated events on Arbitrum Sepolia...

# Terminal 3 — Reserved for Fina's client (demo_client.py)
# Don't run yet — we'll run this during the demo
```

**Browser setup:**
- Open `localhost:3000` (frontend)
- Have two browser profiles ready:
  - Profile 1: Sani's MetaMask wallet
  - Profile 2: Fina's MetaMask wallet (or use incognito)
- Both wallets funded with Arbitrum Sepolia ETH

---

## PART 1 — SANI REGISTERS HIS AGENT

### Step 1.1 — Connect Sani's Wallet

**What to show:** Browser at `localhost:3000`. Navbar shows "Connect Wallet" button.

```
Action: Click "Connect Wallet" in top-right corner
        → MetaMask opens → Select Sani's account → Approve
Result: Navbar shows "● 0xSani...6f4a" (Sani's address, green)
        Network badge shows "Arbitrum Sepolia"
```

**Talking point:**
> "Sani connects MetaMask to Arbitrum Sepolia. No registration. No KYC. Just a wallet."

---

### Step 1.2 — Navigate to Register

```
Action: Click "Register" in the navbar
URL:    localhost:3000/register
```

**What to show:** Registration form with fields:
- Agent Name
- Description
- Price (USD cents)
- Skills

---

### Step 1.3 — Fill in the Registration Form

```
Agent Name:  SummarizerBot
Description: AI-powered article summarization using Claude. Quality guaranteed by Chainlink.
Price:       200  (= $2.00 USD)
Skills:      summarization, nlp, content
```

**Talking point:**
> "Price is set in USD cents — 200 means $2.00. Watch what happens when we submit."

---

### Step 1.4 — Click Register → MetaMask Popup

```
Action: Click "Register Agent"
```

**MetaMask popup shows:**
```
Contract: AgentRegistry (0x...)
Function: registerAgent
Value:    0.01 ETH  ← This is the slashable stake
Gas:      ~0.0002 ETH estimated
```

**Talking point:**
> "Two things happen in this one transaction: Sani's agent is registered with an ERC-8004 on-chain identity, AND he stakes 0.01 ETH — slashable if his bot delivers bad work. Skin in the game."

```
Action: Click "Confirm" in MetaMask
Result: Transaction submits → ~15 seconds → confirmed on Arbitrum Sepolia
```

---

### Step 1.5 — Agent Appears on Dashboard

```
Action: Click "Dashboard" in navbar
Result: Sani's agent card appears:

┌──────────────────────────────────────┐
│  SummarizerBot                       │
│  🟢 Active  │  ERC-8004              │
│                                      │
│  Price: 0.000847 ETH  ← Chainlink!   │
│  ($2.00 USD · Live ETH/USD Feed)     │
│                                      │
│  Reputation: 0 jobs  •  — avg score  │
│  Stake: 0.01 ETH (slashable)         │
│                                      │
│  Skills: summarization, nlp, content │
└──────────────────────────────────────┘
```

**Talking point:**
> "The ETH price — 0.000847 ETH — is fetched live from Chainlink's ETH/USD Data Feed. Not hardcoded. Not guessed. Real market price, updated every block. Manipulation-resistant."

---

## PART 2 — FINA HIRES THE BOT

### Step 2.1 — Switch to Fina's Wallet

```
Action: Disconnect Sani's wallet → Connect Fina's wallet
        (Or open a new browser profile with Fina's MetaMask)
Result: Navbar shows "● 0xFina...8b2c"
```

---

### Step 2.2 — Browse the Marketplace

```
Action: Stay on Dashboard → scroll to agent cards
```

**What Fina sees:**
```
SummarizerBot — 0.000847 ETH — 0 jobs — ERC-8004 ✓
[Hire Agent →]
```

**Talking point:**
> "Fina can see all registered agents, their on-chain reputation, price, and ERC-8004 verification status. Nothing to trust — everything's on-chain."

---

### Step 2.3 — Click "Hire Agent"

```
Action: Click "Hire Agent →" on SummarizerBot's card
Result: HireModal opens:

┌────────────────────────────────────────────┐
│  Hire SummarizerBot                         │
│                                             │
│  Cost: 0.000847 ETH                         │
│  (≈ $2.00 USD · Chainlink ETH/USD feed)     │
│                                             │
│  Job Description:                           │
│  [text area]                                │
│                                             │
│  [Create Job]                               │
└────────────────────────────────────────────┘
```

---

### Step 2.4 — Fill Job Description

```
Job Description:
"Summarize this article for a general audience:

The European Union's AI Act, adopted in March 2024, is the world's first
comprehensive legal framework for artificial intelligence. It classifies AI
systems by risk level — from minimal (spam filters) to high-risk (medical
devices, hiring algorithms) to prohibited (social scoring). High-risk AI
systems must meet strict requirements: transparency, human oversight, and
conformity assessments. Violations can result in fines up to 35 million euros
or 7% of global annual turnover. The Act takes full effect in 2026."
```

---

### Step 2.5 — Click "Create Job" → MetaMask Confirmation

```
Action: Click "Create Job"
```

**MetaMask popup:**
```
Contract: JobEscrow (0x...)
Function: createJob(agentId=0, deadline=86400, description="...", jobType=0)
Value:    0.000847 ETH  ← locked in escrow
Gas:      ~0.0003 ETH
```

**Talking point:**
> "Fina's ETH is locked in the JobEscrow smart contract. Neither Sani nor Fina can touch it. The contract holds it until Chainlink decides who gets it — based purely on output quality."

```
Action: Confirm in MetaMask
Result: Transaction confirmed → Job #1 created
```

---

### Step 2.6 — Watch Job Status

```
Action: Click "Jobs" in navbar
Result: Job row appears:

Job #1
Client:   0xFina...8b2c
Agent:    SummarizerBot (#0)
Status:   CREATED  [blue badge]
Payment:  0.000847 ETH
Created:  just now
```

---

## PART 3 — SANI'S BOT WORKS

### Step 3.1 — Bot Detects the Job (Terminal 2)

**What appears in Sani's terminal:**

```bash
[EVENT] JobCreated detected!
  jobId: 1
  client: 0xFina...8b2c
  agentId: 0 (SummarizerBot)
  payment: 0.000847 ETH

Calling acceptJob(1)...
Transaction submitted: 0xabc...
✓ Job #1 accepted.
```

**Browser update (if you refresh Jobs page):**
```
Status: ACCEPTED  [orange badge]
```

---

### Step 3.2 — Bot Runs Claude, Submits Result

**Terminal 2 continues:**

```bash
Running Claude summarization...
Input: "The European Union's AI Act..."
Model: claude-haiku-4-5-20251001
Response received (247 chars)

Summary:
"The EU AI Act (2024) is the world's first comprehensive AI law,
classifying AI systems by risk. High-risk AI (medical, hiring) faces
strict rules; prohibited uses include social scoring. Violations risk
fines up to €35M or 7% of turnover. Full effect: 2026."

Submitting result on-chain...
Transaction submitted: 0xdef...
✓ Result submitted for job #1. Status: VERIFYING
```

---

### Step 3.3 — VERIFYING Badge Appears

**Browser — Jobs page:**
```
Job #1
Status:   VERIFYING  [purple badge, glowing]
          ● Chainlink DON processing quality check...
```

**Talking point:**
> "This purple badge means the Chainlink Decentralized Oracle Network is running our quality verification JavaScript right now — on multiple independent nodes. It calls Claude API separately, scores the output 0–100, and delivers the result back on-chain. No one — not us, not Sani, not Fina — can influence this score."

---

## PART 4 — CHAINLINK VERIFIES

### Step 4.1 — DON Runs verify-quality.js

**What's happening on Chainlink DON (not visible but explain):**

```javascript
// verify-quality.js — running on Chainlink DON
// DON secrets: CLAUDE_API_KEY (encrypted, never visible on-chain)

const response = await Functions.makeHttpRequest({
  url: "https://api.anthropic.com/v1/messages",
  headers: { "x-api-key": secrets.CLAUDE_API_KEY },
  data: {
    model: "claude-haiku-4-5-20251001",
    messages: [{
      role: "user",
      content: "Score this AI summarization from 0-100. Return ONLY a number.\n\nOriginal: [Fina's article]\nSummary: [Sani's bot output]"
    }]
  }
});

const score = parseInt(response.data.content[0].text.trim()); // e.g., 91
return Functions.encodeUint256(score); // → on-chain
```

---

### Step 4.2 — fulfillRequest Callback

**What happens on-chain (NeuroCartFunctions.sol):**

```
fulfillRequest() called by Chainlink DON
  requestId → mapped to jobId=1
  response → uint256 decoded → score=91

Calling JobEscrow.finalizeVerification(jobId=1, score=91)...
  91 >= 80 → PASS

Actions:
  ✓ Release 0.000826 ETH to Sani (after 2.5% fee)
  ✓ AgentRegistry.submitFeedback(agentId=0, score=91, "COMPLETED")
  ✓ Job status → COMPLETED
```

---

## PART 5 — PAYMENT RELEASED & REPUTATION UPDATED

### Step 5.1 — Job Completed

**Browser — Jobs page refreshes:**
```
Job #1
Status:          COMPLETED  [green badge]
Quality Score:   91/100  [gold badge]
Payment:         Released to provider
```

---

### Step 5.2 — Sani's Reputation Updated

**Browser — Dashboard → SummarizerBot card:**
```
┌──────────────────────────────────────┐
│  SummarizerBot                       │
│  🟢 Active  │  ERC-8004              │
│                                      │
│  Price: 0.000847 ETH                 │
│                                      │
│  Reputation: 1 job  •  91.0 avg      │  ← updated!
│  Stake: 0.01 ETH (intact)            │  ← not slashed
└──────────────────────────────────────┘
```

**Talking point:**
> "Sani's ERC-8004 reputation updated automatically — 1 completed job, 91.0 average quality. This lives on-chain forever. He can't fake it. He can't delete it. Every future client can see exactly how trustworthy his bot is."

---

### Step 5.3 — Sani Checks Balance (ETH Received)

**Sani's terminal or block explorer:**
```bash
# Check Sani's wallet — should show ETH received
# Approximately 0.000826 ETH (after 2.5% NeuroCart fee)
# Sani earned $1.95 USD in ~90 seconds
```

**Talking point:**
> "Sani earned 1.95 dollars — in about ninety seconds — from a completely autonomous transaction. No invoice. No bank wire. No waiting 3 business days. The ETH hit his wallet the moment Chainlink confirmed quality."

---

## PART 6 — x402 MACHINE-TO-MACHINE DEMO

### Step 6.1 — Run Fina's Autonomous Client

**Terminal 3:**
```bash
cd sdk
python demo_client.py
```

**Full output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  NeuroCart x402 Client — Autonomous Agent Demo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[STEP 1] Checking provider health...
  GET http://localhost:5000/health
  ✓ Provider: SummarizerBot
  ✓ ERC-8004 ID: 0x4e6575726f...
  ✓ x402 enabled: true
  ✓ Status: active

[STEP 2] Requesting service WITHOUT payment...
  POST http://localhost:5000/api/summarize
  ← HTTP 402 Payment Required
  Payment instructions:
    Amount: 2000000 (2 USDC)
    Asset:  USDC
    PayTo:  0xSani...6f4a
    Network: base-sepolia

[STEP 3] Paying 2 USDC on Base Sepolia...
  USDC contract: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  Checking balance...
  Balance: 5.00 USDC ✓
  Transferring 2 USDC to 0xSani...6f4a...
  Transaction: 0x7f3a...d891
  ✓ Payment confirmed on Base Sepolia

[STEP 4] Retrying with X-PAYMENT header...
  POST http://localhost:5000/api/summarize
  Header: X-PAYMENT: eyJ0eEhhc2giOiIweDdmM2EuLi5kODkxIn0=
  ← HTTP 200 OK

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RESULT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Summary: "The EU AI Act (2024) is the world's first comprehensive
  AI law, classifying AI systems by risk..."

  Blockchain Job ID: 2
  Chainlink Status: pending verification
  Payment: 2 USDC (Base Sepolia)

  ✓ x402 flow complete. No human needed.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Talking point:**
> "This is the x402 protocol. Four steps. Twelve seconds. No accounts, no API keys, no humans. An AI agent detected the 402, automatically transferred USDC on Base Sepolia, built a cryptographic payment proof as an HTTP header, and got back its result. This is how AI agents will operate in 2027 — and we built the infrastructure for it today."

---

## PART 7 — FAILURE SCENARIO (OPTIONAL — SHOWS SLASH)

### What to show if you want to demonstrate the slash:

To trigger a quality failure manually in a test environment:

```solidity
// In JobEscrow.t.sol — testVerificationFail_RefundsClient
// Simulate score = 40 (below threshold)
escrow.finalizeVerification(jobId, 40);

// Expected:
// ✓ Client gets full refund
// ✓ Agent's stake partially slashed
// ✓ AgentRegistry reputation updated with bad score
// ✓ Job status → CANCELLED
```

**Talking point:**
> "If the Chainlink score comes back below 80 — say 40 — the escrow automatically refunds Fina and slashes part of Sani's stake. The market self-regulates. Bad AI gets punished. Good AI gets rewarded. No dispute resolution. No human judge. Just code."

---

## PART 8 — AUTOMATION DEMO (OPTIONAL)

### Show Chainlink Automation working:

```solidity
// Create a job, let it expire (deadline = 0 for testing)
// Chainlink Automation detects it via checkUpkeep()
// performUpkeep() calls cancelExpiredJob()

// Expected terminal (Chainlink Automation node):
// checkUpkeep() → upkeepNeeded=true, jobIds=[3]
// performUpkeep() → cancelExpiredJob(3) → success
// Client refunded automatically
```

**Talking point:**
> "Chainlink Automation runs our checkUpkeep function every block. If a job expires with no provider — maybe Sani's bot went offline — the job is automatically cancelled and Fina refunded. Zero human maintenance. The system runs itself."

---

## FULL DEMO TIMELINE

| Time | Action | Shows |
|------|---------|-------|
| 0:00 | Open frontend | Dashboard, no wallet |
| 0:30 | Sani connects wallet | MetaMask, Arbitrum Sepolia |
| 1:00 | Sani goes to /register | Registration form |
| 1:30 | Sani registers bot | MetaMask → 0.01 ETH stake → ERC-8004 |
| 2:00 | Dashboard updates | AgentCard with Chainlink price |
| 2:30 | Switch to Fina's wallet | Disconnect/reconnect |
| 3:00 | Fina clicks Hire Agent | HireModal + Chainlink price |
| 3:30 | Fina confirms job | MetaMask → 0.000847 ETH → escrow |
| 4:00 | Job status: CREATED | Blue badge |
| 4:30 | Sani's terminal: JobCreated | acceptJob() |
| 5:00 | Job status: ACCEPTED | Orange badge |
| 5:30 | Bot runs Claude, submits | Terminal output |
| 6:00 | Job status: VERIFYING | Purple badge + glow |
| 6:30 | Chainlink DON runs | Explain verify-quality.js |
| 7:00 | Job status: COMPLETED | Green badge + score 91 |
| 7:30 | Sani's rep updated | 1 job, 91.0 avg |
| 8:00 | x402 demo: demo_client.py | 4 steps, 12 seconds |
| 9:00 | Closing | GitHub URL, 17/17 tests |

---

## TROUBLESHOOTING

**Frontend shows "Demo Mode" banner:**
→ No `.env.local` with contract addresses set.
→ Set `NEXT_PUBLIC_REGISTRY_ADDRESS` and `NEXT_PUBLIC_ESCROW_ADDRESS` to deployed contract addresses.

**MetaMask shows wrong network:**
→ Wallet is not on Arbitrum Sepolia.
→ Navbar shows "⚠ Wrong Network" — ask MetaMask to switch.
→ Add Arbitrum Sepolia: chainId 421614, RPC `https://sepolia-rollup.arbitrum.io/rpc`

**demo_client.py USDC balance insufficient:**
→ Get testnet USDC from the Base Sepolia faucet.
→ Or the script falls back to a mock payment header (demo_summarizer.py accepts it in demo mode).

**Chainlink Functions not triggering:**
→ Check that the Functions subscription has LINK funded and the consumer contract is added.
→ Subscription ID must be set in `FUNCTIONS_SUBSCRIPTION_ID` env var for deploy.

**forge test fails:**
→ Run `forge install` to install dependencies first.
→ Ensure you're in the root directory (not `src/` or `sdk/`).

---

*NeuroCart · Chainlink Convergence Hackathon 2026 · CRE & AI Track*
*"The trust layer for the autonomous AI economy."*
