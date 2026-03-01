# 🏆 NEUROCART — HACKATHON WIN PLAN
## Chainlink "Convergence" Hackathon | Deadline: 8 Maret 2026 (7 hari tersisa!)

---

## 🎯 TRACK TARGET

**Primary: CRE & AI Track → Hadiah $17,000 (Juara 1)**
> *"AI agents consuming CRE workflows and autonomous decision-making systems"*

Ini adalah track yang **paling sesuai** dengan proyek kita. AI Agent Marketplace + Chainlink = perfect fit.

**Bonus Specialty Track:**
- **Tenderly Virtual TestNets** → +$5,000 (deploy di sana, hampir gratis nilainya)

**Total potensi: $22,000** jika menang keduanya.

---

## 🔑 MASALAH BESAR DI PROYEK SEKARANG (Mata Juri Akan Langsung Lihat)

| Kelemahan | Impact |
|---|---|
| Verifikasi hasil AI hanya pakai hash comparison | Mudah dicurangi, tidak trustless |
| Frontend masih pakai mock data | Tidak ada koneksi blockchain nyata |
| Tidak ada Chainlink sama sekali | Ini hackathon CHAINLINK — wajib ada |
| Polling setiap 5 detik di SDK | Tidak efisien, tidak production-ready |
| Tidak ada staking/slashing | Tidak ada skin-in-the-game untuk agen |
| AgentRegistry custom-built, tidak pakai standard | Juri tahu kita tidak aware ERC-8004 |
| Tidak ada agent-to-agent HTTP payment | Bukan "autonomous" kalau masih manual |

---

## 💡 SENJATA UTAMA: CHAINLINK FUNCTIONS UNTUK VERIFIKASI AI

**Masalah yang kita selesaikan:**
> *"Bagaimana kita bisa memverifikasi kualitas output AI agent secara trustless di blockchain?"*

**Solusi NeuroCart:**

```
Client bayar → ETH terkunci di escrow
       ↓
AI Agent selesaikan task (off-chain)
       ↓
Agent submit hasil ke blockchain
       ↓
🔗 Chainlink Functions dipanggil otomatis
       ↓
Chainlink DON memanggil AI Quality Verification API
       ↓
Skor kualitas dikembalikan ke smart contract
       ↓
Jika skor ≥ 80%: payment release otomatis ✅
Jika skor < 80%: ETH refund ke client ❌
```

Ini **novel**, **trustless**, dan **benar-benar pakai Chainlink** — trifecta menang hackathon.

---

## 🆕 DUA SENJATA TAMBAHAN: ERC-8004 + x402

### ERC-8004 — "Trustless Agents" Standard (live mainnet 29 Jan 2026)

ERC-8004 adalah Ethereum standard resmi untuk AI agents. Dibuat oleh MetaMask, Ethereum Foundation, Google, dan Coinbase. Mendefinisikan 3 registry onchain:

| Registry | Fungsi | Implementasi di NeuroCart |
|---|---|---|
| **Identity** | Setiap agent punya ID unik + metadata off-chain | Gantikan `AgentRegistry.sol` custom kita dengan interface ERC-8004 |
| **Reputation** | On-chain audit trail feedback dari client | Sistem reputasi kita sudah 70% aligned — tinggal implement interface-nya |
| **Validation** | Task verification via crypto-economic staking | Gabungkan dengan Chainlink Functions untuk double verification |

**Kenapa ini penting untuk hackathon:**
Kalau kita bangun `AgentRegistry.sol` sendiri tanpa implement ERC-8004, juri akan tahu kita tidak aware ekosistem. Sebaliknya, kalau kita **implement ERC-8004 + extend dengan Chainlink** — kita tunjukkan kita membangun di atas standard industry, bukan reinvent the wheel.

---

### x402 — HTTP Payment Protocol (Coinbase, 156K tx/minggu)

x402 adalah protocol Coinbase untuk agent-to-agent micropayments via HTTP. Diintegrasikan ke Google Agent Payments Protocol (AP2). Cara kerja:

```
Tanpa x402 (sekarang — butuh manusia):
Human → MetaMask → createJob() → ETH terkunci → agent polling → submit

Dengan x402 (truly autonomous):
Client Agent → HTTP GET https://summarizer-agent.com/api/summarize
             ← 402 Payment Required
               { "amount": "0.002", "token": "USDC", "network": "base" }
Client Agent → bayar USDC otomatis (no human)
             → HTTP GET (retry dengan payment header)
Provider Agent → jalankan task
             → submit result ke blockchain
Chainlink Functions → verify kualitas
             → release payment dari escrow ✅
```

**Kenapa ini game-changer:**
- Agent benar-benar **autonomous** — tidak perlu manusia approve setiap transaksi
- USDC stablecoin — tidak ada volatilitas harga saat pembayaran
- Kompatibel dengan Google A2A protocol — bisa interop dengan agent lain di luar NeuroCart
- x402 Foundation sudah didukung Coinbase + Cloudflare — juri tahu ini ekosistem nyata

---

## 🏗️ ARSITEKTUR UPGRADE (GAMBARAN BESAR)

```
┌──────────────────────────────────────────────────────────────┐
│                     NEUROCART v2.0                            │
│                                                               │
│  Frontend (Next.js + wagmi)                                  │
│  ├── Connect Wallet (MetaMask/WalletConnect)                 │
│  ├── Browse & Hire Agents (real blockchain data)             │
│  ├── Real-time Job Status (via events)                       │
│  └── Agent Dashboard + Reputation Score                      │
│                                                               │
│  x402 Layer (HTTP Payment)                                   │
│  ├── Provider Agent HTTP endpoint (x402-enabled)             │
│  ├── Client Agent auto-pay USDC via HTTP 402                 │
│  └── Kompatibel dengan Google A2A Protocol                   │
│                                                               │
│  Smart Contracts (Arbitrum Sepolia)                          │
│  ├── AgentRegistry.sol → implement ERC-8004 interface        │
│  │   (Identity + Reputation + Validation registries)         │
│  ├── JobEscrow.sol (upgraded + Functions integration)        │
│  ├── NeuroCartFunctions.sol ← BARU (Chainlink Functions)     │
│  └── NeuroCartAutomation.sol ← BARU (Chainlink Auto)        │
│                                                               │
│  Python SDK (upgraded)                                       │
│  ├── Real AI integration (Claude/OpenAI API)                 │
│  ├── x402 payment handler (auto-pay USDC)                    │
│  ├── Event-driven (bukan polling)                            │
│  └── ERC-8004 compliant agent registration                   │
│                                                               │
│  Chainlink Stack                                              │
│  ├── 🔗 Functions → AI quality verification                  │
│  ├── 🔗 Automation → Auto-cancel expired jobs                │
│  └── 🔗 Data Feeds → ETH/USD dynamic pricing                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 📋 PEMBAGIAN TUGAS TIM (7 Hari)

### 👨‍💻 PERSON 1 — Smart Contract Dev

**Hari 1-3:**
- [ ] Upgrade `AgentRegistry.sol` → implement ERC-8004 Identity + Reputation + Validation interface
- [ ] Tambah staking ke AgentRegistry (agent harus stake 0.01 ETH saat register)
- [ ] Buat `NeuroCartFunctions.sol` → Chainlink Functions consumer
- [ ] Upgrade `JobEscrow.sol` → integrasikan dengan Functions untuk verifikasi + support x402 USDC payment
- [ ] Buat `NeuroCartAutomation.sol` → Chainlink Automation untuk expired jobs

**Hari 4:**
- [ ] Deploy semua ke Arbitrum Sepolia
- [ ] Fund contracts dengan LINK token
- [ ] Jalankan forge test semua contract

**Deliverable:** 4 smart contracts ter-deploy, ERC-8004 compliant, semua test pass

---

### 👨‍💻 PERSON 2 — Frontend Dev

**Hari 1-2:**
- [ ] Install wagmi + viem + RainbowKit di frontend
- [ ] Hapus semua MOCK_DATA, ganti dengan real contract reads
- [ ] Implementasi wallet connect flow

**Hari 3-4:**
- [ ] Buat halaman "Hire Agent" (createJob dengan ETH)
- [ ] Real-time job status updates via blockchain events
- [ ] Dashboard agent (register, lihat jobs, lihat earnings)

**Hari 5:**
- [ ] Polish UI, responsif, smooth animations
- [ ] Deploy ke Vercel

**Deliverable:** Frontend live di Vercel, full wallet integration

---

### 👨‍💻 PERSON 3 — AI/SDK Dev

**Hari 1-2:**
- [ ] Integrasikan Claude API atau OpenAI ke `example_agent.py`
- [ ] Implement x402 payment handler di SDK (agent client auto-pay USDC)
- [ ] Ganti polling menjadi event-driven (pakai web3 event filter)
- [ ] Buat Chainlink Functions source code (JavaScript) untuk AI verification

**Hari 3-4:**
- [ ] Buat `demo_summarizer.py` — agent provider dengan x402 HTTP endpoint
- [ ] Buat `demo_client.py` — agent client yang hire via x402 (fully autonomous)
- [ ] Test end-to-end: client agent hire → x402 auto-pay → agent kerja → Chainlink verify → payment release

**Hari 5-6:**
- [ ] Rekam video demo 3-5 menit
- [ ] Tulis README yang detail (cantumkan semua Chainlink + ERC-8004 + x402 links)

**Deliverable:** Demo agent berjalan autonomous via x402, video siap upload, README lengkap

---

## 🔗 DETAIL CHAINLINK INTEGRATIONS

### 1. Chainlink Functions (PRIORITAS UTAMA)

**Apa yang dilakukan:**
Smart contract memanggil external API untuk memverifikasi kualitas hasil AI agent secara trustless.

**Source code JavaScript yang dijalankan di DON:**
```javascript
// Dipanggil oleh Chainlink Functions DON
// Input: hasil AI agent (sebagai string)
// Output: skor kualitas 0-100

const result = args[0]; // hasil AI agent
const jobType = args[1]; // "summarization", "translation", dll

// Panggil API verifikasi (bisa pakai Claude, GPT-4, dll)
const response = await Functions.makeHttpRequest({
  url: "https://api.anthropic.com/v1/messages",
  method: "POST",
  headers: {
    "x-api-key": secrets.CLAUDE_API_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
  },
  data: {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 10,
    messages: [{
      role: "user",
      content: `Rate the quality of this AI output from 0-100. Output ONLY the number.\n\nOutput: ${result}`
    }]
  }
});

const score = parseInt(response.data.content[0].text.trim());
return Functions.encodeUint256(score);
```

**Smart contract menerima skor ini dan otomatis release/refund payment.**

---

### 4. ERC-8004 — Standard Agent Identity & Reputation

**Apa yang dilakukan:**
Implement 3 registry resmi dari ERC-8004 agar NeuroCart compatible dengan ekosistem AI agent yang lebih luas.

```solidity
// AgentRegistry.sol — implement IERC8004
interface IERC8004 {
    // Identity Registry
    function registerAgent(bytes32 agentId, string calldata metadataURI) external;
    function getAgentMetadata(bytes32 agentId) external view returns (string memory);

    // Reputation Registry
    function submitFeedback(bytes32 agentId, uint8 score, string calldata comment) external;
    function getReputation(bytes32 agentId) external view returns (uint256 avgScore, uint256 totalFeedback);

    // Validation Registry
    function stakeForValidation(bytes32 agentId) external payable;
    function slashStake(bytes32 agentId, string calldata reason) external;
}
```

Dengan ini, agent yang terdaftar di NeuroCart **interoperable** dengan dApps lain yang implement ERC-8004.

---

### 5. x402 — Agent-to-Agent HTTP Payment

**Apa yang dilakukan:**
Provider agent expose HTTP endpoint. Client agent bayar otomatis via x402 tanpa manusia.

```python
# demo_summarizer.py — Provider Agent (x402-enabled server)
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/api/summarize", methods=["GET", "POST"])
def summarize():
    # Cek apakah ada payment header dari x402
    payment_header = request.headers.get("X-PAYMENT")

    if not payment_header:
        # Belum bayar — kembalikan 402 dengan instruksi payment
        return jsonify({
            "x402Version": 1,
            "accepts": [{
                "scheme": "exact",
                "network": "base-sepolia",
                "maxAmountRequired": "2000000",  # 2 USDC (6 decimals)
                "resource": "https://summarizer-agent.neurocart.xyz/api/summarize",
                "description": "AI Summarization - per request",
                "mimeType": "application/json",
                "payTo": "0xYourAgentWalletAddress",
                "maxTimeoutSeconds": 300,
                "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  # USDC Base Sepolia
            }]
        }), 402

    # Payment valid — jalankan AI task
    article_url = request.json.get("url")
    summary = call_claude_api(article_url)  # Claude API

    # Submit result ke blockchain + trigger Chainlink Functions verification
    submit_to_blockchain(summary)

    return jsonify({"summary": summary, "status": "completed"})
```

```python
# demo_client.py — Client Agent (x402 auto-pay)
import x402  # pip install x402

client = x402.Client(private_key=os.getenv("PRIVATE_KEY"), network="base-sepolia")

# Satu baris — agent otomatis bayar dan retry
response = client.get("https://summarizer-agent.neurocart.xyz/api/summarize",
                       json={"url": "https://example.com/article"})

print(response.json())  # {"summary": "...", "status": "completed"}
```

---

### 2. Chainlink Automation

**Apa yang dilakukan:**
Auto-cancel jobs yang melewati deadline — tidak perlu manusia memanggil `cancelExpiredJob()`.

```solidity
// NeuroCartAutomation.sol
function checkUpkeep(bytes calldata) external view returns (bool, bytes memory) {
    for (uint i = 0; i < escrow.jobCount(); i++) {
        Job memory job = escrow.jobs(i);
        if (block.timestamp > job.deadline &&
            (job.status == JobStatus.CREATED || job.status == JobStatus.ACCEPTED)) {
            return (true, abi.encode(i));
        }
    }
    return (false, "");
}

function performUpkeep(bytes calldata performData) external {
    uint256 jobId = abi.decode(performData, (uint256));
    escrow.cancelExpiredJob(jobId);
}
```

---

### 3. Chainlink Data Feeds

**Apa yang dilakukan:**
Agent menetapkan harga dalam USD, bukan ETH. Client bayar dalam ETH dengan kurs real-time.

```solidity
// Di JobEscrow.sol
AggregatorV3Interface priceFeed = AggregatorV3Interface(
    0x62CAe0FA2da220f43a51F86Db2EDb36DcA9A5A08 // ETH/USD Arbitrum Sepolia
);

function getRequiredETH(uint256 agentId) public view returns (uint256) {
    uint256 priceUSD = registry.agents(agentId).pricePerCallUSD; // harga dalam USD cents
    (, int256 ethPrice,,,) = priceFeed.latestRoundData();
    // Konversi: berapa ETH yang dibutuhkan untuk membayar priceUSD
    return (priceUSD * 1e18) / uint256(ethPrice / 1e8);
}
```

---

## 📁 STRUKTUR FILE BARU

```
NeuroCart/
├── src/
│   ├── interfaces/
│   │   └── IERC8004.sol            ← BARU (ERC-8004 interface)
│   ├── AgentRegistry.sol           (UPGRADE: implement ERC-8004 + staking)
│   ├── JobEscrow.sol               (UPGRADE: Functions + x402 USDC support)
│   ├── NeuroCartFunctions.sol      ← BARU (Chainlink Functions consumer)
│   └── NeuroCartAutomation.sol     ← BARU (Chainlink Automation)
├── chainlink/
│   └── verify-quality.js           ← BARU (Functions DON source code)
├── sdk/
│   ├── agent_sdk.py                (UPGRADE: event-driven + x402 + ERC-8004)
│   ├── demo_summarizer.py          ← BARU (provider agent, x402 HTTP server)
│   └── demo_client.py              ← BARU (client agent, x402 auto-pay)
├── frontend/
│   └── ...                         (UPGRADE: wagmi + real blockchain reads)
└── script/
    └── Deploy.s.sol                 ← BARU (deployment script lengkap)
```

---

## 🎬 SKENARIO DEMO VIDEO (3-5 Menit)

**Narasi demo yang akan direkam:**

```
[00:00] Opening — Hook
        "Masalah: AI agent yang kita hire bisa saja kirim hasil jelek
         tapi tetap minta dibayar. Siapa yang memutuskan?"
        → Jawaban: Chainlink Functions + ERC-8004 + x402

[00:30] Show arsitektur singkat
        Diagram: x402 (payment) → ERC-8004 (identity) → Chainlink (verify)

[01:00] Demo AUTONOMOUS agent-to-agent transaction
        → Jalankan demo_client.py di terminal
        → Client agent kirim HTTP request ke SummarizerBot endpoint
        → Terminal: "402 Payment Required — membayar 2 USDC otomatis..."
        → Terminal: "Payment sukses, menunggu hasil..."
        (No human approved anything!)

[01:45] SummarizerBot kerja
        → Terminal provider: "Job diterima via x402, memanggil Claude API..."
        → Ringkasan artikel selesai
        → "Submitting result ke blockchain..."

[02:15] Chainlink Functions verification
        → Show Chainlink Functions explorer
        → DON nodes memverifikasi kualitas ringkasan
        → Skor: 91/100 ✅ — threshold terpenuhi

[02:45] Payment release + reputasi naik
        → Frontend update: job COMPLETED
        → ERC-8004 Reputation Registry diupdate onchain
        → Balance SummarizerBot naik 2 USDC

[03:15] Demo Chainlink Automation
        → Buat job baru, tidak ada yang accept
        → Fast-forward: deadline lewat
        → "Automation mendeteksi expired job, auto-cancel..."
        → Refund kembali ke client

[03:45] Closing — Show semua integrasi
        → ERC-8004: agent identity & reputation standard
        → x402: autonomous HTTP payment, no human needed
        → Chainlink Functions: trustless AI quality verification
        → Chainlink Automation: autonomous lifecycle management
        → Chainlink Data Feeds: real-time ETH/USD pricing
```

---

## 📝 CHECKLIST SUBMISSION

- [ ] GitHub repo public
- [ ] README mencantumkan semua Chainlink contract addresses
- [ ] README mencantumkan ERC-8004 implementation details
- [ ] README mencantumkan x402 endpoint URL provider agent
- [ ] Contract ter-deploy di Arbitrum Sepolia (atau Tenderly VNet)
- [ ] Video demo 3-5 menit (upload YouTube/Loom)
- [ ] End-to-end demo berjalan autonomous via x402 (CLI)
- [ ] Chainlink Functions subscription funded dengan LINK
- [ ] Chainlink Automation upkeep terdaftar
- [ ] x402 provider agent ter-deploy dan accessible via HTTPS

---

## 🏅 KENAPA INI LAYAK MENANG JUARA 1

| Kriteria Juri | Nilai NeuroCart |
|---|---|
| **Inovasi** | Gabungan x402 + ERC-8004 + Chainlink Functions untuk AI verification — belum ada yang buat ini |
| **Chainlink Integration** | 3 produk Chainlink: Functions + Automation + Data Feeds |
| **Standards Compliance** | ERC-8004 compliant (live mainnet Jan 2026) — menunjukkan awareness ekosistem |
| **True Autonomy** | x402 payment = agent-to-agent tanpa manusia, bukan sekedar demo scripted |
| **Kelengkapan** | Full stack: Smart contract + SDK + Frontend + Demo agent live |
| **Problem Statement** | Jelas: "trustless AI quality verification + autonomous agent economy" |
| **Demo Quality** | Live end-to-end autonomous transaction, bukan slides |
| **Track Alignment** | CRE & AI = "AI agents consuming CRE workflows" — exact match |
| **Ekosistem Awareness** | x402 sudah terintegrasi Google A2A Protocol — proyek kita interoperable |

---

## ⚡ PRIORITAS HARI INI (Hari 1)

1. **Contract dev:** Install Chainlink dependencies
   ```bash
   forge install smartcontractkit/chainlink-brownie-contracts
   ```

2. **Frontend dev:** Install wagmi + RainbowKit
   ```bash
   npm install wagmi viem @rainbow-me/rainbowkit
   ```

3. **SDK dev:** Daftar ke Anthropic API atau OpenAI, test Claude haiku call + install x402 Python library
   ```bash
   pip install x402 flask web3 anthropic python-dotenv
   ```

4. **Semua:** Setup Arbitrum Sepolia di MetaMask, dapat faucet ETH & LINK + USDC Base Sepolia

---

## 🔗 LINK PENTING

| Resource | URL |
|---|---|
| Faucet ETH Arbitrum Sepolia | https://faucet.quicknode.com/arbitrum/sepolia |
| Faucet LINK | https://faucets.chain.link/arbitrum-sepolia |
| Chainlink Functions Subscription | https://functions.chain.link |
| Chainlink Automation | https://automation.chain.link |
| Chainlink Data Feeds (Arbitrum) | https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum |
| ERC-8004 Official EIP | https://eips.ethereum.org/EIPS/eip-8004 |
| ERC-8004 Resources (awesome list) | https://github.com/sudeepb02/awesome-erc8004 |
| x402 Official Docs | https://docs.cdp.coinbase.com/x402/welcome |
| x402 GitHub (Coinbase) | https://github.com/coinbase/x402 |
| x402 Website | https://www.x402.org |
| Tenderly Virtual TestNets | https://tenderly.co/virtual-testnets |
| Hackathon Submission | https://chain.link/hackathon |
