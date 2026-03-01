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

// ============================================================
// TYPES
// ============================================================

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
  id: number;
  description: string;
  payment: string;
  paymentToken: "ETH" | "USDC";
  status: number;
  agentId: number;
  qualityScore: number;
};

// ============================================================
// CONSTANTS
// ============================================================

// JobStatus: CREATED=0 ACCEPTED=1 VERIFYING=2 COMPLETED=3 CANCELLED=4
const STATUS_MAP = {
  0: { label: "Created",   color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.25)"  },
  1: { label: "Accepted",  color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
  2: { label: "Verifying", color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.25)" },
  3: { label: "Completed", color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)"  },
  4: { label: "Cancelled", color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
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

// ============================================================
// HIRE MODAL
// ============================================================

type HireModalProps = { agent: AgentUI; onClose: () => void; onSuccess: () => void };

function HireModal({ agent, onClose, onSuccess }: HireModalProps) {
  const [description, setDescription] = useState("");
  const [jobType, setJobType] = useState(agent.skills[0] ?? "general");

  const { data: requiredEthRaw } = useReadContract({
    address: REGISTRY_ADDRESS as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getRequiredETH",
    args: [BigInt(agent.id)],
    query: { enabled: !!REGISTRY_ADDRESS },
  });
  const requiredEth = requiredEthRaw as bigint | undefined;

  const { writeContract, isPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) { onSuccess(); onClose(); }
  }, [isSuccess, onSuccess, onClose]);

  const handleHire = () => {
    if (!ESCROW_ADDRESS || !description.trim()) return;
    writeContract({
      address: ESCROW_ADDRESS as `0x${string}`,
      abi: JOB_ESCROW_ABI,
      functionName: "createJob",
      args: [BigInt(agent.id), BigInt(86400), description.trim(), jobType],
      value: requiredEth ?? BigInt(0),
    });
  };

  const ethDisplay = requiredEth !== undefined
    ? `${parseFloat(formatEther(requiredEth)).toFixed(5)} ETH`
    : "...";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          background: "#0d0d0d", borderRadius: "20px",
          border: "1px solid rgba(255,255,255,0.08)",
          padding: "32px", maxWidth: "480px", width: "100%",
          boxShadow: "0 40px 100px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h2 style={{
              fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em", margin: 0,
              fontFamily: "var(--font-syne), sans-serif",
            }}>
              Hire {agent.name}
            </h2>
            <p style={{ fontSize: "12px", color: "#555", marginTop: "6px" }}>
              {agent.priceDisplay} · {agent.skills.join(", ")}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "8px", color: "#555", cursor: "pointer",
            fontSize: "18px", width: "32px", height: "32px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Description */}
        <label style={{ fontSize: "11px", color: "#555", fontWeight: 600, letterSpacing: "0.1em", display: "block", marginBottom: "8px" }}>
          JOB DESCRIPTION
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Deskripsikan task yang ingin dikerjakan agent..."
          rows={4}
          style={{
            width: "100%", padding: "12px 16px", borderRadius: "10px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "white", fontSize: "14px", resize: "vertical",
            fontFamily: "var(--font-space), sans-serif", boxSizing: "border-box",
            outline: "none", marginBottom: "16px",
          }}
        />

        {/* Job type */}
        <label style={{ fontSize: "11px", color: "#555", fontWeight: 600, letterSpacing: "0.1em", display: "block", marginBottom: "8px" }}>
          JOB TYPE
        </label>
        <select
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
          style={{
            width: "100%", padding: "10px 16px", borderRadius: "10px", marginBottom: "20px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "white", fontSize: "14px",
            fontFamily: "var(--font-space), sans-serif", boxSizing: "border-box",
          }}
        >
          {agent.skills.map((s) => (
            <option key={s} value={s} style={{ background: "#111" }}>{s}</option>
          ))}
        </select>

        {/* Payment */}
        <div style={{
          padding: "12px 16px", borderRadius: "10px", marginBottom: "24px",
          background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.12)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: "11px", color: "#555", fontWeight: 600, letterSpacing: "0.08em" }}>
              PAYMENT · Chainlink ETH/USD
            </div>
            <div style={{ fontSize: "11px", color: "#444", marginTop: "3px" }}>
              {agent.priceDisplay} auto-converted
            </div>
          </div>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "#34d399", fontFamily: "monospace" }}>
            {ethDisplay}
          </span>
        </div>

        {isSuccess && (
          <div style={{
            padding: "10px 16px", borderRadius: "10px", marginBottom: "16px",
            background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)",
            fontSize: "13px", color: "#34d399",
          }}>
            ✅ Job dibuat! Agent akan memproses dan Chainlink akan verifikasi kualitas.
          </div>
        )}

        <motion.button
          whileHover={{ scale: isPending || isConfirming ? 1 : 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleHire}
          disabled={isPending || isConfirming || !description.trim() || !ESCROW_ADDRESS}
          style={{
            width: "100%", padding: "14px", borderRadius: "12px",
            fontSize: "14px", fontWeight: 600, cursor: "pointer",
            background: isPending || isConfirming
              ? "rgba(52,211,153,0.25)"
              : "linear-gradient(135deg, #34d399, #059669)",
            color: "#000", border: "none",
            fontFamily: "var(--font-space), sans-serif",
            opacity: !description.trim() || !ESCROW_ADDRESS ? 0.5 : 1,
            transition: "all 0.2s",
          }}
        >
          {isPending ? "Confirm in wallet..." : isConfirming ? "Confirming on-chain..." : `Create Job · ${ethDisplay}`}
        </motion.button>

        {!ESCROW_ADDRESS && (
          <p style={{ fontSize: "11px", color: "#f87171", textAlign: "center", marginTop: "12px" }}>
            Set NEXT_PUBLIC_ESCROW_ADDRESS in frontend/.env.local after deployment
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// AGENT CARD
// ============================================================

type AgentCardProps = { agent: AgentUI; index: number; onHire: () => void; canHire: boolean };

function AgentCard({ agent, index, onHire, canHire }: AgentCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        padding: "24px", borderRadius: "18px",
        background: hovered ? "rgba(52,211,153,0.04)" : "rgba(255,255,255,0.02)",
        border: hovered ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(255,255,255,0.06)",
        transition: "all 0.25s ease", backdropFilter: "blur(8px)",
      }}
    >
      {/* Status + ID */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: agent.isActive ? "#34d399" : "#333",
            boxShadow: agent.isActive ? "0 0 8px #34d399" : "none",
          }} />
          <span style={{
            fontSize: "10px", letterSpacing: "0.15em",
            color: agent.isActive ? "#34d399" : "#444", fontWeight: 600,
          }}>
            {agent.isActive ? "ACTIVE" : "OFFLINE"}
          </span>
        </div>
        <span style={{ fontSize: "11px", color: "#333", fontFamily: "monospace" }}>ID #{agent.id}</span>
      </div>

      {/* Name + owner */}
      <h3 style={{
        fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "4px",
        fontFamily: "var(--font-syne), 'Syne', sans-serif",
      }}>
        {agent.name}
      </h3>
      <p style={{ fontSize: "11px", color: "#383838", fontFamily: "monospace", marginBottom: "16px" }}>
        {agent.owner}
      </p>

      {/* Skills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "20px" }}>
        {agent.skills.map((skill) => (
          <span key={skill} style={{
            fontSize: "11px", padding: "4px 12px", borderRadius: "100px",
            background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.15)",
            color: "#34d399", fontWeight: 500,
          }}>
            {skill}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "16px" }}>
        {([
          { label: "Price", value: agent.priceDisplay, color: "#34d399" },
          { label: "Rep",   value: `${agent.reputation}/100`, color: "#fbbf24" },
          { label: "Jobs",  value: String(agent.totalJobs), color: "white" },
        ] as const).map((s) => (
          <div key={s.label} style={{
            padding: "10px 12px", borderRadius: "10px",
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ fontSize: "10px", color: "#444", marginBottom: "4px", letterSpacing: "0.08em" }}>
              {s.label.toUpperCase()}
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Reputation bar */}
      <div style={{ height: "3px", borderRadius: "100px", background: "rgba(255,255,255,0.04)", overflow: "hidden", marginBottom: "16px" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${agent.reputation}%` }}
          transition={{ delay: index * 0.07 + 0.4, duration: 0.9, ease: "easeOut" }}
          style={{ height: "100%", background: "linear-gradient(90deg, #34d399, #059669)", borderRadius: "100px" }}
        />
      </div>

      {/* Hire button */}
      <motion.button
        whileHover={{ scale: agent.isActive ? 1.02 : 1 }}
        whileTap={{ scale: agent.isActive ? 0.98 : 1 }}
        onClick={() => { if (agent.isActive) onHire(); }}
        style={{
          width: "100%", padding: "10px 16px", borderRadius: "10px",
          fontSize: "13px", fontWeight: 600,
          cursor: agent.isActive ? "pointer" : "not-allowed",
          background: agent.isActive
            ? "linear-gradient(135deg, rgba(52,211,153,0.12), rgba(5,150,105,0.08))"
            : "rgba(255,255,255,0.02)",
          border: `1px solid ${agent.isActive ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.05)"}`,
          color: agent.isActive ? "#34d399" : "#333",
          fontFamily: "var(--font-space), sans-serif",
          opacity: !canHire && agent.isActive ? 0.6 : 1,
          transition: "all 0.2s",
        }}
      >
        {!agent.isActive ? "Offline" : !canHire ? "Connect wallet to hire" : "Hire Agent →"}
      </motion.button>
    </motion.div>
  );
}

// ============================================================
// JOB ROW
// ============================================================

type JobRowProps = { job: JobUI; index: number; agents: AgentUI[] };

function JobRow({ job, index, agents }: JobRowProps) {
  const s = STATUS_MAP[job.status as keyof typeof STATUS_MAP] ?? STATUS_MAP[0];
  const agentName = agents.find((a) => a.id === job.agentId)?.name ?? `Agent #${job.agentId}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", borderRadius: "14px",
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <span style={{ fontSize: "11px", color: "#333", fontFamily: "monospace", minWidth: "28px" }}>
          #{job.id}
        </span>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 500 }}>{job.description}</div>
          <div style={{ fontSize: "11px", color: "#444", marginTop: "2px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>{agentName}</span>
            {job.status === 3 && job.qualityScore > 0 && (
              <span style={{
                fontSize: "10px", padding: "2px 8px", borderRadius: "100px",
                background: "rgba(52,211,153,0.1)", color: "#34d399",
                border: "1px solid rgba(52,211,153,0.2)",
              }}>
                Score: {job.qualityScore}/100
              </span>
            )}
            {job.status === 2 && (
              <span style={{ fontSize: "10px", color: "#a78bfa" }}>Chainlink verifying...</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <span style={{ fontSize: "14px", fontWeight: 600, fontFamily: "monospace" }}>
          {parseFloat(job.payment).toFixed(4)} {job.paymentToken}
        </span>
        <span style={{
          fontSize: "11px", fontWeight: 500, padding: "4px 12px", borderRadius: "100px",
          background: s.bg, border: `1px solid ${s.border}`, color: s.color, whiteSpace: "nowrap",
        }}>
          {s.label}{job.status === 2 ? " ⚡" : ""}
        </span>
      </div>
    </motion.div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function Home() {
  const [tab, setTab] = useState<"agents" | "jobs">("agents");
  const [hireAgent, setHireAgent] = useState<AgentUI | null>(null);
  const [mounted, setMounted] = useState(false);
  const { isConnected } = useAccount();

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const useRealData = HAS_CONTRACTS && isConnected;

  // ── Read counts ──────────────────────────────────────────────
  const { data: agentCountRaw } = useReadContract({
    address: REGISTRY_ADDRESS as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
    functionName: "agentCount",
    query: { enabled: useRealData },
  });
  const agentCount = agentCountRaw ? Number(agentCountRaw) : 0;

  const { data: jobCountRaw } = useReadContract({
    address: ESCROW_ADDRESS as `0x${string}`,
    abi: JOB_ESCROW_ABI,
    functionName: "jobCount",
    query: { enabled: useRealData },
  });
  const jobCount = jobCountRaw ? Number(jobCountRaw) : 0;

  // ── Batch read: agents() + getAgentSkills() interleaved ──────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentBatchContracts = useMemo((): any[] => {
    if (!useRealData || agentCount === 0) return [];
    const calls = [];
    for (let i = 0; i < Math.min(agentCount, 20); i++) {
      calls.push({ address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI, functionName: "agents",        args: [BigInt(i)] });
      calls.push({ address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI, functionName: "getAgentSkills", args: [BigInt(i)] });
    }
    return calls;
  }, [useRealData, agentCount]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agentBatchData } = useReadContracts({ contracts: agentBatchContracts as any, query: { enabled: agentBatchContracts.length > 0 } });

  // ── Batch read: jobs() ───────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobBatchContracts = useMemo((): any[] => {
    if (!useRealData || jobCount === 0) return [];
    return Array.from({ length: Math.min(jobCount, 20) }, (_, i) => ({
      address: ESCROW_ADDRESS as `0x${string}`, abi: JOB_ESCROW_ABI, functionName: "jobs", args: [BigInt(i)],
    }));
  }, [useRealData, jobCount]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: jobBatchData } = useReadContracts({ contracts: jobBatchContracts as any, query: { enabled: jobBatchContracts.length > 0 } });

  // ── Process agent data ───────────────────────────────────────
  const agents: AgentUI[] = useMemo(() => {
    if (!useRealData || !agentBatchData || agentBatchData.length === 0) return MOCK_AGENTS;
    const result: AgentUI[] = [];
    for (let i = 0; i < Math.min(agentCount, 20); i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agentRaw = agentBatchData[i * 2]?.result as any;
      const skillsRaw = agentBatchData[i * 2 + 1]?.result as string[] | undefined;
      if (!agentRaw) continue;
      const repScore = agentRaw.totalFeedback > 0n
        ? Number(agentRaw.reputationTotal) / Number(agentRaw.totalFeedback)
        : 0;
      result.push({
        id: i,
        name: agentRaw.name,
        skills: skillsRaw ?? [],
        priceDisplay: `$${(Number(agentRaw.priceUSDCents) / 100).toFixed(2)}`,
        reputation: Math.round(repScore),
        totalJobs: Number(agentRaw.totalJobs),
        isActive: agentRaw.isActive,
        owner: `${(agentRaw.owner as string).slice(0, 6)}...${(agentRaw.owner as string).slice(-4)}`,
      });
    }
    return result.length > 0 ? result : MOCK_AGENTS;
  }, [useRealData, agentBatchData, agentCount]);

  // ── Process job data ─────────────────────────────────────────
  const jobs: JobUI[] = useMemo(() => {
    if (!useRealData || !jobBatchData || jobBatchData.length === 0) return MOCK_JOBS;
    const result: JobUI[] = [];
    for (let i = 0; i < Math.min(jobCount, 20); i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jobRaw = jobBatchData[i]?.result as any;
      if (!jobRaw) continue;
      result.push({
        id: i,
        description: jobRaw.description,
        payment: formatEther(jobRaw.payment as bigint),
        paymentToken: jobRaw.paymentToken === 0 ? "ETH" : "USDC",
        status: jobRaw.status,
        agentId: Number(jobRaw.registryAgentId),
        qualityScore: jobRaw.qualityScore,
      });
    }
    return result.length > 0 ? result : MOCK_JOBS;
  }, [useRealData, jobBatchData, jobCount]);

  // ── Stats ────────────────────────────────────────────────────
  const completedJobs  = jobs.filter((j) => j.status === 3).length;
  const activeAgents   = agents.filter((a) => a.isActive).length;
  const totalVolumeEth = jobs.reduce((acc, j) => j.paymentToken === "ETH" ? acc + parseFloat(j.payment) : acc, 0);

  return (
    <div style={{
      minHeight: "100vh", background: "#070707",
      fontFamily: "var(--font-space), 'Space Grotesk', sans-serif",
      color: "white", position: "relative", overflow: "hidden",
    }}>
      {/* Background */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 80% 50% at 10% 10%, rgba(52,211,153,0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 90% 80%, rgba(96,165,250,0.05) 0%, transparent 60%)",
      }} />
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.03,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1100px", margin: "0 auto", padding: "40px 32px" }}>

        {/* Demo mode banner */}
        {!useRealData && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            style={{
              padding: "10px 20px", borderRadius: "10px", marginBottom: "24px",
              background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.15)",
              fontSize: "12px", color: "#fbbf24",
              display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            <span>⚡</span>
            <span>
              {!isConnected
                ? "Connect your wallet to see live blockchain data — showing demo mode"
                : "Set NEXT_PUBLIC_REGISTRY_ADDRESS in frontend/.env.local after deployment"}
            </span>
          </motion.div>
        )}

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <div style={{
              width: "7px", height: "7px", borderRadius: "50%",
              background: useRealData ? "#34d399" : "#fbbf24",
              boxShadow: `0 0 10px ${useRealData ? "#34d399" : "#fbbf24"}`,
            }} />
            <span style={{
              fontSize: "11px", letterSpacing: "0.15em",
              color: useRealData ? "#34d399" : "#fbbf24", fontWeight: 500,
            }}>
              {useRealData ? "ARBITRUM SEPOLIA · LIVE DATA" : "DEMO MODE"}
            </span>
          </div>
          <h1 style={{
            fontSize: "42px", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1,
            fontFamily: "var(--font-syne), 'Syne', sans-serif",
          }}>
            Neuro<span style={{ color: "#34d399" }}>Cart</span>
          </h1>
          <p style={{ marginTop: "8px", fontSize: "13px", color: "#555" }}>
            Autonomous AI economy · ERC-8004 · x402 · Chainlink Functions + Automation
          </p>
        </motion.div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "40px" }}>
          {[
            { label: "Total Agents",   value: String(agents.length),                sub: `${activeAgents} active`   },
            { label: "Jobs Completed", value: String(completedJobs),                sub: "Chainlink verified"        },
            { label: "Volume",         value: `${totalVolumeEth.toFixed(4)} ETH`,   sub: "Total transacted"         },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              style={{
                padding: "24px 28px", borderRadius: "16px",
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div style={{ fontSize: "11px", letterSpacing: "0.12em", color: "#555", marginBottom: "10px", fontWeight: 500 }}>
                {stat.label.toUpperCase()}
              </div>
              <div style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-0.03em", fontFamily: "var(--font-syne), sans-serif" }}>
                {stat.value}
              </div>
              <div style={{ fontSize: "12px", color: "#444", marginTop: "6px" }}>{stat.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{
          display: "inline-flex", gap: "4px", padding: "4px",
          background: "rgba(255,255,255,0.03)", borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.06)", marginBottom: "24px",
        }}>
          {(["agents", "jobs"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 24px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s", textTransform: "capitalize",
              background: tab === t ? "rgba(52,211,153,0.1)" : "transparent",
              color: tab === t ? "#34d399" : "#555",
              border: tab === t ? "1px solid rgba(52,211,153,0.2)" : "1px solid transparent",
              fontFamily: "var(--font-space), sans-serif",
            }}>
              {t === "agents" ? `Agents (${agents.length})` : `Jobs (${jobs.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {tab === "agents" ? (
            <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}
            >
              {agents.map((agent, i) => (
                <AgentCard
                  key={agent.id} agent={agent} index={i} canHire={isConnected}
                  onHire={() => setHireAgent(agent)}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div key="jobs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {jobs.length === 0 ? (
                <div style={{
                  padding: "48px", textAlign: "center", color: "#444",
                  border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "16px", fontSize: "14px",
                }}>
                  No jobs yet. Hire an agent to get started.
                </div>
              ) : (
                jobs.map((job, i) => (
                  <JobRow key={job.id} job={job} index={i} agents={agents} />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div style={{
          marginTop: "64px", paddingTop: "24px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {["ERC-8004", "x402", "Chainlink Functions", "Automation", "Data Feeds"].map((tag) => (
              <span key={tag} style={{
                fontSize: "11px", padding: "3px 10px", borderRadius: "100px",
                background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.12)",
                color: "#34d399",
              }}>
                {tag}
              </span>
            ))}
          </div>
          <span style={{ fontSize: "11px", color: "#2a2a2a", fontFamily: "monospace" }}>
            NeuroCart v2.0 · Arbitrum Sepolia
          </span>
        </div>

      </div>

      {/* Hire Modal */}
      <AnimatePresence>
        {hireAgent && (
          <HireModal
            agent={hireAgent}
            onClose={() => setHireAgent(null)}
            onSuccess={() => { setTab("jobs"); setHireAgent(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
