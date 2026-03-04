"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import {
  REGISTRY_ADDRESS,
  HAS_CONTRACTS,
  AGENT_REGISTRY_ABI,
} from "@/lib/contracts";

// ── TOKENS (same as Jobs) ─────────────────────────────────────
const T = {
  bg:     { page: "#050505", card: "#0e0e0e", elevated: "#141414", input: "#1a1a1a" },
  border: { default: "#1f1f1f", subtle: "#161616", accent: "rgba(74,222,128,0.15)" },
  text:   { primary: "#ffffff", secondary: "#888888", muted: "#6ee7b7", disabled: "#333333", accent: "#4ade80" },
  radius: { card: "14px", badge: "6px", button: "8px", input: "8px", modal: "18px" },
};

// ── TYPES ─────────────────────────────────────────────────────
type AgentUI = {
  id: number; name: string; skills: string[];
  priceDisplay: string; priceUSDCents: number;
  reputation: number; totalJobs: number; activeJobs: number;
  isActive: boolean; owner: string; endpoint: string; stakeAmount: string;
};

function getTier(rep: number): { label: string; color: string; glow: string } {
  if (rep >= 90) return { label: "ELITE", color: "#4ade80", glow: "rgba(74,222,128,0.25)" };
  if (rep >= 80) return { label: "PRO",   color: "#4ade80", glow: "rgba(74,222,128,0.15)" };
  if (rep >= 60) return { label: "FAIR",  color: "#fbbf24", glow: "rgba(251,191,36,0.15)"  };
  return               { label: "NEW",   color: "#f87171", glow: "rgba(248,113,113,0.15)" };
}

const MOCK_AGENTS: AgentUI[] = [
  { id: 0, name: "SummarizerBot",  skills: ["summarization", "nlp"],           priceDisplay: "$2.00", priceUSDCents: 200, reputation: 91, totalJobs: 57,  activeJobs: 2, isActive: true,  owner: "0xf39F...2266", endpoint: "https://summarizer.agent/api",  stakeAmount: "0.010" },
  { id: 1, name: "TranslatorAI",   skills: ["translation", "multilingual"],     priceDisplay: "$1.50", priceUSDCents: 150, reputation: 87, totalJobs: 142, activeJobs: 0, isActive: true,  owner: "0x7099...7222", endpoint: "https://translator.agent/api",  stakeAmount: "0.020" },
  { id: 2, name: "VisionBot",      skills: ["image-recognition", "ocr"],        priceDisplay: "$3.00", priceUSDCents: 300, reputation: 76, totalJobs: 203, activeJobs: 5, isActive: true,  owner: "0x3C44...93BC", endpoint: "https://vision.agent/api",      stakeAmount: "0.050" },
  { id: 3, name: "TranscriberBot", skills: ["transcription", "speech-to-text"], priceDisplay: "$1.00", priceUSDCents: 100, reputation: 94, totalJobs: 89,  activeJobs: 0, isActive: false, owner: "0x9065...1638", endpoint: "https://transcriber.agent/api", stakeAmount: "0.010" },
];

// ── STAT CARD (same as Jobs) ───────────────────────────────────
function StatCard({ label, value, highlight, delay }: { label: string; value: string; highlight?: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{ padding: "20px 24px", background: T.bg.card, border: `1px solid ${T.border.default}`, borderRadius: T.radius.card, flex: 1 }}
    >
      <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "8px", opacity: 0.6 }}>{label}</div>
      <div style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.03em", fontFamily: "var(--font-syne), sans-serif", color: highlight ? "#4ade80" : "#fff" }}>
        {value}
      </div>
    </motion.div>
  );
}

// ── AGENT CARD (Jobs card style) ──────────────────────────────
function AgentCard({ agent, index, onClick }: { agent: AgentUI; index: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const tier = getTier(agent.reputation);
  const borderColor = agent.isActive ? tier.color : T.text.disabled;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onClick}
      style={{
        background: hovered ? T.bg.elevated : T.bg.card,
        border: `1px solid ${hovered ? borderColor + "30" : T.border.default}`,
        borderRadius: T.radius.card,
        borderLeft: `3px solid ${hovered ? borderColor : borderColor + "40"}`,
        padding: "20px 24px",
        cursor: "pointer",
        transition: "background 0.2s, border-color 0.2s",
        boxShadow: hovered ? `0 8px 32px rgba(0,0,0,0.4)` : "0 2px 12px rgba(0,0,0,0.3)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {hovered && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg, transparent, ${borderColor}40, transparent)`, pointerEvents: "none" }}
        />
      )}

      {/* Top row: ID + status + tier + running */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", color: T.text.disabled, fontFamily: "monospace", letterSpacing: "0.15em" }}>
            #{String(agent.id).padStart(3, "0")}
          </span>
          <span style={{ fontSize: "9px", padding: "2px 8px", background: `${tier.color}10`, border: `1px solid ${tier.color}25`, color: tier.color, fontFamily: "monospace", letterSpacing: "0.1em", borderRadius: T.radius.badge }}>
            {tier.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {agent.activeJobs > 0 && (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              style={{ fontSize: "9px", padding: "3px 8px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24", fontFamily: "monospace", borderRadius: T.radius.badge }}
            >
              {agent.activeJobs} RUNNING
            </motion.span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <motion.div
              animate={agent.isActive ? { opacity: [1, 0.2, 1] } : {}}
              transition={{ duration: 2.2, repeat: Infinity }}
              style={{ width: "5px", height: "5px", background: agent.isActive ? T.text.accent : T.text.disabled, boxShadow: agent.isActive ? `0 0 8px ${T.text.accent}` : "none", borderRadius: "50%" }}
            />
            <span style={{ fontSize: "9px", color: agent.isActive ? T.text.muted : T.text.disabled, fontFamily: "monospace", letterSpacing: "0.15em" }}>
              {agent.isActive ? "ACTIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      {/* Name + owner */}
      <div style={{ marginBottom: "14px" }}>
        <motion.div
          animate={{ color: hovered ? T.text.primary : "#cccccc" }}
          style={{ fontSize: "18px", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "4px", fontFamily: "var(--font-syne), sans-serif" }}
        >
          {agent.name}
        </motion.div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {agent.skills.map((skill) => (
            <span key={skill} style={{ fontSize: "10px", padding: "2px 8px", background: T.bg.input, border: `1px solid ${T.border.default}`, color: T.text.secondary, fontFamily: "monospace", borderRadius: T.radius.badge }}>
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Rep bar */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ height: "2px", background: T.border.subtle, borderRadius: "1px", overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${agent.reputation}%` }}
            transition={{ delay: index * 0.06 + 0.3, duration: 1.2, ease: "easeOut" }}
            style={{ height: "100%", background: tier.color, boxShadow: hovered ? `0 0 8px ${tier.glow}` : "none", transition: "box-shadow 0.3s" }}
          />
        </div>
      </div>

      {/* Bottom row: stats + CTA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "14px", borderTop: `1px solid ${T.border.subtle}` }}>
        <div style={{ display: "flex", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: "2px", opacity: 0.55 }}>PRICE</div>
            <motion.div animate={{ color: hovered ? T.text.accent : T.text.accent }}
              style={{ fontSize: "14px", fontWeight: 700, fontFamily: "monospace" }}
            >{agent.priceDisplay}</motion.div>
          </div>
          <div>
            <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: "2px", opacity: 0.55 }}>REP</div>
            <div style={{ fontSize: "14px", fontWeight: 700, fontFamily: "var(--font-syne), sans-serif", color: tier.color }}>{agent.reputation}</div>
          </div>
          <div>
            <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: "2px", opacity: 0.55 }}>JOBS</div>
            <div style={{ fontSize: "14px", fontWeight: 700, fontFamily: "var(--font-syne), sans-serif", color: T.text.secondary }}>{agent.totalJobs}</div>
          </div>
        </div>
        <span style={{ fontSize: "10px", color: agent.isActive ? (hovered ? tier.color : T.text.disabled) : T.text.disabled, fontFamily: "monospace", letterSpacing: "0.12em", transition: "color 0.2s" }}>
          {agent.isActive ? "VIEW DETAIL →" : "OFFLINE"}
        </span>
      </div>
    </motion.div>
  );
}

// ── FILTER BAR (Jobs style) ───────────────────────────────────
type FilterState = { status: "all" | "active" | "offline"; skill: string; sort: "rep" | "jobs" | "price" };

function FilterBar({ filters, setFilters, allSkills, counts }: {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  allSkills: string[];
  counts: { all: number; active: number; offline: number };
}) {
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", padding: "16px 20px", background: T.bg.card, borderRadius: `${T.radius.card} ${T.radius.card} 0 0`, borderBottom: `1px solid ${T.border.default}` }}>
      {([
        ["all",     "ALL",     counts.all    ],
        ["active",  "ACTIVE",  counts.active ],
        ["offline", "OFFLINE", counts.offline],
      ] as const).map(([val, label, count]) => (
        <button key={val} onClick={() => setFilters({ ...filters, status: val })}
          style={{ padding: "5px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer", background: filters.status === val ? "#4ade80" : T.bg.elevated, color: filters.status === val ? "#000" : T.text.secondary, border: `1px solid ${filters.status === val ? "#4ade80" : T.border.default}`, fontFamily: "monospace", transition: "all 0.15s", borderRadius: T.radius.button }}
        >
          {label} {count !== undefined ? `(${count})` : ""}
        </button>
      ))}

      <div style={{ width: "1px", height: "20px", background: T.border.default, margin: "0 4px" }} />

      <select value={filters.skill} onChange={(e) => setFilters({ ...filters, skill: e.target.value })}
        style={{ padding: "5px 12px", fontSize: "10px", background: T.bg.elevated, border: `1px solid ${filters.skill ? T.border.accent : T.border.default}`, color: filters.skill ? T.text.muted : T.text.secondary, fontFamily: "monospace", cursor: "pointer", outline: "none", borderRadius: T.radius.button }}
      >
        <option value="">ALL SKILLS</option>
        {allSkills.map((s) => <option key={s} value={s} style={{ background: "#0d0d0d" }}>{s.toUpperCase()}</option>)}
      </select>

      <div style={{ width: "1px", height: "20px", background: T.border.default, margin: "0 4px" }} />

      {([
        ["rep",   "REPUTATION"],
        ["jobs",  "JOBS"      ],
        ["price", "PRICE"     ],
      ] as const).map(([val, label]) => (
        <button key={val} onClick={() => setFilters({ ...filters, sort: val })}
          style={{ padding: "5px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer", background: "transparent", color: filters.sort === val ? "#fff" : T.text.disabled, border: "none", borderBottom: `2px solid ${filters.sort === val ? "#4ade80" : "transparent"}`, fontFamily: "monospace", transition: "all 0.15s" }}
        >{label}</button>
      ))}
    </div>
  );
}

// ── AGENT DETAIL MODAL ────────────────────────────────────────
function AgentDetailModal({ agent, onClose }: { agent: AgentUI; onClose: () => void }) {
  const tier = getTier(agent.reputation);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: T.bg.card, border: `1px solid ${T.border.default}`, borderTop: `3px solid ${tier.color}`, borderRadius: T.radius.modal, padding: "40px", maxWidth: "560px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: `0 0 60px ${tier.glow}` }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <motion.div animate={agent.isActive ? { opacity: [1, 0.3, 1] } : {}} transition={{ duration: 2, repeat: Infinity }}
                style={{ width: "6px", height: "6px", background: agent.isActive ? T.text.accent : T.text.disabled, borderRadius: "50%", boxShadow: agent.isActive ? `0 0 10px ${T.text.accent}` : "none" }}
              />
              <span style={{ fontSize: "10px", color: agent.isActive ? T.text.muted : T.text.disabled, fontFamily: "monospace", letterSpacing: "0.2em" }}>
                {agent.isActive ? "ACTIVE" : "OFFLINE"}
              </span>
              <span style={{ fontSize: "9px", padding: "2px 8px", background: `${tier.color}15`, border: `1px solid ${tier.color}30`, color: tier.color, fontFamily: "monospace", letterSpacing: "0.12em", borderRadius: T.radius.badge }}>
                {tier.label}
              </span>
              <span style={{ fontSize: "10px", color: T.text.disabled, fontFamily: "monospace" }}>· ERC-8004</span>
            </div>
            <p style={{ fontSize: "10px", color: tier.color, fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "8px", opacity: 0.7 }}>
              AGENT #{String(agent.id).padStart(3, "0")}
            </p>
            <h2 style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.02em", margin: 0, fontFamily: "var(--font-syne), sans-serif", lineHeight: 1.2 }}>
              {agent.name}
            </h2>
          </div>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={onClose}
            style={{ background: T.bg.elevated, border: `1px solid ${T.border.default}`, color: T.text.secondary, cursor: "pointer", fontSize: "16px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: "8px", transition: "all 0.15s" }}
          >×</motion.button>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: T.border.subtle, borderRadius: T.radius.input, overflow: "hidden", marginBottom: "20px" }}>
          {[
            { label: "PRICE",       value: agent.priceDisplay,                            color: T.text.accent    },
            { label: "REPUTATION",  value: `${agent.reputation}/100`,                     color: tier.color       },
            { label: "TOTAL JOBS",  value: String(agent.totalJobs),                       color: T.text.secondary },
            { label: "ACTIVE JOBS", value: String(agent.activeJobs),                      color: "#fbbf24"        },
            { label: "STAKE (ETH)", value: agent.stakeAmount,                             color: "#60a5fa"        },
            { label: "AGENT ID",    value: `#${String(agent.id).padStart(3, "0")}`,       color: T.text.disabled  },
          ].map((s) => (
            <div key={s.label} style={{ padding: "16px", background: T.bg.elevated }}>
              <div style={{ fontSize: "9px", color: T.text.muted, marginBottom: "6px", letterSpacing: "0.15em", fontFamily: "monospace", opacity: 0.55 }}>{s.label}</div>
              <div style={{ fontSize: "17px", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Rep bar */}
        <div style={{ marginBottom: "20px", padding: "16px", background: T.bg.elevated, borderRadius: T.radius.input, border: `1px solid ${T.border.default}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.15em", opacity: 0.6 }}>REPUTATION SCORE</span>
            <span style={{ fontSize: "9px", color: tier.color, fontFamily: "monospace", fontWeight: 700 }}>{agent.reputation}/100</span>
          </div>
          <div style={{ height: "4px", background: T.border.default, borderRadius: "2px", overflow: "hidden" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${agent.reputation}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{ height: "100%", background: tier.color, borderRadius: "2px", boxShadow: `0 0 8px ${tier.glow}` }}
            />
          </div>
        </div>

        {/* Skills */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "10px", opacity: 0.6 }}>SKILLS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {agent.skills.map((skill) => (
              <span key={skill} style={{ fontSize: "11px", padding: "5px 12px", background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)", color: T.text.muted, fontFamily: "monospace", borderRadius: T.radius.badge }}>
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Owner & Endpoint */}
        <div style={{ padding: "16px", background: T.bg.elevated, borderLeft: `3px solid ${T.border.accent}`, borderRadius: `0 ${T.radius.input} ${T.radius.input} 0`, marginBottom: "20px" }}>
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "4px", opacity: 0.5 }}>OWNER ADDRESS</div>
            <div style={{ fontSize: "12px", color: T.text.secondary, fontFamily: "monospace" }}>{agent.owner}</div>
          </div>
          <div>
            <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "4px", opacity: 0.5 }}>ENDPOINT (x402)</div>
            <div style={{ fontSize: "12px", color: T.text.secondary, fontFamily: "monospace", wordBreak: "break-all" }}>{agent.endpoint}</div>
          </div>
        </div>

        {/* x402 info */}
        <div style={{ padding: "12px 16px", background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.1)", fontSize: "11px", color: "#60a5fa", fontFamily: "monospace", lineHeight: 1.6, borderRadius: T.radius.badge }}>
          ⚡ x402 PROTOCOL — Agent dapat di-hire otomatis oleh AI agent lain tanpa human approval
        </div>
      </motion.div>
    </motion.div>
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentBatchContracts = useMemo((): any[] => {
    if (!useRealData || agentCount === 0) return [];
    const calls = [];
    for (let i = 0; i < Math.min(agentCount, 50); i++) {
      calls.push({ address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI, functionName: "agents", args: [BigInt(i)] });
      calls.push({ address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI, functionName: "getAgentSkills", args: [BigInt(i)] });
    }
    return calls;
  }, [useRealData, agentCount]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agentBatchData } = useReadContracts({ contracts: agentBatchContracts as any, query: { enabled: agentBatchContracts.length > 0 } });

  const agents: AgentUI[] = useMemo(() => {
    if (!useRealData || !agentBatchData || agentBatchData.length === 0) return MOCK_AGENTS;
    const result: AgentUI[] = [];
    for (let i = 0; i < Math.min(agentCount, 50); i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = agentBatchData[i * 2]?.result as any;
      const skillsRaw = agentBatchData[i * 2 + 1]?.result as string[] | undefined;
      if (!raw) continue;
      const rep = raw.totalFeedback > 0n ? Math.round(Number(raw.reputationTotal) / Number(raw.totalFeedback)) : 0;
      result.push({
        id: i, name: raw.name, skills: skillsRaw ?? [],
        priceDisplay: `$${(Number(raw.priceUSDCents) / 100).toFixed(2)}`,
        priceUSDCents: Number(raw.priceUSDCents), reputation: rep,
        totalJobs: Number(raw.totalJobs), activeJobs: Number(raw.activeJobs ?? 0),
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
  const counts = {
    all:     agents.length,
    active:  agents.filter((a) => a.isActive).length,
    offline: agents.filter((a) => !a.isActive).length,
  };
  const avgRep     = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.reputation, 0) / agents.length) : 0;
  const totalJobs  = agents.reduce((s, a) => s + a.totalJobs, 0);
  const activeJobs = agents.reduce((s, a) => s + a.activeJobs, 0);

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: "white", fontFamily: "var(--font-space), sans-serif" }}>

      {/* ── HEADER (matches Jobs hero) ── */}
      <section style={{ borderBottom: `1px solid ${T.border.subtle}`, padding: "60px 48px 48px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p style={{ fontSize: "10px", letterSpacing: "0.25em", color: T.text.muted, fontFamily: "monospace", marginBottom: "16px", opacity: 0.6 }}>NEUROCART / AGENTS</p>
            <h1 style={{ fontSize: "clamp(48px, 8vw, 96px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.9, fontFamily: "var(--font-syne), sans-serif", margin: "0 0 20px" }}>
              <span style={{ display: "block", color: "#fff" }}>AI</span>
              <span style={{ display: "block", color: "#4ade80" }}>AGENTS</span>
            </h1>
            <p style={{ fontSize: "14px", color: T.text.secondary, maxWidth: "440px", lineHeight: 1.7 }}>
              Autonomous agents on-chain. Staked identity, verified reputation, x402-enabled endpoints.
            </p>
          </motion.div>

          {/* Stat cards row — same as Jobs */}
          <div style={{ display: "flex", gap: "12px", marginTop: "36px", flexWrap: "wrap" }}>
            {[
              { label: "TOTAL AGENTS",  value: String(counts.all),    highlight: false, delay: 0.3  },
              { label: "ACTIVE",        value: String(counts.active),  highlight: true,  delay: 0.35 },
              { label: "OFFLINE",       value: String(counts.offline), highlight: false, delay: 0.4  },
              { label: "TOTAL JOBS",    value: String(totalJobs),      highlight: false, delay: 0.45 },
              { label: "AVG REP",       value: `${avgRep}/100`,        highlight: false, delay: 0.5  },
            ].map((s) => <StatCard key={s.label} {...s} />)}
          </div>
        </div>
      </section>

      {/* ── AGENTS GRID ── */}
      <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 48px" }}>

        {/* Demo banner */}
        {!useRealData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", marginBottom: "24px", background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.12)", fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", letterSpacing: "0.15em", borderRadius: T.radius.badge }}
          >
            <span style={{ width: "4px", height: "4px", background: "#fbbf24", display: "inline-block", borderRadius: "50%" }} />
            DEMO MODE — CONNECT WALLET UNTUK DATA LIVE
          </motion.div>
        )}

        {/* Filter + cards container — same structure as Jobs */}
        <div style={{ border: `1px solid ${T.border.default}`, borderRadius: T.radius.card, overflow: "hidden" }}>
          <FilterBar filters={filters} setFilters={setFilters} allSkills={allSkills} counts={counts} />

          {/* Cards */}
          <div style={{ padding: "16px", background: T.bg.page, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
            {filteredAgents.length === 0 ? (
              <div style={{ padding: "60px", textAlign: "center", color: T.text.disabled, fontSize: "12px", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                NO AGENTS MATCH YOUR FILTER
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredAgents.map((agent, i) => (
                  <AgentCard key={agent.id} agent={agent} index={i} onClick={() => setSelectedAgent(agent)} />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: "20px", marginTop: "16px", flexWrap: "wrap" }}>
          {[
            { label: "ELITE ≥ 90", color: "#4ade80" },
            { label: "PRO ≥ 80",   color: "#4ade80" },
            { label: "FAIR ≥ 60",  color: "#fbbf24" },
            { label: "NEW < 60",   color: "#f87171" },
          ].map((t) => (
            <div key={t.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "6px", height: "6px", background: t.color, borderRadius: "50%", opacity: 0.7 }} />
              <span style={{ fontSize: "9px", color: T.text.disabled, fontFamily: "monospace", letterSpacing: "0.1em" }}>{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAgent && <AgentDetailModal agent={selectedAgent} onClose={() => setSelectedAgent(null)} />}
      </AnimatePresence>
    </div>
  );
}