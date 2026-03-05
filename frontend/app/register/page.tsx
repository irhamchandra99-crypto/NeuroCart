"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useAccount, useWriteContract,
  useWaitForTransactionReceipt, useReadContract,
} from "wagmi";
import { parseEther } from "viem";
import { REGISTRY_ADDRESS, HAS_CONTRACTS, AGENT_REGISTRY_ABI } from "@/lib/contracts";

// ── TOKENS ───────────────────────────────────────────────────
const T = {
  bg:     { page: "#050505", card: "#0e0e0e", input: "#141414", elevated: "#1a1a1a" },
  border: { default: "#1f1f1f", subtle: "#171717", accent: "rgba(74,222,128,0.2)", error: "#f87171" },
  text:   { primary: "#ffffff", secondary: "#aaaaaa", muted: "#6ee7b7", disabled: "#444444", accent: "#4ade80" },
  radius: { card: "16px", input: "8px", button: "8px", badge: "6px", modal: "20px" },
};

const MINIMUM_STAKE = "0.01";
const SKILL_OPTIONS = [
  "summarization","translation","nlp","multilingual",
  "image-recognition","ocr","transcription","speech-to-text",
  "code-generation","data-analysis","classification","sentiment-analysis",
];

type FormState = {
  name: string; endpoint: string; metadataURI: string;
  priceUSD: string; stakeETH: string; skills: string[]; customSkill: string;
};
const EMPTY_FORM: FormState = {
  name:"", endpoint:"", metadataURI:"",
  priceUSD:"", stakeETH: MINIMUM_STAKE, skills:[], customSkill:"",
};

// ── FOCUS INPUT ───────────────────────────────────────────────
function FocusInput({ hasError, style: extra, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
      style={{
        width:"100%", padding:"12px 14px",
        background: T.bg.input,
        border:`1px solid ${hasError ? T.border.error : focused ? "#4ade80" : T.border.default}`,
        borderRadius: T.radius.input,
        color:"white", fontSize:"14px",
        fontFamily:"var(--font-space), sans-serif",
        boxSizing:"border-box", outline:"none",
        transition:"border-color 0.2s, box-shadow 0.2s",
        boxShadow: focused
          ? hasError ? "0 0 0 3px rgba(248,113,113,0.1)" : "0 0 0 3px rgba(74,222,128,0.08)"
          : "none",
        ...extra,
      }}
    />
  );
}

// ── FIELD ─────────────────────────────────────────────────────
function Field({ label, hint, error, children }: { label:string; hint?:string; error?:string; children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:"24px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:"8px" }}>
        <label style={{ fontSize:"10px", letterSpacing:"0.2em", color: error ? T.border.error : T.text.muted, fontFamily:"monospace", fontWeight:700 }}>{label}</label>
        {hint && <span style={{ fontSize:"10px", color:T.text.disabled, fontFamily:"monospace" }}>{hint}</span>}
      </div>
      {children}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{ fontSize:"10px", color:T.border.error, fontFamily:"monospace", marginTop:"6px" }}
          >{error}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── SUCCESS MODAL ─────────────────────────────────────────────
function SuccessModal({ agentName, txHash, onClose }: { agentName:string; txHash:string; onClose:()=>void }) {
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.95)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}
    >
      <motion.div
        initial={{ y:40, scale:0.95 }} animate={{ y:0, scale:1 }}
        transition={{ duration:0.3, ease:[0.16,1,0.3,1] }}
        style={{ background:T.bg.card, border:`1px solid ${T.border.default}`, borderTop:"3px solid #4ade80", borderRadius:T.radius.modal, padding:"48px", maxWidth:"480px", width:"100%", textAlign:"center", boxShadow:"0 0 60px rgba(74,222,128,0.1)" }}
      >
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ delay:0.2, type:"spring", stiffness:200 }}
          style={{ width:"64px", height:"64px", background:"rgba(74,222,128,0.1)", border:"2px solid #4ade80", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px", fontSize:"28px" }}
        >✓</motion.div>
        <h2 style={{ fontSize:"28px", fontWeight:900, letterSpacing:"-0.03em", fontFamily:"var(--font-syne), sans-serif", color:"#fff", marginBottom:"8px" }}>Agent Registered!</h2>
        <p style={{ fontSize:"13px", color:T.text.secondary, marginBottom:"24px", lineHeight:1.6 }}>
          <span style={{ color:"#4ade80" }}>{agentName}</span> kini terdaftar on-chain dengan identitas ERC-8004.
        </p>
        <div style={{ padding:"14px", background:T.bg.input, borderLeft:"3px solid #4ade80", borderRadius:T.radius.input, marginBottom:"24px", textAlign:"left" }}>
          <div style={{ fontSize:"9px", color:T.text.muted, fontFamily:"monospace", letterSpacing:"0.15em", marginBottom:"6px", opacity:0.6 }}>TX HASH</div>
          <div style={{ fontSize:"11px", color:"#4ade80", fontFamily:"monospace", wordBreak:"break-all" }}>{txHash}</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"8px", fontSize:"11px", color:T.text.secondary, fontFamily:"monospace", marginBottom:"28px", textAlign:"left" }}>
          {["ERC-8004 identity registered on-chain","Stake ETH locked — slashable if quality fails","Agent visible di marketplace","Start x402 Flask server untuk receive jobs"].map((item) => (
            <div key={item} style={{ display:"flex", gap:"10px" }}><span style={{ color:"#4ade80" }}>✓</span><span>{item}</span></div>
          ))}
        </div>
        <motion.button whileHover={{ scale:1.02, boxShadow:"0 0 24px rgba(74,222,128,0.3)" }} whileTap={{ scale:0.98 }}
          onClick={onClose}
          style={{ width:"100%", padding:"14px", fontSize:"11px", fontWeight:700, letterSpacing:"0.2em", cursor:"pointer", background:"#4ade80", color:"#000", border:"none", fontFamily:"monospace", borderRadius:T.radius.button }}
        >VIEW AGENTS →</motion.button>
      </motion.div>
    </motion.div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function RegisterPage() {
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState,string>>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const { address, isConnected } = useAccount();
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return <RegisterContent form={form} setForm={setForm} errors={errors} setErrors={setErrors} showSuccess={showSuccess} setShowSuccess={setShowSuccess} address={address} isConnected={isConnected} />;
}

function RegisterContent({ form, setForm, errors, setErrors, showSuccess, setShowSuccess, address, isConnected }: {
  form:FormState; setForm:(f:FormState)=>void;
  errors:Partial<Record<keyof FormState,string>>; setErrors:(e:Partial<Record<keyof FormState,string>>)=>void;
  showSuccess:boolean; setShowSuccess:(v:boolean)=>void;
  address?:string; isConnected:boolean;
}) {
  const { writeContract, isPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const { data: myAgentsRaw } = useReadContract({
    address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI,
    functionName:"getAgentsByOwner", args:[address as `0x${string}`],
    query:{ enabled: !!REGISTRY_ADDRESS && !!address },
  });
  const myAgentCount = (myAgentsRaw as bigint[]|undefined)?.length ?? 0;

  useEffect(() => { if (isSuccess) setShowSuccess(true); }, [isSuccess, setShowSuccess]);

  const set = (key:keyof FormState, value:string|string[]) => {
    setForm({ ...form, [key]:value });
    if (errors[key]) setErrors({ ...errors, [key]:undefined });
  };
  const toggleSkill = (skill:string) => {
    const c = form.skills;
    set("skills", c.includes(skill) ? c.filter((s)=>s!==skill) : [...c, skill]);
  };
  const addCustomSkill = () => {
    const s = form.customSkill.trim().toLowerCase().replace(/\s+/g,"-");
    if (!s || form.skills.includes(s)) return;
    setForm({ ...form, skills:[...form.skills, s], customSkill:"" });
  };
  const validate = ():boolean => {
    const e:Partial<Record<keyof FormState,string>> = {};
    if (!form.name.trim())                                                         e.name="Nama agent wajib diisi";
    if (form.name.length>64)                                                       e.name="Maksimal 64 karakter";
    if (!form.endpoint.trim())                                                     e.endpoint="Endpoint URL wajib diisi";
    if (form.endpoint && !form.endpoint.startsWith("http"))                        e.endpoint="Harus dimulai dengan http:// atau https://";
    if (!form.priceUSD||isNaN(Number(form.priceUSD))||Number(form.priceUSD)<=0)   e.priceUSD="Harga harus lebih dari $0";
    if (form.skills.length===0)                                                    e.skills="Pilih minimal 1 skill";
    const stake=parseFloat(form.stakeETH);
    if (isNaN(stake)||stake<0.01)                                                  e.stakeETH="Stake minimum 0.01 ETH";
    setErrors(e);
    return Object.keys(e).length===0;
  };
  const handleRegister = () => {
    if (!validate()||!REGISTRY_ADDRESS) return;
    writeContract({
      address: REGISTRY_ADDRESS as `0x${string}`, abi: AGENT_REGISTRY_ABI,
      functionName:"registerAgent",
      args:[form.name.trim(), form.skills, BigInt(Math.round(parseFloat(form.priceUSD)*100)), form.endpoint.trim(), form.metadataURI.trim()||""],
      value: parseEther(form.stakeETH),
    });
  };

  const priceUSDCents = Math.round(parseFloat(form.priceUSD||"0")*100);
  const stakeNum = parseFloat(form.stakeETH||"0");
  const isLoading = isPending||isConfirming;

  return (
    <div style={{ minHeight:"100vh", background:"transparent", color:"white", fontFamily:"var(--font-space), sans-serif" }}>

      {/* HEADER */}
      <section style={{ borderBottom:`1px solid ${T.border.subtle}`, padding:"60px 48px 48px" }}>
        <div style={{ maxWidth:"1200px", margin:"0 auto" }}>
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
            <p style={{ fontSize:"10px", letterSpacing:"0.25em", color:T.text.muted, fontFamily:"monospace", marginBottom:"16px", opacity:0.6 }}>NEUROCART / REGISTER</p>
            <h1 style={{ fontSize:"clamp(48px, 8vw, 96px)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:0.9, fontFamily:"var(--font-syne), sans-serif", margin:"0 0 20px" }}>
              <span style={{ display:"block", color:"#fff" }}>REGISTER</span>
              <span style={{ display:"block", color:"#4ade80" }}>YOUR AGENT</span>
            </h1>
            <p style={{ fontSize:"14px", color:T.text.secondary, maxWidth:"480px", lineHeight:1.7 }}>
              Register your AI agent on-chain via ERC-8004. Deposit a minimum stake of 0.01 ETH as a quality guarantee.
            </p>
          </motion.div>
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.3 }}
            style={{ display:"flex", gap:"8px", marginTop:"28px", flexWrap:"wrap" }}
          >
            {[
              { label:"MIN STAKE: 0.01 ETH",       color:"#60a5fa" },
              { label:"ERC-8004 STANDARD",          color:"#4ade80" },
              { label:"QUALITY THRESHOLD: 80/100",  color:"#e879f9" },
              { label:"CHAINLINK VERIFIED",         color:"#375BD2" },
            ].map((b) => (
              <span key={b.label} style={{ fontSize:"10px", padding:"5px 12px", background:"transparent", border:`1px solid ${b.color}25`, color:`${b.color}aa`, fontFamily:"monospace", letterSpacing:"0.12em", borderRadius:T.radius.badge }}>
                {b.label}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FORM */}
      <section style={{ maxWidth:"1200px", margin:"0 auto", padding:"48px" }}>
        {!isConnected ? (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            style={{ padding:"64px", textAlign:"center", border:`1px solid ${T.border.default}`, background:T.bg.card, borderRadius:T.radius.card }}
          >
            <div style={{ fontSize:"40px", marginBottom:"16px" }}>🔌</div>
            <div style={{ fontSize:"18px", fontWeight:700, fontFamily:"var(--font-syne), sans-serif", marginBottom:"8px" }}>Connect Wallet Dulu</div>
            <div style={{ fontSize:"13px", color:T.text.secondary }}>Kamu perlu connect wallet untuk mendaftarkan agent on-chain.</div>
          </motion.div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 380px", gap:"20px", alignItems:"start" }}>

            {/* LEFT: FORM */}
            <motion.div initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.4 }}
              style={{ background:T.bg.card, padding:"40px", borderRadius:T.radius.card, border:`1px solid ${T.border.default}`, boxShadow:"0 4px 32px rgba(0,0,0,0.5)" }}
            >
              <div style={{ fontSize:"10px", color:T.text.muted, fontFamily:"monospace", letterSpacing:"0.2em", marginBottom:"32px", opacity:0.7 }}>DETAIL AGENT</div>

              <Field label="NAMA AGENT *" error={errors.name}>
                <FocusInput value={form.name} onChange={(e)=>set("name",e.target.value)} placeholder="contoh: SummarizerBot" hasError={!!errors.name} />
              </Field>

              <Field label="SKILLS *" hint="min. 1" error={errors.skills}>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginBottom:"10px" }}>
                  {SKILL_OPTIONS.map((skill) => {
                    const active = form.skills.includes(skill);
                    return (
                      <motion.button key={skill} whileTap={{ scale:0.93 }} onClick={()=>toggleSkill(skill)}
                        style={{ padding:"6px 12px", fontSize:"10px", cursor:"pointer", background: active?"#4ade80":T.bg.input, color: active?"#000":T.text.disabled, border:`1px solid ${active?"#4ade80":T.border.default}`, borderRadius:T.radius.badge, fontFamily:"monospace", letterSpacing:"0.08em", transition:"all 0.15s", boxShadow: active?"0 0 12px rgba(74,222,128,0.2)":"none" }}
                      >{skill}</motion.button>
                    );
                  })}
                </div>
                <div style={{ display:"flex", gap:"8px" }}>
                  <FocusInput value={form.customSkill} onChange={(e)=>set("customSkill",e.target.value)}
                    onKeyDown={(e)=>{ if(e.key==="Enter"){e.preventDefault();addCustomSkill();} }}
                    placeholder="Tambah skill custom..." style={{ flex:1 }}
                  />
                  <button onClick={addCustomSkill}
                    style={{ padding:"12px 16px", background:T.bg.input, border:`1px solid ${T.border.default}`, color:T.text.secondary, cursor:"pointer", fontFamily:"monospace", fontSize:"12px", whiteSpace:"nowrap", borderRadius:T.radius.input, transition:"all 0.15s" }}
                  >+ ADD</button>
                </div>
                {form.skills.length>0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginTop:"10px" }}>
                    {form.skills.map((s)=>(
                      <span key={s} style={{ fontSize:"10px", padding:"4px 10px", background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.2)", color:"#4ade80", fontFamily:"monospace", display:"flex", alignItems:"center", gap:"6px", borderRadius:T.radius.badge }}>
                        {s}
                        <button onClick={()=>toggleSkill(s)} style={{ background:"none", border:"none", color:"#4ade80", cursor:"pointer", fontSize:"12px", padding:"0", lineHeight:1 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </Field>

              <Field label="HARGA PER CALL (USD) *" hint="Chainlink ETH/USD auto-convert" error={errors.priceUSD}>
                <div style={{ position:"relative" }}>
                  <span style={{ position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:T.text.disabled, fontSize:"14px", fontFamily:"monospace", zIndex:1 }}>$</span>
                  <FocusInput value={form.priceUSD} onChange={(e)=>set("priceUSD",e.target.value)} type="number" min="0.01" step="0.01" placeholder="2.00" hasError={!!errors.priceUSD} style={{ paddingLeft:"28px" }} />
                </div>
                {priceUSDCents>0 && (
                  <div style={{ fontSize:"10px", color:T.text.muted, fontFamily:"monospace", marginTop:"6px", opacity:0.6 }}>
                    = {priceUSDCents} cents → Chainlink ETH/USD real-time
                  </div>
                )}
              </Field>

              <Field label="ENDPOINT URL *" hint="x402-enabled HTTP server" error={errors.endpoint}>
                <FocusInput value={form.endpoint} onChange={(e)=>set("endpoint",e.target.value)} placeholder="https://your-agent.com/api" hasError={!!errors.endpoint} />
                <div style={{ fontSize:"10px", color:T.text.disabled, fontFamily:"monospace", marginTop:"6px" }}>Called via x402 protocol for machine-to-machine payment</div>
              </Field>

              <Field label="METADATA URI" hint="optional — IPFS/HTTPS">
                <FocusInput value={form.metadataURI} onChange={(e)=>set("metadataURI",e.target.value)} placeholder="ipfs://Qm... atau https://..." />
                <div style={{ fontSize:"10px", color:T.text.disabled, fontFamily:"monospace", marginTop:"6px" }}>JSON metadata according to the ERC-8004 standard</div>
              </Field>

              <Field label="STAKE ETH *" hint={`min. ${MINIMUM_STAKE} ETH`} error={errors.stakeETH}>
                <FocusInput value={form.stakeETH} onChange={(e)=>set("stakeETH",e.target.value)} type="number" min={MINIMUM_STAKE} step="0.001" placeholder="0.01" hasError={!!errors.stakeETH} />
                <div style={{ padding:"12px 14px", marginTop:"8px", background:T.bg.input, borderLeft:"3px solid #fbbf24", fontSize:"11px", color:T.text.secondary, lineHeight:1.6, borderRadius:`0 ${T.radius.input} ${T.radius.input} 0` }}>
                  ⚠ Stakes will be slashed if the output is below a score of 80/100. Higher stakes = more trusted by clients.
                </div>
              </Field>
            </motion.div>

            {/* RIGHT: SUMMARY */}
            <motion.div initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.4, delay:0.1 }}
              style={{ position:"sticky", top:"80px" }}
            >
              <div style={{ background:T.bg.card, padding:"32px", borderRadius:T.radius.card, border:`1px solid ${T.border.accent}`, boxShadow:"0 8px 40px rgba(74,222,128,0.07), 0 4px 20px rgba(0,0,0,0.5)" }}>
                <div style={{ fontSize:"10px", color:T.text.muted, fontFamily:"monospace", letterSpacing:"0.2em", marginBottom:"24px", opacity:0.7 }}>SUMMARY</div>

                {/* Preview box */}
                <div style={{ marginBottom:"20px", padding:"20px", background:T.bg.input, borderRadius:T.radius.input, border:`1px solid ${T.border.default}` }}>
                  <div style={{ fontSize:"10px", color:T.text.muted, fontFamily:"monospace", letterSpacing:"0.15em", marginBottom:"8px", opacity:0.6 }}>AGENT NAME</div>
                  <motion.div animate={{ color: form.name?"#fff":T.text.disabled }}
                    style={{ fontSize:"22px", fontWeight:900, fontFamily:"var(--font-syne), sans-serif", marginBottom:"12px" }}
                  >{form.name||"Unnamed Agent"}</motion.div>
                  <AnimatePresence>
                    {form.skills.length>0 && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
                        style={{ display:"flex", flexWrap:"wrap", gap:"5px" }}
                      >
                        {form.skills.slice(0,4).map((s)=>(
                          <span key={s} style={{ fontSize:"9px", padding:"3px 8px", border:"1px solid rgba(74,222,128,0.2)", color:"#4ade80", fontFamily:"monospace", borderRadius:T.radius.badge }}>{s}</span>
                        ))}
                        {form.skills.length>4 && (
                          <span style={{ fontSize:"9px", padding:"3px 8px", border:`1px solid ${T.border.default}`, color:T.text.disabled, fontFamily:"monospace", borderRadius:T.radius.badge }}>+{form.skills.length-4}</span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Stat rows */}
                <div style={{ display:"flex", flexDirection:"column", gap:"1px", background:T.border.subtle, borderRadius:T.radius.input, overflow:"hidden", marginBottom:"16px" }}>
                  {[
                    { label:"HARGA",    value: form.priceUSD?`$${parseFloat(form.priceUSD).toFixed(2)}`:"—", color: form.priceUSD?"#4ade80":T.text.disabled },
                    { label:"STAKE",    value: stakeNum>=0.01?`${form.stakeETH} ETH`:"—",                   color: stakeNum>=0.01?"#60a5fa":T.text.disabled  },
                    { label:"SKILLS",   value: form.skills.length>0?`${form.skills.length} skill`:"—",       color: form.skills.length>0?T.text.secondary:T.text.disabled },
                    { label:"STANDARD", value:"ERC-8004",                                                    color:T.text.secondary },
                    { label:"NETWORK",  value:"Arbitrum Sepolia",                                            color:T.text.secondary },
                  ].map((row)=>(
                    <div key={row.label} style={{ display:"flex", justifyContent:"space-between", padding:"11px 14px", background:T.bg.elevated }}>
                      <span style={{ fontSize:"10px", color:T.text.muted, fontFamily:"monospace", letterSpacing:"0.12em", opacity:0.55 }}>{row.label}</span>
                      <motion.span animate={{ color:row.color }} style={{ fontSize:"12px", fontWeight:700, fontFamily:"monospace" }}>{row.value}</motion.span>
                    </div>
                  ))}
                </div>

                {/* Wallet */}
                <div style={{ padding:"12px 14px", background:T.bg.elevated, border:`1px solid ${T.border.default}`, borderRadius:T.radius.input, marginBottom:"16px" }}>
                  <div style={{ fontSize:"9px", color:T.text.muted, fontFamily:"monospace", letterSpacing:"0.15em", marginBottom:"4px", opacity:0.6 }}>OWNER</div>
                  <div style={{ fontSize:"11px", color:T.text.secondary, fontFamily:"monospace" }}>
                    {address?`${address.slice(0,8)}...${address.slice(-6)}`:"—"}
                  </div>
                  {myAgentCount>0 && (
                    <div style={{ fontSize:"10px", color:"#4ade80", fontFamily:"monospace", marginTop:"4px" }}>You already have {myAgentCount} agent</div>
                  )}
                </div>

                {!HAS_CONTRACTS && (
                  <div style={{ padding:"10px 14px", background:"rgba(251,191,36,0.04)", border:"1px solid rgba(251,191,36,0.15)", fontSize:"10px", color:"#fbbf24", fontFamily:"monospace", lineHeight:1.6, marginBottom:"12px", borderRadius:T.radius.input }}>
                    Set NEXT_PUBLIC_REGISTRY_ADDRESS di .env.local
                  </div>
                )}

                <AnimatePresence>
                  {isPending && (
                    <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
                      style={{ padding:"10px 14px", marginBottom:"10px", background:"rgba(96,165,250,0.05)", border:"1px solid rgba(96,165,250,0.15)", fontSize:"10px", color:"#60a5fa", fontFamily:"monospace", borderRadius:T.radius.input }}
                    >Confirm di wallet kamu...</motion.div>
                  )}
                  {isConfirming && (
                    <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
                      style={{ padding:"10px 14px", marginBottom:"10px", background:"rgba(232,121,249,0.05)", border:"1px solid rgba(232,121,249,0.15)", fontSize:"10px", color:"#e879f9", fontFamily:"monospace", display:"flex", alignItems:"center", gap:"8px", borderRadius:T.radius.input }}
                    >
                      <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ duration:1, repeat:Infinity }}
                        style={{ width:"6px", height:"6px", background:"#e879f9", borderRadius:"50%", flexShrink:0 }}
                      />
                      Menunggu konfirmasi on-chain...
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  whileHover={!isLoading&&HAS_CONTRACTS?{ scale:1.02, boxShadow:"0 0 28px rgba(74,222,128,0.3)" }:{}}
                  whileTap={!isLoading&&HAS_CONTRACTS?{ scale:0.98 }:{}}
                  onClick={handleRegister}
                  disabled={isLoading||!HAS_CONTRACTS}
                  style={{ width:"100%", padding:"16px", fontSize:"12px", fontWeight:700, letterSpacing:"0.2em", cursor: isLoading||!HAS_CONTRACTS?"not-allowed":"pointer", background: isLoading||!HAS_CONTRACTS?T.bg.elevated:"#4ade80", color: isLoading||!HAS_CONTRACTS?T.text.disabled:"#000", border:"none", fontFamily:"monospace", borderRadius:T.radius.button, transition:"all 0.15s", opacity: isLoading?0.6:1 }}
                >
                  {isPending?"CONFIRM IN WALLET...":isConfirming?"CONFIRMING...":!HAS_CONTRACTS?"CONTRACT NOT SET":"REGISTER AGENT →"}
                </motion.button>

                <div style={{ fontSize:"9px", color:T.text.disabled, fontFamily:"monospace", textAlign:"center", marginTop:"12px", lineHeight:1.6 }}>
                  Stake ETH dapat di-slash jika output di bawah 80/100 per Chainlink Functions
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </section>

      <AnimatePresence>
        {showSuccess && txHash && (
          <SuccessModal agentName={form.name} txHash={txHash} onClose={()=>{ setShowSuccess(false); window.location.href="/agents"; }} />
        )}
      </AnimatePresence>
    </div>
  );
}