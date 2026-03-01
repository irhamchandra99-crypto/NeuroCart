# NeuroCart CRE Workflow

**Chainlink Runtime Environment (CRE) — AI Quality Verification Orchestration Layer**

This is the CRE workflow that powers NeuroCart's trustless AI quality verification. It serves as the orchestration layer connecting the blockchain, Claude API, and smart contract escrow — all running on Chainlink's Decentralized Oracle Network.

---

## What This Workflow Does

```
[TRIGGER] Cron every 1 minute
    ↓
[EVM READ] JobEscrow.getVerifyingJobIds()
    → Get all jobs awaiting quality verification
    ↓
[EVM READ] JobEscrow.jobs(jobId)
    → Fetch resultData + jobDescription for each job
    ↓
[HTTP] POST https://api.anthropic.com/v1/messages
    → Claude scores output quality 0-100
    ↓
[EVM WRITE] NeuroCartFunctions.receiveCREScore(jobId, score)
    → score ≥ 80: release ETH to Sani + update ERC-8004 reputation
    → score < 80: refund Fina + slash Sani's stake
```

---

## Prerequisites

1. **Install CRE CLI**

```bash
# macOS / Linux
curl -sSL https://raw.githubusercontent.com/smartcontractkit/cre-cli/main/install.sh | bash

# Verify
cre --version
```

2. **Install Bun** (CRE TypeScript workflows use Bun)

```bash
curl -fsSL https://bun.sh/install | bash
bun --version   # requires >= 1.2.0
```

3. **Install workflow dependencies**

```bash
cd cre
bun install
```

---

## Configuration

Edit `cre-config.json` with your deployed contract addresses:

```json
{
  "schedule": "*/1 * * * *",
  "jobEscrowAddress": "0xYOUR_JOB_ESCROW_ADDRESS",
  "functionsAddress": "0xYOUR_FUNCTIONS_ADDRESS",
  "chainId": 421614,
  "qualityThreshold": 80,
  "maxJobsPerRun": 5
}
```

Set secrets (Anthropic API key — never in config.json):

```bash
cre secrets set ANTHROPIC_API_KEY sk-ant-YOUR_KEY
```

---

## Simulate (CRE CLI)

Run the workflow locally — makes real HTTP calls and reads real chain state:

```bash
cd cre
cre workflow simulate --workflow src/workflow.ts --config cre-config.json
```

Expected output:

```
[CRE Simulator] Compiling workflow → WASM...
[CRE Simulator] Cron trigger fired
[CRE Simulator] EVM READ: JobEscrow.getVerifyingJobIds() → [1, 2]
[CRE Simulator] EVM READ: JobEscrow.jobs(1) → resultData="...", description="..."
[CRE Simulator] HTTP POST: api.anthropic.com → score=91
[CRE Simulator] EVM WRITE: receiveCREScore(1, 91) → tx=0xabc...
[CRE Simulator] EVM READ: JobEscrow.jobs(2) → resultData="...", description="..."
[CRE Simulator] HTTP POST: api.anthropic.com → score=67
[CRE Simulator] EVM WRITE: receiveCREScore(2, 67) → tx=0xdef...
[CRE Simulator] Result: { status: "success", verified: 2 }
```

---

## Compile to WASM

```bash
cd cre
cre workflow compile --workflow src/workflow.ts --out dist/workflow.wasm
```

---

## Deploy to CRE Network

```bash
# Register workflow with CRE
cre workflow deploy \
  --wasm dist/workflow.wasm \
  --config cre-config.json \
  --network arbitrum-sepolia

# Check status
cre workflow status --id YOUR_WORKFLOW_ID
```

---

## How It Connects to Smart Contracts

### NeuroCartFunctions.sol — New CRE Function

```solidity
/// @notice Called by CRE workflow to submit quality score
/// @dev CRE orchestrates the off-chain Claude API call and submits here
function receiveCREScore(uint256 jobId, uint8 score) external {
    require(msg.sender == creWorkflow, "Only authorized CRE workflow");
    bool passed = score >= QUALITY_THRESHOLD;  // 80
    IJobEscrowFinalize(escrowContract).finalizeVerification(jobId, passed, score);
    emit VerificationFulfilled(bytes32(jobId), jobId, score, passed);
}
```

### JobEscrow.sol — New View Function

```solidity
/// @notice Returns job IDs in VERIFYING status — for CRE to poll
function getVerifyingJobIds() external view returns (uint256[] memory) {
    // ... scans all jobs, returns VERIFYING ones
}
```

---

## Why CRE Is the Right Tool for NeuroCart

| Concern | Without CRE | With CRE |
|---------|------------|---------|
| **Who runs the AI scorer?** | Centralized server (trusted) | Chainlink DON (trustless) |
| **Multi-step orchestration** | Manual coordination | Single CRE workflow |
| **API key security** | Exposed or self-hosted | DON secrets (encrypted) |
| **On-chain settlement** | Manual transaction | CRE EVM write capability |
| **Decentralization** | Partial | Full — no central operator |

CRE is the orchestration layer that ties NeuroCart together:
- **Trigger**: Time-based (cron) — runs automatically every minute
- **Off-chain compute**: Reads chain state, calls Claude API
- **On-chain write**: Settles payment trustlessly

---

*NeuroCart · Chainlink Convergence Hackathon 2026 · CRE & AI Track*
