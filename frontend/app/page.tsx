"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

type AgentUI = {
  id: number; 
  name: string; 
  skills: string[];
  priceDisplay: string; 
  reputation: number;
  totalJobs: number; 
  isActive: boolean; 
  owner: string;
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
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.92)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: "24px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "40px", maxWidth: "520px", width: "100%" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
          <div>
            <p style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#333", marginBottom: "8px", fontFamily: "monospace" }}>HIRE AGENT #{agent.id}</p>
            <h2 style={{ fontSize: "32px", fontWeight: 900, letterSpacing: "-0.03em", margin: 0, fontFamily: "var(--font-syne), sans-serif", lineHeight: 1 }}>
              {agent.name}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #1a1a1a", color: "#444", cursor: "pointer", fontSize: "18px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        <label style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#333", display: "block", marginBottom: "8px", fontFamily: "monospace" }}>JOB DESCRIPTION</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the task..." rows={4}
          style={{ width: "100%", padding: "14px", background: "#111", border: "1px solid #1a1a1a", borderTop: "2px solid #222", color: "white", fontSize: "14px", resize: "vertical", fontFamily: "var(--font-space), sans-serif", boxSizing: "border-box", outline: "none", marginBottom: "20px" }}
        />

        <label style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#333", display: "block", marginBottom: "8px", fontFamily: "monospace" }}>JOB TYPE</label>
        <select value={jobType} onChange={(e) => setJobType(e.target.value)}
          style={{ width: "100%", padding: "12px 14px", background: "#111", border: "1px solid #1a1a1a", color: "white", fontSize: "14px", fontFamily: "var(--font-space), sans-serif", boxSizing: "border-box", marginBottom: "24px" }}
        >
          {agent.skills.map((s) => <option key={s} value={s} style={{ background: "#111" }}>{s}</option>)}
        </select>

        <div style={{ padding: "16px", marginBottom: "28px", background: "#111", borderLeft: "3px solid #4ade80", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#444", fontFamily: "monospace" }}>PAYMENT · CHAINLINK ETH/USD</div>
            <div style={{ fontSize: "11px", color: "#333", marginTop: "4px" }}>{agent.priceDisplay} auto-converted</div>
          </div>
          <span style={{ fontSize: "20px", fontWeight: 900, color: "#4ade80", fontFamily: "monospace" }}>{ethDisplay}</span>
        </div>

        {isSuccess && (
          <div style={{ padding: "12px 16px", marginBottom: "20px", background: "rgba(74,222,128,0.05)", borderLeft: "3px solid #4ade80", fontSize: "13px", color: "#4ade80" }}>
            Job created. Agent processing. Chainlink verifying quality.
          </div>
        )}

        <motion.button whileTap={{ scale: 0.98 }} onClick={handleHire}
          disabled={isPending || isConfirming || !description.trim() || !ESCROW_ADDRESS}
          style={{ width: "100%", padding: "16px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.2em", cursor: isPending || isConfirming ? "not-allowed" : "pointer", background: isPending || isConfirming ? "#111" : "#4ade80", color: isPending || isConfirming ? "#333" : "#000", border: "none", fontFamily: "monospace", opacity: !description.trim() || !ESCROW_ADDRESS ? 0.4 : 1, transition: "all 0.15s" }}
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)}
      style={{ padding: "28px", background: hovered ? "#0f0f0f" : "#080808", border: "1px solid #111", borderTop: agent.isActive ? "2px solid #4ade80" : "2px solid #1a1a1a", transition: "all 0.2s" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "5px", height: "5px", background: agent.isActive ? "#4ade80" : "#222", boxShadow: agent.isActive ? "0 0 8px #4ade80" : "none" }} />
          <span style={{ fontSize: "10px", letterSpacing: "0.2em", color: agent.isActive ? "#4ade80" : "#222", fontFamily: "monospace", fontWeight: 700 }}>
            {agent.isActive ? "ACTIVE" : "OFFLINE"}
          </span>
        </div>
        <span style={{ fontSize: "10px", color: "#222", fontFamily: "monospace" }}>#{String(agent.id).padStart(3, "0")}</span>
      </div>

      <h3 style={{ fontSize: "30px", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "6px", fontFamily: "var(--font-syne), sans-serif", color: hovered ? "#fff" : "#ddd", transition: "color 0.2s" }}>
        {agent.name}
      </h3>
      <p style={{ fontSize: "11px", color: "#222", fontFamily: "monospace", marginBottom: "20px" }}>{agent.owner}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "24px" }}>
        {agent.skills.map((skill) => (
          <span key={skill} style={{ fontSize: "10px", padding: "4px 10px", background: "transparent", border: "1px solid #1a1a1a", color: "#444", fontFamily: "monospace", letterSpacing: "0.1em" }}>
            {skill}
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "#111", marginBottom: "20px" }}>
        {[
          { label: "PRICE", value: agent.priceDisplay, color: "#4ade80" },
          { label: "REP",   value: `${agent.reputation}`, color: "#888" },
          { label: "JOBS",  value: String(agent.totalJobs), color: "#888" },
        ].map((s) => (
          <div key={s.label} style={{ padding: "14px", background: "#080808" }}>
            <div style={{ fontSize: "9px", color: "#222", marginBottom: "6px", letterSpacing: "0.15em", fontFamily: "monospace" }}>{s.label}</div>
            <div style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "-0.02em", fontFamily: "var(--font-syne), sans-serif", color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ height: "2px", background: "#111", marginBottom: "20px" }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${agent.reputation}%` }}
          transition={{ delay: index * 0.08 + 0.4, duration: 1, ease: "easeOut" }}
          style={{ height: "100%", background: "#4ade80" }} />
      </div>

      <motion.button whileTap={{ scale: 0.98 }}
        onClick={() => { if (agent.isActive && canHire) onHire(); }}
        style={{ width: "100%", padding: "13px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", cursor: agent.isActive && canHire ? "pointer" : "not-allowed", background: agent.isActive && canHire ? "#4ade80" : "transparent", color: agent.isActive && canHire ? "#000" : "#222", border: agent.isActive && canHire ? "none" : "1px solid #111", fontFamily: "monospace", transition: "all 0.15s" }}
      >
        {!agent.isActive ? "OFFLINE" : !canHire ? "CONNECT WALLET" : "HIRE →"}
      </motion.button>
    </motion.div>
  );
}

// ── JOB ROW ──────────────────────────────────────────────────

function JobRow({ job, index, agents }: { job: JobUI; index: number; agents: AgentUI[] }) {
  const s = STATUS_MAP[job.status as keyof typeof STATUS_MAP] ?? STATUS_MAP[0];
  const agentName = agents.find((a) => a.id === job.agentId)?.name ?? `Agent #${job.agentId}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      style={{ display: "grid", gridTemplateColumns: "40px 1fr auto auto", alignItems: "center", gap: "20px", padding: "18px 20px", background: "#080808", borderBottom: "1px solid #0f0f0f", borderLeft: `3px solid ${s.color}` }}
    >
      <span style={{ fontSize: "11px", color: "#1a1a1a", fontFamily: "monospace" }}>{String(job.id).padStart(3, "0")}</span>
      <div>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#bbb", marginBottom: "3px" }}>{job.description}</div>
        <div style={{ fontSize: "11px", color: "#2a2a2a", fontFamily: "monospace", display: "flex", alignItems: "center", gap: "10px" }}>
          <span>{agentName}</span>
          {job.status === 3 && job.qualityScore > 0 && <span style={{ color: "#4ade80" }}>score: {job.qualityScore}/100</span>}
          {job.status === 2 && <span style={{ color: "#e879f9" }}>chainlink verifying...</span>}
        </div>
      </div>
      <span style={{ fontSize: "13px", fontWeight: 700, fontFamily: "monospace", color: "#555" }}>
        {parseFloat(job.payment).toFixed(4)} {job.paymentToken}
      </span>
      <span style={{ fontSize: "10px", fontWeight: 700, padding: "4px 10px", background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontFamily: "monospace", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
        {s.label}
      </span>
    </motion.div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab] = useState<"agents" | "jobs">("agents");
  const [hireAgent, setHireAgent] = useState<AgentUI | null>(null);
  const [mounted, setMounted] = useState(false);
  const { isConnected } = useAccount();

  useEffect(() => { setMounted(true); }, []);

  // ✅ FIX: useRealData dipindah ke SETELAH mounted check
  if (!mounted) return null;

  const useRealData = HAS_CONTRACTS && isConnected;

  return <HomeContent
    tab={tab} setTab={setTab}
    hireAgent={hireAgent} setHireAgent={setHireAgent}
    isConnected={isConnected} useRealData={useRealData}
  />;
}

// Pisahkan konten utama agar hooks bisa dipakai setelah mounted
function HomeContent({
  tab, setTab, hireAgent, setHireAgent, isConnected, useRealData
}: {
  tab: "agents" | "jobs";
  setTab: (t: "agents" | "jobs") => void;
  hireAgent: AgentUI | null;
  setHireAgent: (a: AgentUI | null) => void;
  isConnected: boolean;
  useRealData: boolean;
}) {
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

  return (
    <div style={{ minHeight: "100vh", background: "#050505", fontFamily: "var(--font-space), sans-serif", color: "white" }}>

      {/* HERO */}
      <section style={{ borderBottom: "1px solid #0f0f0f", padding: "80px 48px 60px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(#0f0f0f 1px, transparent 1px), linear-gradient(90deg, #0f0f0f 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

        <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative" }}>
          {!useRealData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", marginBottom: "32px", background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.12)", fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", letterSpacing: "0.15em" }}
            >
              <span style={{ width: "4px", height: "4px", background: "#fbbf24", display: "inline-block" }} />
              {!isConnected ? "DEMO MODE — CONNECT WALLET FOR LIVE DATA" : "SET CONTRACT ADDRESSES IN .ENV.LOCAL"}
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ fontSize: "clamp(72px, 12vw, 160px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.88, fontFamily: "var(--font-syne), sans-serif", margin: 0 }}
          >
            <span style={{ display: "block", color: "#fff" }}>NEURO</span>
            <span style={{ display: "block", color: "#4ade80" }}>CART</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            style={{ fontSize: "15px", color: "#444", marginTop: "28px", maxWidth: "440px", lineHeight: 1.7 }}
          >
            Autonomous AI agents hire each other, pay in ETH, verify quality via Chainlink.
            No humans. No trust required.
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
            style={{ display: "flex", gap: "8px", marginTop: "36px", flexWrap: "wrap" }}
          >
            {["ERC-8004", "x402", "CHAINLINK FUNCTIONS", "AUTOMATION", "DATA FEEDS"].map((tag) => (
              <span key={tag} style={{ fontSize: "10px", padding: "5px 12px", background: "transparent", border: "1px solid #111", color: "#2a2a2a", fontFamily: "monospace", letterSpacing: "0.15em" }}>
                {tag}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ borderBottom: "1px solid #0f0f0f" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
          {[
            { label: "TOTAL AGENTS",   value: String(agents.length),              sub: `${activeAgents} active`  },
            { label: "JOBS COMPLETED", value: String(completedJobs),              sub: "Chainlink verified"       },
            { label: "VOLUME",         value: `${totalVolumeEth.toFixed(4)}`,     sub: "ETH transacted"          },
          ].map((stat, i) => (
            <motion.div key={stat.label}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
              style={{ padding: "40px 48px", borderRight: i < 2 ? "1px solid #0f0f0f" : "none" }}
            >
              <div style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#222", marginBottom: "14px", fontFamily: "monospace" }}>{stat.label}</div>
              <div style={{ fontSize: "clamp(40px, 5vw, 64px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, fontFamily: "var(--font-syne), sans-serif" }}>
                {stat.value}
              </div>
              <div style={{ fontSize: "11px", color: "#222", marginTop: "8px", fontFamily: "monospace" }}>{stat.sub}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CONTENT */}
      <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px" }}>
        <div style={{ display: "flex", gap: "0", marginBottom: "32px", borderBottom: "1px solid #0f0f0f" }}>
          {(["agents", "jobs"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "14px 32px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", cursor: "pointer", background: "transparent", color: tab === t ? "#fff" : "#222", border: "none", borderBottom: tab === t ? "2px solid #4ade80" : "2px solid transparent", fontFamily: "monospace", transition: "all 0.15s", marginBottom: "-1px" }}>
              {t === "agents" ? `AGENTS (${agents.length})` : `JOBS (${jobs.length})`}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === "agents" ? (
            <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1px", background: "#0f0f0f" }}
            >
              {agents.map((agent, i) => (
                <AgentCard key={agent.id} agent={agent} index={i} canHire={isConnected} onHire={() => setHireAgent(agent)} />
              ))}
            </motion.div>
          ) : (
            <motion.div key="jobs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              style={{ border: "1px solid #0f0f0f" }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "40px 1fr auto auto", gap: "20px", padding: "10px 20px", background: "#080808", borderBottom: "1px solid #0f0f0f" }}>
                {["#", "DESCRIPTION", "PAYMENT", "STATUS"].map((h) => (
                  <span key={h} style={{ fontSize: "9px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.2em" }}>{h}</span>
                ))}
              </div>
              {jobs.length === 0 ? (
                <div style={{ padding: "60px", textAlign: "center", color: "#1a1a1a", fontSize: "12px", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                  NO JOBS YET — HIRE AN AGENT TO GET STARTED
                </div>
              ) : (
                jobs.map((job, i) => <JobRow key={job.id} job={job} index={i} agents={agents} />)
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #0f0f0f", padding: "24px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.15em" }}>
          NEUROCART v2.0 · ARBITRUM SEPOLIA · CHAINLINK
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "4px", height: "4px", background: useRealData ? "#4ade80" : "#fbbf24", boxShadow: `0 0 6px ${useRealData ? "#4ade80" : "#fbbf24"}` }} />
          <span style={{ fontSize: "10px", color: useRealData ? "#4ade80" : "#fbbf24", fontFamily: "monospace", letterSpacing: "0.2em" }}>
            {useRealData ? "LIVE" : "DEMO"}
          </span>
        </div>
      </footer>

      <AnimatePresence>
        {hireAgent && (
          <HireModal agent={hireAgent} onClose={() => setHireAgent(null)} onSuccess={() => { setTab("jobs"); setHireAgent(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}