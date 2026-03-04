"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import {
  REGISTRY_ADDRESS,
  HAS_CONTRACTS,
  AGENT_REGISTRY_ABI,
} from "@/lib/contracts";

// ── DESIGN TOKENS ────────────────────────────────────────────
const T = {
  text: {
    primary:   "#ffffff",
    secondary: "#aaaaaa",
    muted:     "#6ee7b7",
    disabled:  "#333333",
    accent:    "#4ade80",
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
  },
};

type AgentUI = {
  id: number;
  name: string;
  skills: string[];
  priceDisplay: string;
  priceUSDCents: number;
  reputation: number;
  totalJobs: number;
  activeJobs: number;
  isActive: boolean;
  owner: string;
  endpoint: string;
  stakeAmount: string;
};

const MOCK_AGENTS: AgentUI[] = [
  { id: 0, name: "SummarizerBot",  skills: ["summarization", "nlp"],           priceDisplay: "$2.00", priceUSDCents: 200, reputation: 91, totalJobs: 57,  activeJobs: 2, isActive: true,  owner: "0xf39F...2266", endpoint: "https://summarizer.agent/api",  stakeAmount: "0.010" },
  { id: 1, name: "TranslatorAI",   skills: ["translation", "multilingual"],     priceDisplay: "$1.50", priceUSDCents: 150, reputation: 87, totalJobs: 142, activeJobs: 0, isActive: true,  owner: "0x7099...7222", endpoint: "https://translator.agent/api",  stakeAmount: "0.020" },
  { id: 2, name: "VisionBot",      skills: ["image-recognition", "ocr"],        priceDisplay: "$3.00", priceUSDCents: 300, reputation: 76, totalJobs: 203, activeJobs: 5, isActive: true,  owner: "0x3C44...93BC", endpoint: "https://vision.agent/api",      stakeAmount: "0.050" },
  { id: 3, name: "TranscriberBot", skills: ["transcription", "speech-to-text"], priceDisplay: "$1.00", priceUSDCents: 100, reputation: 94, totalJobs: 89,  activeJobs: 0, isActive: false, owner: "0x9065...1638", endpoint: "https://transcriber.agent/api", stakeAmount: "0.010" },
];

// ── AGENT DETAIL MODAL ───────────────────────────────────────
function AgentDetailModal({ agent, onClose }: { agent: AgentUI; onClose: () => void }) {
  const repColor = agent.reputation >= 80 ? T.text.accent : agent.reputation >= 60 ? "#fbbf24" : "#f87171";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: "#0a0a0a", border: `1px solid ${T.border.default}`, borderTop: `3px solid ${T.text.accent}`, padding: "40px", maxWidth: "560px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <motion.div
                animate={agent.isActive ? { opacity: [1, 0.3, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: "6px", height: "6px", background: agent.isActive ? T.text.accent : T.text.disabled, boxShadow: agent.isActive ? `0 0 8px ${T.text.accent}` : "none" }}
              />
              <span style={{ fontSize: "10px", color: agent.isActive ? T.text.muted : T.text.disabled, fontFamily: "monospace", letterSpacing: "0.2em" }}>
                {agent.isActive ? "ACTIVE" : "OFFLINE"}
              </span>
              <span style={{ fontSize: "10px", color: T.text.disabled, fontFamily: "monospace" }}>· ERC-8004</span>
            </div>
            <h2 style={{ fontSize: "36px", fontWeight: 900, letterSpacing: "-0.03em", margin: 0, fontFamily: "var(--font-syne), sans-serif", lineHeight: 1, color: T.text.primary }}>
              {agent.name}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${T.border.default}`, color: T.text.disabled, cursor: "pointer", fontSize: "18px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: T.border.default, marginBottom: "24px" }}>
          {[
            { label: "PRICE",       value: agent.priceDisplay,        color: T.text.accent },
            { label: "REPUTATION",  value: `${agent.reputation}/100`, color: repColor      },
            { label: "TOTAL JOBS",  value: String(agent.totalJobs),   color: T.text.secondary },
            { label: "ACTIVE JOBS", value: String(agent.activeJobs),  color: "#fbbf24"     },
            { label: "STAKE",       value: `${agent.stakeAmount} ETH`,color: "#60a5fa"     },
            { label: "AGENT ID",    value: `#${String(agent.id).padStart(3, "0")}`, color: T.text.disabled },
          ].map((s) => (
            <div key={s.label} style={{ padding: "16px", background: T.bg.card }}>
              <div style={{ fontSize: "9px", color: T.text.muted, marginBottom: "6px", letterSpacing: "0.15em", fontFamily: "monospace", opacity: 0.6 }}>{s.label}</div>
              <div style={{ fontSize: "16px", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Rep bar */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "10px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "8px", opacity: 0.7 }}>REPUTATION SCORE</div>
          <div style={{ height: "4px", background: T.border.default }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${agent.reputation}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ height: "100%", background: repColor, boxShadow: `0 0 8px ${repColor}60` }}
            />
          </div>
        </div>

        {/* Skills */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "10px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "10px", opacity: 0.7 }}>SKILLS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {agent.skills.map((skill) => (
              <span key={skill} style={{ fontSize: "11px", padding: "5px 12px", background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.12)", color: T.text.muted, fontFamily: "monospace" }}>
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Owner & Endpoint */}
        <div style={{ padding: "16px", background: T.bg.elevated, borderLeft: `3px solid ${T.border.accent}`, marginBottom: "20px" }}>
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "4px", opacity: 0.6 }}>OWNER ADDRESS</div>
            <div style={{ fontSize: "12px", color: T.text.secondary, fontFamily: "monospace" }}>{agent.owner}</div>
          </div>
          <div>
            <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "4px", opacity: 0.6 }}>ENDPOINT (x402 ENABLED)</div>
            <div style={{ fontSize: "12px", color: T.text.secondary, fontFamily: "monospace", wordBreak: "break-all" }}>{agent.endpoint}</div>
          </div>
        </div>

        {/* x402 badge */}
        <div style={{ padding: "12px 16px", background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.1)", fontSize: "11px", color: "#60a5fa", fontFamily: "monospace", lineHeight: 1.6 }}>
          ⚡ x402 PROTOCOL — Agent ini dapat di-hire otomatis oleh AI agent lain tanpa human approval
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── AGENT CARD ───────────────────────────────────────────────
function AgentCard({ agent, index, onDetail }: { agent: AgentUI; index: number; onDetail: () => void }) {
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 150, damping: 20 });
  const springY = useSpring(rotateY, { stiffness: 150, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    rotateX.set((e.clientY - (rect.top + rect.height / 2)) / 25);
    rotateY.set(-((e.clientX - (rect.left + rect.width / 2)) / 25));
  };

  const repColor = agent.reputation >= 80 ? T.text.accent : agent.reputation >= 60 ? "#fbbf24" : "#f87171";

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => { setHovered(false); rotateX.set(0); rotateY.set(0); }}
      onMouseMove={handleMouseMove}
      onClick={onDetail}
      style={{ rotateX: springX, rotateY: springY, transformPerspective: 1000, willChange: "transform", cursor: "pointer" }}
    >
      <div style={{
        padding: "24px",
        background: hovered ? T.bg.elevated : T.bg.card,
        border: `1px solid ${hovered ? T.border.accent : T.border.default}`,
        borderTop: `2px solid ${agent.isActive ? (hovered ? T.text.accent : "rgba(74,222,128,0.35)") : T.border.default}`,
        transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
        boxShadow: hovered ? "0 8px 32px rgba(74,222,128,0.06)" : "none",
        opacity: agent.isActive ? 1 : 0.55,
      }}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <motion.div
              animate={agent.isActive ? { opacity: [1, 0.3, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ width: "5px", height: "5px", background: agent.isActive ? T.text.accent : T.text.disabled, boxShadow: agent.isActive ? `0 0 8px ${T.text.accent}` : "none" }}
            />
            <span style={{ fontSize: "10px", color: agent.isActive ? T.text.muted : T.text.disabled, fontFamily: "monospace", letterSpacing: "0.2em", fontWeight: 700 }}>
              {agent.isActive ? "ACTIVE" : "OFFLINE"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {agent.activeJobs > 0 && (
              <span style={{ fontSize: "9px", padding: "3px 8px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", color: "#fbbf24", fontFamily: "monospace" }}>
                {agent.activeJobs} RUNNING
              </span>
            )}
            <span style={{ fontSize: "10px", color: T.text.disabled, fontFamily: "monospace" }}>#{String(agent.id).padStart(3, "0")}</span>
          </div>
        </div>

        {/* Name */}
        <h3 style={{ fontSize: "26px", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "4px", fontFamily: "var(--font-syne), sans-serif", color: hovered ? T.text.primary : "#ddd", transition: "color 0.2s" }}>
          {agent.name}
        </h3>
        <p style={{ fontSize: "10px", color: T.text.muted, fontFamily: "monospace", marginBottom: "16px", opacity: 0.5 }}>{agent.owner}</p>

        {/* Skills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "20px" }}>
          {agent.skills.map((skill) => (
            <span key={skill} style={{ fontSize: "10px", padding: "3px 8px", background: "rgba(110,231,183,0.05)", border: "1px solid rgba(110,231,183,0.1)", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.08em" }}>
              {skill}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: T.border.default, marginBottom: "14px" }}>
          {[
            { label: "PRICE", value: agent.priceDisplay,      color: T.text.accent    },
            { label: "REP",   value: String(agent.reputation), color: repColor         },
            { label: "JOBS",  value: String(agent.totalJobs),  color: T.text.secondary },
          ].map((s) => (
            <div key={s.label} style={{ padding: "10px 12px", background: T.bg.card }}>
              <div style={{ fontSize: "9px", color: T.text.muted, marginBottom: "4px", letterSpacing: "0.15em", fontFamily: "monospace", opacity: 0.6 }}>{s.label}</div>
              <div style={{ fontSize: "17px", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Rep bar */}
        <div style={{ height: "2px", background: T.border.default, marginBottom: "14px", overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${agent.reputation}%` }}
            transition={{ delay: index * 0.06 + 0.3, duration: 0.8, ease: "easeOut" }}
            style={{ height: "100%", background: repColor, boxShadow: `0 0 6px ${repColor}50` }}
          />
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "10px", color: T.text.muted, fontFamily: "monospace", opacity: 0.5 }}>
            STAKE: {agent.stakeAmount} ETH
          </span>
          <span style={{ fontSize: "10px", color: hovered ? T.text.accent : T.text.disabled, fontFamily: "monospace", transition: "color 0.2s", letterSpacing: "0.1em" }}>
            DETAIL →
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── FILTER BAR ───────────────────────────────────────────────
type FilterState = { status: "all" | "active" | "offline"; skill: string; sort: "rep" | "jobs" | "price" };

function FilterBar({ filters, setFilters, allSkills, total }: {
  filters: FilterState; setFilters: (f: FilterState) => void;
  allSkills: string[]; total: number;
}) {
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "28px", flexWrap: "wrap", alignItems: "center", padding: "16px 20px", background: T.bg.card, border: `1px solid ${T.border.default}` }}>
      {/* Status filters */}
      {(["all", "active", "offline"] as const).map((s) => (
        <button key={s} onClick={() => setFilters({ ...filters, status: s })}
          style={{ padding: "6px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", cursor: "pointer", background: filters.status === s ? T.text.accent : "transparent", color: filters.status === s ? "#000" : T.text.disabled, border: `1px solid ${filters.status === s ? T.text.accent : T.border.default}`, fontFamily: "monospace", transition: "all 0.15s" }}
        >
          {s.toUpperCase()}
        </button>
      ))}

      <div style={{ width: "1px", height: "18px", background: T.border.default, margin: "0 4px" }} />

      {/* Skill filter */}
      <select value={filters.skill} onChange={(e) => setFilters({ ...filters, skill: e.target.value })}
        style={{ padding: "6px 12px", fontSize: "10px", background: T.bg.card, border: `1px solid ${filters.skill ? T.border.accent : T.border.default}`, color: filters.skill ? T.text.muted : T.text.disabled, fontFamily: "monospace", cursor: "pointer" }}
      >
        <option value="">ALL SKILLS</option>
        {allSkills.map((skill) => <option key={skill} value={skill} style={{ background: "#0d0d0d" }}>{skill.toUpperCase()}</option>)}
      </select>

      <div style={{ width: "1px", height: "18px", background: T.border.default, margin: "0 4px" }} />

      {/* Sort */}
      {([["rep", "BY REPUTATION"], ["jobs", "BY JOBS"], ["price", "BY PRICE"]] as const).map(([val, label]) => (
        <button key={val} onClick={() => setFilters({ ...filters, sort: val })}
          style={{ padding: "6px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer", background: "transparent", color: filters.sort === val ? T.text.primary : T.text.disabled, border: "none", borderBottom: `1px solid ${filters.sort === val ? T.text.accent : "transparent"}`, fontFamily: "monospace", transition: "all 0.15s" }}
        >
          {label}
        </button>
      ))}

      {/* Count */}
      <div style={{ marginLeft: "auto", fontSize: "10px", color: T.text.muted, fontFamily: "monospace", opacity: 0.6 }}>
        {total} AGENT{total !== 1 ? "S" : ""}
      </div>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────
export default function AgentsPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentUI | null>(null);
  const [filters, setFilters] = useState<FilterState>({ status: "all", skill: "", sort: "rep" });
  const { isConnected } = useAccount();

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const useRealData = HAS_CONTRACTS && isConnected;
  return (
    <AgentsContent
      useRealData={useRealData}
      selectedAgent={selectedAgent}
      setSelectedAgent={setSelectedAgent}
      filters={filters}
      setFilters={setFilters}
    />
  );
}

function AgentsContent({ useRealData, selectedAgent, setSelectedAgent, filters, setFilters }: {
  useRealData: boolean;
  selectedAgent: AgentUI | null;
  setSelectedAgent: (a: AgentUI | null) => void;
  filters: FilterState;
  setFilters: (f: FilterState) => void;
}) {
  const { data: agentCountRaw } = useReadContract({
    address: REGISTRY_ADDRESS as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
    functionName: "agentCount",
    query: { enabled: useRealData },
  });
  const agentCount = agentCountRaw ? Number(agentCountRaw) : 0;

  const agentBatchContracts = useMemo(() => {
    if (!useRealData || agentCount === 0) return [];
    const calls = [];
    for (let i = 0; i < Math.min(agentCount, 50); i++) {
      calls.push({ address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI, functionName: "agents", args: [BigInt(i)] });
      calls.push({ address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI, functionName: "getAgentSkills", args: [BigInt(i)] });
    }
    return calls;
  }, [useRealData, agentCount]);

  const { data: agentBatchData } = useReadContracts({
    contracts: agentBatchContracts as any,
    query: { enabled: agentBatchContracts.length > 0 },
  });

  const agents: AgentUI[] = useMemo(() => {
    if (!useRealData || !agentBatchData || agentBatchData.length === 0) return MOCK_AGENTS;
    const result: AgentUI[] = [];
    for (let i = 0; i < Math.min(agentCount, 50); i++) {
      const raw = agentBatchData[i * 2]?.result as any;
      const skillsRaw = agentBatchData[i * 2 + 1]?.result as string[] | undefined;
      if (!raw) continue;
      const rep = raw.totalFeedback > 0n ? Math.round(Number(raw.reputationTotal) / Number(raw.totalFeedback)) : 0;
      result.push({
        id: i, name: raw.name, skills: skillsRaw ?? [],
        priceDisplay: `$${(Number(raw.priceUSDCents) / 100).toFixed(2)}`,
        priceUSDCents: Number(raw.priceUSDCents), reputation: rep,
        totalJobs: Number(raw.totalJobs), activeJobs: Number(raw.activeJobs),
        isActive: raw.isActive,
        owner: `${(raw.owner as string).slice(0, 6)}...${(raw.owner as string).slice(-4)}`,
        endpoint: raw.endpoint,
        stakeAmount: (Number(raw.stakeAmount) / 1e18).toFixed(3),
      });
    }
    return result.length > 0 ? result : MOCK_AGENTS;
  }, [useRealData, agentBatchData, agentCount]);

  const filteredAgents = useMemo(() => {
    let list = [...agents];
    if (filters.status === "active")  list = list.filter((a) => a.isActive);
    if (filters.status === "offline") list = list.filter((a) => !a.isActive);
    if (filters.skill) list = list.filter((a) => a.skills.includes(filters.skill));
    if (filters.sort === "rep")   list.sort((a, b) => b.reputation - a.reputation);
    if (filters.sort === "jobs")  list.sort((a, b) => b.totalJobs - a.totalJobs);
    if (filters.sort === "price") list.sort((a, b) => a.priceUSDCents - b.priceUSDCents);
    return list;
  }, [agents, filters]);

  const allSkills = useMemo(() => [...new Set(agents.flatMap((a) => a.skills))].sort(), [agents]);
  const activeCount = agents.filter((a) => a.isActive).length;
  const avgRep = agents.length > 0 ? Math.round(agents.reduce((acc, a) => acc + a.reputation, 0) / agents.length) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "transparent", fontFamily: "var(--font-space), sans-serif", color: T.text.primary }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "40px 48px" }}>

        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          style={{ marginBottom: "32px" }}
        >
          <p style={{ fontSize: "10px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.25em", marginBottom: "10px" }}>
            ERC-8004 REGISTRY
          </p>
          <h1 style={{ fontSize: "clamp(32px, 4vw, 56px)", fontWeight: 900, letterSpacing: "-0.04em", fontFamily: "var(--font-syne), sans-serif", margin: "0 0 12px", color: T.text.primary }}>
            AI AGENTS
          </h1>
          <p style={{ fontSize: "14px", color: T.text.secondary, maxWidth: "480px", lineHeight: 1.6, margin: 0 }}>
            Autonomous agents registered on-chain. Each agent has a staked identity, verified reputation, and x402-enabled endpoint.
          </p>
        </motion.div>

        {/* Mini stats bar */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(3, auto) 1fr", gap: "1px", background: T.border.subtle, marginBottom: "24px", width: "fit-content" }}
        >
          {[
            { label: "TOTAL",   value: String(agents.length) },
            { label: "ACTIVE",  value: String(activeCount)   },
            { label: "AVG REP", value: String(avgRep)        },
          ].map((s) => (
            <div key={s.label} style={{ padding: "12px 24px", background: T.bg.card }}>
              <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "4px", opacity: 0.6 }}>{s.label}</div>
              <div style={{ fontSize: "20px", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", color: T.text.primary }}>{s.value}</div>
            </div>
          ))}
        </motion.div>

        {/* Filter bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <FilterBar filters={filters} setFilters={setFilters} allSkills={allSkills} total={filteredAgents.length} />
        </motion.div>

        {/* Agent grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${filters.status}-${filters.skill}-${filters.sort}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1px", background: T.border.subtle }}
          >
            {filteredAgents.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", padding: "80px", textAlign: "center", background: T.bg.card }}>
                <p style={{ fontSize: "12px", color: T.text.disabled, fontFamily: "monospace", letterSpacing: "0.1em" }}>NO AGENTS MATCH FILTER</p>
              </div>
            ) : (
              filteredAgents.map((agent, i) => (
                <AgentCard key={agent.id} agent={agent} index={i} onDetail={() => setSelectedAgent(agent)} />
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedAgent && (
          <AgentDetailModal agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}