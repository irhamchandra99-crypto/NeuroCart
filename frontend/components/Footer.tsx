"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

// ── TOKENS ───────────────────────────────────────────────────
const T = {
  bg:     { footer: "#080808", footerDeep: "#060606" },
  border: { top: "rgba(255,255,255,0.04)", subtle: "rgba(255,255,255,0.02)" },
  text:   { primary: "#ffffff", secondary: "#aaaaaa", muted: "#6ee7b7", disabled: "#666666", accent: "#4ade80" },
};

const NAV_LINKS = {
  product: [
    { label: "Dashboard",  href: "/dashboard"    },
    { label: "Agents",     href: "/agents"       },
    { label: "Jobs",       href: "/jobs"         },
    { label: "Register",   href: "/register"     },
  ],
  resources: [
    { label: "How It Works", href: "/how-it-works" },
    { label: "GitHub",       href: "https://github.com/irhamchandra99-crypto/NeuroCart", external: true },
    { label: "Docs",         href: "/how-it-works" },
    { label: "Arbitrum",     href: "https://sepolia.arbiscan.io", external: true },
  ],
};

const SOCIAL = [
  { label: "X",        icon: "𝕏", href: "#", color: "#aaaaaa" },
  { label: "Discord",  icon: "◈", href: "#", color: "#5865F2" },
  { label: "Telegram", icon: "✈", href: "#", color: "#2CA5E0" },
];

const TRUST_ITEMS = [
  "CONTRACT VERIFIED",
  "BASE SEPOLIA",
  "CHAINLINK SECURED",
  "ERC-8004 STANDARD",
];

// ── FOOTER LINK ───────────────────────────────────────────────
function FooterLink({ label, href, external }: { label: string; href: string; external?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const inner = (
    <motion.span
      animate={{ color: hovered ? T.text.muted : T.text.secondary }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ fontSize: "12px", fontFamily: "var(--font-space), sans-serif", cursor: "pointer", display: "block", paddingBottom: "2px", borderBottom: `1px solid ${hovered ? "rgba(110,231,183,0.2)" : "transparent"}`, transition: "border-color 0.2s" }}
    >
      {label}{external && <span style={{ fontSize: "9px", opacity: 0.5, marginLeft: "3px" }}>↗</span>}
    </motion.span>
  );
  if (external) return <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{inner}</a>;
  return <Link href={href} style={{ textDecoration: "none" }}>{inner}</Link>;
}

// ── SOCIAL ICON ───────────────────────────────────────────────
function SocialIcon({ label, icon, href, color }: { label: string; icon: string; href: string; color: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.a
      href={href} target="_blank" rel="noopener noreferrer"
      aria-label={label}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        width: "36px", height: "36px",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: hovered ? `${color}12` : "rgba(255,255,255,0.03)",
        border: `1px solid ${hovered ? `${color}30` : "rgba(255,255,255,0.06)"}`,
        borderRadius: "8px",
        fontSize: "14px", color: hovered ? color : T.text.secondary,
        textDecoration: "none", cursor: "pointer",
        transition: "all 0.2s",
        boxShadow: hovered ? `0 0 14px ${color}20` : "none",
      }}
    >
      {icon}
    </motion.a>
  );
}

// ── NETWORK DOT ───────────────────────────────────────────────
function NetworkIndicator() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.1)", borderRadius: "6px" }}>
      <motion.div
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ width: "5px", height: "5px", background: T.text.accent, borderRadius: "50%", boxShadow: "0 0 6px #4ade80" }}
      />
      <span style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.12em" }}>BASE SEPHOLIA</span>
    </div>
  );
}

// ── FOOTER ────────────────────────────────────────────────────
export default function Footer() {
  return (
    <footer style={{ position: "relative", overflow: "hidden" }}>

      {/* ── EDGE TRANSITION — soft gradient fade from page to footer ── */}
      <div style={{
        height: "64px",
        background: "linear-gradient(to bottom, transparent, #080808)",
        pointerEvents: "none",
      }} />

      {/* ── MAIN FOOTER BODY ── */}
      <div style={{
        background: `linear-gradient(to bottom, #080808 0%, #060606 100%)`,
        borderTop: `1px solid ${T.border.top}`,
        position: "relative",
      }}>

        {/* Subtle radial glow behind logo area */}
        <div style={{
          position: "absolute",
          top: 0, left: 0,
          width: "400px", height: "200px",
          background: "radial-gradient(ellipse at 15% 0%, rgba(74,222,128,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Very faint animated grid */}
        <motion.div
          animate={{ backgroundPosition: ["0px 0px", "80px 80px"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{
            position: "absolute", inset: 0,
            backgroundImage: "linear-gradient(rgba(74,222,128,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.015) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            pointerEvents: "none",
            opacity: 1,
          }}
        />

        {/* ── MAIN CONTENT ── */}
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "56px 48px 40px", position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "48px", marginBottom: "48px" }}>

            {/* LEFT — Logo + tagline */}
            <div>
              <Link href="/" style={{ textDecoration: "none" }}>
                <h2 style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "-0.03em", fontFamily: "var(--font-syne), sans-serif", color: "white", margin: "0 0 10px" }}>
                  Neuro<span style={{ color: T.text.accent }}>Cart</span>
                </h2>
              </Link>
              <p style={{ fontSize: "12px", color: T.text.secondary, lineHeight: 1.6, margin: "0 0 20px", maxWidth: "200px" }}>
                Trustless AI agent marketplace. No humans. No trust required.
              </p>
              <NetworkIndicator />
            </div>

            {/* CENTER — Links */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
              <div>
                <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "16px", opacity: 0.6 }}>PRODUCT</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {NAV_LINKS.product.map((l) => <FooterLink key={l.label} {...l} />)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "16px", opacity: 0.6 }}>RESOURCES</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {NAV_LINKS.resources.map((l) => <FooterLink key={l.label} {...l} />)}
                </div>
              </div>
            </div>

            {/* RIGHT — Social + copyright */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: "16px", opacity: 0.6 }}>COMMUNITY</div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
                {SOCIAL.map((s) => <SocialIcon key={s.label} {...s} />)}
              </div>
              <div style={{ fontSize: "10px", color: T.text.secondary, fontFamily: "monospace", textAlign: "right", lineHeight: 1.6 }}>
                Built for<br />
                <span style={{ color: T.text.muted }}>Chainlink Convergence</span><br />
                Hackathon 2026
              </div>
            </div>
          </div>

          {/* ── BOTTOM BAR ── */}
          <div style={{ borderTop: `1px solid ${T.border.subtle}`, paddingTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>

            {/* Trust strip */}
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
              {TRUST_ITEMS.map((item, i) => (
                <span key={item} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <span style={{ fontSize: "9px", color: T.text.disabled, fontFamily: "monospace", letterSpacing: "0.12em" }}>{item}</span>
                  {i < TRUST_ITEMS.length - 1 && (
                    <span style={{ fontSize: "9px", color: T.text.disabled, opacity: 0.3 }}>·</span>
                  )}
                </span>
              ))}
            </div>

            {/* Copyright */}
            <span style={{ fontSize: "10px", color: T.text.disabled, fontFamily: "monospace", letterSpacing: "0.08em" }}>
              © 2026 NeuroCart
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}