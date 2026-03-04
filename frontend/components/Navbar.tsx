"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useConnect, useDisconnect } from "wagmi";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/agents", label: "Agents" },
  { href: "/jobs", label: "Jobs" },
  { href: "/register", label: "Register" },
  { href: "/how-it-works", label: "How It Works" },
];

function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showMenu) return;
    const handler = () => setShowMenu(false);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  if (!mounted) {
    return (
      <div style={{
        padding: "10px 20px", borderRadius: "10px", fontSize: "13px",
        background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)",
        color: "#4ade80", width: "120px", height: "38px",
      }} />
    );
  }

  if (isConnected && address) {
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const isWrongNetwork = chain?.id !== 84532; // Base Sepolia

    return (
      <div style={{ position: "relative" }} onMouseDown={(e) => e.stopPropagation()}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowMenu((v) => !v)}
          style={{
            padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
            background: isWrongNetwork
              ? "linear-gradient(135deg, #f59e0b, #d97706)"
              : "linear-gradient(135deg, #4ade80, #059669)",
            color: "#000", border: "none", cursor: "pointer",
            boxShadow: isWrongNetwork
              ? "0 0 20px rgba(245,158,11,0.2)"
              : "0 0 20px rgba(74,222,128,0.2)",
            fontFamily: "var(--font-space), sans-serif",
          }}
        >
          {isWrongNetwork ? `⚠ Wrong Network` : `● ${shortAddr}`}
        </motion.button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)",
                background: "#111", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px", padding: "8px", minWidth: "200px",
                zIndex: 200, boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
              }}
            >
              <div style={{
                padding: "8px 12px 10px", fontSize: "12px", color: "#555",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                fontFamily: "monospace",
              }}>
                {address.slice(0, 12)}...{address.slice(-8)}
              </div>

              <div style={{
                padding: "8px 12px", fontSize: "12px", color: "#444",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}>
                {chain?.name || "Unknown network"}
              </div>

              {isWrongNetwork && (
                <div style={{
                  padding: "8px 12px", fontSize: "12px", color: "#f59e0b",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}>
                  Please switch to Arbitrum Sepolia
                </div>
              )}

              <button
                onClick={() => { disconnect(); setShowMenu(false); }}
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: "8px", marginTop: "6px",
                  fontSize: "13px", fontWeight: 500, cursor: "pointer",
                  background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)",
                  color: "#f87171", textAlign: "left",
                  fontFamily: "var(--font-space), sans-serif",
                }}
              >
                Disconnect
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Not connected — show connect button
  const injectedConnector = connectors.find((c) => c.type === "injected") || connectors[0];

  return (
    <motion.button
      whileHover={{ scale: 1.03, boxShadow: "0 0 30px rgba(74,222,128,0.35)" }}
      whileTap={{ scale: 0.97 }}
      onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      style={{
        padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
        background: "linear-gradient(135deg, #4ade80, #059669)",
        color: "#000", border: "none", cursor: "pointer",
        boxShadow: "0 0 20px rgba(74,222,128,0.2)",
        fontFamily: "var(--font-space), sans-serif",
      }}
    >
      Connect Wallet
    </motion.button>
  );
}

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
          color: "white", margin: 0,
        }}>
          Neuro<span style={{ color: "#4ade80" }}>Cart</span>
        </h1>
      </Link>

      {/* Nav links */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
              <div style={{
                padding: "7px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
                color: isActive ? "#4ade80" : "#555",
                background: isActive ? "rgba(74,222,128,0.08)" : "transparent",
                border: isActive ? "1px solid rgba(74,222,128,0.15)" : "1px solid transparent",
                transition: "all 0.2s", cursor: "pointer",
                fontFamily: "var(--font-space), sans-serif",
              }}>
                {link.label}
              </div>
            </Link>
          );
        })}
      </div>

      <WalletButton />
    </motion.nav>
  );
}