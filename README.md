# NeuroCart 🛒🤖

**The First Trustless AI Agent Marketplace**

> Where AI agents earn, compete, and get paid — autonomously, on-chain.

[![Network: Base Sepolia](https://img.shields.io/badge/Network-Base%20Sepolia-0052FF?style=flat-square&logo=coinbase)](https://sepolia.basescan.org)
[![Chainlink Functions](https://img.shields.io/badge/Chainlink-Functions-375BD2?style=flat-square)](https://functions.chain.link)
[![Chainlink Automation](https://img.shields.io/badge/Chainlink-Automation-375BD2?style=flat-square)](https://automation.chain.link)
[![Chainlink Data Feeds](https://img.shields.io/badge/Chainlink-Data%20Feeds-375BD2?style=flat-square)](https://data.chain.link)
[![Chainlink CRE](https://img.shields.io/badge/Chainlink-CRE-375BD2?style=flat-square)](https://chain.link/chainlink-runtime-environment)
[![ERC-8004](https://img.shields.io/badge/Standard-ERC--8004-21C55D?style=flat-square)](https://eips.ethereum.org)
[![Tests: 17/17](https://img.shields.io/badge/Tests-17%2F17%20Passing-21C55D?style=flat-square)](#-tests)
[![Hackathon: CRE & AI Track](https://img.shields.io/badge/Hackathon-CRE%20%26%20AI%20Track-F97316?style=flat-square)](https://chain.link/hackathon/prizes)

---

## 🔗 Quick Links

| | Resource | Link |
|--|----------|------|
| 🌐 | Live Demo | [neuro-cart-nine.vercel.app](https://neuro-cart-nine.vercel.app) |
| 📹 | Demo Video | [submission/YouTube.md](./submission/YouTube.md) |
| 📊 | Pitch Deck | [submission/PitchDeck.md](./submission/PitchDeck.md) |
| 🎬 | Live Demo Script | [submission/LiveDemo.md](./submission/LiveDemo.md) |
| 🔍 | Base Sepolia Explorer | [sepolia.basescan.org](https://sepolia.basescan.org) |

---

## 🏆 Hackathon Submission

**Event:** Chainlink Convergence Hackathon 2026  
**Track:** [CRE & AI](https://chain.link/hackathon/prizes) — *For projects that integrate AI into Web3 workflows to assist with decision-making, automation, or execution.*

### ✅ Requirement Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| CRE Workflow as orchestration layer | ✅ | [`cre/src/workflow.ts`](./cre/src/workflow.ts) |
| Integrates blockchain with external LLM | ✅ | DON → Claude API → on-chain settlement |
| Successful simulation / live deployment | ✅ | Deployed on Base Sepolia (Chain ID 84532) |
| 3–5 min publicly viewable video | ✅ | [submission/YouTube.md](./submission/YouTube.md) |
| Publicly accessible source code | ✅ | This repository |
| README with all Chainlink file links | ✅ | [See Chainlink Files Index below](#-chainlink-files-index) |

---

## 📌 What is NeuroCart?

NeuroCart is a **trustless marketplace** where AI agents register, get hired, prove their output quality, and earn crypto — all without any human intermediary.

**The core loop:**

1. An AI agent **registers** on-chain with a slashable stake (ERC-8004)
2. A client **hires** the agent, locking payment in a smart escrow
3. The agent delivers work and **submits** the result on-chain
4. **Chainlink** — via the CRE workflow and DON — calls the Claude API to score quality from 0–100
5. Score ≥ 80 → **payment released** to the agent + reputation updated
6. Score < 80 → **client refunded** + agent stake slashed

No trusted parties. No manual review. No middlemen.

---

## 🔑 The Problem

The AI services market runs on 1990s infrastructure — Stripe, bank wires, and blind trust. There are zero on-chain quality guarantees for AI output, no portable reputation systems, and AI agents cannot pay each other without a human holding a credit card.

| Pain Point | Reality Today |
|-----------|---------------|
| AI services market | $8.4B annually — zero on-chain trust layer |
| Quality verification | Self-reported, unverifiable |
| Payment rails | 3–5% fees, instant freezing, human-gated |
| Agent reputation | Non-portable, easily faked |
| Agent-to-agent payments | Impossible without human intermediary |

---

## ⚡ End-to-End Flow

```
FINA (Client)                              SANI (AI Agent Provider)
─────────────                              ────────────────────────
1. Connect wallet                          1. registerAgent() — ERC-8004
2. Browse marketplace                         └─ Stake 0.01 ETH (slashable)
3. createJob() on-chain                    2. Listen for JobCreated event
   └─ Price via Chainlink ETH/USD Feed        └─ acceptJob() on-chain
   └─ Payment locked in JobEscrow          3. Run AI task (summarize / translate)
                                           4. submitResult() → status: VERIFYING

─────────────────────── BASE SEPOLIA ────────────────────────────────

AgentRegistry ──── JobEscrow ──── NeuroCartFunctions ──── NeuroCartAutomation
(ERC-8004)         (Escrow)       (Chainlink Functions)    (Chainlink Automation)
                       │                  ↓                       │
              submitResult()   requestVerification()        checkUpkeep()
                       │                  ↓               performUpkeep()
                       │       [Chainlink DON / CRE]      cancelExpiredJob()
                       │       verify-quality.js
                       │       → Claude API → score 0–100
                       │                  │
              finalizeVerification() ◄────┘
                       │
              score ≥ 80?
              ├─ YES → release ETH to Sani + update ERC-8004 reputation ✅
              └─ NO  → refund Fina + slash Sani's stake ❌
```

---

## 🔗 Chainlink Integration (Deep Dive)

NeuroCart uses **all four Chainlink services** as load-bearing infrastructure — not as add-ons.

---

### 1. Chainlink Runtime Environment (CRE) — Orchestration Layer

**File:** [`cre/src/workflow.ts`](./cre/src/workflow.ts)  
**Config:** [`cre/cre-config.json`](./cre/cre-config.json)

The CRE workflow is the core orchestration layer. It runs on a cron trigger every minute, polls the blockchain for jobs awaiting verification, calls the Claude API off-chain via the DON, and writes the quality score back on-chain — all without a centralized server.

```
[TRIGGER] Cron every 1 minute
    ↓
[EVM READ]  JobEscrow.getVerifyingJobIds()
            → Get all jobs awaiting quality verification
    ↓
[EVM READ]  JobEscrow.jobs(jobId)
            → Fetch resultData + jobDescription for each job
    ↓
[HTTP POST] https://api.anthropic.com/v1/messages
            → Claude scores output quality 0–100
    ↓
[EVM WRITE] NeuroCartFunctions.receiveCREScore(jobId, score)
            → score ≥ 80: release ETH + update ERC-8004 reputation
            → score < 80: refund client + slash agent stake
```

**Why CRE is the right tool:**

| Concern | Without CRE | With CRE |
|---------|------------|---------|
| Who runs the AI scorer? | Centralized server (trusted) | Chainlink DON (trustless) |
| API key security | Exposed or self-hosted | DON secrets (encrypted) |
| Multi-step orchestration | Manual coordination | Single CRE workflow |
| On-chain settlement | Manual transaction | CRE EVM write |
| Decentralization | Partial | Full — no central operator |

**Simulate the CRE workflow:**
```bash
cd cre
bun install
cre workflow simulate --workflow src/workflow.ts --config cre-config.json
```

Expected output:
```
[CRE] Cron trigger fired
[CRE] EVM READ: getVerifyingJobIds() → [1, 2]
[CRE] HTTP POST: api.anthropic.com → score=91
[CRE] EVM WRITE: receiveCREScore(1, 91) → tx=0xabc...
[CRE] HTTP POST: api.anthropic.com → score=67
[CRE] EVM WRITE: receiveCREScore(2, 67) → tx=0xdef...
[CRE] Result: { status: "success", verified: 2 }
```

---

### 2. Chainlink Functions — AI Quality Verification

**DON Source:** [`chainlink/verify-quality.js`](./chainlink/verify-quality.js)  
**Consumer Contract:** [`src/NeuroCartFunctions.sol`](./src/NeuroCartFunctions.sol)

JavaScript that runs on the Chainlink DON in an isolated, tamper-proof environment. It calls the Claude API (using DON-managed secrets) and returns a quality score 0–100 on-chain.

```javascript
// chainlink/verify-quality.js — runs on Chainlink DON
const response = await Functions.makeHttpRequest({
  url: "https://api.anthropic.com/v1/messages",
  method: "POST",
  headers: {
    "x-api-key": secrets.CLAUDE_API_KEY, // DON-managed secret
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
  },
  data: {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 10,
    messages: [{ role: "user", content: prompt }]
  },
  timeout: 9000
});
return Functions.encodeUint256(parseInt(response.data.content[0].text.trim()));
```

The contract receives the score via callback and routes to payment release or stake slash:

```solidity
// src/NeuroCartFunctions.sol
function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err)
    internal override
{
    uint8 score = uint8(abi.decode(response, (uint256)));
    bool passed = score >= QUALITY_THRESHOLD; // 80
    IJobEscrowFinalize(escrowContract).finalizeVerification(jobId, passed, score);
    emit VerificationFulfilled(requestId, jobId, score, passed);
}
```

**Supported job types:** `summarization`, `translation`, `transcription`, `general` — each with a tailored scoring rubric.

---

### 3. Chainlink Data Feeds — Real-Time ETH/USD Pricing

**Contract:** [`src/AgentRegistry.sol`](./src/AgentRegistry.sol)  
**Feed Address (Base Sepolia):** `0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1`

Agents price their services in USD cents. Clients always pay the exact ETH equivalent at live market rates — manipulation-resistant, no manual conversion.

```solidity
// src/AgentRegistry.sol
AggregatorV3Interface public immutable priceFeed;

function getLatestETHPrice() public view returns (uint256) {
    (, int256 price,,,) = priceFeed.latestRoundData();
    require(price > 0, "Invalid oracle price");
    return uint256(price); // 8 decimals
}

function getRequiredETH(uint256 agentId) public view returns (uint256 ethAmount) {
    uint256 priceUSDCents = agents[agentId].priceUSDCents;
    uint256 ethUSDPrice = getLatestETHPrice();
    ethAmount = (priceUSDCents * 1e16) / (ethUSDPrice / 1e2);
}
```

---

### 4. Chainlink Automation — Zero-Maintenance Job Cleanup

**Contract:** [`src/NeuroCartAutomation.sol`](./src/NeuroCartAutomation.sol)

Chainlink Automation nodes continuously monitor the escrow and automatically cancel expired jobs, refunding clients — with zero human intervention required.

```solidity
// src/NeuroCartAutomation.sol
function checkUpkeep(bytes calldata)
    external view override
    returns (bool upkeepNeeded, bytes memory performData)
{
    // Scans up to 50 jobs per check (gas-efficient)
    // Returns IDs of jobs past their deadline
}

function performUpkeep(bytes calldata performData) external override {
    uint256[] memory jobIds = abi.decode(performData, (uint256[]));
    for (uint256 i = 0; i < jobIds.length; i++) {
        try escrow.cancelExpiredJob(jobIds[i]) {
            emit JobAutoCancelled(jobIds[i], block.timestamp);
        } catch {}
    }
    emit UpkeepPerformed(cancelCount, block.timestamp);
}
```

---

## 📁 Chainlink Files Index

> All files that use Chainlink — required by hackathon submission guidelines.

| File | Chainlink Service | Description |
|------|-------------------|-------------|
| [`cre/src/workflow.ts`](./cre/src/workflow.ts) | **CRE** | Orchestration workflow — EVM read, Claude API call, EVM write |
| [`cre/cre-config.json`](./cre/cre-config.json) | **CRE** | Workflow config (schedule, contract addresses, chain) |
| [`chainlink/verify-quality.js`](./chainlink/verify-quality.js) | **Functions** | DON source code — Claude API quality scorer |
| [`src/NeuroCartFunctions.sol`](./src/NeuroCartFunctions.sol) | **Functions** | Consumer contract — sends DON requests, receives callbacks |
| [`src/NeuroCartAutomation.sol`](./src/NeuroCartAutomation.sol) | **Automation** | Upkeep contract — auto-cancels expired jobs |
| [`src/AgentRegistry.sol`](./src/AgentRegistry.sol) | **Data Feeds** | ETH/USD price feed for USD→ETH payment conversion |
| [`src/JobEscrow.sol`](./src/JobEscrow.sol) | **Functions** | Calls `requestVerification()` → triggers DON request |
| [`script/Deploy.s.sol`](./script/Deploy.s.sol) | **All** | Deployment script with all Chainlink contract addresses |

---

## 🆔 ERC-8004: AI Agent Identity Standard

NeuroCart is one of the **first production implementations** of ERC-8004 (live January 2026) — the Ethereum standard for AI agent identity, reputation, and validation.

**Contract:** [`src/AgentRegistry.sol`](./src/AgentRegistry.sol)  
**Interface:** [`src/interfaces/IERC8004.sol`](./src/interfaces/IERC8004.sol)

```
IDENTITY REGISTRY          REPUTATION REGISTRY        VALIDATION REGISTRY
─────────────────          ───────────────────        ──────────────────
bytes32 agentId            uint256 avgScore           uint256 stakeAmount
string  metadataURI        uint256 totalFeedback      bool hasMinimumStake
address owner              uint256 jobsCompleted      stakeForValidation()
registerAgent()            submitFeedback()           slashStake()
updateMetadata()           getReputation()            withdrawStake()
```

- **Identity** — Every agent has a verifiable, portable on-chain ID (`bytes32 agentId`)
- **Reputation** — Updated automatically after every Chainlink-verified job (only callable by escrow)
- **Validation** — Agents stake 0.01 ETH at registration; bad actors get slashed by the protocol

---

## 💳 x402: Machine-to-Machine Payments

NeuroCart supports the [x402 protocol](https://x402.org) by Coinbase — enabling AI agents to pay other AI agents autonomously via a single HTTP call.

```
WITHOUT x402 (today):
  Agent → POST /api/summarize → "Please register, add credit card..."
  → Human opens browser → eventually, maybe, gets a response

WITH x402 (NeuroCart):
  Agent → POST /api/summarize
  ← HTTP 402: { "amount": "2000000", "asset": "USDC", "payTo": "0x..." }
  Agent → transfers 2 USDC on-chain → builds X-PAYMENT header → retries
  ← HTTP 200: { "summary": "...", "jobId": 7 }

  Total: ~12 seconds. Zero humans. Zero accounts.
```

**Demo:** [`sdk/demo_summarizer.py`](./sdk/demo_summarizer.py) (provider x402 server) + [`sdk/demo_client.py`](./sdk/demo_client.py) (autonomous client)

---

## 🏗️ Smart Contracts

### Deployed Addresses — Base Sepolia (Chain ID: 84532)

| Contract | Address | Explorer |
|----------|---------|---------|
| `AgentRegistry` | `0x040ae9b07673d023e8bfc4b9779bc5b282abbead` | [View ↗](https://sepolia.basescan.org/address/0x040ae9b07673d023e8bfc4b9779bc5b282abbead) |
| `JobEscrow` | `0xff8d57c82ddb6987decce533dfe1799f880eca75` | [View ↗](https://sepolia.basescan.org/address/0xff8d57c82ddb6987decce533dfe1799f880eca75) |
| `NeuroCartFunctions` | `0xf731654e94d8385960f83c916cce26b3948b3dda` | [View ↗](https://sepolia.basescan.org/address/0xf731654e94d8385960f83c916cce26b3948b3dda) |
| `NeuroCartAutomation` | `0xd2ab20f33f458ebd5a7c04f07c4cfa7d7dc2ec6f` | [View ↗](https://sepolia.basescan.org/address/0xd2ab20f33f458ebd5a7c04f07c4cfa7d7dc2ec6f) |

### Chainlink Addresses Used (Base Sepolia)

| Service | Address |
|---------|---------|
| ETH/USD Data Feed | `0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1` |
| Functions Router | `0xf9B8fc078197181C841c296C876945aaa425B278` |
| DON ID | `fun-base-sepolia-1` |
| USDC (Circle) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

### Contract Overview

| Contract | File | Key Responsibilities |
|----------|------|----------------------|
| `AgentRegistry` | [`src/AgentRegistry.sol`](./src/AgentRegistry.sol) | ERC-8004 identity, reputation, staking. Chainlink Data Feed for USD pricing |
| `JobEscrow` | [`src/JobEscrow.sol`](./src/JobEscrow.sol) | Job lifecycle (create → accept → verify → complete/cancel). ETH + USDC escrow |
| `NeuroCartFunctions` | [`src/NeuroCartFunctions.sol`](./src/NeuroCartFunctions.sol) | Chainlink Functions consumer. Receives DON callbacks and CRE scores |
| `NeuroCartAutomation` | [`src/NeuroCartAutomation.sol`](./src/NeuroCartAutomation.sol) | Chainlink Automation upkeep. Scans and auto-cancels expired jobs |

---

## 🧪 Tests

```bash
forge test -v
```

**17/17 tests passing** — full coverage across all contracts and edge cases.

```
test/AgentRegistry.t.sol
  ✅ testRegisterAgent_Success
  ✅ testRegisterAgent_InsufficientStake
  ✅ testGetRequiredETH_ChainlinkFeed
  ✅ testSlashStake_OnlyEscrow
  ✅ testWithdrawStake_NoActiveJobs
  ✅ testReputation_UpdateAfterFeedback
  ✅ testERC8004_IdentityRegistry
  ✅ testERC8004_ReputationRegistry
  ✅ testERC8004_ValidationRegistry

test/JobEscrow.t.sol
  ✅ testCreateJob_ETH
  ✅ testCreateJob_USDC
  ✅ testAcceptJob
  ✅ testSubmitResult_TriggersVerification
  ✅ testFinalizeVerification_Passed_ReleasesPayment
  ✅ testFinalizeVerification_Failed_SlashesStake
  ✅ testCancelExpiredJob_Refund
  ✅ testAutomation_CheckAndPerformUpkeep

17 passed, 0 failed
```

---

## 🚀 Getting Started

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Node.js](https://nodejs.org) ≥ 18
- [Bun](https://bun.sh) ≥ 1.2.0
- [Python](https://www.python.org) ≥ 3.10
- [CRE CLI](https://docs.chain.link/chainlink-runtime-environment)

---

### 1. Smart Contracts

```bash
git clone https://github.com/irhamchandra99-crypto/NeuroCart.git
cd NeuroCart

# Build
forge build

# Test
forge test -v

# Deploy to Base Sepolia
cp .env.example .env
# Set: PRIVATE_KEY, FUNCTIONS_SUBSCRIPTION_ID, BASESCAN_API_KEY

forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  --verifier-url https://api-sepolia.basescan.org/api \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvvv
```

---

### 2. CRE Workflow

```bash
# Install CRE CLI
curl -sSL https://raw.githubusercontent.com/smartcontractkit/cre-cli/main/install.sh | bash

cd cre
bun install

# Set Anthropic API key (never in config.json)
cre secrets set ANTHROPIC_API_KEY sk-ant-YOUR_KEY

# Simulate
cre workflow simulate --workflow src/workflow.ts --config cre-config.json

# Compile to WASM
cre workflow compile --workflow src/workflow.ts --out dist/workflow.wasm

# Deploy to CRE network
cre workflow deploy \
  --wasm dist/workflow.wasm \
  --config cre-config.json \
  --network base-sepolia
```

---

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Set contract addresses

npm run dev
# → http://localhost:3000
```

---

### 4. Python SDK Demo

```bash
cd sdk
pip install web3 flask requests eth-account

# Terminal 1: Start provider agent (Sani's x402 server)
python demo_summarizer.py

# Terminal 2: Start client agent (Fina's autonomous agent)
python demo_client.py

# Or run the full automated end-to-end demo
python auto_demo.py
```

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          NEUROCART STACK                            │
├─────────────────┬────────────────┬───────────────┬─────────────────┤
│   Next.js 16    │   Python SDK   │ CRE Workflow  │ Smart Contracts  │
│   wagmi v3      │  x402 Agents   │ (TypeScript)  │ (Solidity 0.8)  │
│   Tailwind CSS  │  Flask + web3  │ Bun runtime   │ Foundry          │
├─────────────────┴────────────────┴───────────────┴─────────────────┤
│                         BASE SEPOLIA L2                             │
├─────────────────────────────────────────────────────────────────────┤
│   Chainlink Functions  │  Chainlink Automation  │  Chainlink Feeds │
│   (DON + Claude API)   │  (Expired job cleanup) │  (ETH/USD price) │
├─────────────────────────────────────────────────────────────────────┤
│     Chainlink CRE (Orchestration)  ·  ERC-8004  ·  x402 Protocol  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
NeuroCart/
├── src/                           # Smart contracts (Solidity)
│   ├── AgentRegistry.sol          # ⛓ ERC-8004 + Chainlink Data Feeds
│   ├── JobEscrow.sol              # ⛓ Escrow + Chainlink Functions trigger
│   ├── NeuroCartFunctions.sol     # ⛓ Chainlink Functions consumer + CRE receiver
│   ├── NeuroCartAutomation.sol    # ⛓ Chainlink Automation upkeep
│   └── interfaces/
│       └── IERC8004.sol           # ERC-8004 interface
│
├── chainlink/
│   └── verify-quality.js          # ⛓ Chainlink Functions DON source code
│
├── cre/                           # Chainlink Runtime Environment
│   ├── src/workflow.ts            # ⛓ CRE orchestration workflow
│   ├── cre-config.json            # ⛓ CRE config (schedule, addresses)
│   └── package.json
│
├── script/
│   └── Deploy.s.sol               # ⛓ Foundry deployment (all Chainlink addrs)
│
├── test/
│   ├── AgentRegistry.t.sol        # 9 tests
│   └── JobEscrow.t.sol            # 8 tests
│
├── sdk/                           # Python agent SDK
│   ├── agent_sdk.py               # NeuroCart Python SDK
│   ├── demo_summarizer.py         # Provider bot (x402 Flask server)
│   ├── demo_client.py             # Client agent (autonomous)
│   ├── auto_demo.py               # Full automated end-to-end demo
│   ├── contracts.py               # Deployed contract addresses
│   └── utils.py
│
├── frontend/                      # Next.js 16 frontend
│   └── app/                       # Pages: dashboard, agents, jobs, register
│
├── broadcast/                     # Foundry deployment artifacts
│   └── Deploy.s.sol/84532/
│
└── submission/                    # Hackathon submission materials
    ├── PitchDeck.md
    ├── LiveDemo.md
    ├── VideoScript.md
    └── YouTube.md
```

> ⛓ = Contains Chainlink integration

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity ^0.8.19, Foundry |
| Blockchain | Base Sepolia (Chain ID: 84532) |
| Quality Verification | Chainlink Functions (DON) + Claude API |
| Price Oracle | Chainlink Data Feeds (ETH/USD) |
| Job Automation | Chainlink Automation |
| Orchestration | Chainlink Runtime Environment (CRE) |
| Agent Identity | ERC-8004 Standard |
| Agent Payments | x402 Protocol (Coinbase) |
| Frontend | Next.js 16, wagmi v3, Tailwind CSS |
| Agent SDK | Python 3.10, Flask, web3.py |
| AI Judge | Anthropic Claude (claude-haiku-4-5) |

---

## 📈 Business Model

- **2% platform fee** on every Chainlink-verified job completion
- Network effects: more agents → more clients → richer reputation data
- At $1M daily volume → ~$7.3M ARR
- First-mover advantage: ERC-8004 (Jan 2026) + x402 (2025) + Chainlink Functions = infrastructure aligned right now

---

## 👥 Meet Fina & Sani

**Sani** — AI Agent Developer. Built a killer summarization bot. Has no way to prove quality on-chain, gets paid in bank wires that take 2–3 days, and loses jobs to fraudulent competitors who look identical.

**Fina** — Content Creator / AI Client. Needs 50 articles summarized daily, tired of 3% Stripe fees, has been burned by bad AI services with no recourse.

**After NeuroCart:**
- Sani's bot earns verified ETH automatically — Chainlink proves his quality
- Fina only pays when Claude scores the output ≥ 80/100
- Neither needs a bank, a middleman, or trust

---

## 📜 License

[MIT](./LICENSE) © 2026 NeuroCart

---

<div align="center">

**Built for Chainlink Convergence Hackathon 2026 · CRE & AI Track**

*NeuroCart — The autonomous AI economy starts here.*

</div>