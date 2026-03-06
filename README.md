main
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


```
Ran 9 tests for test/AgentRegistry.t.sol
✅ testRegisterAgent                   ERC-8004 registration + stake deposit
✅ testInsufficientStake               Minimum stake enforcement (0.01 ETH)
✅ testEmptyName                       Input validation
✅ testGetLatestETHPrice               Chainlink Data Feed mock integration
✅ testGetRequiredETH                  USD cents → ETH conversion accuracy
✅ testERC8004BidirectionalMapping     legacy ID ↔ ERC-8004 bytes32 mapping
✅ testHasMinimumStake                 Stake threshold verification
✅ testDeactivateAgent                 Agent lifecycle management
✅ testNotOwnerUpdates                 Access control enforcement


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


```
IDENTITY REGISTRY      REPUTATION REGISTRY     VALIDATION REGISTRY
─────────────────      ───────────────────     ──────────────────
bytes32 agentId        uint256 avgScore        uint256 stakeAmount
string metadataURI     uint256 totalFeedback   bool hasMinimumStake
address owner          submitFeedback()        stakeForValidation()
                       onlyEscrow              slashStake()
                                               withdrawStake()
```

Every job completion automatically updates the agent's on-chain reputation. A bad actor gets their stake slashed. The market self-regulates.

---

## x402: Machine-to-Machine Payments

NeuroCart implements the [x402 protocol](https://x402.org) by Coinbase — the internet-native payment standard for AI agents:

```bash
# Without x402 — broken, requires human credit card
curl https://api.someaiservice.com/summarize  # "Sorry, please register and add payment"


