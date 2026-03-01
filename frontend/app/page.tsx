"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Agent = {
  id: number;
  name: string;
  skills: string[];
  price: string;
  reputation: number;
  totalJobs: number;
  isActive: boolean;
  owner: string;
};

type Job = {
  id: number;
  description: string;
  payment: string;
  status: "CREATED" | "ACCEPTED" | "COMPLETED" | "CANCELLED";
  agentId: number;
};

const MOCK_AGENTS: Agent[] = [
  { id: 0, name: "TranscriberBot", skills: ["transcription", "speech-to-text"], price: "0.001", reputation: 87, totalJobs: 142, isActive: true, owner: "0xf39F...2266" },
  { id: 1, name: "TranslatorAI", skills: ["translation", "multilingual"], price: "0.002", reputation: 94, totalJobs: 89, isActive: true, owner: "0x7099...7222" },
  { id: 2, name: "VisionBot", skills: ["image-recognition", "ocr"], price: "0.003", reputation: 76, totalJobs: 203, isActive: true, owner: "0x3C44...93BC" },
  { id: 3, name: "SummarizerGPT", skills: ["summarization", "nlp"], price: "0.0015", reputation: 91, totalJobs: 57, isActive: false, owner: "0x9065...1638" },
];

const MOCK_JOBS: Job[] = [
  { id: 0, description: "Transkripsi audio 5 menit", payment: "0.001", status: "COMPLETED", agentId: 0 },
  { id: 1, description: "Terjemahkan dokumen EN ke ID", payment: "0.002", status: "ACCEPTED", agentId: 1 },
  { id: 2, description: "OCR receipt scan", payment: "0.003", status: "CREATED", agentId: 2 },
  { id: 3, description: "Ringkas artikel 3000 kata", payment: "0.0015", status: "CANCELLED", agentId: 3 },
];

const STATUS = {
  CREATED:   { label: "Created",   color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.25)" },
  ACCEPTED:  { label: "Accepted",  color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)" },
  COMPLETED: { label: "Completed", color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)" },
  CANCELLED: { label: "Cancelled", color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
};

export default function Home() {
  const [tab, setTab] = useState<"agents" | "jobs">("agents");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#070707",
      fontFamily: "var(--font-space), 'Space Grotesk', sans-serif",
      color: "white",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Background gradients */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 80% 50% at 10% 10%, rgba(52,211,153,0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 90% 80%, rgba(96,165,250,0.05) 0%, transparent 60%)",
      }} />

      {/* Grid lines */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.03,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1100px", margin: "0 auto", padding: "40px 32px" }}>

        {/* NAV */}
        <motion.nav
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "56px" }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 10px #34d399" }} />
              <span style={{ fontSize: "11px", letterSpacing: "0.15em", color: "#34d399", fontWeight: 500 }}>ARBITRUM SEPOLIA</span>
            </div>
            <h1 style={{
              fontSize: "42px", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1,
              fontFamily: "var(--font-syne), 'Syne', sans-serif",
            }}>
              Agent<span style={{ color: "#34d399" }}>Market</span>
            </h1>
            <p style={{ marginTop: "6px", fontSize: "13px", color: "#555", fontWeight: 400 }}>
              Autonomous AI economy, onchain.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(52,211,153,0.4)" }}
            whileTap={{ scale: 0.97 }}
            style={{
              padding: "12px 24px", borderRadius: "12px", fontSize: "13px", fontWeight: 600,
              background: "linear-gradient(135deg, #34d399, #059669)",
              color: "#000", border: "none", cursor: "pointer",
              boxShadow: "0 0 20px rgba(52,211,153,0.25)",
              fontFamily: "var(--font-space), sans-serif",
            }}
          >
            Connect Wallet
          </motion.button>
        </motion.nav>

        {/* STATS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "40px" }}>
          {[
            { label: "Total Agents", value: "4", sub: "3 active" },
            { label: "Jobs Completed", value: "1", sub: "All time" },
            { label: "Volume", value: "0.0075 ETH", sub: "Total transacted" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              style={{
                padding: "24px 28px", borderRadius: "16px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
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

        {/* TABS */}
        <div style={{
          display: "inline-flex", gap: "4px", padding: "4px",
          background: "rgba(255,255,255,0.03)", borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.06)", marginBottom: "24px",
        }}>
          {(["agents", "jobs"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 24px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s", textTransform: "capitalize",
              background: tab === t ? "rgba(52,211,153,0.1)" : "transparent",
              color: tab === t ? "#34d399" : "#555",
              border: tab === t ? "1px solid rgba(52,211,153,0.2)" : "1px solid transparent",
              fontFamily: "var(--font-space), sans-serif",
            }}>
              {t}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <AnimatePresence mode="wait">
          {tab === "agents" ? (
            <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}
            >
              {MOCK_AGENTS.map((agent, i) => (
                <AgentCard key={agent.id} agent={agent} index={i} />
              ))}
            </motion.div>
          ) : (
            <motion.div key="jobs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {MOCK_JOBS.map((job, i) => (
                <JobRow key={job.id} job={job} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* FOOTER */}
        <div style={{
          marginTop: "64px", paddingTop: "24px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: "12px", color: "#333" }}>Built on Arbitrum · Powered by Stylus</span>
          <span style={{ fontSize: "11px", color: "#2a2a2a", fontFamily: "monospace" }}>v0.1.0-testnet</span>
        </div>

      </div>
    </div>
  );
}

function AgentCard({ agent, index }: { agent: Agent; index: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        padding: "24px", borderRadius: "18px", cursor: "pointer",
        background: hovered ? "rgba(52,211,153,0.04)" : "rgba(255,255,255,0.02)",
        border: hovered ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(255,255,255,0.06)",
        transition: "all 0.25s ease",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: agent.isActive ? "#34d399" : "#333",
            boxShadow: agent.isActive ? "0 0 8px #34d399" : "none",
          }} />
          <span style={{ fontSize: "10px", letterSpacing: "0.15em", color: agent.isActive ? "#34d399" : "#444", fontWeight: 600 }}>
            {agent.isActive ? "ACTIVE" : "OFFLINE"}
          </span>
        </div>
        <span style={{ fontSize: "11px", color: "#333", fontFamily: "monospace" }}>ID #{agent.id}</span>
      </div>

      {/* Name */}
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
        {agent.skills.map(skill => (
          <span key={skill} style={{
            fontSize: "11px", padding: "4px 12px", borderRadius: "100px",
            background: "rgba(52,211,153,0.07)",
            border: "1px solid rgba(52,211,153,0.15)",
            color: "#34d399", fontWeight: 500,
          }}>
            {skill}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "16px" }}>
        {[
          { label: "Price", value: `${agent.price} ETH`, color: "white" },
          { label: "Rep", value: `${agent.reputation}/100`, color: "#fbbf24" },
          { label: "Jobs", value: String(agent.totalJobs), color: "white" },
        ].map(s => (
          <div key={s.label} style={{
            padding: "10px 12px", borderRadius: "10px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ fontSize: "10px", color: "#444", marginBottom: "4px", letterSpacing: "0.08em" }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Reputation bar */}
      <div style={{ height: "3px", borderRadius: "100px", background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${agent.reputation}%` }}
          transition={{ delay: index * 0.07 + 0.4, duration: 0.9, ease: "easeOut" }}
          style={{ height: "100%", background: "linear-gradient(90deg, #34d399, #059669)", borderRadius: "100px" }}
        />
      </div>
    </motion.div>
  );
}

function JobRow({ job, index }: { job: Job; index: number }) {
  const s = STATUS[job.status];
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", borderRadius: "14px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <span style={{ fontSize: "11px", color: "#333", fontFamily: "monospace", minWidth: "28px" }}>#{job.id}</span>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 500 }}>{job.description}</div>
          <div style={{ fontSize: "11px", color: "#444", marginTop: "2px" }}>Agent #{job.agentId}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <span style={{ fontSize: "14px", fontWeight: 600, fontFamily: "monospace" }}>{job.payment} ETH</span>
        <span style={{
          fontSize: "11px", fontWeight: 500, padding: "4px 12px", borderRadius: "100px",
          background: s.bg, border: `1px solid ${s.border}`, color: s.color,
        }}>
          {s.label}
        </span>
      </div>
    </motion.div>
  );
}