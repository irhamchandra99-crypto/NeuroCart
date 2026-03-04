"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import {
  ESCROW_ADDRESS, REGISTRY_ADDRESS, HAS_CONTRACTS,
  JOB_ESCROW_ABI, AGENT_REGISTRY_ABI,
} from "@/lib/contracts";

// ── TOKENS ────────────────────────────────────────────────────
const T = {
  bg:     { page: "#050505", card: "#0e0e0e", elevated: "#141414", input: "#1a1a1a" },
  border: { default: "#1f1f1f", subtle: "#161616", accent: "rgba(74,222,128,0.15)" },
  text:   { primary: "#ffffff", secondary: "#888888", muted: "#6ee7b7", disabled: "#333333", accent: "#4ade80" },
  radius: { card: "14px", badge: "6px", button: "8px", input: "8px", modal: "18px" },
};

// ── TYPES ─────────────────────────────────────────────────────
type JobUI = {
  id: number; description: string; jobType: string;
  payment: string; paymentToken: "ETH" | "USDC";
  status: number; agentId: number; agentName: string;
  client: string; provider: string;
  qualityScore: number; createdAt: number; deadline: number;
};

const STATUS_MAP = {
  0: { label: "CREATED",   color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  },
  1: { label: "ACCEPTED",  color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)"  },
  2: { label: "VERIFYING", color: "#e879f9", bg: "rgba(232,121,249,0.08)", border: "rgba(232,121,249,0.2)" },
  3: { label: "COMPLETED", color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)"  },
  4: { label: "CANCELLED", color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
} as const;

const MOCK_JOBS: JobUI[] = [
  { id: 0, description: "Ringkas artikel berita 3000 kata tentang AI", jobType: "summarization", payment: "0.0007", paymentToken: "ETH", status: 3, agentId: 0, agentName: "SummarizerBot",  client: "0xf39F...2266", provider: "0x7099...7222", qualityScore: 92, createdAt: Date.now()-7200000,  deadline: Date.now()+79200000 },
  { id: 1, description: "Terjemahkan dokumen kontrak EN ke ID",         jobType: "translation",   payment: "0.0005", paymentToken: "ETH", status: 2, agentId: 1, agentName: "TranslatorAI",   client: "0x3C44...93BC", provider: "0x7099...7222", qualityScore: 0,  createdAt: Date.now()-3600000,  deadline: Date.now()+82800000 },
  { id: 2, description: "OCR scan 10 receipt dari gambar",              jobType: "ocr",           payment: "0.0010", paymentToken: "ETH", status: 1, agentId: 2, agentName: "VisionBot",      client: "0x9065...1638", provider: "0x3C44...93BC", qualityScore: 0,  createdAt: Date.now()-1800000,  deadline: Date.now()+84600000 },
  { id: 3, description: "Transkripsi audio podcast 5 menit",            jobType: "transcription", payment: "0.0003", paymentToken: "ETH", status: 0, agentId: 3, agentName: "TranscriberBot", client: "0xf39F...2266", provider: "0x9065...1638", qualityScore: 0,  createdAt: Date.now()-600000,   deadline: Date.now()+85800000 },
  { id: 4, description: "Ringkas laporan keuangan Q3 2025",             jobType: "summarization", payment: "0.0007", paymentToken: "ETH", status: 4, agentId: 0, agentName: "SummarizerBot",  client: "0x7099...7222", provider: "0x3C44...93BC", qualityScore: 61, createdAt: Date.now()-14400000, deadline: Date.now()-7200000  },
];

const timeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${m}m ago`;
};

// ── JOB CARD ──────────────────────────────────────────────────
function JobCard({ job, index, onClick }: { job: JobUI; index: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const s = STATUS_MAP[job.status as keyof typeof STATUS_MAP] ?? STATUS_MAP[0];

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
        border: `1px solid ${hovered ? s.color + "30" : T.border.default}`,
        borderRadius: T.radius.card,
        borderLeft: `3px solid ${hovered ? s.color : s.color + "40"}`,
        padding: "20px 24px",
        cursor: "pointer",
        transition: "background 0.2s, border-color 0.2s",
        boxShadow: hovered ? `0 8px 32px rgba(0,0,0,0.4), 0 0 0 0 ${s.color}` : "0 2px 12px rgba(0,0,0,0.3)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Hover glow top edge */}
      {hovered && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg, transparent, ${s.color}40, transparent)`, pointerEvents: "none" }}
        />
      )}

      {/* Top row: ID + status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ fontSize: "10px", color: T.text.disabled, fontFamily: "monospace", letterSpacing: "0.15em" }}>
          #{String(job.id).padStart(3, "0")}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {job.status === 2 && (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ fontSize: "9px", color: "#e879f9", fontFamily: "monospace" }}
            >● LIVE</motion.span>
          )}
          <span style={{
            fontSize: "10px", fontWeight: 700, padding: "4px 10px",
            background: s.bg, border: `1px solid ${s.border}`,
            color: s.color, fontFamily: "monospace", letterSpacing: "0.08em",
            borderRadius: T.radius.badge,
          }}>{s.label}</span>
        </div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: "14px" }}>
        <motion.div
          animate={{ color: hovered ? T.text.primary : "#cccccc" }}
          style={{ fontSize: "14px", fontWeight: 600, lineHeight: 1.4, marginBottom: "6px", fontFamily: "var(--font-space), sans-serif" }}
        >
          {job.description}
        </motion.div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "10px", padding: "2px 8px", background: T.bg.input, border: `1px solid ${T.border.default}`, color: T.text.secondary, fontFamily: "monospace", borderRadius: T.radius.badge }}>
            {job.jobType}
          </span>
          <span style={{ fontSize: "10px", padding: "2px 8px", background: T.bg.input, border: `1px solid ${T.border.default}`, color: T.text.secondary, fontFamily: "monospace", borderRadius: T.radius.badge }}>
            {job.agentName}
          </span>
          {job.status === 2 && (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ fontSize: "10px", padding: "2px 8px", background: "rgba(232,121,249,0.06)", border: "1px solid rgba(232,121,249,0.15)", color: "#e879f9", fontFamily: "monospace", borderRadius: T.radius.badge }}
            >chainlink verifying...</motion.span>
          )}
          {job.status === 3 && job.qualityScore > 0 && (
            <span style={{ fontSize: "10px", padding: "2px 8px", background: job.qualityScore >= 80 ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${job.qualityScore >= 80 ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`, color: job.qualityScore >= 80 ? "#4ade80" : "#f87171", fontFamily: "monospace", borderRadius: T.radius.badge }}>
              score: {job.qualityScore}/100
            </span>
          )}
        </div>
      </div>

      {/* Bottom row: payment + time */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "14px", borderTop: `1px solid ${T.border.subtle}` }}>
        <motion.span
          animate={{ color: hovered ? T.text.accent : "#666666" }}
          style={{ fontSize: "14px", fontWeight: 700, fontFamily: "monospace" }}
        >
          {parseFloat(job.payment).toFixed(4)} {job.paymentToken}
        </motion.span>
        <span style={{ fontSize: "10px", color: T.text.disabled, fontFamily: "monospace" }}>
          {timeAgo(job.createdAt)}
        </span>
      </div>
    </motion.div>
  );
}

// ── FILTER BAR ────────────────────────────────────────────────
type FilterState = { status: number | "all"; token: "all" | "ETH" | "USDC" };

function FilterBar({ filters, setFilters, counts }: { filters: FilterState; setFilters: (f: FilterState) => void; counts: Record<string, number> }) {
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", padding: "16px 20px", background: T.bg.card, borderRadius: `${T.radius.card} ${T.radius.card} 0 0`, borderBottom: `1px solid ${T.border.default}` }}>
      {/* Status filters */}
      <button onClick={() => setFilters({ ...filters, status: "all" })}
        style={{ padding: "5px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer", background: filters.status === "all" ? "#4ade80" : T.bg.elevated, color: filters.status === "all" ? "#000" : T.text.secondary, border: `1px solid ${filters.status === "all" ? "#4ade80" : T.border.default}`, fontFamily: "monospace", transition: "all 0.15s", borderRadius: T.radius.button }}
      >ALL {counts.all ? `(${counts.all})` : ""}</button>

      {Object.entries(STATUS_MAP).map(([key, val]) => (
        <button key={key} onClick={() => setFilters({ ...filters, status: Number(key) })}
          style={{ padding: "5px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer", background: filters.status === Number(key) ? val.color : T.bg.elevated, color: filters.status === Number(key) ? "#000" : T.text.disabled, border: `1px solid ${filters.status === Number(key) ? val.color : T.border.default}`, fontFamily: "monospace", transition: "all 0.15s", borderRadius: T.radius.button }}
        >{val.label} {counts[key] !== undefined ? `(${counts[key]})` : ""}</button>
      ))}

      <div style={{ width: "1px", height: "20px", background: T.border.default, margin: "0 4px" }} />

      {(["all", "ETH", "USDC"] as const).map((t) => (
        <button key={t} onClick={() => setFilters({ ...filters, token: t })}
          style={{ padding: "5px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer", background: "transparent", color: filters.token === t ? "#fff" : T.text.disabled, border: "none", borderBottom: `2px solid ${filters.token === t ? "#4ade80" : "transparent"}`, fontFamily: "monospace", transition: "all 0.15s" }}
        >{t}</button>
      ))}
    </div>
  );
}

// ── JOB DETAIL MODAL ─────────────────────────────────────────
function JobDetailModal({ job, onClose }: { job: JobUI; onClose: () => void }) {
  const s = STATUS_MAP[job.status as keyof typeof STATUS_MAP] ?? STATUS_MAP[0];
  const isExpired = job.deadline < Date.now() && job.status < 2;

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
        style={{ background: T.bg.card, border: `1px solid ${T.border.default}`, borderTop: `3px solid ${s.color}`, borderRadius: T.radius.modal, padding: "40px", maxWidth: "560px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: `0 0 60px ${s.color}15` }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <p style={{ fontSize: "10px", color: s.color, fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "8px", opacity: 0.7 }}>
              JOB #{String(job.id).padStart(3, "0")}
            </p>
            <h2 style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "-0.02em", margin: 0, fontFamily: "var(--font-syne), sans-serif", lineHeight: 1.2, maxWidth: "380px" }}>
              {job.description}
            </h2>
          </div>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={onClose}
            style={{ background: T.bg.elevated, border: `1px solid ${T.border.default}`, color: T.text.secondary, cursor: "pointer", fontSize: "16px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: "8px", transition: "all 0.15s" }}
          >×</motion.button>
        </div>

        {/* Status + type badges */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, padding: "5px 12px", background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontFamily: "monospace", borderRadius: T.radius.badge }}>{s.label}</span>
          <span style={{ fontSize: "10px", padding: "5px 12px", background: T.bg.elevated, border: `1px solid ${T.border.default}`, color: T.text.secondary, fontFamily: "monospace", borderRadius: T.radius.badge }}>{job.jobType.toUpperCase()}</span>
          {job.paymentToken === "USDC" && (
            <span style={{ fontSize: "10px", padding: "5px 12px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)", color: "#60a5fa", fontFamily: "monospace", borderRadius: T.radius.badge }}>x402 USDC</span>
          )}
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: T.border.subtle, borderRadius: T.radius.input, overflow: "hidden", marginBottom: "20px" }}>
          {[
            { label: "PAYMENT", value: `${parseFloat(job.payment).toFixed(4)} ${job.paymentToken}`, color: T.text.accent },
            { label: "AGENT",   value: job.agentName,  color: "#ddd" },
            { label: "QUALITY", value: job.qualityScore > 0 ? `${job.qualityScore}/100` : "PENDING", color: job.qualityScore >= 80 ? T.text.accent : job.qualityScore > 0 ? "#f87171" : T.text.disabled },
          ].map((row) => (
            <div key={row.label} style={{ padding: "16px", background: T.bg.elevated }}>
              <div style={{ fontSize: "9px", color: T.text.muted, marginBottom: "6px", letterSpacing: "0.15em", fontFamily: "monospace", opacity: 0.55 }}>{row.label}</div>
              <div style={{ fontSize: "14px", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", color: row.color, wordBreak: "break-word" }}>{row.value}</div>
            </div>
          ))}
        </div>

        {/* Quality score bar */}
        {job.qualityScore > 0 && (
          <div style={{ marginBottom: "20px", padding: "16px", background: T.bg.elevated, borderRadius: T.radius.input, border: `1px solid ${T.border.default}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.15em", opacity: 0.6 }}>CHAINLINK QUALITY SCORE</span>
              <span style={{ fontSize: "9px", color: job.qualityScore >= 80 ? T.text.accent : "#f87171", fontFamily: "monospace", fontWeight: 700 }}>
                {job.qualityScore >= 80 ? "PASS ≥ 80" : "FAIL < 80"}
              </span>
            </div>
            <div style={{ height: "4px", background: T.border.default, borderRadius: "2px", overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${job.qualityScore}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                style={{ height: "100%", background: job.qualityScore >= 80 ? T.text.accent : "#f87171", borderRadius: "2px", boxShadow: `0 0 8px ${job.qualityScore >= 80 ? "rgba(74,222,128,0.5)" : "rgba(248,113,113,0.5)"}` }}
              />
            </div>
            <div style={{ textAlign: "right", marginTop: "6px", fontSize: "11px", fontWeight: 700, fontFamily: "monospace", color: job.qualityScore >= 80 ? T.text.accent : "#f87171" }}>
              {job.qualityScore}/100
            </div>
          </div>
        )}

        {/* Verifying indicator */}
        {job.status === 2 && (
          <div style={{ padding: "14px 16px", marginBottom: "20px", background: "rgba(232,121,249,0.05)", border: "1px solid rgba(232,121,249,0.15)", borderRadius: T.radius.input, display: "flex", alignItems: "center", gap: "10px" }}>
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
              style={{ width: "6px", height: "6px", background: "#e879f9", borderRadius: "50%", flexShrink: 0 }}
            />
            <span style={{ fontSize: "11px", color: "#e879f9", fontFamily: "monospace" }}>
              Chainlink DON sedang memverifikasi kualitas output...
            </span>
          </div>
        )}

        {/* Addresses */}
        <div style={{ padding: "16px", background: T.bg.elevated, borderLeft: `3px solid ${T.border.default}`, borderRadius: `0 ${T.radius.input} ${T.radius.input} 0`, marginBottom: "20px" }}>
          {[{ label: "CLIENT", value: job.client }, { label: "PROVIDER", value: job.provider }].map((a, i) => (
            <div key={a.label} style={{ marginBottom: i === 0 ? "10px" : 0 }}>
              <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "3px", opacity: 0.5 }}>{a.label}</div>
              <div style={{ fontSize: "12px", color: T.text.secondary, fontFamily: "monospace" }}>{a.value}</div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: T.border.subtle, borderRadius: T.radius.input, overflow: "hidden" }}>
          {[
            { label: "CREATED",  value: new Date(job.createdAt).toLocaleString("id-ID"), warn: false },
            { label: "DEADLINE", value: new Date(job.deadline).toLocaleString("id-ID"),  warn: isExpired },
          ].map((t) => (
            <div key={t.label} style={{ padding: "14px", background: T.bg.elevated }}>
              <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "4px", opacity: 0.5 }}>{t.label}</div>
              <div style={{ fontSize: "11px", color: t.warn ? "#f87171" : T.text.secondary, fontFamily: "monospace" }}>{t.value}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── STAT CARD ─────────────────────────────────────────────────
function StatCard({ label, value, highlight, delay }: { label: string; value: string; highlight?: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{ padding: "20px 24px", background: T.bg.card, border: `1px solid ${T.border.default}`, borderRadius: T.radius.card, flex: 1 }}
    >
      <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "8px", opacity: 0.6 }}>{label}</div>
      <div style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.03em", fontFamily: "var(--font-syne), sans-serif", color: highlight ? "#e879f9" : "#fff" }}>
        {value}
      </div>
    </motion.div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
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
  useRealData: boolean; selectedJob: JobUI | null;
  setSelectedJob: (j: JobUI | null) => void;
  filters: FilterState; setFilters: (f: FilterState) => void;
}) {
  const { data: jobCountRaw } = useReadContract({ address: ESCROW_ADDRESS as `0x${string}`, abi: JOB_ESCROW_ABI, functionName: "jobCount", query: { enabled: useRealData } });
  const jobCount = jobCountRaw ? Number(jobCountRaw) : 0;
  const { data: agentCountRaw } = useReadContract({ address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI, functionName: "agentCount", query: { enabled: useRealData } });
  const agentCount = agentCountRaw ? Number(agentCountRaw) : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobBatchContracts = useMemo((): any[] => {
    if (!useRealData || jobCount === 0) return [];
    return Array.from({ length: Math.min(jobCount, 50) }, (_, i) => ({ address: ESCROW_ADDRESS as `0x${string}`, abi: JOB_ESCROW_ABI, functionName: "jobs", args: [BigInt(i)] }));
  }, [useRealData, jobCount]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentNameContracts = useMemo((): any[] => {
    if (!useRealData || agentCount === 0) return [];
    return Array.from({ length: Math.min(agentCount, 50) }, (_, i) => ({ address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI, functionName: "agents", args: [BigInt(i)] }));
  }, [useRealData, agentCount]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: jobBatchData } = useReadContracts({ contracts: jobBatchContracts as any, query: { enabled: jobBatchContracts.length > 0 } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agentBatchData } = useReadContracts({ contracts: agentNameContracts as any, query: { enabled: agentNameContracts.length > 0 } });

  const agentNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (!agentBatchData) return map;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    agentBatchData.forEach((r, i) => { const raw = r?.result as any; if (raw?.name) map[i] = raw.name; });
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
      result.push({ id: i, description: raw.jobDescription, jobType: raw.jobType, payment: formatEther(raw.payment as bigint), paymentToken: raw.paymentToken === 0 ? "ETH" : "USDC", status: raw.status, agentId, agentName: agentNameMap[agentId] ?? `Agent #${agentId}`, client: `${(raw.clientAgent as string).slice(0,6)}...${(raw.clientAgent as string).slice(-4)}`, provider: `${(raw.providerAgent as string).slice(0,6)}...${(raw.providerAgent as string).slice(-4)}`, qualityScore: raw.qualityScore, createdAt: Number(raw.createdAt)*1000, deadline: Number(raw.deadline)*1000 });
    }
    return result.length > 0 ? result : MOCK_JOBS;
  }, [useRealData, jobBatchData, jobCount, agentNameMap]);

  const filteredJobs = useMemo(() => {
    let list = [...jobs].reverse();
    if (filters.status !== "all") list = list.filter((j) => j.status === filters.status);
    if (filters.token !== "all") list = list.filter((j) => j.paymentToken === filters.token);
    return list;
  }, [jobs, filters]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobs.length };
    jobs.forEach((j) => { c[j.status] = (c[j.status] ?? 0) + 1; });
    return c;
  }, [jobs]);

  const completedJobs  = jobs.filter((j) => j.status === 3).length;
  const verifyingJobs  = jobs.filter((j) => j.status === 2).length;
  const totalVolume    = jobs.reduce((acc, j) => j.paymentToken === "ETH" ? acc + parseFloat(j.payment) : acc, 0);
  const avgScore       = jobs.filter((j) => j.qualityScore > 0).reduce((acc, j, _, arr) => acc + j.qualityScore / arr.length, 0);

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: "white", fontFamily: "var(--font-space), sans-serif" }}>

      {/* ── HEADER ── */}
      <section style={{ borderBottom: `1px solid ${T.border.subtle}`, padding: "60px 48px 48px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p style={{ fontSize: "10px", letterSpacing: "0.25em", color: T.text.muted, fontFamily: "monospace", marginBottom: "16px", opacity: 0.6 }}>NEUROCART / JOBS</p>
            <h1 style={{ fontSize: "clamp(48px, 8vw, 96px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.9, fontFamily: "var(--font-syne), sans-serif", margin: "0 0 20px" }}>
              <span style={{ display: "block", color: "#fff" }}>JOB</span>
              <span style={{ display: "block", color: "#4ade80" }}>ESCROW</span>
            </h1>
            <p style={{ fontSize: "14px", color: T.text.secondary, maxWidth: "440px", lineHeight: 1.7 }}>
              All transactions are locked in a smart contract. Chainlink Functions verifies quality before payment is released.
            </p>
          </motion.div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: "12px", marginTop: "36px", flexWrap: "wrap" }}>
            {[
              { label: "TOTAL JOBS",   value: String(jobs.length),                                   highlight: false, delay: 0.3  },
              { label: "COMPLETED",    value: String(completedJobs),                                  highlight: false, delay: 0.35 },
              { label: "VERIFYING",    value: String(verifyingJobs), highlight: verifyingJobs > 0,               delay: 0.4  },
              { label: "VOLUME (ETH)", value: totalVolume.toFixed(4),                                 highlight: false, delay: 0.45 },
              { label: "AVG SCORE",    value: avgScore > 0 ? `${Math.round(avgScore)}/100` : "—",     highlight: false, delay: 0.5  },
            ].map((s) => <StatCard key={s.label} {...s} />)}
          </div>
        </div>
      </section>

      {/* ── JOBS GRID ── */}
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

        {/* Filter bar + cards container */}
        <div style={{ border: `1px solid ${T.border.default}`, borderRadius: T.radius.card, overflow: "hidden" }}>
          <FilterBar filters={filters} setFilters={setFilters} counts={counts} />

          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: "0", padding: "10px 24px", background: T.bg.elevated, borderBottom: `1px solid ${T.border.default}` }}>
            {["#", "DESCRIPTION", "AGENT", "PAYMENT", "STATUS"].map((h) => (
              <span key={h} style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.2em", opacity: 0.5 }}>{h}</span>
            ))}
          </div>

          {/* Cards */}
          <div style={{ padding: "16px", background: T.bg.page, display: "flex", flexDirection: "column", gap: "10px" }}>
            {filteredJobs.length === 0 ? (
              <div style={{ padding: "60px", textAlign: "center", color: T.text.disabled, fontSize: "12px", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                NO JOBS MATCH YOUR FILTER
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredJobs.map((job, i) => (
                  <JobCard key={job.id} job={job} index={i} onClick={() => setSelectedJob(job)} />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: "20px", marginTop: "16px", flexWrap: "wrap" }}>
          {Object.values(STATUS_MAP).map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "6px", height: "6px", background: s.color, borderRadius: "50%", opacity: 0.7 }} />
              <span style={{ fontSize: "9px", color: T.text.disabled, fontFamily: "monospace", letterSpacing: "0.1em" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {selectedJob && <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
      </AnimatePresence>
    </div>
  );
}