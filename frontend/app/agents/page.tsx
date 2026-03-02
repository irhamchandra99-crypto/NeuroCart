"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import {
  REGISTRY_ADDRESS,
  HAS_CONTRACTS,
  AGENT_REGISTRY_ABI,
} from "@/lib/contracts";

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
  { id: 0, name: "SummarizerBot",  skills: ["summarization", "nlp"],           priceDisplay: "$2.00", priceUSDCents: 200, reputation: 91, totalJobs: 57,  activeJobs: 2, isActive: true,  owner: "0xf39F...2266", endpoint: "https://summarizer.agent/api", stakeAmount: "0.010" },
  { id: 1, name: "TranslatorAI",   skills: ["translation", "multilingual"],     priceDisplay: "$1.50", priceUSDCents: 150, reputation: 87, totalJobs: 142, activeJobs: 0, isActive: true,  owner: "0x7099...7222", endpoint: "https://translator.agent/api", stakeAmount: "0.020" },
  { id: 2, name: "VisionBot",      skills: ["image-recognition", "ocr"],        priceDisplay: "$3.00", priceUSDCents: 300, reputation: 76, totalJobs: 203, activeJobs: 5, isActive: true,  owner: "0x3C44...93BC", endpoint: "https://vision.agent/api",      stakeAmount: "0.050" },
  { id: 3, name: "TranscriberBot", skills: ["transcription", "speech-to-text"], priceDisplay: "$1.00", priceUSDCents: 100, reputation: 94, totalJobs: 89,  activeJobs: 0, isActive: false, owner: "0x9065...1638", endpoint: "https://transcriber.agent/api", stakeAmount: "0.010" },
];

// ── AGENT DETAIL MODAL ───────────────────────────────────────

function AgentDetailModal({ agent, onClose }: { agent: AgentUI; onClose: () => void }) {
  const repColor = agent.reputation >= 80 ? "#4ade80" : agent.reputation >= 60 ? "#fbbf24" : "#f87171";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "40px", maxWidth: "560px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <div style={{ width: "6px", height: "6px", background: agent.isActive ? "#4ade80" : "#333", boxShadow: agent.isActive ? "0 0 8px #4ade80" : "none" }} />
              <span style={{ fontSize: "10px", color: agent.isActive ? "#4ade80" : "#333", fontFamily: "monospace", letterSpacing: "0.2em" }}>
                {agent.isActive ? "ACTIVE" : "OFFLINE"}
              </span>
              <span style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace" }}>· ERC-8004</span>
            </div>
            <h2 style={{ fontSize: "36px", fontWeight: 900, letterSpacing: "-0.03em", margin: 0, fontFamily: "var(--font-syne), sans-serif", lineHeight: 1 }}>
              {agent.name}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #1a1a1a", color: "#444", cursor: "pointer", fontSize: "18px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "#111", marginBottom: "24px" }}>
          {[
            { label: "PRICE",       value: agent.priceDisplay,        color: "#4ade80"  },
            { label: "REPUTATION",  value: `${agent.reputation}/100`, color: repColor   },
            { label: "TOTAL JOBS",  value: String(agent.totalJobs),   color: "#888"     },
            { label: "ACTIVE JOBS", value: String(agent.activeJobs),  color: "#fbbf24"  },
            { label: "STAKE",       value: `${agent.stakeAmount} ETH`,color: "#60a5fa"  },
            { label: "AGENT ID",    value: `#${String(agent.id).padStart(3, "0")}`, color: "#222" },
          ].map((s) => (
            <div key={s.label} style={{ padding: "16px", background: "#080808" }}>
              <div style={{ fontSize: "9px", color: "#1a1a1a", marginBottom: "6px", letterSpacing: "0.15em", fontFamily: "monospace" }}>{s.label}</div>
              <div style={{ fontSize: "16px", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Rep bar */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "8px" }}>REPUTATION SCORE</div>
          <div style={{ height: "4px", background: "#111" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${agent.reputation}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ height: "100%", background: repColor }} />
          </div>
        </div>

        {/* Skills */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "10px" }}>SKILLS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {agent.skills.map((skill) => (
              <span key={skill} style={{ fontSize: "11px", padding: "5px 12px", background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.12)", color: "#4ade80", fontFamily: "monospace" }}>
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Owner & Endpoint */}
        <div style={{ padding: "16px", background: "#111", borderLeft: "3px solid #1a1a1a", marginBottom: "20px" }}>
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "9px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "4px" }}>OWNER ADDRESS</div>
            <div style={{ fontSize: "12px", color: "#444", fontFamily: "monospace" }}>{agent.owner}</div>
          </div>
          <div>
            <div style={{ fontSize: "9px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "4px" }}>ENDPOINT (x402 ENABLED)</div>
            <div style={{ fontSize: "12px", color: "#444", fontFamily: "monospace", wordBreak: "break-all" }}>{agent.endpoint}</div>
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
  const repColor = agent.reputation >= 80 ? "#4ade80" : agent.reputation >= 60 ? "#fbbf24" : "#f87171";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)}
      style={{ padding: "24px", background: hovered ? "#0d0d0d" : "#080808", border: "1px solid #111", borderTop: `2px solid ${agent.isActive ? "#4ade80" : "#1a1a1a"}`, transition: "all 0.2s", cursor: "pointer" }}
      onClick={onDetail}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "5px", height: "5px", background: agent.isActive ? "#4ade80" : "#222", boxShadow: agent.isActive ? "0 0 8px #4ade80" : "none" }} />
          <span style={{ fontSize: "10px", color: agent.isActive ? "#4ade80" : "#222", fontFamily: "monospace", letterSpacing: "0.2em", fontWeight: 700 }}>
            {agent.isActive ? "ACTIVE" : "OFFLINE"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {agent.activeJobs > 0 && (
            <span style={{ fontSize: "9px", padding: "3px 8px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", color: "#fbbf24", fontFamily: "monospace" }}>
              {agent.activeJobs} RUNNING
            </span>
          )}
          <span style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace" }}>#{String(agent.id).padStart(3, "0")}</span>
        </div>
      </div>

      <h3 style={{ fontSize: "26px", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "4px", fontFamily: "var(--font-syne), sans-serif", color: hovered ? "#fff" : "#ddd", transition: "color 0.2s" }}>
        {agent.name}
      </h3>
      <p style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", marginBottom: "16px" }}>{agent.owner}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "20px" }}>
        {agent.skills.map((skill) => (
          <span key={skill} style={{ fontSize: "10px", padding: "3px 8px", border: "1px solid #1a1a1a", color: "#2a2a2a", fontFamily: "monospace" }}>
            {skill}
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "#111", marginBottom: "16px" }}>
        {[
          { label: "PRICE", value: agent.priceDisplay, color: "#4ade80" },
          { label: "REP",   value: `${agent.reputation}`, color: repColor },
          { label: "JOBS",  value: String(agent.totalJobs), color: "#555" },
        ].map((s) => (
          <div key={s.label} style={{ padding: "12px", background: "#080808" }}>
            <div style={{ fontSize: "9px", color: "#1a1a1a", marginBottom: "4px", letterSpacing: "0.15em", fontFamily: "monospace" }}>{s.label}</div>
            <div style={{ fontSize: "18px", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ height: "2px", background: "#111", marginBottom: "16px" }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${agent.reputation}%` }}
          transition={{ delay: index * 0.06 + 0.3, duration: 0.8, ease: "easeOut" }}
          style={{ height: "100%", background: repColor }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace" }}>
          STAKE: {agent.stakeAmount} ETH
        </span>
        <span style={{ fontSize: "10px", color: hovered ? "#4ade80" : "#1a1a1a", fontFamily: "monospace", transition: "color 0.2s", letterSpacing: "0.1em" }}>
          DETAIL →
        </span>
      </div>
    </motion.div>
  );
}

// ── FILTER BAR ───────────────────────────────────────────────

type FilterState = { status: "all" | "active" | "offline"; skill: string; sort: "rep" | "jobs" | "price" };

function FilterBar({ filters, setFilters, allSkills }: { filters: FilterState; setFilters: (f: FilterState) => void; allSkills: string[] }) {
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "28px", flexWrap: "wrap", alignItems: "center" }}>
      {(["all", "active", "offline"] as const).map((s) => (
        <button key={s} onClick={() => setFilters({ ...filters, status: s })}
          style={{ padding: "7px 16px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", cursor: "pointer", background: filters.status === s ? "#4ade80" : "transparent", color: filters.status === s ? "#000" : "#222", border: `1px solid ${filters.status === s ? "#4ade80" : "#111"}`, fontFamily: "monospace", transition: "all 0.15s" }}
        >
          {s.toUpperCase()}
        </button>
      ))}
      <div style={{ width: "1px", height: "20px", background: "#111", margin: "0 4px" }} />
      <select value={filters.skill} onChange={(e) => setFilters({ ...filters, skill: e.target.value })}
        style={{ padding: "7px 12px", fontSize: "10px", background: "#080808", border: "1px solid #111", color: filters.skill ? "#4ade80" : "#222", fontFamily: "monospace", cursor: "pointer" }}
      >
        <option value="">ALL SKILLS</option>
        {allSkills.map((skill) => <option key={skill} value={skill} style={{ background: "#080808" }}>{skill.toUpperCase()}</option>)}
      </select>
      <div style={{ width: "1px", height: "20px", background: "#111", margin: "0 4px" }} />
      {([["rep", "BY REPUTATION"], ["jobs", "BY JOBS"], ["price", "BY PRICE"]] as const).map(([val, label]) => (
        <button key={val} onClick={() => setFilters({ ...filters, sort: val })}
          style={{ padding: "7px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer", background: "transparent", color: filters.sort === val ? "#fff" : "#1a1a1a", border: "none", borderBottom: `1px solid ${filters.sort === val ? "#4ade80" : "transparent"}`, fontFamily: "monospace", transition: "all 0.15s" }}
        >
          {label}
        </button>
      ))}
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
  return <AgentsContent useRealData={useRealData} selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent} filters={filters} setFilters={setFilters} />;
}

function AgentsContent({
  useRealData,
  selectedAgent,
  setSelectedAgent,
  filters,
  setFilters,
}: {
  useRealData: boolean;
  selectedAgent: AgentUI | null;
  setSelectedAgent: (a: AgentUI | null) => void;
  filters: FilterState;
  setFilters: (f: FilterState) => void;
}) {
  const { isConnected } = useAccount();

  console.log("========== DEBUG ==========");
  console.log("isConnected:", isConnected);
  console.log("HAS_CONTRACTS:", HAS_CONTRACTS);
  console.log("useRealData:", useRealData);
  console.log("REGISTRY_ADDRESS:", REGISTRY_ADDRESS);
  console.log("===========================");

  const { data: agentCountRaw } = useReadContract({
    address: REGISTRY_ADDRESS as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
    functionName: "agentCount",
    query: { enabled: useRealData },
  });

  const agentCount = agentCountRaw ? Number(agentCountRaw) : 0;

  console.log("agentCountRaw:", agentCountRaw);
  console.log("agentCount:", agentCount);

  const agentBatchContracts = useMemo(() => {
    if (!useRealData || agentCount === 0) return [];

    const calls = [];
    for (let i = 0; i < Math.min(agentCount, 50); i++) {
      calls.push({
        address: REGISTRY_ADDRESS as `0x${string}`,
        abi: AGENT_REGISTRY_ABI,
        functionName: "agents",
        args: [BigInt(i)],
      });

      calls.push({
        address: REGISTRY_ADDRESS as `0x${string}`,
        abi: AGENT_REGISTRY_ABI,
        functionName: "getAgentSkills",
        args: [BigInt(i)],
      });
    }

    return calls;
  }, [useRealData, agentCount]);

  console.log("agentBatchContracts length:", agentBatchContracts.length);

  const { data: agentBatchData } = useReadContracts({
    contracts: agentBatchContracts as any,
    query: { enabled: agentBatchContracts.length > 0 },
  });

  console.log("agentBatchData:", agentBatchData);

  const agents: AgentUI[] = useMemo(() => {
    if (!useRealData) {
      console.log("⚠️ Falling back: useRealData = false");
      return MOCK_AGENTS;
    }

    if (!agentBatchData || agentBatchData.length === 0) {
      console.log("⚠️ Falling back: no batch data");
      return MOCK_AGENTS;
    }

    const result: AgentUI[] = [];

    for (let i = 0; i < Math.min(agentCount, 50); i++) {
      const raw = agentBatchData[i * 2]?.result as any;
      const skillsRaw = agentBatchData[i * 2 + 1]?.result as
        | string[]
        | undefined;

      if (!raw) continue;

      const rep =
        raw.totalFeedback > 0n
          ? Math.round(
              Number(raw.reputationTotal) / Number(raw.totalFeedback)
            )
          : 0;

      result.push({
        id: i,
        name: raw.name,
        skills: skillsRaw ?? [],
        priceDisplay: `$${(Number(raw.priceUSDCents) / 100).toFixed(2)}`,
        priceUSDCents: Number(raw.priceUSDCents),
        reputation: rep,
        totalJobs: Number(raw.totalJobs),
        activeJobs: Number(raw.activeJobs),
        isActive: raw.isActive,
        owner: `${(raw.owner as string).slice(0, 6)}...${(
          raw.owner as string
        ).slice(-4)}`,
        endpoint: raw.endpoint,
        stakeAmount: (Number(raw.stakeAmount) / 1e18).toFixed(3),
      });
    }

    console.log("Parsed real agents:", result);

    if (result.length === 0) {
      console.log("⚠️ No real agents found, fallback to MOCK");
      return MOCK_AGENTS;
    }

    return result;
  }, [useRealData, agentBatchData, agentCount]);

  const filteredAgents = useMemo(() => {
    let list = [...agents];

    if (filters.status === "active")
      list = list.filter((a) => a.isActive);

    if (filters.status === "offline")
      list = list.filter((a) => !a.isActive);

    if (filters.skill)
      list = list.filter((a) => a.skills.includes(filters.skill));

    if (filters.sort === "rep")
      list.sort((a, b) => b.reputation - a.reputation);

    if (filters.sort === "jobs")
      list.sort((a, b) => b.totalJobs - a.totalJobs);

    if (filters.sort === "price")
      list.sort((a, b) => a.priceUSDCents - b.priceUSDCents);

    return list;
  }, [agents, filters]);

  const allSkills = useMemo(
    () => [...new Set(agents.flatMap((a) => a.skills))].sort(),
    [agents]
  );

  const activeCount = agents.filter((a) => a.isActive).length;

  const avgRep =
    agents.length > 0
      ? Math.round(
          agents.reduce((acc, a) => acc + a.reputation, 0) /
            agents.length
        )
      : 0;

  return (
    <div>
      {/* BIAR SEDERHANA DULU */}
      <h2 style={{ marginBottom: 20 }}>
        DEBUG MODE — CHECK CONSOLE
      </h2>

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        allSkills={allSkills}
      />

      <div style={{ marginTop: 20 }}>
        {filteredAgents.map((agent, i) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            index={i}
            onDetail={() => setSelectedAgent(agent)}
          />
        ))}
      </div>

      <AnimatePresence>
        {selectedAgent && (
          <AgentDetailModal
            agent={selectedAgent}
            onClose={() => setSelectedAgent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}