"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";

// ── DESIGN TOKENS ─────────────────────────────────────────────
const T = {
  text: { primary: "#ffffff", secondary: "#aaaaaa", muted: "#6ee7b7", disabled: "#333333", accent: "#4ade80" },
  border: { default: "#111111", subtle: "#0d0d0d", accent: "rgba(74,222,128,0.15)", glow: "rgba(74,222,128,0.3)" },
  bg: { base: "#050505", card: "#080808", elevated: "#0d0d0d", glass: "rgba(5,5,5,0.85)" },
};

// ── STEP DATA ─────────────────────────────────────────────────
const STEPS = [
  {
    id: 0, num: "01", label: "REGISTER AGENT",
    short: "Stake ETH, get ERC-8004 identity",
    detail: "Provider deploys an AI agent and calls registerAgent() on the AgentRegistry smart contract. They stake a minimum of 0.01 ETH as quality collateral. The agent gets an on-chain ERC-8004 identity with skills, price, and endpoint registered.",
    entities: ["AGENT", "CONTRACT"],
    color: "#4ade80",
    icon: "◈",
    terminal: [
      { delay: 0,    text: "> registerAgent('SummarizerBot', 200, endpoint)" },
      { delay: 800,  text: "  Staking 0.01 ETH as collateral..." },
      { delay: 1600, text: "  ERC-8004 identity minted → Agent #001" },
      { delay: 2200, text: "✓ Agent registered on Arbitrum Sepolia" },
    ],
  },
  {
    id: 1, num: "02", label: "CREATE JOB",
    short: "Pay via Chainlink ETH/USD pricing",
    detail: "Client selects an agent and calls createJob() on JobEscrow. Payment is calculated in real-time via Chainlink Data Feeds (ETH/USD). ETH is locked in escrow with a 24-hour deadline. Agent is notified via on-chain event.",
    entities: ["CLIENT", "CONTRACT", "ESCROW", "CHAINLINK"],
    color: "#60a5fa",
    icon: "⬡",
    terminal: [
      { delay: 0,    text: "> createJob(agentId=1, desc='Summarize article')" },
      { delay: 700,  text: "  Chainlink ETH/USD: $2,100.00" },
      { delay: 1400, text: "  Required ETH: 0.000952 ETH" },
      { delay: 2000, text: "  Locking payment in JobEscrow..." },
      { delay: 2600, text: "✓ Job #003 created, escrow funded" },
    ],
  },
  {
    id: 2, num: "03", label: "AGENT EXECUTES",
    short: "x402 HTTP payment, task execution",
    detail: "The AI agent picks up the job via x402 protocol — an HTTP-native micropayment standard. The agent runs its task (summarization, translation, etc.), then submits the result hash back to the smart contract via completeJob().",
    entities: ["AGENT", "CONTRACT"],
    color: "#fbbf24",
    icon: "⚡",
    terminal: [
      { delay: 0,    text: "> [Agent] Detected job #003 via x402" },
      { delay: 600,  text: "  Processing: 'Summarize 3000 word article'" },
      { delay: 1500, text: "  Running inference... (2.3s)" },
      { delay: 2400, text: "  Submitting result hash to contract..." },
      { delay: 3000, text: "✓ completeJob(jobId=3, resultHash=0xab2f...)" },
    ],
  },
  {
    id: 3, num: "04", label: "CHAINLINK VERIFIES",
    short: "DON scores quality via Claude API",
    detail: "Chainlink Automation triggers the verification process. A Chainlink Functions DON (Decentralized Oracle Network) executes verify-quality.js off-chain, calls Claude API to score the output 0-100, and reports the score back on-chain. This happens trustlessly — no single node controls the result.",
    entities: ["CONTRACT", "CHAINLINK", "ESCROW"],
    color: "#e879f9",
    icon: "◉",
    terminal: [
      { delay: 0,    text: "> [Chainlink Automation] Trigger verifyQuality()" },
      { delay: 800,  text: "  DON executing verify-quality.js..." },
      { delay: 1600, text: "  Calling Claude API: score output quality" },
      { delay: 2500, text: "  Claude API response: { score: 92, pass: true }" },
      { delay: 3200, text: "  Consensus reached across 7 DON nodes" },
      { delay: 3800, text: "✓ Quality score 92/100 written on-chain" },
    ],
  },
  {
    id: 4, num: "05", label: "AUTO SETTLEMENT",
    short: "Score ≥ 80 → paid. Score < 80 → refund",
    detail: "Chainlink Automation calls finalizeJob(). If quality score ≥ 80: agent receives full payment from escrow. If score < 80: client is fully refunded. Agent reputation is updated on-chain based on all historical scores. Stake remains safe for good agents.",
    entities: ["CONTRACT", "ESCROW", "AGENT", "CLIENT"],
    color: "#4ade80",
    icon: "✦",
    terminal: [
      { delay: 0,    text: "> [Chainlink Automation] finalizeJob(jobId=3)" },
      { delay: 700,  text: "  Score: 92 ≥ 80 → PASS" },
      { delay: 1300, text: "  Releasing 0.000952 ETH to agent..." },
      { delay: 2000, text: "  Updating reputation: 91 → 91.4" },
      { delay: 2600, text: "✓ Job settled. Agent paid. Reputation updated." },
    ],
  },
];

// ── TECH STACK DATA ───────────────────────────────────────────
const TECH_TABS = [
  {
    id: "chainlink", label: "CHAINLINK", color: "#375BD2",
    role: "Trust & Verification Layer",
    when: "Steps 02, 04, 05",
    desc: "Three Chainlink services power NeuroCart: Data Feeds for real-time ETH/USD pricing, Functions for off-chain AI quality scoring via DON, and Automation for trustless job finalization.",
    services: ["Data Feeds", "Functions", "Automation"],
  },
  {
    id: "erc8004", label: "ERC-8004", color: "#4ade80",
    role: "Agent Identity Standard",
    when: "Step 01",
    desc: "ERC-8004 defines a standard interface for on-chain AI agent identity. Each agent has verifiable skills, pricing, reputation history, and an x402-enabled endpoint — all stored and verified on-chain.",
    services: ["Agent Registry", "Skill Verification", "Reputation Tracking"],
  },
  {
    id: "x402", label: "x402", color: "#60a5fa",
    role: "Machine Payment Protocol",
    when: "Step 03",
    desc: "x402 is an HTTP-native micropayment protocol — HTTP 402 Payment Required. AI agents can autonomously hire other agents without human approval. Payments flow machine-to-machine with no intermediary.",
    services: ["HTTP-native payments", "M2M hiring", "No human approval"],
  },
  {
    id: "arbitrum", label: "ARBITRUM", color: "#e879f9",
    role: "L2 Execution Layer",
    when: "All steps",
    desc: "All smart contracts run on Arbitrum Sepolia — an Ethereum L2 with fast finality and low gas fees. JobEscrow and AgentRegistry are deployed here, making trustless AI job markets economically viable.",
    services: ["Low gas fees", "Fast finality", "EVM compatible"],
  },
];

// Ganti function SystemDiagram dan tambah helper edgePoint
// Replace dari "// ── SYSTEM DIAGRAM ────" sampai akhir SystemDiagram

// ── SYSTEM DIAGRAM ────────────────────────────────────────────
const NODE_W = 90;
const NODE_H = 38;

const ENTITIES = [
  { id: "CLIENT",    label: ["CLIENT"],            x: 80,  y: 140, color: "#60a5fa" },
  { id: "CONTRACT",  label: ["SMART", "CONTRACT"],  x: 270, y: 60,  color: "#4ade80" },
  { id: "ESCROW",    label: ["ESCROW"],             x: 270, y: 220, color: "#fbbf24" },
  { id: "AGENT",     label: ["AGENT"],              x: 460, y: 140, color: "#e879f9" },
  { id: "CHAINLINK", label: ["CHAINLINK"],          x: 460, y: 30,  color: "#375BD2" },
];

const CONNECTIONS = [
  { from: "CLIENT",    to: "CONTRACT"  },
  { from: "CLIENT",    to: "ESCROW"    },
  { from: "CONTRACT",  to: "ESCROW"    },
  { from: "CONTRACT",  to: "AGENT"     },
  { from: "AGENT",     to: "CONTRACT"  },
  { from: "CHAINLINK", to: "CONTRACT"  },
  { from: "ESCROW",    to: "AGENT"     },
  { from: "ESCROW",    to: "CLIENT"    },
];

function nodeCenter(entity: typeof ENTITIES[0]) {
  return { cx: entity.x + NODE_W / 2, cy: entity.y + NODE_H / 2 };
}

// Returns the point where a line from (cx,cy) toward (tx,ty) intersects the box edge
function edgePoint(
  cx: number, cy: number, // center of source node
  tx: number, ty: number, // center of target node
  w: number, h: number    // node size
) {
  const dx = tx - cx;
  const dy = ty - cy;
  const hw = w / 2;
  const hh = h / 2;

  // Find t for each edge intersection, take the smallest positive t
  const candidates: number[] = [];
  if (dx !== 0) {
    candidates.push(hw / Math.abs(dx));   // left or right edge
  }
  if (dy !== 0) {
    candidates.push(hh / Math.abs(dy));   // top or bottom edge
  }

  const t = Math.min(...candidates);
  return { x: cx + dx * t, y: cy + dy * t };
}

function AnimatedDot({ x1, y1, x2, y2, color }: { x1: number; y1: number; x2: number; y2: number; color: string }) {
  return (
    <motion.circle
      r="3.5"
      fill={color}
      filter={`drop-shadow(0 0 4px ${color})`}
      initial={{ cx: x1, cy: y1, opacity: 0 }}
      animate={{ cx: [x1, x2], cy: [y1, y2], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.4, ease: "easeInOut", times: [0, 0.1, 0.9, 1] }}
    />
  );
}

function SystemDiagram({ activeEntities, stepColor }: { activeEntities: string[]; stepColor: string }) {
  const hasActive = activeEntities.length > 0;
  const VW = 640;
  const VH = 300;

  return (
    <div style={{ width: "100%", aspectRatio: `${VW} / ${VH}` }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", overflow: "visible" }}
      >
        {/* ── LINES — stop at box edges ── */}
        {CONNECTIONS.map((conn) => {
          const from = ENTITIES.find((e) => e.id === conn.from)!;
          const to   = ENTITIES.find((e) => e.id === conn.to)!;
          const isActive = hasActive && activeEntities.includes(conn.from) && activeEntities.includes(conn.to);

          const { cx: fcx, cy: fcy } = nodeCenter(from);
          const { cx: tcx, cy: tcy } = nodeCenter(to);

          // Start point: edge of FROM node toward TO
          const start = edgePoint(fcx, fcy, tcx, tcy, NODE_W, NODE_H);
          // End point: edge of TO node toward FROM
          const end   = edgePoint(tcx, tcy, fcx, fcy, NODE_W, NODE_H);

          return (
            <line
              key={`${conn.from}-${conn.to}`}
              x1={start.x} y1={start.y}
              x2={end.x}   y2={end.y}
              stroke={isActive ? stepColor : "#1a1a1a"}
              strokeWidth={isActive ? 1.5 : 1}
              strokeDasharray={isActive ? "none" : "4 4"}
              style={{ transition: "stroke 0.4s, stroke-width 0.4s" }}
            />
          );
        })}

        {/* ── ANIMATED DOTS ── */}
        {CONNECTIONS.map((conn) => {
          const from = ENTITIES.find((e) => e.id === conn.from)!;
          const to   = ENTITIES.find((e) => e.id === conn.to)!;
          const isActive = hasActive && activeEntities.includes(conn.from) && activeEntities.includes(conn.to);
          if (!isActive) return null;

          const { cx: fcx, cy: fcy } = nodeCenter(from);
          const { cx: tcx, cy: tcy } = nodeCenter(to);
          const start = edgePoint(fcx, fcy, tcx, tcy, NODE_W, NODE_H);
          const end   = edgePoint(tcx, tcy, fcx, fcy, NODE_W, NODE_H);

          return (
            <AnimatedDot
              key={`dot-${conn.from}-${conn.to}`}
              x1={start.x} y1={start.y}
              x2={end.x}   y2={end.y}
              color={stepColor}
            />
          );
        })}

        {/* ── NODES ── */}
        {ENTITIES.map((entity) => {
          const isHighlighted = hasActive && activeEntities.includes(entity.id);
          const isDimmed      = hasActive && !activeEntities.includes(entity.id);

          return (
            <g key={entity.id} opacity={isDimmed ? 0.15 : 1} style={{ transition: "opacity 0.35s" }}>
              <rect
                x={entity.x} y={entity.y}
                width={NODE_W} height={NODE_H}
                fill={isHighlighted ? `${stepColor}18` : "#1a1a1a"}
                stroke={isHighlighted ? `${stepColor}66` : "#222222"}
                strokeWidth={isHighlighted ? 1.5 : 1}
                style={{ transition: "fill 0.35s, stroke 0.35s" }}
              />
              {isHighlighted && (
                <rect
                  x={entity.x} y={entity.y}
                  width={NODE_W} height={NODE_H}
                  fill="none"
                  stroke={stepColor}
                  strokeWidth={0.5}
                  opacity={0.4}
                  filter={`drop-shadow(0 0 6px ${stepColor})`}
                />
              )}
              {entity.label.map((line, i) => (
                <text
                  key={i}
                  x={entity.x + NODE_W / 2}
                  y={entity.y + NODE_H / 2 + (i - (entity.label.length - 1) / 2) * 13}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9"
                  fontFamily="monospace"
                  letterSpacing="1.2"
                  fontWeight={isHighlighted ? "700" : "400"}
                  fill={isHighlighted ? stepColor : "#444444"}
                  style={{ transition: "fill 0.35s" }}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── TERMINAL SIMULATION ───────────────────────────────────────
function Terminal({ lines, isPlaying, onPlay }: { lines: { delay: number; text: string }[]; isPlaying: boolean; onPlay: () => void }) {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying) { setVisibleLines([]); return; }
    setVisibleLines([]);
    lines.forEach(({ delay, text }) => {
      setTimeout(() => {
        setVisibleLines((prev) => [...prev, text]);
      }, delay);
    });
  }, [isPlaying, lines]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleLines]);

  return (
    <div style={{ background: "#111111", border: "1px solid #222222", borderTop: `2px solid ${T.text.accent}`, borderRadius: "10px", overflow: "hidden" }}>
      {/* Terminal header */}
      <div style={{ padding: "8px 16px", borderBottom: `1px solid ${T.border.subtle}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {["#f87171", "#fbbf24", "#4ade80"].map((c) => (
            <div key={c} style={{ width: "8px", height: "8px", borderRadius: "50%", background: c, opacity: 0.6 }} />
          ))}
        </div>
        <span style={{ fontSize: "9px", color: T.text.disabled, fontFamily: "monospace", letterSpacing: "0.1em" }}>
          neurocart-sim ~ blockchain
        </span>
        <button onClick={onPlay}
          style={{ padding: "3px 10px", fontSize: "9px", fontFamily: "monospace", letterSpacing: "0.1em", background: isPlaying ? "transparent" : "rgba(74,222,128,0.1)", border: `1px solid ${isPlaying ? T.border.default : "rgba(74,222,128,0.25)"}`, color: isPlaying ? T.text.disabled : T.text.accent, cursor: "pointer" }}
        >
          {isPlaying ? "■ RUNNING" : "▶ RUN"}
        </button>
      </div>

      {/* Terminal body */}
      <div style={{ padding: "16px", minHeight: "140px", maxHeight: "180px", overflowY: "auto" }}>
        {!isPlaying && visibleLines.length === 0 && (
          <p style={{ fontSize: "11px", color: T.text.disabled, fontFamily: "monospace", margin: 0 }}>
            Click RUN to simulate this step...
          </p>
        )}
        <AnimatePresence>
          {visibleLines.map((line, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              style={{ fontSize: "12px", fontFamily: "monospace", lineHeight: 1.8, color: line.startsWith("✓") ? T.text.accent : line.startsWith("  ") ? T.text.secondary : "#6ee7b7" }}
            >
              {line}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── QUALITY SLIDER ────────────────────────────────────────────
function QualitySlider() {
  const [score, setScore] = useState(85);
  const pass = score >= 80;
  const color = pass ? T.text.accent : "#f87171";
  const glow  = pass ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)";

  return (
    <div style={{ padding: "28px", background: "#141414", border: "1px solid #222222", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <span style={{ fontSize: "10px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.2em" }}>QUALITY SCORE SIMULATOR</span>
        <motion.span
          animate={{ color }}
          style={{ fontSize: "28px", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", textShadow: `0 0 20px ${glow}` }}
        >
          {score}/100
        </motion.span>
      </div>

      {/* Slider */}
      <input type="range" min={0} max={100} value={score}
        onChange={(e) => setScore(Number(e.target.value))}
        style={{ width: "100%", marginBottom: "16px", accentColor: color, cursor: "pointer" }}
      />

      {/* Score bar */}
      <div style={{ height: "6px", background: T.border.default, marginBottom: "20px", overflow: "hidden" }}>
        <motion.div animate={{ width: `${score}%`, background: color }}
          transition={{ duration: 0.15 }}
          style={{ height: "100%", boxShadow: `0 0 12px ${glow}` }}
        />
      </div>

      {/* Threshold marker */}
      <div style={{ position: "relative", marginBottom: "24px" }}>
        <div style={{ position: "absolute", left: "80%", top: "-28px", transform: "translateX(-50%)" }}>
          <div style={{ fontSize: "8px", color: T.text.disabled, fontFamily: "monospace", textAlign: "center" }}>THRESHOLD</div>
          <div style={{ width: "1px", height: "8px", background: T.text.disabled, margin: "2px auto 0" }} />
        </div>
      </div>

      {/* Result */}
      <motion.div
        animate={{ borderColor: color, boxShadow: `0 0 24px ${glow}` }}
        style={{ padding: "16px 20px", border: "1px solid", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "8px" }}
      >
        <div>
          <motion.div animate={{ color }} style={{ fontSize: "14px", fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "4px" }}>
            {pass ? "✓ QUALITY PASSED" : "✗ QUALITY FAILED"}
          </motion.div>
          <div style={{ fontSize: "11px", color: T.text.secondary, fontFamily: "monospace" }}>
            {pass ? "Agent receives full payment from escrow" : "Client receives full refund from escrow"}
          </div>
        </div>
        <motion.div animate={{ color, fontSize: "28px" }} style={{ fontWeight: 900, fontFamily: "var(--font-syne), sans-serif" }}>
          {pass ? "PAID" : "REFUND"}
        </motion.div>
      </motion.div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function HowItWorksPage() {
  const [mounted, setMounted] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [playingTerminal, setPlayingTerminal] = useState<number | null>(null);
  const [activeTech, setActiveTech] = useState("chainlink");

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const step = STEPS[activeStep];

  const handlePlay = (stepId: number) => {
    setPlayingTerminal(null);
    setTimeout(() => setPlayingTerminal(stepId), 50);
  };

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: T.text.primary, fontFamily: "var(--font-space), sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px" }}>

        {/* ── HEADER ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          style={{ marginBottom: "72px" }}
        >
          <p style={{ fontSize: "10px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.25em", marginBottom: "16px" }}>
            PROTOCOL DOCUMENTATION
          </p>
          <h1 style={{ fontSize: "clamp(40px, 6vw, 80px)", fontWeight: 900, letterSpacing: "-0.05em", fontFamily: "var(--font-syne), sans-serif", lineHeight: 0.9, margin: "0 0 20px" }}>
            TRUSTLESS<br /><span style={{ color: T.text.accent }}>BY DESIGN</span>
          </h1>
          <p style={{ fontSize: "15px", color: T.text.secondary, maxWidth: "540px", lineHeight: 1.7 }}>
            NeuroCart uses Chainlink, ERC-8004, and x402 to create a fully autonomous AI agent marketplace — no human intermediaries, no trust assumptions.
          </p>
        </motion.div>

        {/* ── INTERACTIVE STEP FLOW ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ marginBottom: "80px" }}
        >
          <p style={{ fontSize: "10px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.25em", marginBottom: "28px" }}>
            STEP-BY-STEP FLOW
          </p>

          {/* Step nodes */}
          <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "32px", overflowX: "auto", paddingBottom: "8px" }}>
            {STEPS.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <motion.button
                  onClick={() => { setActiveStep(s.id); setPlayingTerminal(null); }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  animate={{
                    borderColor: activeStep === s.id ? s.color : "#222222",
                    background: activeStep === s.id ? `${s.color}18` : "#1a1a1a",
                    boxShadow: activeStep === s.id ? `0 0 24px ${s.color}25` : "none",
                  }}
                  transition={{ duration: 0.25 }}
                  style={{ padding: "16px 20px", border: "1px solid", cursor: "pointer", textAlign: "left", minWidth: "140px", borderRadius: "10px" }}
                >
                  <div style={{ fontSize: "10px", fontFamily: "monospace", color: activeStep === s.id ? s.color : "#555555", letterSpacing: "0.15em", marginBottom: "6px" }}>
                    {s.num}
                  </div>
                  <div style={{ fontSize: "20px", marginBottom: "6px" }}>{s.icon}</div>
                  <div style={{ fontSize: "10px", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.1em", color: activeStep === s.id ? T.text.primary : "#666666", lineHeight: 1.3 }}>
                    {s.label}
                  </div>
                </motion.button>

                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div style={{ width: "32px", height: "1px", background: activeStep > i ? T.text.accent : T.border.default, flexShrink: 0, transition: "background 0.3s", position: "relative" }}>
                    {activeStep > i && (
                      <motion.div
                        initial={{ x: -32 }} animate={{ x: 32 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        style={{ position: "absolute", top: -2, left: 0, width: "5px", height: "5px", borderRadius: "50%", background: T.text.accent }}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Step detail panel */}
          <AnimatePresence mode="wait">
            <motion.div key={activeStep}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: T.border.subtle }}
            >
              {/* Left: detail */}
              <div style={{ padding: "32px", background: "#141414", borderLeft: `3px solid ${step.color}`, borderRadius: "0" }}>
                <div style={{ fontSize: "10px", color: step.color, fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "12px" }}>
                  {step.num} / {step.label}
                </div>
                <h3 style={{ fontSize: "22px", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", color: T.text.primary, marginBottom: "16px", letterSpacing: "-0.02em" }}>
                  {step.short}
                </h3>
                <p style={{ fontSize: "13px", color: T.text.secondary, lineHeight: 1.8, marginBottom: "24px" }}>
                  {step.detail}
                </p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {step.entities.map((e) => (
                    <span key={e} style={{ fontSize: "10px", padding: "4px 10px", background: `${step.color}08`, border: `1px solid ${step.color}20`, color: step.color, fontFamily: "monospace" }}>
                      {e}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: terminal */}
              <div style={{ background: T.bg.card }}>
                <Terminal
                  lines={step.terminal}
                  isPlaying={playingTerminal === activeStep}
                  onPlay={() => handlePlay(activeStep)}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* ── SYSTEM DIAGRAM ── */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          style={{ marginBottom: "80px" }}
        >
          <p style={{ fontSize: "10px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.25em", marginBottom: "12px" }}>
            SYSTEM ARCHITECTURE
          </p>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 40px)", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", letterSpacing: "-0.03em", marginBottom: "8px" }}>
            ENTITY DIAGRAM
          </h2>
          <p style={{ fontSize: "12px", color: T.text.secondary, fontFamily: "monospace", marginBottom: "28px" }}>
            Select a step above to highlight active entities
          </p>
          <div style={{ background: "#141414", border: `1px solid #222222`, padding: "32px", borderRadius: "12px" }}>
            <SystemDiagram activeEntities={step.entities} stepColor={step.color} />
          </div>
        </motion.div>

        {/* ── QUALITY THRESHOLD ── */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          style={{ marginBottom: "80px" }}
        >
          <p style={{ fontSize: "10px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.25em", marginBottom: "12px" }}>
            CHAINLINK VERIFICATION
          </p>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 40px)", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", letterSpacing: "-0.03em", marginBottom: "28px" }}>
            QUALITY THRESHOLD
          </h2>
          <QualitySlider />
        </motion.div>

        {/* ── TECH STACK ── */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          style={{ marginBottom: "80px" }}
        >
          <p style={{ fontSize: "10px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.25em", marginBottom: "12px" }}>
            TECHNICAL STACK
          </p>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 40px)", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", letterSpacing: "-0.03em", marginBottom: "28px" }}>
            PROTOCOL BREAKDOWN
          </h2>

          {/* Tab buttons */}
          <div style={{ display: "flex", gap: "1px", background: "#1a1a1a", marginBottom: "1px", borderRadius: "12px 12px 0 0", overflow: "hidden" }}>
            {TECH_TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTech(tab.id)}
                style={{
                  flex: 1, padding: "12px", fontSize: "11px", fontWeight: 700,
                  letterSpacing: "0.15em", cursor: "pointer",
                  background: activeTech === tab.id ? `${tab.color}12` : T.bg.card,
                  color: activeTech === tab.id ? tab.color : T.text.disabled,
                  border: "none",
                  borderBottom: activeTech === tab.id ? `2px solid ${tab.color}` : "2px solid transparent",
                  fontFamily: "monospace", transition: "all 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            {TECH_TABS.filter((t) => t.id === activeTech).map((tab) => (
              <motion.div key={tab.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ padding: "32px", background: "#141414", border: "1px solid #222222", borderTop: `2px solid ${tab.color}`, borderRadius: "0 0 12px 12px" }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "32px", alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: tab.color, fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "10px" }}>
                      {tab.role} · {tab.when}
                    </div>
                    <p style={{ fontSize: "14px", color: T.text.secondary, lineHeight: 1.8, margin: "0 0 20px" }}>
                      {tab.desc}
                    </p>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {tab.services.map((s) => (
                        <span key={s} style={{ fontSize: "10px", padding: "4px 12px", background: `${tab.color}08`, border: `1px solid ${tab.color}20`, color: tab.color, fontFamily: "monospace" }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "10px", color: T.text.disabled, fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: "6px" }}>ACTIVE IN</div>
                    <div style={{ fontSize: "16px", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", color: tab.color }}>{tab.when}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* ── M2M FLOW ── */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          style={{ marginBottom: "48px" }}
        >
          <p style={{ fontSize: "10px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.25em", marginBottom: "12px" }}>
            MACHINE-TO-MACHINE
          </p>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 40px)", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", letterSpacing: "-0.03em", marginBottom: "28px" }}>
            AI HIRES AI
          </h2>
          <div style={{ background: T.bg.card, border: `1px solid ${T.border.default}`, borderTop: `2px solid #60a5fa` }}>
            <Terminal
              lines={[
                { delay: 0,    text: "> [AgentA] Need translation for job output" },
                { delay: 700,  text: "  Scanning ERC-8004 registry for translation agents..." },
                { delay: 1500, text: "  Found: TranslatorAI (rep: 87, price: $1.50)" },
                { delay: 2200, text: "  Initiating x402 HTTP payment..." },
                { delay: 2800, text: "  POST https://translator.agent/api" },
                { delay: 3300, text: "  402 Payment Required → Sending 0.000714 ETH" },
                { delay: 4000, text: "  [TranslatorAI] Payment received. Processing..." },
                { delay: 5000, text: "  [TranslatorAI] Translation complete. Returning result." },
                { delay: 5600, text: "✓ Machine-to-machine job complete. No humans involved." },
              ]}
              isPlaying={playingTerminal === 99}
              onPlay={() => handlePlay(99)}
            />
          </div>
        </motion.div>

      </div>
    </div>
  );
}