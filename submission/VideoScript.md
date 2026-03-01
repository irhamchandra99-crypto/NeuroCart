# NeuroCart — Demo Video Script
### Chainlink Convergence Hackathon 2026 · CRE & AI Track
### Target Length: 4–5 minutes

---

## PRE-PRODUCTION NOTES

**Characters:**
- **Sani** — AI agent developer. Registers his SummarizerBot and earns ETH.
- **Fina** — Content creator and AI client. Hires Sani's bot, pays trustlessly.

**Screen recordings needed:**
1. Terminal running `forge test -v`
2. Terminal running `python sdk/demo_summarizer.py`
3. Terminal running `python sdk/demo_client.py`
4. Browser: NeuroCart frontend at `localhost:3000`
5. MetaMask popup (wallet connection + transaction)
6. Arbitrum Sepolia block explorer (transaction confirmation)

**Tone:** Confident, fast-paced, technical but accessible. No filler words. Every second of the video should show something real.

---

## SCENE 1 — HOOK (0:00–0:20)

**[SCREEN: NeuroCart dashboard — glowing green, animated, no wallet connected]**

**🎙️ VOICEOVER:**

> "What if an AI agent could get paid — automatically, trustlessly, with no human in the loop — every time it delivers quality work?"

**[SCREEN: Pause on the headline: "The First Trustless AI Agent Marketplace"]**

> "That's NeuroCart. And in the next four minutes, we're going to prove it works."

**[CUT TO: Terminal showing `forge test -v` output — green checkmarks scrolling]**

> "Seventeen tests. Seventeen passing. Let's go."

**[SCREEN: Final line: `17/17 TESTS PASSING ✅`]**

---

## SCENE 2 — THE PROBLEM (0:20–0:45)

**[SCREEN: Simple slide — bold white text on black]**

**🎙️ VOICEOVER:**

> "Eight-point-four billion dollars is spent on AI services every year. And every single dollar flows through centralized rails — Stripe, bank wires, and blind trust."

**[SCREEN: Three bullet points appear one by one]**
- ❌ No on-chain quality guarantees
- ❌ No portable reputation for AI agents
- ❌ No way for AI agents to pay other AI agents

> "If an AI delivers garbage, you can't prove it on-chain. If a provider freezes your account, you have no recourse. And if one AI agent wants to hire another? It still needs a human with a credit card. NeuroCart fixes all three."

---

## SCENE 3 — SANI REGISTERS HIS AGENT (0:45–1:30)

**[SCREEN: Browser — NeuroCart frontend, /register page]**

**🎙️ VOICEOVER:**

> "Meet Sani. He built an AI summarization bot powered by Claude. Let's register it on NeuroCart."

**[SCREEN: Sani connects MetaMask — wallet popup appears]**

> "Sani connects his wallet — MetaMask, Arbitrum Sepolia."

**[SCREEN: MetaMask connection approved. Address appears in Navbar.]**

**[SCREEN: Registration form — fills in: Name: 'SummarizerBot', Price: $2.00 USD, Skills: summarization, nlp]**

> "He names his agent, sets a price of two dollars — priced in USD. And here's where the first Chainlink service comes in."

**[SCREEN: Highlight the ETH equivalent field updating in real time]**

> "Chainlink's ETH/USD Data Feed converts that two dollars to the exact ETH equivalent — live, at market price. Manipulation-resistant. Always fair."

**[SCREEN: Click 'Register Agent' — MetaMask popup with 0.01 ETH stake]**

> "Registration requires a 0.01 ETH stake — Sani puts skin in the game. This stake is slashable if his bot delivers bad output."

**[SCREEN: Transaction confirmed. AgentCard appears on dashboard with ID #0, ERC-8004 badge, green dot 'Active']**

> "And just like that — Sani's bot has an on-chain identity. An ERC-8004 identity — verifiable, portable, permanent. Job completions, quality score, reputation — all live on-chain."

---

## SCENE 4 — SANI'S BOT GOES LIVE (x402) (1:30–2:00)

**[SCREEN: Terminal — `python sdk/demo_summarizer.py`]**

**🎙️ VOICEOVER:**

> "Sani starts his x402 Flask server. This is the AI agent backend — built with Coinbase's x402 protocol."

**[SCREEN: Terminal output scrolling]**
```
SummarizerBot starting...
ERC-8004 Identity: 0x4e6575726f...
Price: 2 USDC (Base Sepolia)
Server running at http://localhost:5000
Listening for JobCreated events on Arbitrum Sepolia...
```

> "The server announces its ERC-8004 identity, its price, and starts listening for on-chain job events. Sani's bot is now open for business — no accounts, no API keys required from clients."

---

## SCENE 5 — FINA HIRES THE BOT (2:00–3:00)

**[SCREEN: Browser — NeuroCart dashboard, Fina's wallet connected]**

**🎙️ VOICEOVER:**

> "Now meet Fina. She needs 50 articles summarized today. She opens NeuroCart."

**[SCREEN: Dashboard with agent cards — SummarizerBot visible with price, reputation, Chainlink badge]**

> "She sees Sani's SummarizerBot — $2.00, ERC-8004 verified, 47 completed jobs, 94 average quality score. Verifiable on-chain."

**[SCREEN: Click 'Hire Agent →' — HireModal opens]**

> "She clicks 'Hire Agent.' A modal appears with the exact ETH required — fetched live from Chainlink Data Feeds."

**[SCREEN: HireModal showing ETH amount, job description field]**

> "She types her job description — 'Summarize this article about the EU AI Act for a general audience.' She clicks 'Create Job.'"

**[SCREEN: MetaMask popup — value: 0.000847 ETH, function: createJob]**

> "MetaMask asks for confirmation. The ETH is sent — locked into the JobEscrow smart contract. Neither Sani nor Fina can touch it until Chainlink decides who gets it."

**[SCREEN: Transaction confirmed. Job appears in Jobs table — status: CREATED (blue badge)]**

> "Job created. The escrow is live."

---

## SCENE 6 — SANI'S BOT WORKS (3:00–3:30)

**[SCREEN: Split — left: browser (Job status: ACCEPTED), right: terminal (Sani's server)]**

**🎙️ VOICEOVER:**

> "Sani's bot detects the JobCreated event on-chain — automatically. It calls acceptJob, then runs Claude on Fina's text."

**[SCREEN: Terminal]**
```
JobCreated event: jobId=7, client=0xFina..., agent=0xSani...
Accepting job #7...
Running Claude summarization...
Summary generated (342 chars, quality estimate: 91/100)
Submitting result on-chain...
```

> "The bot submits the summary on-chain."

**[SCREEN: Browser — Job status changes from ACCEPTED to VERIFYING — purple badge glows]**

> "Status changes to VERIFYING — purple. This is where Chainlink takes over."

---

## SCENE 7 — CHAINLINK FUNCTIONS VERIFIES (3:30–4:00)

**[SCREEN: Diagram — Chainlink DON with verify-quality.js]**

**🎙️ VOICEOVER:**

> "The JobEscrow smart contract calls NeuroCartFunctions, which sends a request to the Chainlink Decentralized Oracle Network."

**[SCREEN: Code snippet — verify-quality.js]**
```javascript
// Running on the Chainlink DON — decentralized, tamper-proof
const response = await Functions.makeHttpRequest({
  url: "https://api.anthropic.com/v1/messages",
  headers: { "x-api-key": secrets.CLAUDE_API_KEY },
  data: { model: "claude-haiku-4-5-20251001",
    messages: [{ role: "user",
      content: "Score this summarization 0-100. Return only a number.\n\n[Fina's result]" }]
  }
});
return Functions.encodeUint256(score); // tamper-proof, on-chain
```

> "The DON runs our JavaScript — calls Claude API independently, gets a quality score, encodes it as a uint256, and delivers it back on-chain. Decentralized. Trustless. The node operators cannot lie about the score."

**[SCREEN: fulfillRequest callback — score: 91]**

> "Score: ninety-one. Above the threshold of eighty."

---

## SCENE 8 — PAYMENT RELEASED (4:00–4:20)

**[SCREEN: Browser — Job status: COMPLETED (green badge). Quality score badge: 91/100]**

**🎙️ VOICEOVER:**

> "Payment released. Sani receives 0.000847 ETH — the full amount, minus NeuroCart's 2.5% platform fee. His ERC-8004 reputation updates automatically — 48 completed jobs, 94.1 average score."

**[SCREEN: AgentCard — reputation ticking up live]**

> "If the score had been below eighty — Fina would get a full refund. Sani would lose part of his stake. The market self-regulates."

**[SCREEN: Fina's side — summary text visible in job result]**

> "Fina gets her summary. Quality-verified. On-chain proof. No middlemen. No Stripe. No trust required."

---

## SCENE 9 — x402 MACHINE-TO-MACHINE (4:20–4:45)

**[SCREEN: Terminal — `python sdk/demo_client.py`]**

**🎙️ VOICEOVER:**

> "And here's the part that makes this truly autonomous — x402 machine-to-machine payments."

**[SCREEN: Terminal output]**
```
[STEP 1] Checking provider health...
  ✓ ERC-8004: 0x4e657572...  ✓ x402: true  ✓ Status: active

[STEP 2] Requesting summarization (no payment)...
  ← HTTP 402 Payment Required
  Payment: 2 USDC → 0xSani... (Base Sepolia)

[STEP 3] Paying USDC autonomously...
  ✓ USDC transferred. tx: 0xabc123...

[STEP 4] Retrying with X-PAYMENT header...
  ← HTTP 200 OK
  Summary: "The EU AI Act establishes..."
  Blockchain job ID: 8 | Chainlink: pending verification
```

> "No human in the loop. No accounts. No API keys. An AI agent pays another AI agent — autonomously — in twelve seconds. This is the x402 protocol by Coinbase. This is the future of AI commerce."

---

## SCENE 10 — CLOSING (4:45–5:00)

**[SCREEN: NeuroCart dashboard — multiple agents, multiple jobs, some VERIFYING]**

**🎙️ VOICEOVER:**

> "NeuroCart. Seventeen tests passing. Full stack running. Three Chainlink services. ERC-8004. x402. The first trustless AI agent marketplace."

**[SCREEN: Fade to logo — NeuroCart in white, 'Cart' in green]**

> "We are not building another AI wrapper. We are building the trust layer for the autonomous AI economy."

**[SCREEN: GitHub URL — github.com/yt2025id-lab/NeuroCart]**

> "Built for the Chainlink Convergence Hackathon 2026."

---

## PRODUCTION CHECKLIST

- [ ] Screen record `forge test -v` in clean terminal (white text, dark background)
- [ ] Screen record `python sdk/demo_summarizer.py` showing server startup + event listening
- [ ] Screen record `python sdk/demo_client.py` showing full x402 flow (all 4 steps)
- [ ] Screen record frontend — wallet connect, agent list, hire modal, MetaMask confirm
- [ ] Screen record job status transitions: CREATED → ACCEPTED → VERIFYING → COMPLETED
- [ ] Add subtle background music (lo-fi tech, ~80 BPM, not distracting)
- [ ] Add captions/subtitles for all voiceover
- [ ] Add code highlight animations for Chainlink code snippets
- [ ] End card with GitHub URL + hackathon name
- [ ] Export: 1080p60, H.264, under 500MB

---

*NeuroCart · Chainlink Convergence Hackathon 2026 · CRE & AI Track*
