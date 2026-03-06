"use client";

import { useEffect, useRef, useState } from "react";

interface OpeningProps {
  onComplete: () => void;
}

export default function Opening({ onComplete }: OpeningProps) {
  const [step, setStep]       = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [done, setDone]       = useState(false);
  const [barW, setBarW]       = useState(0);       // progress bar 0-100
  const [hashIdx, setHashIdx] = useState(0);       // cycling hash string
  const rafRef                = useRef<number | null>(null);

  // ── Hash strings — simulasi on-chain verification ─────────
  const HASHES = [
    "0x4a3f...c91b",
    "0x7e12...08fa",
    "0xb3d9...5521",
    "0x0c6a...ef44",
    "VERIFIED ✓",
  ];

  useEffect(() => {
    let startT = performance.now();
    const DURATION = 2600; // total loading bar duration (ms)

    // ── Progress bar animasi ──────────────────────────────────
    const animBar = (now: number) => {
      const p = Math.min((now - startT) / DURATION, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setBarW(eased * 100);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(animBar);
      }
    };
    rafRef.current = requestAnimationFrame(animBar);

    // ── Hash cycling tiap 420ms ───────────────────────────────
    let hi = 0;
    const hashInterval = setInterval(() => {
      hi = Math.min(hi + 1, HASHES.length - 1);
      setHashIdx(hi);
    }, 420);

    // ── Sequence steps ────────────────────────────────────────
    // step 0: logo + bar muncul
    // step 1: bar selesai → status "VERIFIED"
    // step 2: semua fade up → website reveal

    const t1 = setTimeout(() => setStep(1), DURATION);
    const t2 = setTimeout(() => setStep(2), DURATION + 500);

    // fade out
    const t3 = setTimeout(() => {
      let fs = performance.now();
      const fade = (now: number) => {
        const p = Math.min((now - fs) / 480, 1);
        setOpacity(1 - p);
        if (p < 1) requestAnimationFrame(fade);
        else { setDone(true); onComplete(); }
      };
      requestAnimationFrame(fade);
    }, DURATION + 900);

    return () => {
      clearInterval(hashInterval);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onComplete]);

  if (done) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Syne:wght@700;900&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(0.95); opacity: 0.6; }
          100% { transform: scale(1.18); opacity: 0; }
        }
      `}</style>

      <div style={{
        position:   "fixed", inset: 0, zIndex: 9999,
        background: "#010603",
        display:    "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        opacity,
        transition: "opacity 0.08s linear",
        pointerEvents: opacity < 0.05 ? "none" : "all",
        fontFamily: "'Share Tech Mono', monospace",
      }}>

        {/* ── Subtle grid background ───────────────────────── */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `
            linear-gradient(rgba(0,255,156,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,156,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "72px 72px",
        }} />

        {/* ── Corner marks ─────────────────────────────────── */}
        {(["tl","tr","bl","br"] as const).map(c => (
          <div key={c} style={{
            position: "absolute",
            width: 20, height: 20,
            ...(c.includes("t") ? { top: 24 }    : { bottom: 24 }),
            ...(c.includes("l") ? { left: 24 }   : { right: 24 }),
            transform: `scale(${c.includes("r") ? -1 : 1},${c.includes("b") ? -1 : 1})`,
          }}>
            <div style={{ position:"absolute", top:0, left:0, width:"100%", height:1, background:"rgba(0,255,156,0.5)" }} />
            <div style={{ position:"absolute", top:0, left:0, width:1, height:"100%", background:"rgba(0,255,156,0.5)" }} />
          </div>
        ))}

        {/* ── Center content ────────────────────────────────── */}
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 0,
          animation: "fadeUp 0.6s ease both",
        }}>

          {/* Logo image */}
          <div style={{ position: "relative", marginBottom: 32 }}>
            {/* Pulse ring saat verified */}
            {step >= 1 && (
              <div style={{
                position: "absolute", inset: -14,
                border: "1px solid rgba(0,255,156,0.35)",
                borderRadius: "16px",
                animation: "pulse-ring 1s ease-out forwards",
              }} />
            )}

            {/* Logo wrapper — subtle glow saat verified */}
            <div style={{
              width: 72, height: 72,
              borderRadius: "14px",
              overflow: "hidden",
              boxShadow: step >= 1
                ? "0 0 24px rgba(0,255,156,0.25), 0 0 60px rgba(0,255,156,0.1)"
                : "none",
              border: `1px solid ${step >= 1 ? "rgba(0,255,156,0.2)" : "rgba(255,255,255,0.06)"}`,
              transition: "all 0.5s ease",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="NeuroCart"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          </div>

          {/* Wordmark */}
          <div style={{
            fontSize: "clamp(22px, 3vw, 28px)",
            fontFamily: "'Syne', sans-serif",
            fontWeight: 900,
            letterSpacing: "0.18em",
            color: "#ffffff",
            marginBottom: 6,
          }}>
            NEURO<span style={{ color: "rgba(0,255,156,0.8)" }}>CART</span>
          </div>

          {/* Tagline */}
          <div style={{
            fontSize: "8px",
            letterSpacing: "0.32em",
            color: "rgba(110,231,183,0.35)",
            marginBottom: 52,
            textTransform: "uppercase",
          }}>
            The Future Is Autonomous
          </div>

          {/* ── Progress bar ──────────────────────────────────── */}
          <div style={{ width: "min(320px, 70vw)", marginBottom: 16 }}>
            {/* Track */}
            <div style={{
              width: "100%", height: 1,
              background: "rgba(0,255,156,0.1)",
              position: "relative", overflow: "hidden",
            }}>
              {/* Fill */}
              <div style={{
                position: "absolute", top: 0, left: 0,
                height: "100%",
                width: `${barW}%`,
                background: step >= 1
                  ? "#00ff9c"
                  : "linear-gradient(90deg, rgba(0,255,156,0.4), #00ff9c)",
                boxShadow: "0 0 8px rgba(0,255,156,0.6)",
                transition: "background 0.3s ease",
              }} />
            </div>
          </div>

          {/* ── Status row ────────────────────────────────────── */}
          <div style={{
            width: "min(320px, 70vw)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            {/* Hash / verified */}
            <span style={{
              fontSize: "10px",
              letterSpacing: "0.08em",
              color: step >= 1 ? "#00ff9c" : "rgba(0,255,156,0.4)",
              transition: "color 0.3s ease",
              fontFamily: "'Share Tech Mono', monospace",
            }}>
              {HASHES[hashIdx]}
            </span>

            {/* Percentage */}
            <span style={{
              fontSize: "10px",
              letterSpacing: "0.12em",
              color: "rgba(0,255,156,0.35)",
            }}>
              {step >= 1 ? "100%" : `${Math.round(barW)}%`}
            </span>
          </div>

          {/* ── Network info ───────────────────────────────────── */}
          <div style={{
            marginTop: 40,
            display: "flex", gap: 24,
            opacity: step >= 1 ? 1 : 0,
            transform: step >= 1 ? "translateY(0)" : "translateY(6px)",
            transition: "all 0.5s ease",
          }}>
            {[
              { label: "NETWORK",  value: "BASE SEPOLIA" },
              { label: "PROTOCOL", value: "ERC-8004"     },
              { label: "ORACLE",   value: "CHAINLINK"    },
            ].map(item => (
              <div key={item.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "8px", letterSpacing: "0.2em", color: "rgba(0,255,156,0.3)", marginBottom: 4 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "9px", letterSpacing: "0.12em", color: "rgba(0,255,156,0.7)" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom: block number ticker ──────────────────── */}
        <div style={{
          position: "absolute", bottom: 28,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "#00ff9c",
            boxShadow: "0 0 8px #00ff9c",
            animation: "blink 1.2s ease-in-out infinite",
          }} />
          <span style={{
            fontSize: "9px", letterSpacing: "0.2em",
            color: "rgba(0,255,156,0.4)",
          }}>
            BLOCK #21,847,{String(Math.floor(Date.now() / 1000) % 1000).padStart(3,"0")}
          </span>
        </div>

      </div>
    </>
  );
}