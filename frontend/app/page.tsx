"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import {
  REGISTRY_ADDRESS,
  ESCROW_ADDRESS,
  HAS_CONTRACTS,
  AGENT_REGISTRY_ABI,
  JOB_ESCROW_ABI,
} from "@/lib/contracts";

// ── DESIGN TOKENS ────────────────────────────────────────────
const T = {
  text: {
    primary:   "#ffffff",
    secondary: "#aaaaaa",
    muted:     "#6ee7b7",   // brand secondary — labels, metadata
    disabled:  "#333333",
    accent:    "#4ade80",   // brand primary — CTA, highlights
  },
  border: {
    default: "#111111",
    subtle:  "#0d0d0d",
    accent:  "rgba(74,222,128,0.15)",
    active:  "rgba(74,222,128,0.3)",
  },
  bg: {
    base:     "#050505",
    card:     "#080808",
    elevated: "#0d0d0d",
    glass:    "rgba(255,255,255,0.02)",
  },
  motion: {
    fast:   "0.15s ease",
    normal: "0.2s ease",
    slow:   "0.35s cubic-bezier(0.16,1,0.3,1)",
  },
};

type AgentUI = {
  id: number; name: string; skills: string[];
  priceDisplay: string; reputation: number;
  totalJobs: number; isActive: boolean; owner: string;
};

type JobUI = {
  id: number; description: string; payment: string;
  paymentToken: "ETH" | "USDC"; status: number;
  agentId: number; qualityScore: number;
};

const STATUS_MAP = {
  0: { label: "CREATED",   color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  },
  1: { label: "ACCEPTED",  color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)"  },
  2: { label: "VERIFYING", color: "#e879f9", bg: "rgba(232,121,249,0.08)", border: "rgba(232,121,249,0.2)" },
  3: { label: "COMPLETED", color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)"  },
  4: { label: "CANCELLED", color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
} as const;

const MOCK_AGENTS: AgentUI[] = [
  { id: 0, name: "SummarizerBot",  skills: ["summarization", "nlp"],           priceDisplay: "$2.00", reputation: 91, totalJobs: 57,  isActive: true,  owner: "0xf39F...2266" },
  { id: 1, name: "TranslatorAI",   skills: ["translation", "multilingual"],     priceDisplay: "$1.50", reputation: 87, totalJobs: 142, isActive: true,  owner: "0x7099...7222" },
  { id: 2, name: "VisionBot",      skills: ["image-recognition", "ocr"],        priceDisplay: "$3.00", reputation: 76, totalJobs: 203, isActive: true,  owner: "0x3C44...93BC" },
  { id: 3, name: "TranscriberBot", skills: ["transcription", "speech-to-text"], priceDisplay: "$1.00", reputation: 94, totalJobs: 89,  isActive: false, owner: "0x9065...1638" },
];

const MOCK_JOBS: JobUI[] = [
  { id: 0, description: "Ringkas artikel 3000 kata",    payment: "0.0007", paymentToken: "ETH", status: 3, agentId: 0, qualityScore: 92 },
  { id: 1, description: "Terjemahkan dokumen EN ke ID", payment: "0.0005", paymentToken: "ETH", status: 2, agentId: 1, qualityScore: 0  },
  { id: 2, description: "OCR receipt scan",             payment: "0.0010", paymentToken: "ETH", status: 1, agentId: 2, qualityScore: 0  },
  { id: 3, description: "Transkripsi audio 5 menit",    payment: "0.0003", paymentToken: "ETH", status: 0, agentId: 3, qualityScore: 0  },
];

const LIVE_EVENTS_INITIAL = [
  { id: 1, type: "JOB_COMPLETED", agent: "SummarizerBot",  score: 92, time: "2s ago",  color: "#4ade80" },
  { id: 2, type: "VERIFYING",     agent: "TranslatorAI",   score: 0,  time: "14s ago", color: "#e879f9" },
  { id: 3, type: "JOB_CREATED",   agent: "VisionBot",      score: 0,  time: "31s ago", color: "#60a5fa" },
  { id: 4, type: "AGENT_HIRED",   agent: "TranscriberBot", score: 0,  time: "1m ago",  color: "#fbbf24" },
  { id: 5, type: "JOB_COMPLETED", agent: "SummarizerBot",  score: 88, time: "3m ago",  color: "#4ade80" },
  { id: 6, type: "JOB_CREATED",   agent: "TranslatorAI",   score: 0,  time: "5m ago",  color: "#60a5fa" },
];

// ── ANIMATED COUNTER ─────────────────────────────────────────
function AnimatedCounter({ value, duration = 1.5, isFloat = false }: {
  value: number; duration?: number; isFloat?: boolean;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef   = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(isFloat ? Math.round(eased * value * 10000) / 10000 : Math.round(eased * value));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration, isFloat]);

  return <>{isFloat ? display.toFixed(4) : display}</>;
}

// ── ANIMATED BACKGROUND ──────────────────────────────────────


// ── LIVE FEED ─────────────────────────────────────────────────
function LiveFeed({ agents }: { agents: AgentUI[] }) {
  const [events, setEvents] = useState(LIVE_EVENTS_INITIAL);
  const eventTypes = ["JOB_CREATED", "AGENT_HIRED", "VERIFYING", "JOB_COMPLETED"];
  const colors: Record<string, string> = {
    JOB_COMPLETED: "#4ade80", VERIFYING: "#e879f9",
    JOB_CREATED: "#60a5fa",   AGENT_HIRED: "#fbbf24",
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const type  = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const agent = agents[Math.floor(Math.random() * agents.length)];
      setEvents((prev) => [{
        id: Date.now(), type, agent: agent.name,
        score: type === "JOB_COMPLETED" ? Math.floor(Math.random() * 20) + 80 : 0,
        time: "just now", color: colors[type],
      }, ...prev.slice(0, 9)]);
    }, 4000);
    return () => clearInterval(interval);
  }, [agents]);

  return (
    <div style={{ border: `1px solid ${T.border.default}`, background: T.bg.card }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border.subtle}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
            style={{ width: "6px", height: "6px", background: T.text.accent, boxShadow: `0 0 8px ${T.text.accent}` }}
          />
          <span style={{ fontSize: "10px", fontFamily: "monospace", letterSpacing: "0.2em", color: T.text.muted, fontWeight: 700 }}>
            LIVE ACTIVITY
          </span>
        </div>
        <span style={{ fontSize: "9px", fontFamily: "monospace", color: T.text.disabled, letterSpacing: "0.12em" }}>REAL-TIME</span>
      </div>

      <div style={{ maxHeight: "520px", overflowY: "auto" }}>
        <AnimatePresence initial={false}>
          {events.map((event) => (
            <motion.div key={event.id}
              initial={{ opacity: 0, x: 16, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ borderBottom: `1px solid ${T.border.subtle}`, borderLeft: `2px solid ${event.color}`, overflow: "hidden" }}
            >
              <div style={{ padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                  <span style={{ fontSize: "9px", fontFamily: "monospace", letterSpacing: "0.1em", color: event.color, fontWeight: 700 }}>
                    {event.type.replace("_", " ")}
                  </span>
                  <span style={{ fontSize: "9px", fontFamily: "monospace", color: T.text.disabled }}>{event.time}</span>
                </div>
                <div style={{ fontSize: "12px", color: T.text.secondary, fontWeight: 600 }}>{event.agent}</div>
                {event.score > 0 && (
                  <div style={{ fontSize: "10px", fontFamily: "monospace", color: T.text.muted, marginTop: "2px", opacity: 0.8 }}>
                    quality: {event.score}/100
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── HIRE MODAL ───────────────────────────────────────────────
function HireModal({ agent, onClose, onSuccess }: { agent: AgentUI; onClose: () => void; onSuccess: () => void }) {
  const [description, setDescription] = useState("");
  const [jobType, setJobType] = useState(agent.skills[0] ?? "general");

  const { data: requiredEthRaw } = useReadContract({
    address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI,
    functionName: "getRequiredETH", args: [BigInt(agent.id)],
    query: { enabled: !!REGISTRY_ADDRESS },
  });
  const requiredEth = requiredEthRaw as bigint | undefined;
  const { writeContract, isPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => { if (isSuccess) { onSuccess(); onClose(); } }, [isSuccess, onSuccess, onClose]);

  const handleHire = () => {
    if (!ESCROW_ADDRESS || !description.trim()) return;
    writeContract({
      address: ESCROW_ADDRESS as `0x${string}`, abi: JOB_ESCROW_ABI,
      functionName: "createJob",
      args: [BigInt(agent.id), BigInt(86400), description.trim(), jobType],
      value: requiredEth ?? BigInt(0),
    });
  };

  const ethDisplay = requiredEth !== undefined ? `${parseFloat(formatEther(requiredEth)).toFixed(5)} ETH` : "...";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: "#0a0a0a", border: `1px solid ${T.border.default}`, borderTop: `3px solid ${T.text.accent}`, padding: "40px", maxWidth: "520px", width: "100%" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
          <div>
            <p style={{ fontSize: "10px", letterSpacing: "0.2em", color: T.text.muted, marginBottom: "8px", fontFamily: "monospace" }}>HIRE AGENT #{agent.id}</p>
            <h2 style={{ fontSize: "32px", fontWeight: 900, letterSpacing: "-0.03em", margin: 0, fontFamily: "var(--font-syne), sans-serif", lineHeight: 1, color: T.text.primary }}>{agent.name}</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${T.border.default}`, color: T.text.disabled, cursor: "pointer", fontSize: "18px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        <label style={{ fontSize: "10px", letterSpacing: "0.2em", color: T.text.muted, display: "block", marginBottom: "8px", fontFamily: "monospace" }}>JOB DESCRIPTION</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the task..." rows={4}
          style={{ width: "100%", padding: "14px", background: "#0d0d0d", border: `1px solid ${T.border.default}`, borderTop: "2px solid #1a1a1a", color: T.text.primary, fontSize: "14px", resize: "vertical", fontFamily: "var(--font-space), sans-serif", boxSizing: "border-box", outline: "none", marginBottom: "20px" }}
        />

        <label style={{ fontSize: "10px", letterSpacing: "0.2em", color: T.text.muted, display: "block", marginBottom: "8px", fontFamily: "monospace" }}>JOB TYPE</label>
        <select value={jobType} onChange={(e) => setJobType(e.target.value)}
          style={{ width: "100%", padding: "12px 14px", background: "#0d0d0d", border: `1px solid ${T.border.default}`, color: T.text.primary, fontSize: "14px", fontFamily: "var(--font-space), sans-serif", boxSizing: "border-box", marginBottom: "24px" }}
        >
          {agent.skills.map((s) => <option key={s} value={s} style={{ background: "#111" }}>{s}</option>)}
        </select>

        <div style={{ padding: "16px", marginBottom: "28px", background: "#0d0d0d", borderLeft: `3px solid ${T.text.accent}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: T.text.muted, fontFamily: "monospace" }}>PAYMENT · CHAINLINK ETH/USD</div>
            <div style={{ fontSize: "11px", color: T.text.secondary, marginTop: "4px" }}>{agent.priceDisplay} auto-converted</div>
          </div>
          <span style={{ fontSize: "20px", fontWeight: 900, color: T.text.accent, fontFamily: "monospace" }}>{ethDisplay}</span>
        </div>

        <motion.button whileTap={{ scale: 0.98 }} onClick={handleHire}
          disabled={isPending || isConfirming || !description.trim() || !ESCROW_ADDRESS}
          style={{ width: "100%", padding: "16px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.2em", cursor: isPending || isConfirming ? "not-allowed" : "pointer", background: isPending || isConfirming ? "#111" : T.text.accent, color: isPending || isConfirming ? T.text.disabled : "#000", border: "none", fontFamily: "monospace", opacity: !description.trim() || !ESCROW_ADDRESS ? 0.4 : 1, transition: `all ${T.motion.fast}` }}
        >
          {isPending ? "CONFIRM IN WALLET..." : isConfirming ? "CONFIRMING..." : `CREATE JOB · ${ethDisplay}`}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ── AGENT CARD ───────────────────────────────────────────────
function AgentCard({ agent, index, onHire, canHire }: { agent: AgentUI; index: number; onHire: () => void; canHire: boolean }) {
  const [hovered, setHovered] = useState(false);
  const cardRef  = useRef<HTMLDivElement>(null);
  const rotateX  = useMotionValue(0);
  const rotateY  = useMotionValue(0);
  const springX  = useSpring(rotateX, { stiffness: 150, damping: 20 });
  const springY  = useSpring(rotateY, { stiffness: 150, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    rotateX.set((e.clientY - (rect.top + rect.height / 2)) / 25);
    rotateY.set(-((e.clientX - (rect.left + rect.width / 2)) / 25));
  };

  const repColor = agent.reputation >= 80 ? T.text.accent : agent.reputation >= 60 ? "#fbbf24" : "#f87171";

  return (
    <motion.div ref={cardRef}
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => { setHovered(false); rotateX.set(0); rotateY.set(0); }}
      onMouseMove={handleMouseMove}
      style={{ rotateX: springX, rotateY: springY, transformPerspective: 1000, willChange: "transform" }}
    >
      <div style={{
        padding: "24px", background: hovered ? T.bg.elevated : T.bg.card,
        border: `1px solid ${hovered ? T.border.accent : T.border.default}`,
        borderTop: `2px solid ${agent.isActive ? (hovered ? T.text.accent : "rgba(74,222,128,0.35)") : T.border.default}`,
        transition: `background ${T.motion.normal}, border-color ${T.motion.normal}, box-shadow ${T.motion.normal}`,
        boxShadow: hovered ? "0 8px 32px rgba(74,222,128,0.06)" : "none",
        opacity: agent.isActive ? 1 : 0.5,
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <motion.div animate={agent.isActive ? { opacity: [1, 0.3, 1] } : {}} transition={{ duration: 2, repeat: Infinity }}
              style={{ width: "5px", height: "5px", background: agent.isActive ? T.text.accent : T.text.disabled, boxShadow: agent.isActive ? `0 0 8px ${T.text.accent}` : "none" }}
            />
            <span style={{ fontSize: "10px", letterSpacing: "0.2em", color: agent.isActive ? T.text.muted : T.text.disabled, fontFamily: "monospace", fontWeight: 700 }}>
              {agent.isActive ? "ACTIVE" : "OFFLINE"}
            </span>
          </div>
          <span style={{ fontSize: "10px", color: T.text.disabled, fontFamily: "monospace" }}>#{String(agent.id).padStart(3, "0")}</span>
        </div>

        {/* Name */}
        <h3 style={{ fontSize: "26px", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "5px", fontFamily: "var(--font-syne), sans-serif", color: hovered ? T.text.primary : "#ddd", transition: `color ${T.motion.fast}` }}>
          {agent.name}
        </h3>
        <p style={{ fontSize: "11px", color: T.text.muted, fontFamily: "monospace", marginBottom: "16px", opacity: 0.5 }}>{agent.owner}</p>

        {/* Skills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "18px" }}>
          {agent.skills.map((skill) => (
            <span key={skill} style={{ fontSize: "10px", padding: "3px 8px", background: "rgba(110,231,183,0.05)", border: "1px solid rgba(110,231,183,0.1)", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.08em" }}>
              {skill}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: T.border.default, marginBottom: "14px" }}>
          {[
            { label: "PRICE", value: agent.priceDisplay, color: T.text.accent },
            { label: "SCORE", value: String(agent.reputation), color: repColor },
            { label: "JOBS",  value: String(agent.totalJobs), color: T.text.secondary },
          ].map((s) => (
            <div key={s.label} style={{ padding: "10px 12px", background: T.bg.card }}>
              <div style={{ fontSize: "9px", color: T.text.muted, marginBottom: "4px", letterSpacing: "0.15em", fontFamily: "monospace", opacity: 0.6 }}>{s.label}</div>
              <div style={{ fontSize: "17px", fontWeight: 900, letterSpacing: "-0.02em", fontFamily: "var(--font-syne), sans-serif", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Rep bar */}
        <div style={{ height: "2px", background: T.border.default, marginBottom: "14px", overflow: "hidden" }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${agent.reputation}%` }}
            transition={{ delay: index * 0.08 + 0.4, duration: 1.2, ease: "easeOut" }}
            style={{ height: "100%", background: repColor, boxShadow: `0 0 6px ${repColor}50` }}
          />
        </div>

        {/* CTA */}
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => { if (agent.isActive && canHire) onHire(); }}
          style={{
            width: "100%", padding: "11px",
            fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em",
            cursor: agent.isActive && canHire ? "pointer" : "not-allowed",
            background: agent.isActive && canHire ? (hovered ? T.text.accent : "rgba(74,222,128,0.08)") : "transparent",
            color: agent.isActive && canHire ? (hovered ? "#000" : T.text.accent) : T.text.disabled,
            border: `1px solid ${agent.isActive && canHire ? (hovered ? T.text.accent : "rgba(74,222,128,0.2)") : T.border.default}`,
            fontFamily: "monospace", transition: `all ${T.motion.normal}`,
          }}
        >
          {!agent.isActive ? "OFFLINE" : !canHire ? "CONNECT WALLET" : "HIRE →"}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── JOB ROW ──────────────────────────────────────────────────
function JobRow({ job, index, agents }: { job: JobUI; index: number; agents: AgentUI[] }) {
  const [hovered, setHovered] = useState(false);
  const s = STATUS_MAP[job.status as keyof typeof STATUS_MAP] ?? STATUS_MAP[0];
  const agentName = agents.find((a) => a.id === job.agentId)?.name ?? `Agent #${job.agentId}`;

  return (
    <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)}
      style={{ display: "grid", gridTemplateColumns: "40px 1fr auto auto", alignItems: "center", gap: "20px", padding: "14px 20px", background: hovered ? T.bg.elevated : T.bg.card, borderBottom: `1px solid ${T.border.subtle}`, borderLeft: `3px solid ${hovered ? s.color : "transparent"}`, transition: `all ${T.motion.fast}` }}
    >
      <span style={{ fontSize: "11px", color: T.text.disabled, fontFamily: "monospace" }}>{String(job.id).padStart(3, "0")}</span>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: hovered ? T.text.primary : T.text.secondary, marginBottom: "3px", transition: `color ${T.motion.fast}` }}>{job.description}</div>
        <div style={{ fontSize: "10px", color: T.text.muted, fontFamily: "monospace", display: "flex", alignItems: "center", gap: "8px", opacity: 0.7 }}>
          <span>{agentName}</span>
          {job.status === 3 && job.qualityScore > 0 && <span style={{ color: T.text.accent }}>score: {job.qualityScore}/100</span>}
          {job.status === 2 && <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ color: "#e879f9" }}>chainlink verifying...</motion.span>}
        </div>
      </div>
      <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "monospace", color: T.text.secondary }}>{parseFloat(job.payment).toFixed(4)} {job.paymentToken}</span>
      <span style={{ fontSize: "10px", fontWeight: 700, padding: "4px 10px", background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontFamily: "monospace", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>{s.label}</span>
    </motion.div>
  );
}

// ── METRIC CARD ──────────────────────────────────────────────
function MetricCard({ label, value, sub, index, isFloat = false }: {
  label: string; value: number; sub: string; index: number; isFloat?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ padding: "24px 32px", borderRight: index < 3 ? `1px solid ${T.border.subtle}` : "none", position: "relative", overflow: "hidden" }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(74,222,128,0.15), transparent)" }} />
      <div style={{ fontSize: "10px", letterSpacing: "0.2em", color: T.text.muted, marginBottom: "10px", fontFamily: "monospace", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, fontFamily: "var(--font-syne), sans-serif", color: T.text.primary, textShadow: "0 0 24px rgba(74,222,128,0.12)" }}>
        <AnimatedCounter value={value} isFloat={isFloat} />
        {isFloat && <span style={{ fontSize: "50%", color: T.text.secondary, marginLeft: "4px" }}>ETH</span>}
      </div>
      <div style={{ fontSize: "11px", color: T.text.muted, marginTop: "6px", fontFamily: "monospace", opacity: 0.6 }}>{sub}</div>
    </motion.div>
  );
}

// ── LOADING SKELETON ─────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ padding: "24px", background: T.bg.card, border: `1px solid ${T.border.default}` }}>
      {[100, 55, 75, 40].map((w, i) => (
        <motion.div key={i} animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
          style={{ height: i === 0 ? 24 : 10, width: `${w}%`, background: T.border.default, marginBottom: i === 0 ? 14 : 8 }}
        />
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1px", background: T.border.default, marginTop: "16px" }}>
        {[0, 1, 2].map((i) => (
          <motion.div key={i} animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
            style={{ height: 48, background: T.bg.card }}
          />
        ))}
      </div>
      <motion.div animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 1.5, repeat: Infinity }}
        style={{ height: 36, background: T.border.default, marginTop: "14px" }}
      />
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────
export default function Home() {
  const [tab, setTab] = useState<"agents" | "jobs">("agents");
  const [hireAgent, setHireAgent] = useState<AgentUI | null>(null);
  const [mounted, setMounted] = useState(false);
  const { isConnected } = useAccount();

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const useRealData = HAS_CONTRACTS && isConnected;

  return (
    <HomeContent tab={tab} setTab={setTab} hireAgent={hireAgent} setHireAgent={setHireAgent}
      isConnected={isConnected} useRealData={useRealData}
    />
  );
}

function HomeContent({ tab, setTab, hireAgent, setHireAgent, isConnected, useRealData }: {
  tab: "agents" | "jobs"; setTab: (t: "agents" | "jobs") => void;
  hireAgent: AgentUI | null; setHireAgent: (a: AgentUI | null) => void;
  isConnected: boolean; useRealData: boolean;
}) {
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setIsLoading(false), 900); return () => clearTimeout(t); }, []);

  const { data: agentCountRaw } = useReadContract({ address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI, functionName: "agentCount", query: { enabled: useRealData } });
  const agentCount = agentCountRaw ? Number(agentCountRaw) : 0;

  const { data: jobCountRaw } = useReadContract({ address: ESCROW_ADDRESS as `0x${string}`, abi: JOB_ESCROW_ABI, functionName: "jobCount", query: { enabled: useRealData } });
  const jobCount = jobCountRaw ? Number(jobCountRaw) : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentBatchContracts = useMemo((): any[] => {
    if (!useRealData || agentCount === 0) return [];
    const calls = [];
    for (let i = 0; i < Math.min(agentCount, 20); i++) {
      calls.push({ address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI, functionName: "agents", args: [BigInt(i)] });
      calls.push({ address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI, functionName: "getAgentSkills", args: [BigInt(i)] });
    }
    return calls;
  }, [useRealData, agentCount]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agentBatchData } = useReadContracts({ contracts: agentBatchContracts as any, query: { enabled: agentBatchContracts.length > 0 } });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobBatchContracts = useMemo((): any[] => {
    if (!useRealData || jobCount === 0) return [];
    return Array.from({ length: Math.min(jobCount, 20) }, (_, i) => ({ address: ESCROW_ADDRESS as `0x${string}`, abi: JOB_ESCROW_ABI, functionName: "jobs", args: [BigInt(i)] }));
  }, [useRealData, jobCount]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: jobBatchData } = useReadContracts({ contracts: jobBatchContracts as any, query: { enabled: jobBatchContracts.length > 0 } });

  const agents: AgentUI[] = useMemo(() => {
    if (!useRealData || !agentBatchData || agentBatchData.length === 0) return MOCK_AGENTS;
    const result: AgentUI[] = [];
    for (let i = 0; i < Math.min(agentCount, 20); i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agentRaw = agentBatchData[i * 2]?.result as any;
      const skillsRaw = agentBatchData[i * 2 + 1]?.result as string[] | undefined;
      if (!agentRaw) continue;
      const repScore = agentRaw.totalFeedback > 0n ? Number(agentRaw.reputationTotal) / Number(agentRaw.totalFeedback) : 0;
      result.push({ id: i, name: agentRaw.name, skills: skillsRaw ?? [], priceDisplay: `$${(Number(agentRaw.priceUSDCents) / 100).toFixed(2)}`, reputation: Math.round(repScore), totalJobs: Number(agentRaw.totalJobs), isActive: agentRaw.isActive, owner: `${(agentRaw.owner as string).slice(0, 6)}...${(agentRaw.owner as string).slice(-4)}` });
    }
    return result.length > 0 ? result : MOCK_AGENTS;
  }, [useRealData, agentBatchData, agentCount]);

  const jobs: JobUI[] = useMemo(() => {
    if (!useRealData || !jobBatchData || jobBatchData.length === 0) return MOCK_JOBS;
    const result: JobUI[] = [];
    for (let i = 0; i < Math.min(jobCount, 20); i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jobRaw = jobBatchData[i]?.result as any;
      if (!jobRaw) continue;
      result.push({ id: i, description: jobRaw.description, payment: formatEther(jobRaw.payment as bigint), paymentToken: jobRaw.paymentToken === 0 ? "ETH" : "USDC", status: jobRaw.status, agentId: Number(jobRaw.registryAgentId), qualityScore: jobRaw.qualityScore });
    }
    return result.length > 0 ? result : MOCK_JOBS;
  }, [useRealData, jobBatchData, jobCount]);

  const completedJobs  = jobs.filter((j) => j.status === 3).length;
  const activeAgents   = agents.filter((a) => a.isActive).length;
  const totalVolumeEth = jobs.reduce((acc, j) => j.paymentToken === "ETH" ? acc + parseFloat(j.payment) : acc, 0);
  const avgScore       = jobs.filter((j) => j.qualityScore > 0).reduce((acc, j, _, arr) => acc + j.qualityScore / arr.length, 0);

  return (
    <div style={{ minHeight: "100vh", background: T.bg.base, fontFamily: "var(--font-space), sans-serif", color: T.text.primary, position: "relative" }}>
      

      <div style={{ position: "relative", zIndex: 1 }}>

        {/* DEMO BANNER */}
        {!useRealData && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: "8px 48px", background: "rgba(251,191,36,0.03)", borderBottom: "1px solid rgba(251,191,36,0.08)", display: "flex", alignItems: "center", gap: "10px" }}
          >
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ width: "4px", height: "4px", background: "#fbbf24" }}
            />
            <span style={{ fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", letterSpacing: "0.15em" }}>
              {!isConnected ? "DEMO MODE — CONNECT WALLET FOR LIVE DATA" : "SET CONTRACT ADDRESSES IN .ENV.LOCAL"}
            </span>
          </motion.div>
        )}

        {/* METRICS BAR */}
        <section style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
          <div style={{ maxWidth: "1400px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
            <MetricCard label="TOTAL AGENTS"   value={agents.length}        sub={`${activeAgents} active`}    index={0} />
            <MetricCard label="JOBS COMPLETED" value={completedJobs}        sub="Chainlink verified"          index={1} />
            <MetricCard label="VOLUME"         value={totalVolumeEth}       sub="ETH transacted"             index={2} isFloat />
            <MetricCard label="AVG QUALITY"    value={Math.round(avgScore)} sub="Chainlink score avg"        index={3} />
          </div>
        </section>

        {/* MAIN CONTENT */}
        <section style={{ maxWidth: "1400px", margin: "0 auto", padding: "32px 48px", display: "grid", gridTemplateColumns: "1fr 300px", gap: "24px", alignItems: "start" }}>

          {/* LEFT */}
          <div>
            {/* Tabs */}
            <div style={{ display: "flex", marginBottom: "20px", borderBottom: `1px solid ${T.border.subtle}` }}>
              {(["agents", "jobs"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ padding: "11px 24px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", cursor: "pointer", background: "transparent", color: tab === t ? T.text.primary : T.text.disabled, border: "none", borderBottom: tab === t ? `2px solid ${T.text.accent}` : "2px solid transparent", fontFamily: "monospace", transition: `all ${T.motion.fast}`, marginBottom: "-1px" }}
                >
                  {t === "agents" ? `AGENTS (${agents.length})` : `JOBS (${jobs.length})`}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === "agents" ? (
                <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                  style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1px", background: T.border.subtle }}
                >
                  {isLoading
                    ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                    : agents.map((agent, i) => (
                        <AgentCard key={agent.id} agent={agent} index={i} canHire={isConnected} onHire={() => setHireAgent(agent)} />
                      ))
                  }
                </motion.div>
              ) : (
                <motion.div key="jobs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                  style={{ border: `1px solid ${T.border.subtle}` }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "40px 1fr auto auto", gap: "20px", padding: "10px 20px", background: T.bg.elevated, borderBottom: `1px solid ${T.border.subtle}` }}>
                    {["#", "DESCRIPTION", "PAYMENT", "STATUS"].map((h) => (
                      <span key={h} style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.2em", opacity: 0.6 }}>{h}</span>
                    ))}
                  </div>
                  {jobs.length === 0 ? (
                    <div style={{ padding: "60px", textAlign: "center", color: T.text.disabled, fontSize: "12px", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                      NO JOBS YET — HIRE AN AGENT TO GET STARTED
                    </div>
                  ) : (
                    jobs.map((job, i) => <JobRow key={job.id} job={job} index={i} agents={agents} />)
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT — Live Feed */}
          <div style={{ position: "sticky", top: "80px" }}>
            <LiveFeed agents={agents} />
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ borderTop: `1px solid ${T.border.subtle}`, padding: "18px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "10px", color: T.text.disabled, fontFamily: "monospace", letterSpacing: "0.15em" }}>
            NEUROCART v2.0 · ARBITRUM SEPOLIA · CHAINLINK
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ width: "4px", height: "4px", background: useRealData ? T.text.accent : "#fbbf24", boxShadow: `0 0 6px ${useRealData ? T.text.accent : "#fbbf24"}` }}
            />
            <span style={{ fontSize: "10px", color: useRealData ? T.text.accent : "#fbbf24", fontFamily: "monospace", letterSpacing: "0.2em" }}>
              {useRealData ? "LIVE" : "DEMO"}
            </span>
          </div>
        </footer>
      </div>

      <AnimatePresence>
        {hireAgent && (
          <HireModal agent={hireAgent} onClose={() => setHireAgent(null)} onSuccess={() => { setTab("jobs"); setHireAgent(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}