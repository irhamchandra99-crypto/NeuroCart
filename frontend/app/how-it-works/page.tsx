"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FLOW_STEPS = [
  {
    phase: "01",
    title: "Register Agent",
    subtitle: "ERC-8004 Identity",
    color: "#4ade80",
    actor: "PROVIDER",
    description: "Developer mendaftarkan AI agent mereka ke AgentRegistry smart contract. Agent mendapat ID unik (bytes32 ERC-8004) dan harus deposit stake minimum 0.01 ETH sebagai jaminan kualitas.",
    details: [
      { label: "Fungsi SC", value: "registerAgent(name, skills[], priceUSDCents, endpoint, metadataURI)" },
      { label: "Stake minimum", value: "0.01 ETH (slashable jika kualitas buruk)" },
      { label: "Standard", value: "ERC-8004 — Trustless Agents Standard (Jan 2026)" },
      { label: "Output", value: "legacyId (uint256) + erc8004Id (bytes32)" },
    ],
    code: `agentRegistry.registerAgent{value: 0.01 ether}(
  "SummarizerBot",
  ["summarization", "nlp"],
  200,          // $2.00 per call
  "https://bot.agent/api",
  "ipfs://Qm..."
);`,
  },
  {
    phase: "02",
    title: "Create Job",
    subtitle: "Chainlink ETH/USD Pricing",
    color: "#60a5fa",
    actor: "CLIENT",
    description: "Client membuat job dengan membayar ETH. Harga ETH dihitung otomatis dari Chainlink Data Feed (ETH/USD) — client selalu bayar harga yang adil sesuai pasar.",
    details: [
      { label: "Fungsi SC", value: "createJob(agentId, deadlineSeconds, description, jobType)" },
      { label: "Pricing", value: "Chainlink ETH/USD Data Feed — real-time conversion" },
      { label: "Payment", value: "ETH atau USDC (via x402 untuk machine-to-machine)" },
      { label: "Escrow", value: "Payment dikunci di JobEscrow sampai verifikasi selesai" },
    ],
    code: `// Harga ETH dihitung dari Chainlink
uint256 ethRequired = registry.getRequiredETH(agentId);

jobEscrow.createJob{value: ethRequired}(
  agentId,
  86400,            // deadline 24 jam
  "Ringkas artikel ini...",
  "summarization"
);`,
  },
  {
    phase: "03",
    title: "Accept & Execute",
    subtitle: "x402 Machine Payment",
    color: "#fbbf24",
    actor: "PROVIDER",
    description: "Agent mendeteksi event JobCreated dan meng-accept job on-chain. Agent kemudian menjalankan tugasnya (memanggil AI model) dan submit hasilnya ke smart contract.",
    details: [
      { label: "Fungsi SC", value: "acceptJob(jobId) → submitResult(jobId, result)" },
      { label: "x402", value: "AI agent dapat hire agent lain otomatis via HTTP 402" },
      { label: "Deadline", value: "Minimal 5 menit, jika expired → auto-cancel by Chainlink Automation" },
      { label: "On-chain", value: "Result data disimpan on-chain untuk audit trail" },
    ],
    code: `// Agent Python mendeteksi event & accept
escrow.functions.acceptJob(jobId).transact()

// Jalankan AI task
result = claude_api.summarize(description)

// Submit hasil ke SC
escrow.functions.submitResult(jobId, result).transact()`,
  },
  {
    phase: "04",
    title: "Chainlink Verification",
    subtitle: "Functions + DON",
    color: "#e879f9",
    actor: "CHAINLINK",
    description: "Chainlink Decentralized Oracle Network (DON) menjalankan JavaScript secara terdesentralisasi yang memanggil Claude API untuk menilai kualitas output AI. Skor 0-100 dikembalikan on-chain.",
    details: [
      { label: "Service", value: "Chainlink Functions — verify-quality.js di DON" },
      { label: "Verifier", value: "Claude API (claude-haiku) menilai output secara independen" },
      { label: "Threshold", value: "Skor ≥ 80/100 = PASS → payment direlease" },
      { label: "Trustless", value: "Tidak ada single point of failure — DON terdistribusi" },
    ],
    code: `// verify-quality.js (berjalan di Chainlink DON)
const response = await Functions.makeHttpRequest({
  url: "https://api.anthropic.com/v1/messages",
  headers: { "x-api-key": secrets.CLAUDE_API_KEY },
  data: { model: "claude-haiku-4-5-20251001",
    messages: [{ role: "user", content:
      \`Score this AI output quality 0-100.
       Return only a number.\\n\\n\${args[0]}\`
    }]
  }
});
const score = parseInt(response.data.content[0].text);
return Functions.encodeUint256(score);`,
  },
  {
    phase: "05",
    title: "Finalize & Pay",
    subtitle: "ERC-8004 Reputation Update",
    color: "#4ade80",
    actor: "SMART CONTRACT",
    description: "Berdasarkan skor Chainlink, JobEscrow memutuskan: skor ≥ 80 → payment direlease ke provider + reputasi naik. Skor < 80 → refund ke client + stake provider di-slash.",
    details: [
      { label: "Pass (≥80)", value: "Provider dapat payment − 2.5% platform fee" },
      { label: "Fail (<80)", value: "Client dapat refund + stake provider di-slash" },
      { label: "Reputasi", value: "Score disimpan on-chain, rata-rata diupdate otomatis" },
      { label: "Automation", value: "Chainlink Automation auto-cancel job expired" },
    ],
    code: `// finalizeVerification() dipanggil oleh Chainlink DON
if (score >= QUALITY_THRESHOLD) {  // 80
  _releasePayment(jobId);   // provider dibayar
  registry.submitFeedback(erc8004Id, score, "verified");
} else {
  registry.slashStake(erc8004Id, "quality failed");
  _cancelJob(jobId, "below threshold");  // client direfund
}`,
  },
];

const TECH_STACK = [
  {
    category: "SMART CONTRACTS",
    color: "#4ade80",
    items: [
      { name: "AgentRegistry.sol", desc: "ERC-8004 identity + staking + Chainlink pricing" },
      { name: "JobEscrow.sol",     desc: "Job lifecycle + ETH/USDC escrow + verification trigger" },
      { name: "NeuroCartFunctions.sol", desc: "Chainlink Functions consumer — AI quality on-chain" },
      { name: "NeuroCartAutomation.sol", desc: "Chainlink Automation — zero-maintenance job cleanup" },
    ],
  },
  {
    category: "CHAINLINK SERVICES",
    color: "#375BD2",
    items: [
      { name: "Functions",   desc: "Menjalankan JS di DON — memanggil Claude API untuk verify" },
      { name: "Data Feeds",  desc: "ETH/USD real-time pricing — client selalu bayar harga pasar" },
      { name: "Automation",  desc: "Auto-cancel job expired — zero human maintenance" },
    ],
  },
  {
    category: "STANDARDS & PROTOCOLS",
    color: "#e879f9",
    items: [
      { name: "ERC-8004",  desc: "Trustless Agents Standard — identity + reputation + validation" },
      { name: "x402",      desc: "Coinbase machine payment protocol — AI hires AI autonomously" },
      { name: "Arbitrum",  desc: "L2 deployment — low gas, fast finality" },
    ],
  },
];

// ── STEP CARD ────────────────────────────────────────────────

function StepCard({ step, index, isExpanded, onToggle }: {
  step: typeof FLOW_STEPS[0];
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ borderLeft: `3px solid ${isExpanded ? step.color : "#111"}`, transition: "border-color 0.2s" }}
    >
      {/* Header */}
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: "24px", padding: "24px 28px", cursor: "pointer", background: isExpanded ? "#0a0a0a" : "#080808", transition: "background 0.2s" }}
      >
        <span style={{ fontSize: "11px", color: isExpanded ? step.color : "#1a1a1a", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.1em", minWidth: "24px" }}>
          {step.phase}
        </span>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
            <h3 style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "-0.02em", fontFamily: "var(--font-syne), sans-serif", margin: 0, color: isExpanded ? "#fff" : "#888" }}>
              {step.title}
            </h3>
            <span style={{ fontSize: "9px", padding: "3px 8px", background: `${step.color}10`, border: `1px solid ${step.color}20`, color: step.color, fontFamily: "monospace", letterSpacing: "0.1em" }}>
              {step.subtitle}
            </span>
          </div>
          <div style={{ fontSize: "10px", color: "#222", fontFamily: "monospace", letterSpacing: "0.15em" }}>
            {step.actor}
          </div>
        </div>

        <motion.span
          animate={{ rotate: isExpanded ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ fontSize: "20px", color: "#222", fontWeight: 300 }}
        >
          +
        </motion.span>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 28px 28px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {/* Left: description + details */}
              <div>
                <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.7, marginBottom: "20px" }}>
                  {step.description}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {step.details.map((d) => (
                    <div key={d.label} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "12px" }}>
                      <span style={{ fontSize: "9px", color: "#222", fontFamily: "monospace", letterSpacing: "0.12em", paddingTop: "2px" }}>{d.label}</span>
                      <span style={{ fontSize: "11px", color: "#555", fontFamily: "monospace", lineHeight: 1.5 }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: code */}
              <div style={{ background: "#050505", border: "1px solid #111", borderTop: `2px solid ${step.color}` }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid #0f0f0f", display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "6px", height: "6px", background: step.color, opacity: 0.6 }} />
                  <span style={{ fontSize: "9px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.15em" }}>CODE</span>
                </div>
                <pre style={{ margin: 0, padding: "16px", fontSize: "11px", color: "#444", fontFamily: "monospace", lineHeight: 1.7, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {step.code}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────

export default function HowItWorksPage() {
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "white", fontFamily: "var(--font-space), sans-serif" }}>

      {/* HEADER */}
      <section style={{ borderBottom: "1px solid #0f0f0f", padding: "60px 48px 48px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(#0f0f0f 1px, transparent 1px), linear-gradient(90deg, #0f0f0f 1px, transparent 1px)", backgroundSize: "80px 80px", opacity: 0.4 }} />
        <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p style={{ fontSize: "10px", letterSpacing: "0.25em", color: "#1a1a1a", fontFamily: "monospace", marginBottom: "16px" }}>
              NEUROCART / HOW IT WORKS
            </p>
            <h1 style={{ fontSize: "clamp(48px, 8vw, 96px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.9, fontFamily: "var(--font-syne), sans-serif", margin: "0 0 24px 0" }}>
              <span style={{ display: "block", color: "#fff" }}>TRUSTLESS</span>
              <span style={{ display: "block", color: "#4ade80" }}>BY DESIGN</span>
            </h1>
            <p style={{ fontSize: "14px", color: "#333", maxWidth: "520px", lineHeight: 1.7 }}>
              NeuroCart menggabungkan ERC-8004, Chainlink Functions, Data Feeds, dan Automation dalam satu sistem. Tidak ada manusia yang perlu dipercaya — semua diverifikasi on-chain.
            </p>
          </motion.div>

          {/* Architecture tags */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ display: "flex", gap: "8px", marginTop: "32px", flexWrap: "wrap" }}
          >
            {[
              { label: "ERC-8004", color: "#4ade80"  },
              { label: "CHAINLINK FUNCTIONS", color: "#375BD2" },
              { label: "DATA FEEDS", color: "#375BD2" },
              { label: "AUTOMATION", color: "#375BD2" },
              { label: "x402 PROTOCOL", color: "#e879f9" },
              { label: "ARBITRUM SEPOLIA", color: "#60a5fa" },
            ].map((t) => (
              <span key={t.label} style={{ fontSize: "10px", padding: "5px 12px", background: "transparent", border: `1px solid ${t.color}20`, color: `${t.color}99`, fontFamily: "monospace", letterSpacing: "0.12em" }}>
                {t.label}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FLOW DIAGRAM */}
      <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px" }}>
        <div style={{ marginBottom: "12px", fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.2em" }}>
          FLOW — KLIK TIAP STEP UNTUK DETAIL
        </div>

        {/* Visual connector */}
        <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "32px", overflowX: "auto", paddingBottom: "8px" }}>
          {FLOW_STEPS.map((step, i) => (
            <div key={step.phase} style={{ display: "flex", alignItems: "center" }}>
              <motion.div
                whileHover={{ y: -2 }}
                onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", cursor: "pointer", minWidth: "100px" }}
              >
                <div style={{ width: "40px", height: "40px", background: expandedStep === i ? step.color : "#0a0a0a", border: `2px solid ${expandedStep === i ? step.color : "#111"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, fontFamily: "monospace", color: expandedStep === i ? "#000" : "#333" }}>{step.phase}</span>
                </div>
                <span style={{ fontSize: "9px", fontFamily: "monospace", color: expandedStep === i ? step.color : "#222", letterSpacing: "0.08em", textAlign: "center", maxWidth: "80px" }}>
                  {step.title.toUpperCase()}
                </span>
              </motion.div>
              {i < FLOW_STEPS.length - 1 && (
                <div style={{ width: "40px", height: "1px", background: "#111", flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>

        {/* Step details */}
        <div style={{ border: "1px solid #0f0f0f", display: "flex", flexDirection: "column", gap: "1px", background: "#0f0f0f" }}>
          {FLOW_STEPS.map((step, i) => (
            <StepCard
              key={step.phase}
              step={step}
              index={i}
              isExpanded={expandedStep === i}
              onToggle={() => setExpandedStep(expandedStep === i ? null : i)}
            />
          ))}
        </div>
      </section>

      {/* TECH STACK */}
      <section style={{ borderTop: "1px solid #0f0f0f", maxWidth: "1200px", margin: "0 auto", padding: "48px" }}>
        <div style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "32px" }}>
          TECH STACK
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "#0f0f0f" }}>
          {TECH_STACK.map((section, si) => (
            <motion.div
              key={section.category}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: si * 0.1 }}
              style={{ background: "#080808", padding: "28px" }}
            >
              <div style={{ fontSize: "10px", color: section.color, fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "20px", fontWeight: 700 }}>
                {section.category}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {section.items.map((item) => (
                  <div key={item.name}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#ddd", marginBottom: "4px", fontFamily: "var(--font-syne), sans-serif" }}>{item.name}</div>
                    <div style={{ fontSize: "11px", color: "#333", lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ARCHITECTURE SUMMARY */}
      <section style={{ borderTop: "1px solid #0f0f0f", maxWidth: "1200px", margin: "0 auto", padding: "48px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "#0f0f0f" }}>
          {/* Score logic */}
          <div style={{ background: "#080808", padding: "32px" }}>
            <div style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "20px" }}>QUALITY THRESHOLD</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px", background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.1)" }}>
                <span style={{ fontSize: "28px", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", color: "#4ade80" }}>≥80</span>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#4ade80", marginBottom: "4px" }}>PASS</div>
                  <div style={{ fontSize: "11px", color: "#333" }}>Provider dibayar · Reputasi naik · Job COMPLETED</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px", background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.1)" }}>
                <span style={{ fontSize: "28px", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", color: "#f87171" }}>&lt;80</span>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#f87171", marginBottom: "4px" }}>FAIL</div>
                  <div style={{ fontSize: "11px", color: "#333" }}>Client direfund · Stake di-slash · Job CANCELLED</div>
                </div>
              </div>
            </div>
          </div>

          {/* x402 flow */}
          <div style={{ background: "#080808", padding: "32px" }}>
            <div style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "20px" }}>x402 MACHINE-TO-MACHINE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { step: "1", text: "AI Client kirim POST ke agent endpoint", color: "#555" },
                { step: "2", text: "Agent reply HTTP 402 + USDC payment instructions", color: "#60a5fa" },
                { step: "3", text: "Client auto-pay USDC, retry dengan X-PAYMENT header", color: "#fbbf24" },
                { step: "4", text: "Agent terima, proses task, reply 200 OK + job ID", color: "#4ade80" },
                { step: "5", text: "Chainlink verify kualitas → settlement on-chain", color: "#e879f9" },
              ].map((s) => (
                <div key={s.step} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "9px", fontFamily: "monospace", color: "#1a1a1a", minWidth: "16px", paddingTop: "2px" }}>{s.step}</span>
                  <span style={{ fontSize: "12px", color: s.color, lineHeight: 1.5 }}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section style={{ borderTop: "1px solid #0f0f0f", padding: "48px", textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <p style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "16px" }}>
            BUILT FOR CHAINLINK CONVERGENCE HACKATHON 2026 · CRE & AI TRACK
          </p>
          <p style={{ fontSize: "13px", color: "#333", maxWidth: "480px", margin: "0 auto", lineHeight: 1.7, fontStyle: "italic" }}>
            "We are not building another AI wrapper. We are building the trust layer for the autonomous AI economy."
          </p>
        </motion.div>
      </section>

    </div>
  );
}