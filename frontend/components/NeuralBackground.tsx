"use client";

import { useEffect, useRef } from "react";

type WanderParticle = {
  x: number; y: number;
  vx: number; vy: number;
  radius: number; opacity: number;
};

type SphereParticle = {
  x: number; y: number;
  ox: number; oy: number;
  vx: number; vy: number;
  radius: number; opacity: number;
  phase: number;

  // ── BARU: Random Walk state ──────────────────
  driftVx: number;   // arah drift acak saat ini
  driftVy: number;
  driftX: number;    // akumulasi offset drift dari ox/oy
  driftY: number;

  // ── BARU: Spontaneous Firing state ──────────
  fireT: number;     // timer nyala (0 = mati, >0 = sedang firing)
  fireMax: number;   // durasi firing (berbeda tiap node)
};

// ── Konstanta lama (tidak diubah) ─────────────
const WANDER_COUNT     = 70;
const WANDER_SPEED     = 0.4;
const WANDER_CONN_DIST = 180;
const WANDER_LINE_MAX  = 0.55;
const WANDER_DOT_MAX   = 0.9;

const SPHERE_COUNT     = 160;
const SPHERE_CONN_DIST = 180;
const SPHERE_RADIUS    = 0.58;
const FLOAT_AMPLITUDE  = 36;
const FLOAT_SPEED      = 0.0007;
const ROTATE_SPEED     = 0.0018;
const RETURN_STRENGTH  = 0.032;
const DAMPING          = 0.80;
const MOUSE_RADIUS     = 130;
const MOUSE_STRENGTH   = 3.0;

const DOT_COLOR  = "110, 231, 183";
const LINE_COLOR = "74, 222, 128";

// ── Konstanta BARU ────────────────────────────
const DRIFT_SPEED     = 0.18;   // kecepatan random walk tiap frame
const DRIFT_CHANGE    = 0.018;  // seberapa sering arah drift berubah (0–1)
const DRIFT_MAX_DIST  = 28;     // jarak maksimum drift dari posisi orbit

const FIRE_CHANCE     = 0.0008; // peluang per node per frame untuk mulai firing
const FIRE_DURATION   = 38;     // durasi firing dalam frame (~0.6 detik di 60fps)
const FIRE_RADIUS_ADD = 2.2;    // tambahan radius saat firing
const FIRE_GLOW       = 18;     // shadowBlur saat firing
const FIRE_OPACITY    = 0.95;   // opacity max saat firing

function randomSpherePoint(cx: number, cy: number, r: number) {
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  return {
    x: cx + r * Math.sin(phi) * Math.cos(theta),
    y: cy + r * Math.sin(phi) * Math.sin(theta) * 0.52,
  };
}

export default function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wanderers = useRef<WanderParticle[]>([]);
  const spherePts = useRef<SphereParticle[]>([]);
  const mouse     = useRef({ x: -9999, y: -9999 });
  const rafId     = useRef<number | null>(null);
  const tick      = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const init = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;

      wanderers.current = Array.from({ length: WANDER_COUNT }, () => ({
        x:       Math.random() * canvas.width,
        y:       Math.random() * canvas.height,
        vx:      (Math.random() - 0.5) * WANDER_SPEED,
        vy:      (Math.random() - 0.5) * WANDER_SPEED,
        radius:  Math.random() * 3 + 1.5,
        opacity: Math.random() * WANDER_DOT_MAX + 0.1,
      }));

      const cx = canvas.width  / 2;
      const cy = canvas.height / 2;
      const r  = Math.min(canvas.width, canvas.height) * SPHERE_RADIUS;

      spherePts.current = Array.from({ length: SPHERE_COUNT }, () => {
        const pos = randomSpherePoint(cx, cy, r);
        return {
          x: pos.x, y: pos.y,
          ox: pos.x, oy: pos.y,
          vx: 0, vy: 0,
          radius:  Math.random() * 2 + 0.8,
          opacity: Math.random() * 0.9 + 0.4,
          phase:   Math.random() * Math.PI * 2,

          // ── BARU: Random Walk ────────────────
          // Setiap node mulai dengan arah drift acak yang berbeda
          driftVx: (Math.random() - 0.5) * DRIFT_SPEED,
          driftVy: (Math.random() - 0.5) * DRIFT_SPEED,
          driftX:  0,
          driftY:  0,

          // ── BARU: Spontaneous Firing ─────────
          fireT:   0,
          fireMax: FIRE_DURATION * (0.7 + Math.random() * 0.6),
        };
      });
    };

    init();
    window.addEventListener("resize", init);

    const onMove  = (e: MouseEvent) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 }; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tick.current += 1;
      const mx = mouse.current.x;
      const my = mouse.current.y;

      // ── LAYER 1: Wanderers (tidak diubah) ──────────────────
      const wp = wanderers.current;
      for (const p of wp) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }
      for (let i = 0; i < wp.length; i++) {
        for (let j = i + 1; j < wp.length; j++) {
          const dx = wp[i].x - wp[j].x;
          const dy = wp[i].y - wp[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < WANDER_CONN_DIST) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${LINE_COLOR}, ${(1 - dist / WANDER_CONN_DIST) * WANDER_LINE_MAX})`;
            ctx.lineWidth = 1.2;
            ctx.moveTo(wp[i].x, wp[i].y);
            ctx.lineTo(wp[j].x, wp[j].y);
            ctx.stroke();
          }
        }
      }
      for (const p of wp) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${DOT_COLOR}, ${p.opacity})`;
        ctx.fill();
      }

      // ── LAYER 2: Sphere cluster ─────────────────────────────
      const sp = spherePts.current;

      for (const p of sp) {
        const cx = canvas.width  / 2;
        const cy = canvas.height / 2;
        const angle = tick.current * ROTATE_SPEED;
        const cosA  = Math.cos(angle);
        const sinA  = Math.sin(angle);
        const dx0   = p.ox - cx;
        const dy0   = p.oy - cy;
        const rotX  = cx + dx0 * cosA - dy0 * sinA;
        const rotY  = cy + dx0 * sinA + dy0 * cosA;

        const floatX = Math.sin(tick.current * FLOAT_SPEED * 1.3 + p.phase) * FLOAT_AMPLITUDE
                     + Math.sin(tick.current * FLOAT_SPEED * 0.7 + p.phase * 2.1) * FLOAT_AMPLITUDE * 0.5;
        const floatY = Math.cos(tick.current * FLOAT_SPEED * 0.9 + p.phase) * FLOAT_AMPLITUDE * 0.6
                     + Math.cos(tick.current * FLOAT_SPEED * 1.6 + p.phase * 1.7) * FLOAT_AMPLITUDE * 0.35;

        // ── BARU: Random Walk ──────────────────────────────────
        // Secara acak ubah arah drift (Brownian direction change)
        if (Math.random() < DRIFT_CHANGE) {
          p.driftVx += (Math.random() - 0.5) * DRIFT_SPEED * 0.6;
          p.driftVy += (Math.random() - 0.5) * DRIFT_SPEED * 0.6;

          // Clamp kecepatan drift agar tidak lari terlalu cepat
          const dSpeed = Math.sqrt(p.driftVx ** 2 + p.driftVy ** 2);
          if (dSpeed > DRIFT_SPEED) {
            p.driftVx = (p.driftVx / dSpeed) * DRIFT_SPEED;
            p.driftVy = (p.driftVy / dSpeed) * DRIFT_SPEED;
          }
        }

        // Akumulasi offset drift
        p.driftX += p.driftVx;
        p.driftY += p.driftVy;

        // Soft boundary: jika drift terlalu jauh, tarik balik perlahan
        const driftDist = Math.sqrt(p.driftX ** 2 + p.driftY ** 2);
        if (driftDist > DRIFT_MAX_DIST) {
          p.driftX *= 0.94;
          p.driftY *= 0.94;
          p.driftVx *= 0.85;
          p.driftVy *= 0.85;
        }
        // ── END Random Walk ────────────────────────────────────

        // Target posisi = rotasi + float (sinusoidal) + drift (random walk)
        const targetX = rotX + floatX + p.driftX;
        const targetY = rotY + floatY + p.driftY;

        const distToOrigin = Math.sqrt((p.x - targetX) ** 2 + (p.y - targetY) ** 2);
        const pullStrength = distToOrigin > 60 ? RETURN_STRENGTH * 2.5 : RETURN_STRENGTH;

        p.vx += (targetX - p.x) * pullStrength;
        p.vy += (targetY - p.y) * pullStrength;

        // Mouse repulsion (tidak diubah)
        const dxm = p.x - mx;
        const dym = p.y - my;
        const dm  = Math.sqrt(dxm * dxm + dym * dym);
        if (dm < MOUSE_RADIUS && dm > 0) {
          const f = (1 - dm / MOUSE_RADIUS) * MOUSE_STRENGTH;
          p.vx += (dxm / dm) * f;
          p.vy += (dym / dm) * f;
        }

        p.vx *= DAMPING; p.vy *= DAMPING;
        p.x  += p.vx;   p.y  += p.vy;

        // ── BARU: Spontaneous Firing ───────────────────────────
        if (p.fireT <= 0) {
          // peluang kecil setiap frame untuk mulai firing
          if (Math.random() < FIRE_CHANCE) {
            p.fireT = p.fireMax;
          }
        } else {
          p.fireT -= 1;
        }
        // ── END Spontaneous Firing ─────────────────────────────
      }

      // Gambar garis sinaps (tidak diubah, kecuali tambah boost dari firing)
      for (let i = 0; i < sp.length; i++) {
        for (let j = i + 1; j < sp.length; j++) {
          const dx   = sp[i].x - sp[j].x;
          const dy   = sp[i].y - sp[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < SPHERE_CONN_DIST) {
            const midX = (sp[i].x + sp[j].x) / 2;
            const midY = (sp[i].y + sp[j].y) / 2;
            const dm   = Math.sqrt((midX - mx) ** 2 + (midY - my) ** 2);
            const boost = dm < MOUSE_RADIUS ? (1 - dm / MOUSE_RADIUS) * 0.45 : 0;

            // ── BARU: garis ikut menyala jika salah satu ujungnya firing
            const isFiring = sp[i].fireT > 0 || sp[j].fireT > 0;
            const fireProgress = Math.max(
              sp[i].fireT / sp[i].fireMax,
              sp[j].fireT / sp[j].fireMax
            );
            const fireBrightness = isFiring
              ? Math.sin(fireProgress * Math.PI) * 0.5  // smooth pulse arc
              : 0;

            const lineAlpha = (1 - dist / SPHERE_CONN_DIST) * (0.65 + boost + fireBrightness);

            ctx.beginPath();
            ctx.strokeStyle = `rgba(${LINE_COLOR}, ${lineAlpha})`;
            ctx.lineWidth   = boost > 0.1 || isFiring ? 1.0 : 0.5;

            if (boost > 0.15 || isFiring) {
              ctx.shadowBlur  = isFiring ? 8 : 5;
              ctx.shadowColor = `rgba(${LINE_COLOR}, ${isFiring ? 0.55 : 0.35})`;
            }

            ctx.moveTo(sp[i].x, sp[i].y);
            ctx.lineTo(sp[j].x, sp[j].y);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      }

      // Gambar titik neuron
      for (const p of sp) {
        const dm   = Math.sqrt((p.x - mx) ** 2 + (p.y - my) ** 2);
        const glow = dm < MOUSE_RADIUS ? (1 - dm / MOUSE_RADIUS) : 0;

        // ── BARU: hitung boost visual dari firing
        const isFiring     = p.fireT > 0;
        const fireProgress = isFiring ? p.fireT / p.fireMax : 0;
        // smooth bell curve: menyala naik lalu turun
        const firePulse    = isFiring ? Math.sin(fireProgress * Math.PI) : 0;

        const finalRadius  = p.radius + glow * 1.2 + firePulse * FIRE_RADIUS_ADD;
        const finalOpacity = Math.min(p.opacity + glow * 0.25 + firePulse * (FIRE_OPACITY - p.opacity), 1);
        const finalGlow    = glow > 0.1
          ? 10 * glow
          : isFiring
            ? FIRE_GLOW * firePulse
            : 0;

        if (finalGlow > 0) {
          ctx.shadowBlur  = finalGlow;
          ctx.shadowColor = `rgba(${DOT_COLOR}, ${isFiring ? firePulse * 0.9 : glow * 0.7})`;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, finalRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${DOT_COLOR}, ${finalOpacity})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      rafId.current = requestAnimationFrame(draw);
    };

    rafId.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", init);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 1 }}
    />
  );
}