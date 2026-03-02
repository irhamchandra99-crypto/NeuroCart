"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import {
  ESCROW_ADDRESS,
  REGISTRY_ADDRESS,
  HAS_CONTRACTS,
  JOB_ESCROW_ABI,
  AGENT_REGISTRY_ABI,
} from "@/lib/contracts";

type JobUI = {
  id: number;
  description: string;
  jobType: string;
  payment: string;
  paymentToken: "ETH" | "USDC";
  status: number;
  agentId: number;
  agentName: string;
  client: string;
  provider: string;
  qualityScore: number;
  createdAt: number;
  deadline: number;
};

const STATUS_MAP = {
  0: { label: "CREATED",   color: "#60a5fa", bg: "rgba(96,165,250,0.06)",  border: "rgba(96,165,250,0.15)"  },
  1: { label: "ACCEPTED",  color: "#fbbf24", bg: "rgba(251,191,36,0.06)",  border: "rgba(251,191,36,0.15)"  },
  2: { label: "VERIFYING", color: "#e879f9", bg: "rgba(232,121,249,0.06)", border: "rgba(232,121,249,0.15)" },
  3: { label: "COMPLETED", color: "#4ade80", bg: "rgba(74,222,128,0.06)",  border: "rgba(74,222,128,0.15)"  },
  4: { label: "CANCELLED", color: "#f87171", bg: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.15)" },
} as const;

const MOCK_JOBS: JobUI[] = [
  { id: 0, description: "Ringkas artikel berita 3000 kata tentang AI", jobType: "summarization", payment: "0.0007", paymentToken: "ETH", status: 3, agentId: 0, agentName: "SummarizerBot",  client: "0xf39F...2266", provider: "0x7099...7222", qualityScore: 92, createdAt: Date.now() - 7200000,  deadline: Date.now() + 79200000 },
  { id: 1, description: "Terjemahkan dokumen kontrak EN ke ID",         jobType: "translation",   payment: "0.0005", paymentToken: "ETH", status: 2, agentId: 1, agentName: "TranslatorAI",   client: "0x3C44...93BC", provider: "0x7099...7222", qualityScore: 0,  createdAt: Date.now() - 3600000,  deadline: Date.now() + 82800000 },
  { id: 2, description: "OCR scan 10 receipt dari gambar",              jobType: "ocr",           payment: "0.0010", paymentToken: "ETH", status: 1, agentId: 2, agentName: "VisionBot",      client: "0x9065...1638", provider: "0x3C44...93BC", qualityScore: 0,  createdAt: Date.now() - 1800000,  deadline: Date.now() + 84600000 },
  { id: 3, description: "Transkripsi audio podcast 5 menit",            jobType: "transcription", payment: "0.0003", paymentToken: "ETH", status: 0, agentId: 3, agentName: "TranscriberBot", client: "0xf39F...2266", provider: "0x9065...1638", qualityScore: 0,  createdAt: Date.now() - 600000,   deadline: Date.now() + 85800000 },
  { id: 4, description: "Ringkas laporan keuangan Q3 2025",             jobType: "summarization", payment: "0.0007", paymentToken: "ETH", status: 4, agentId: 0, agentName: "SummarizerBot",  client: "0x7099...7222", provider: "0x3C44...93BC", qualityScore: 61, createdAt: Date.now() - 14400000, deadline: Date.now() - 7200000  },
];

// ── JOB DETAIL MODAL ─────────────────────────────────────────

function JobDetailModal({ job, onClose }: { job: JobUI; onClose: () => void }) {
  const s = STATUS_MAP[job.status as keyof typeof STATUS_MAP] ?? STATUS_MAP[0];
  const isExpired = job.deadline < Date.now() && job.status < 2;
  const deadlineDate = new Date(job.deadline).toLocaleString("id-ID");
  const createdDate = new Date(job.createdAt).toLocaleString("id-ID");

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderTop: `3px solid ${s.color}`, padding: "40px", maxWidth: "560px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
          <div>
            <p style={{ fontSize: "10px", color: "#222", fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "8px" }}>JOB #{String(job.id).padStart(3, "0")}</p>
            <h2 style={{ fontSize: "24px", fontWeight: 900, letterSpacing: "-0.02em", margin: 0, fontFamily: "var(--font-syne), sans-serif", lineHeight: 1.2, maxWidth: "380px" }}>
              {job.description}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #1a1a1a", color: "#444", cursor: "pointer", fontSize: "18px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
        </div>

        {/* Status + type */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, padding: "5px 12px", background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontFamily: "monospace", letterSpacing: "0.1em" }}>
            {s.label}
          </span>
          <span style={{ fontSize: "10px", padding: "5px 12px", background: "transparent", border: "1px solid #111", color: "#333", fontFamily: "monospace", letterSpacing: "0.1em" }}>
            {job.jobType.toUpperCase()}
          </span>
          {job.paymentToken === "USDC" && (
            <span style={{ fontSize: "10px", padding: "5px 12px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)", color: "#60a5fa", fontFamily: "monospace" }}>
              x402 USDC
            </span>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "#111", marginBottom: "20px" }}>
          {[
            { label: "PAYMENT", value: `${parseFloat(job.payment).toFixed(4)} ${job.paymentToken}`, color: "#4ade80" },
            { label: "AGENT",   value: job.agentName, color: "#ddd" },
            { label: "QUALITY", value: job.qualityScore > 0 ? `${job.qualityScore}/100` : "PENDING", color: job.qualityScore >= 80 ? "#4ade80" : job.qualityScore > 0 ? "#f87171" : "#333" },
          ].map((s) => (
            <div key={s.label} style={{ padding: "14px", background: "#080808" }}>
              <div style={{ fontSize: "9px", color: "#1a1a1a", marginBottom: "6px", letterSpacing: "0.15em", fontFamily: "monospace" }}>{s.label}</div>
              <div style={{ fontSize: "14px", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", color: s.color, wordBreak: "break-word" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Quality score bar (if completed) */}
        {job.qualityScore > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "9px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.15em" }}>CHAINLINK QUALITY SCORE</span>
              <span style={{ fontSize: "9px", color: job.qualityScore >= 80 ? "#4ade80" : "#f87171", fontFamily: "monospace" }}>
                {job.qualityScore >= 80 ? "PASS ≥ 80" : "FAIL < 80"}
              </span>
            </div>
            <div style={{ height: "3px", background: "#111" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${job.qualityScore}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{ height: "100%", background: job.qualityScore >= 80 ? "#4ade80" : "#f87171" }}
              />
            </div>
          </div>
        )}

        {/* Verifying indicator */}
        {job.status === 2 && (
          <div style={{ padding: "12px 16px", marginBottom: "20px", background: "rgba(232,121,249,0.04)", border: "1px solid rgba(232,121,249,0.12)", display: "flex", alignItems: "center", gap: "10px" }}>
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ width: "6px", height: "6px", background: "#e879f9" }}
            />
            <span style={{ fontSize: "11px", color: "#e879f9", fontFamily: "monospace" }}>
              Chainlink DON sedang memverifikasi kualitas output...
            </span>
          </div>
        )}

        {/* Addresses */}
        <div style={{ padding: "16px", background: "#111", borderLeft: "3px solid #1a1a1a", marginBottom: "20px" }}>
          {[
            { label: "CLIENT", value: job.client },
            { label: "PROVIDER", value: job.provider },
          ].map((a) => (
            <div key={a.label} style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "9px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "3px" }}>{a.label}</div>
              <div style={{ fontSize: "12px", color: "#444", fontFamily: "monospace" }}>{a.value}</div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "#111" }}>
          {[
            { label: "CREATED", value: createdDate },
            { label: "DEADLINE", value: deadlineDate, warn: isExpired },
          ].map((t) => (
            <div key={t.label} style={{ padding: "12px 14px", background: "#080808" }}>
              <div style={{ fontSize: "9px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "4px" }}>{t.label}</div>
              <div style={{ fontSize: "11px", color: t.warn ? "#f87171" : "#333", fontFamily: "monospace" }}>{t.value}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── JOB ROW ──────────────────────────────────────────────────

function JobRow({ job, index, onClick }: { job: JobUI; index: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const s = STATUS_MAP[job.status as keyof typeof STATUS_MAP] ?? STATUS_MAP[0];
  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    return `${m}m ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)}
      onClick={onClick}
      style={{ display: "grid", gridTemplateColumns: "48px 1fr 140px 100px 100px", alignItems: "center", gap: "16px", padding: "16px 20px", background: hovered ? "#0a0a0a" : "#080808", borderBottom: "1px solid #0d0d0d", borderLeft: `3px solid ${hovered ? s.color : "transparent"}`, cursor: "pointer", transition: "all 0.15s" }}
    >
      {/* ID */}
      <span style={{ fontSize: "11px", color: "#1a1a1a", fontFamily: "monospace" }}>
        {String(job.id).padStart(3, "0")}
      </span>

      {/* Description */}
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: hovered ? "#fff" : "#aaa", marginBottom: "3px", transition: "color 0.15s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "360px" }}>
          {job.description}
        </div>
        <div style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", display: "flex", gap: "10px" }}>
          <span>{job.agentName}</span>
          <span>·</span>
          <span>{job.jobType}</span>
          {job.status === 3 && job.qualityScore > 0 && (
            <>
              <span>·</span>
              <span style={{ color: job.qualityScore >= 80 ? "#4ade80" : "#f87171" }}>score: {job.qualityScore}/100</span>
            </>
          )}
          {job.status === 2 && (
            <>
              <span>·</span>
              <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ color: "#e879f9" }}>
                chainlink verifying...
              </motion.span>
            </>
          )}
        </div>
      </div>

      {/* Payment */}
      <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "monospace", color: "#444", textAlign: "right" }}>
        {parseFloat(job.payment).toFixed(4)} {job.paymentToken}
      </span>

      {/* Time */}
      <span style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", textAlign: "right" }}>
        {timeAgo(job.createdAt)}
      </span>

      {/* Status */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, padding: "4px 10px", background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontFamily: "monospace", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
          {s.label}
        </span>
      </div>
    </motion.div>
  );
}

// ── FILTER BAR ───────────────────────────────────────────────

type FilterState = { status: number | "all"; token: "all" | "ETH" | "USDC" };

function FilterBar({ filters, setFilters, counts }: {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  counts: Record<string, number>;
}) {
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "0", flexWrap: "wrap", alignItems: "center", padding: "12px 20px", background: "#080808", borderBottom: "1px solid #0d0d0d" }}>
      <button onClick={() => setFilters({ ...filters, status: "all" })}
        style={{ padding: "5px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer", background: filters.status === "all" ? "#4ade80" : "transparent", color: filters.status === "all" ? "#000" : "#222", border: `1px solid ${filters.status === "all" ? "#4ade80" : "#111"}`, fontFamily: "monospace", transition: "all 0.15s" }}
      >
        ALL {counts.all ? `(${counts.all})` : ""}
      </button>
      {Object.entries(STATUS_MAP).map(([key, val]) => (
        <button key={key} onClick={() => setFilters({ ...filters, status: Number(key) })}
          style={{ padding: "5px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer", background: filters.status === Number(key) ? val.color : "transparent", color: filters.status === Number(key) ? "#000" : "#222", border: `1px solid ${filters.status === Number(key) ? val.color : "#111"}`, fontFamily: "monospace", transition: "all 0.15s" }}
        >
          {val.label} {counts[key] !== undefined ? `(${counts[key]})` : ""}
        </button>
      ))}
      <div style={{ width: "1px", height: "20px", background: "#111", margin: "0 4px" }} />
      {(["all", "ETH", "USDC"] as const).map((t) => (
        <button key={t} onClick={() => setFilters({ ...filters, token: t })}
          style={{ padding: "5px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer", background: "transparent", color: filters.token === t ? "#fff" : "#1a1a1a", border: "none", borderBottom: `1px solid ${filters.token === t ? "#4ade80" : "transparent"}`, fontFamily: "monospace", transition: "all 0.15s" }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────

export default function JobsPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobUI | null>(null);
  const [filters, setFilters] = useState<FilterState>({ status: "all", token: "all" });
  const { isConnected } = useAccount();

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const useRealData = HAS_CONTRACTS && isConnected;
  return <JobsContent useRealData={useRealData} selectedJob={selectedJob} setSelectedJob={setSelectedJob} filters={filters} setFilters={setFilters} />;
}

function JobsContent({ useRealData, selectedJob, setSelectedJob, filters, setFilters }: {
  useRealData: boolean;
  selectedJob: JobUI | null;
  setSelectedJob: (j: JobUI | null) => void;
  filters: FilterState;
  setFilters: (f: FilterState) => void;
}) {
  const { data: jobCountRaw } = useReadContract({
    address: ESCROW_ADDRESS as `0x${string}`, abi: JOB_ESCROW_ABI,
    functionName: "jobCount", query: { enabled: useRealData },
  });
  const jobCount = jobCountRaw ? Number(jobCountRaw) : 0;

  const { data: agentCountRaw } = useReadContract({
    address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI,
    functionName: "agentCount", query: { enabled: useRealData },
  });
  const agentCount = agentCountRaw ? Number(agentCountRaw) : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobBatchContracts = useMemo((): any[] => {
    if (!useRealData || jobCount === 0) return [];
    return Array.from({ length: Math.min(jobCount, 50) }, (_, i) => ({
      address: ESCROW_ADDRESS as `0x${string}`, abi: JOB_ESCROW_ABI,
      functionName: "jobs", args: [BigInt(i)],
    }));
  }, [useRealData, jobCount]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentNameContracts = useMemo((): any[] => {
    if (!useRealData || agentCount === 0) return [];
    return Array.from({ length: Math.min(agentCount, 50) }, (_, i) => ({
      address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI,
      functionName: "agents", args: [BigInt(i)],
    }));
  }, [useRealData, agentCount]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: jobBatchData } = useReadContracts({ contracts: jobBatchContracts as any, query: { enabled: jobBatchContracts.length > 0 } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agentBatchData } = useReadContracts({ contracts: agentNameContracts as any, query: { enabled: agentNameContracts.length > 0 } });

  const agentNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (!agentBatchData) return map;
    agentBatchData.forEach((r, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = r?.result as any;
      if (raw?.name) map[i] = raw.name;
    });
    return map;
  }, [agentBatchData]);

  const jobs: JobUI[] = useMemo(() => {
    if (!useRealData || !jobBatchData || jobBatchData.length === 0) return MOCK_JOBS;
    const result: JobUI[] = [];
    for (let i = 0; i < Math.min(jobCount, 50); i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = jobBatchData[i]?.result as any;
      if (!raw) continue;
      const agentId = Number(raw.registryAgentId);
      result.push({
        id: i,
        description: raw.jobDescription,
        jobType: raw.jobType,
        payment: formatEther(raw.payment as bigint),
        paymentToken: raw.paymentToken === 0 ? "ETH" : "USDC",
        status: raw.status,
        agentId,
        agentName: agentNameMap[agentId] ?? `Agent #${agentId}`,
        client: `${(raw.clientAgent as string).slice(0, 6)}...${(raw.clientAgent as string).slice(-4)}`,
        provider: `${(raw.providerAgent as string).slice(0, 6)}...${(raw.providerAgent as string).slice(-4)}`,
        qualityScore: raw.qualityScore,
        createdAt: Number(raw.createdAt) * 1000,
        deadline: Number(raw.deadline) * 1000,
      });
    }
    return result.length > 0 ? result : MOCK_JOBS;
  }, [useRealData, jobBatchData, jobCount, agentNameMap]);

  const filteredJobs = useMemo(() => {
    let list = [...jobs].reverse(); // newest first
    if (filters.status !== "all") list = list.filter((j) => j.status === filters.status);
    if (filters.token !== "all") list = list.filter((j) => j.paymentToken === filters.token);
    return list;
  }, [jobs, filters]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobs.length };
    jobs.forEach((j) => { c[j.status] = (c[j.status] ?? 0) + 1; });
    return c;
  }, [jobs]);

  const completedJobs = jobs.filter((j) => j.status === 3).length;
  const verifyingJobs = jobs.filter((j) => j.status === 2).length;
  const totalVolume = jobs.reduce((acc, j) => j.paymentToken === "ETH" ? acc + parseFloat(j.payment) : acc, 0);
  const avgScore = jobs.filter((j) => j.qualityScore > 0).reduce((acc, j, _, arr) => acc + j.qualityScore / arr.length, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "white", fontFamily: "var(--font-space), sans-serif" }}>

      {/* HEADER */}
      <section style={{ borderBottom: "1px solid #0f0f0f", padding: "60px 48px 48px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(#0f0f0f 1px, transparent 1px), linear-gradient(90deg, #0f0f0f 1px, transparent 1px)", backgroundSize: "80px 80px", opacity: 0.4 }} />
        <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p style={{ fontSize: "10px", letterSpacing: "0.25em", color: "#1a1a1a", fontFamily: "monospace", marginBottom: "16px" }}>NEUROCART / JOBS</p>
            <h1 style={{ fontSize: "clamp(48px, 8vw, 96px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.9, fontFamily: "var(--font-syne), sans-serif", margin: "0 0 20px 0" }}>
              <span style={{ display: "block", color: "#fff" }}>JOB</span>
              <span style={{ display: "block", color: "#4ade80" }}>ESCROW</span>
            </h1>
            <p style={{ fontSize: "14px", color: "#333", maxWidth: "440px", lineHeight: 1.7 }}>
              Semua transaksi dikunci di smart contract. Chainlink Functions memverifikasi kualitas sebelum payment direlease.
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ display: "flex", gap: "0", marginTop: "36px", borderTop: "1px solid #0f0f0f", borderBottom: "1px solid #0f0f0f" }}
          >
            {[
              { label: "TOTAL JOBS",   value: String(jobs.length) },
              { label: "COMPLETED",    value: String(completedJobs) },
              { label: "VERIFYING",    value: String(verifyingJobs), highlight: verifyingJobs > 0 },
              { label: "VOLUME (ETH)", value: totalVolume.toFixed(4) },
              { label: "AVG SCORE",    value: avgScore > 0 ? `${Math.round(avgScore)}/100` : "—" },
            ].map((s, i) => (
              <div key={s.label} style={{ padding: "20px 28px", borderRight: "1px solid #0f0f0f" }}>
                <div style={{ fontSize: "9px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "6px" }}>{s.label}</div>
                <div style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.03em", fontFamily: "var(--font-syne), sans-serif", color: s.highlight ? "#e879f9" : "#fff" }}>
                  {s.value}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* JOBS TABLE */}
      <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 48px" }}>
        {!useRealData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", marginBottom: "20px", background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.12)", fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", letterSpacing: "0.15em" }}
          >
            <span style={{ width: "4px", height: "4px", background: "#fbbf24", display: "inline-block" }} />
            DEMO MODE — CONNECT WALLET UNTUK DATA LIVE
          </motion.div>
        )}

        <div style={{ border: "1px solid #0f0f0f" }}>
          <FilterBar filters={filters} setFilters={setFilters} counts={counts} />

          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 140px 100px 100px", gap: "16px", padding: "10px 20px", background: "#060606", borderBottom: "1px solid #0d0d0d" }}>
            {["#", "DESCRIPTION / AGENT", "PAYMENT", "TIME", "STATUS"].map((h) => (
              <span key={h} style={{ fontSize: "9px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.2em" }}>{h}</span>
            ))}
          </div>

          {filteredJobs.length === 0 ? (
            <div style={{ padding: "60px", textAlign: "center", color: "#1a1a1a", fontSize: "12px", fontFamily: "monospace", letterSpacing: "0.1em" }}>
              NO JOBS MATCH YOUR FILTER
            </div>
          ) : (
            filteredJobs.map((job, i) => (
              <JobRow key={job.id} job={job} index={i} onClick={() => setSelectedJob(job)} />
            ))
          )}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: "20px", marginTop: "16px", flexWrap: "wrap" }}>
          {Object.values(STATUS_MAP).map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "8px", height: "8px", background: s.color, opacity: 0.7 }} />
              <span style={{ fontSize: "9px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.1em" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {selectedJob && (
          <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}