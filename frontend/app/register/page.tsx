"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseEther } from "viem";
import {
  REGISTRY_ADDRESS,
  HAS_CONTRACTS,
  AGENT_REGISTRY_ABI,
} from "@/lib/contracts";

const MINIMUM_STAKE = "0.01"; // ETH — sesuai SC: MINIMUM_STAKE = 0.01 ether

const SKILL_OPTIONS = [
  "summarization", "translation", "nlp", "multilingual",
  "image-recognition", "ocr", "transcription", "speech-to-text",
  "code-generation", "data-analysis", "classification", "sentiment-analysis",
];

type FormState = {
  name: string;
  endpoint: string;
  metadataURI: string;
  priceUSD: string;
  stakeETH: string;
  skills: string[];
  customSkill: string;
};

const EMPTY_FORM: FormState = {
  name: "", endpoint: "", metadataURI: "",
  priceUSD: "", stakeETH: MINIMUM_STAKE,
  skills: [], customSkill: "",
};

// ── SUCCESS MODAL ────────────────────────────────────────────

function SuccessModal({ agentName, txHash, onClose }: { agentName: string; txHash: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <motion.div
        initial={{ y: 40, scale: 0.95 }} animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderTop: "3px solid #4ade80", padding: "48px", maxWidth: "480px", width: "100%", textAlign: "center" }}
      >
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          style={{ width: "64px", height: "64px", background: "rgba(74,222,128,0.1)", border: "2px solid #4ade80", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: "28px" }}
        >
          ✓
        </motion.div>

        <h2 style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.03em", fontFamily: "var(--font-syne), sans-serif", color: "#fff", marginBottom: "8px" }}>
          Agent Registered!
        </h2>
        <p style={{ fontSize: "13px", color: "#333", marginBottom: "24px", lineHeight: 1.6 }}>
          <span style={{ color: "#4ade80" }}>{agentName}</span> kini terdaftar on-chain dengan identitas ERC-8004. Stake ETH dikunci sebagai jaminan kualitas.
        </p>

        <div style={{ padding: "14px", background: "#111", borderLeft: "3px solid #4ade80", marginBottom: "28px", textAlign: "left" }}>
          <div style={{ fontSize: "9px", color: "#222", fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "6px" }}>TX HASH</div>
          <div style={{ fontSize: "11px", color: "#4ade80", fontFamily: "monospace", wordBreak: "break-all" }}>{txHash}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px", color: "#333", fontFamily: "monospace", marginBottom: "28px", textAlign: "left" }}>
          {[
            "ERC-8004 identity registered on-chain",
            "Stake ETH locked — slashable if quality fails",
            "Agent sekarang visible di marketplace",
            "Start x402 Flask server untuk receive jobs",
          ].map((item) => (
            <div key={item} style={{ display: "flex", gap: "10px" }}>
              <span style={{ color: "#4ade80" }}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        <motion.button whileTap={{ scale: 0.98 }} onClick={onClose}
          style={{ width: "100%", padding: "14px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", cursor: "pointer", background: "#4ade80", color: "#000", border: "none", fontFamily: "monospace" }}
        >
          VIEW AGENTS →
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ── FIELD COMPONENT ──────────────────────────────────────────

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "8px" }}>
        <label style={{ fontSize: "10px", letterSpacing: "0.2em", color: error ? "#f87171" : "#333", fontFamily: "monospace", fontWeight: 700 }}>{label}</label>
        {hint && <span style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace" }}>{hint}</span>}
      </div>
      {children}
      {error && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{ fontSize: "10px", color: "#f87171", fontFamily: "monospace", marginTop: "6px" }}
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}

const inputStyle = (hasError?: boolean): React.CSSProperties => ({
  width: "100%", padding: "12px 14px",
  background: "#0d0d0d",
  border: `1px solid ${hasError ? "#f87171" : "#1a1a1a"}`,
  borderTop: `2px solid ${hasError ? "#f87171" : "#222"}`,
  color: "white", fontSize: "14px",
  fontFamily: "var(--font-space), sans-serif",
  boxSizing: "border-box", outline: "none",
  transition: "border-color 0.15s",
});

// ── MAIN PAGE ────────────────────────────────────────────────

export default function RegisterPage() {
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const { address, isConnected } = useAccount();

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return <RegisterContent
    form={form} setForm={setForm}
    errors={errors} setErrors={setErrors}
    showSuccess={showSuccess} setShowSuccess={setShowSuccess}
    address={address} isConnected={isConnected}
  />;
}

function RegisterContent({ form, setForm, errors, setErrors, showSuccess, setShowSuccess, address, isConnected }: {
  form: FormState;
  setForm: (f: FormState) => void;
  errors: Partial<Record<keyof FormState, string>>;
  setErrors: (e: Partial<Record<keyof FormState, string>>) => void;
  showSuccess: boolean;
  setShowSuccess: (v: boolean) => void;
  address?: string;
  isConnected: boolean;
}) {
  const { writeContract, isPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Ambil jumlah agent milik user (untuk info)
  const { data: myAgentsRaw } = useReadContract({
    address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI,
    functionName: "getAgentsByOwner", args: [address as `0x${string}`],
    query: { enabled: !!REGISTRY_ADDRESS && !!address },
  });
  const myAgentCount = (myAgentsRaw as bigint[] | undefined)?.length ?? 0;

  useEffect(() => {
    if (isSuccess) setShowSuccess(true);
  }, [isSuccess, setShowSuccess]);

  const set = (key: keyof FormState, value: string | string[]) => {
    setForm({ ...form, [key]: value });
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  const toggleSkill = (skill: string) => {
    const current = form.skills;
    set("skills", current.includes(skill) ? current.filter((s) => s !== skill) : [...current, skill]);
  };

  const addCustomSkill = () => {
    const s = form.customSkill.trim().toLowerCase().replace(/\s+/g, "-");
    if (!s || form.skills.includes(s)) return;
    set("skills", [...form.skills, s]);
    setForm({ ...form, skills: [...form.skills, s], customSkill: "" });
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = "Nama agent wajib diisi";
    if (form.name.length > 64) e.name = "Maksimal 64 karakter";
    if (!form.endpoint.trim()) e.endpoint = "Endpoint URL wajib diisi";
    if (form.endpoint && !form.endpoint.startsWith("http")) e.endpoint = "Harus dimulai dengan http:// atau https://";
    if (!form.priceUSD || isNaN(Number(form.priceUSD)) || Number(form.priceUSD) <= 0) e.priceUSD = "Harga harus lebih dari $0";
    if (form.skills.length === 0) e.skills = "Pilih minimal 1 skill";
    const stake = parseFloat(form.stakeETH);
    if (isNaN(stake) || stake < 0.01) e.stakeETH = "Stake minimum 0.01 ETH";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = () => {
    if (!validate() || !REGISTRY_ADDRESS) return;

    const priceUSDCents = Math.round(parseFloat(form.priceUSD) * 100);
    const stakeWei = parseEther(form.stakeETH);

    writeContract({
      address: REGISTRY_ADDRESS as `0x${string}`,
      abi: AGENT_REGISTRY_ABI,
      functionName: "registerAgent",
      args: [
        form.name.trim(),
        form.skills,
        BigInt(priceUSDCents),
        form.endpoint.trim(),
        form.metadataURI.trim() || "",
      ],
      value: stakeWei,
    });
  };

  const priceUSDCents = Math.round(parseFloat(form.priceUSD || "0") * 100);
  const stakeNum = parseFloat(form.stakeETH || "0");
  const isLoading = isPending || isConfirming;

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "white", fontFamily: "var(--font-space), sans-serif" }}>

      {/* HEADER */}
      <section style={{ borderBottom: "1px solid #0f0f0f", padding: "60px 48px 48px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(#0f0f0f 1px, transparent 1px), linear-gradient(90deg, #0f0f0f 1px, transparent 1px)", backgroundSize: "80px 80px", opacity: 0.4 }} />
        <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p style={{ fontSize: "10px", letterSpacing: "0.25em", color: "#1a1a1a", fontFamily: "monospace", marginBottom: "16px" }}>NEUROCART / REGISTER</p>
            <h1 style={{ fontSize: "clamp(48px, 8vw, 96px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.9, fontFamily: "var(--font-syne), sans-serif", margin: "0 0 20px 0" }}>
              <span style={{ display: "block", color: "#fff" }}>REGISTER</span>
              <span style={{ display: "block", color: "#4ade80" }}>YOUR AGENT</span>
            </h1>
            <p style={{ fontSize: "14px", color: "#333", maxWidth: "480px", lineHeight: 1.7 }}>
              Daftarkan AI agent kamu on-chain via ERC-8004. Deposit stake minimum 0.01 ETH sebagai jaminan kualitas — akan di-slash jika output di bawah skor 80/100.
            </p>
          </motion.div>

          {/* Info badges */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ display: "flex", gap: "8px", marginTop: "28px", flexWrap: "wrap" }}
          >
            {[
              { label: "MIN STAKE: 0.01 ETH", color: "#60a5fa" },
              { label: "ERC-8004 STANDARD",   color: "#4ade80" },
              { label: "QUALITY THRESHOLD: 80/100", color: "#e879f9" },
              { label: "CHAINLINK VERIFIED",  color: "#375BD2" },
            ].map((b) => (
              <span key={b.label} style={{ fontSize: "10px", padding: "5px 12px", background: "transparent", border: `1px solid ${b.color}20`, color: `${b.color}99`, fontFamily: "monospace", letterSpacing: "0.12em" }}>
                {b.label}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FORM */}
      <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px" }}>
        {!isConnected ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ padding: "48px", textAlign: "center", border: "1px solid #111", background: "#080808" }}
          >
            <div style={{ fontSize: "32px", marginBottom: "16px" }}>🔌</div>
            <div style={{ fontSize: "16px", fontWeight: 700, fontFamily: "var(--font-syne), sans-serif", marginBottom: "8px" }}>Connect Wallet Dulu</div>
            <div style={{ fontSize: "13px", color: "#333" }}>Kamu perlu connect wallet untuk mendaftarkan agent on-chain.</div>
          </motion.div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1px", background: "#0f0f0f", alignItems: "start" }}>

            {/* LEFT: Form */}
            <div style={{ background: "#080808", padding: "40px" }}>
              <div style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "32px" }}>
                DETAIL AGENT
              </div>

              {/* Name */}
              <Field label="NAMA AGENT *" error={errors.name}>
                <input value={form.name} onChange={(e) => set("name", e.target.value)}
                  placeholder="contoh: SummarizerBot"
                  style={inputStyle(!!errors.name)}
                />
              </Field>

              {/* Skills */}
              <Field label="SKILLS *" hint="min. 1" error={errors.skills}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                  {SKILL_OPTIONS.map((skill) => {
                    const active = form.skills.includes(skill);
                    return (
                      <motion.button key={skill} whileTap={{ scale: 0.95 }}
                        onClick={() => toggleSkill(skill)}
                        style={{ padding: "6px 12px", fontSize: "10px", cursor: "pointer", background: active ? "#4ade80" : "transparent", color: active ? "#000" : "#333", border: `1px solid ${active ? "#4ade80" : "#1a1a1a"}`, fontFamily: "monospace", letterSpacing: "0.08em", transition: "all 0.15s" }}
                      >
                        {skill}
                      </motion.button>
                    );
                  })}
                </div>
                {/* Custom skill */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <input value={form.customSkill} onChange={(e) => set("customSkill", e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSkill(); } }}
                    placeholder="Tambah skill custom..."
                    style={{ ...inputStyle(), flex: 1, marginBottom: 0 }}
                  />
                  <button onClick={addCustomSkill}
                    style={{ padding: "12px 16px", background: "#111", border: "1px solid #1a1a1a", color: "#444", cursor: "pointer", fontFamily: "monospace", fontSize: "12px", whiteSpace: "nowrap" }}
                  >
                    + ADD
                  </button>
                </div>
                {/* Selected skills */}
                {form.skills.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "10px" }}>
                    {form.skills.map((s) => (
                      <span key={s} style={{ fontSize: "10px", padding: "4px 10px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ade80", fontFamily: "monospace", display: "flex", alignItems: "center", gap: "6px" }}>
                        {s}
                        <button onClick={() => toggleSkill(s)} style={{ background: "none", border: "none", color: "#4ade80", cursor: "pointer", fontSize: "12px", padding: "0", lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </Field>

              {/* Price */}
              <Field label="HARGA PER CALL (USD) *" hint="Chainlink ETH/USD auto-convert" error={errors.priceUSD}>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#333", fontSize: "14px", fontFamily: "monospace" }}>$</span>
                  <input value={form.priceUSD} onChange={(e) => set("priceUSD", e.target.value)}
                    type="number" min="0.01" step="0.01" placeholder="2.00"
                    style={{ ...inputStyle(!!errors.priceUSD), paddingLeft: "28px" }}
                  />
                </div>
                {priceUSDCents > 0 && (
                  <div style={{ fontSize: "10px", color: "#333", fontFamily: "monospace", marginTop: "6px" }}>
                    = {priceUSDCents} USD cents → dikonversi real-time oleh Chainlink ETH/USD feed
                  </div>
                )}
              </Field>

              {/* Endpoint */}
              <Field label="ENDPOINT URL *" hint="x402-enabled HTTP server" error={errors.endpoint}>
                <input value={form.endpoint} onChange={(e) => set("endpoint", e.target.value)}
                  placeholder="https://your-agent.com/api"
                  style={inputStyle(!!errors.endpoint)}
                />
                <div style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", marginTop: "6px" }}>
                  Endpoint ini dipanggil client via x402 protocol untuk machine-to-machine payment
                </div>
              </Field>

              {/* Metadata URI */}
              <Field label="METADATA URI" hint="optional — IPFS/HTTPS">
                <input value={form.metadataURI} onChange={(e) => set("metadataURI", e.target.value)}
                  placeholder="ipfs://Qm... atau https://..."
                  style={inputStyle()}
                />
                <div style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", marginTop: "6px" }}>
                  JSON metadata sesuai ERC-8004 standard (nama, deskripsi, capabilities)
                </div>
              </Field>

              {/* Stake */}
              <Field label="STAKE ETH *" hint={`min. ${MINIMUM_STAKE} ETH`} error={errors.stakeETH}>
                <input value={form.stakeETH} onChange={(e) => set("stakeETH", e.target.value)}
                  type="number" min={MINIMUM_STAKE} step="0.001" placeholder="0.01"
                  style={inputStyle(!!errors.stakeETH)}
                />
                <div style={{ padding: "10px 14px", marginTop: "8px", background: "#0d0d0d", borderLeft: "3px solid #fbbf24", fontSize: "11px", color: "#555", lineHeight: 1.6 }}>
                  ⚠ Stake akan di-slash jika Chainlink menilai output kamu di bawah skor 80/100. Lebih tinggi stake = lebih dipercaya client.
                </div>
              </Field>
            </div>

            {/* RIGHT: Summary + Submit */}
            <div style={{ background: "#060606", padding: "40px", position: "sticky", top: "80px" }}>
              <div style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "24px" }}>
                SUMMARY
              </div>

              {/* Preview */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "6px" }}>AGENT NAME</div>
                <div style={{ fontSize: "22px", fontWeight: 900, fontFamily: "var(--font-syne), sans-serif", color: form.name ? "#fff" : "#1a1a1a", marginBottom: "16px" }}>
                  {form.name || "Unnamed Agent"}
                </div>

                {form.skills.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "16px" }}>
                    {form.skills.map((s) => (
                      <span key={s} style={{ fontSize: "10px", padding: "3px 8px", border: "1px solid rgba(74,222,128,0.2)", color: "#4ade80", fontFamily: "monospace" }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Detail rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "#111", marginBottom: "24px" }}>
                {[
                  { label: "HARGA",   value: form.priceUSD ? `$${parseFloat(form.priceUSD).toFixed(2)}` : "—", color: "#4ade80" },
                  { label: "STAKE",   value: stakeNum >= 0.01 ? `${form.stakeETH} ETH` : "—", color: stakeNum >= 0.01 ? "#60a5fa" : "#333" },
                  { label: "SKILLS",  value: form.skills.length > 0 ? `${form.skills.length} skill` : "—", color: "#888" },
                  { label: "STANDARD", value: "ERC-8004", color: "#888" },
                  { label: "NETWORK", value: "Arbitrum Sepolia", color: "#888" },
                ].map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "#080808" }}>
                    <span style={{ fontSize: "10px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.12em" }}>{row.label}</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "monospace", color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Wallet info */}
              <div style={{ padding: "12px 14px", background: "#0a0a0a", border: "1px solid #111", marginBottom: "20px" }}>
                <div style={{ fontSize: "9px", color: "#1a1a1a", fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: "4px" }}>OWNER (WALLET)</div>
                <div style={{ fontSize: "11px", color: "#333", fontFamily: "monospace" }}>
                  {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : "—"}
                </div>
                {myAgentCount > 0 && (
                  <div style={{ fontSize: "10px", color: "#4ade80", fontFamily: "monospace", marginTop: "4px" }}>
                    Kamu sudah punya {myAgentCount} agent terdaftar
                  </div>
                )}
              </div>

              {/* No contract warning */}
              {!HAS_CONTRACTS && (
                <div style={{ padding: "10px 14px", background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.12)", fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", lineHeight: 1.6, marginBottom: "16px" }}>
                  Set NEXT_PUBLIC_REGISTRY_ADDRESS di .env.local untuk transaksi on-chain
                </div>
              )}

              {/* TX status */}
              <AnimatePresence>
                {isPending && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ padding: "10px 14px", marginBottom: "12px", background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.12)", fontSize: "10px", color: "#60a5fa", fontFamily: "monospace" }}
                  >
                    Confirm di wallet kamu...
                  </motion.div>
                )}
                {isConfirming && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ padding: "10px 14px", marginBottom: "12px", background: "rgba(232,121,249,0.04)", border: "1px solid rgba(232,121,249,0.12)", fontSize: "10px", color: "#e879f9", fontFamily: "monospace", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}
                      style={{ width: "6px", height: "6px", background: "#e879f9" }}
                    />
                    Menunggu konfirmasi on-chain...
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit button */}
              <motion.button whileTap={{ scale: 0.98 }}
                onClick={handleRegister}
                disabled={isLoading || !HAS_CONTRACTS}
                style={{ width: "100%", padding: "16px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.2em", cursor: isLoading || !HAS_CONTRACTS ? "not-allowed" : "pointer", background: isLoading ? "#0d0d0d" : !HAS_CONTRACTS ? "#0d0d0d" : "#4ade80", color: isLoading || !HAS_CONTRACTS ? "#222" : "#000", border: "none", fontFamily: "monospace", transition: "all 0.15s" }}
              >
                {isPending ? "CONFIRM IN WALLET..." : isConfirming ? "CONFIRMING..." : !HAS_CONTRACTS ? "CONTRACT NOT SET" : "REGISTER AGENT →"}
              </motion.button>

              <div style={{ fontSize: "9px", color: "#1a1a1a", fontFamily: "monospace", textAlign: "center", marginTop: "12px", lineHeight: 1.6 }}>
                Dengan register, kamu setuju stake ETH dapat di-slash jika kualitas output di bawah 80/100 per penilaian Chainlink Functions
              </div>
            </div>
          </div>
        )}
      </section>

      {/* SUCCESS MODAL */}
      <AnimatePresence>
        {showSuccess && txHash && (
          <SuccessModal
            agentName={form.name}
            txHash={txHash}
            onClose={() => {
              setShowSuccess(false);
              window.location.href = "/agents";
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}