"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/agents", label: "Agents" },
  { href: "/jobs", label: "Jobs" },
  { href: "/register", label: "Register" },
  { href: "/how-it-works", label: "How It Works" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "20px 32px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(7,7,7,0.8)",
        backdropFilter: "blur(20px)",
        position: "sticky", top: 0, zIndex: 100,
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ textDecoration: "none" }}>
        <h1 style={{
          fontSize: "22px", fontWeight: 800, letterSpacing: "-0.03em",
          fontFamily: "var(--font-syne), 'Syne', sans-serif",
          color: "white",
        }}>
          Agent<span style={{ color: "#34d399" }}>Market</span>
        </h1>
      </Link>

      {/* Links */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
              <div style={{
                padding: "7px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
                color: isActive ? "#34d399" : "#555",
                background: isActive ? "rgba(52,211,153,0.08)" : "transparent",
                border: isActive ? "1px solid rgba(52,211,153,0.15)" : "1px solid transparent",
                transition: "all 0.2s",
                cursor: "pointer",
                fontFamily: "var(--font-space), sans-serif",
              }}>
                {link.label}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Connect Wallet */}
      <motion.button
        whileHover={{ scale: 1.03, boxShadow: "0 0 30px rgba(52,211,153,0.35)" }}
        whileTap={{ scale: 0.97 }}
        style={{
          padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
          background: "linear-gradient(135deg, #34d399, #059669)",
          color: "#000", border: "none", cursor: "pointer",
          boxShadow: "0 0 20px rgba(52,211,153,0.2)",
          fontFamily: "var(--font-space), sans-serif",
        }}
      >
        Connect Wallet
      </motion.button>
    </motion.nav>
  );
}