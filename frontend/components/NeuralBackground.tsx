"use client";

import { useEffect, useRef } from "react";

// ── TYPES ──────────────────────────────────────────────────────
type WanderParticle = {
  x: number; y: number;
  vx: number; vy: number;
  radius: number; opacity: number;
};

type SphereParticle = {
  lx: number; ly: number; lz: number;   // posisi 3D lokal
  wvx: number; wvy: number; wvz: number; // walk velocity 3D
  sx: number; sy: number;                // posisi layar (proyeksi)
  depth: number;                         // 0=belakang, 1=depan
  radius: number;
  opacity: number;
  phase: number;
  fireT: number;    // timer firing (detik)
  fireMax: number;  // durasi firing (detik)
};

// ── WANDERER CONSTANTS ─────────────────────────────────────────
const WANDER_COUNT     = 70;
const WANDER_SPEED     = 24;           // px/detik (bukan px/frame)
const WANDER_CONN_DIST = 180;
const WANDER_LINE_MAX  = 0.55;
const WANDER_DOT_MAX   = 0.9;

// ── SPHERE CONSTANTS ───────────────────────────────────────────
const SPHERE_COUNT     = 130;
const SPHERE_CONN_DIST = 140;
const SPHERE_RADIUS    = 0.30;

// Rotasi globe — radian/detik
const ROT_X_SPEED      = 0.055;
const ROT_Y_SPEED      = 0.13;

// Random walk — unit/detik
const WALK_SPEED       = 1.4;          // kecepatan max drift
const WALK_CHANGE_RATE = 2.0;          // perubahan arah per detik (Poisson rate)
const WALK_MAX_OFFSET  = 0.18;

// Mouse
const MOUSE_RADIUS     = 130;
const MOUSE_STRENGTH   = 18;           // impulse/detik (lebih halus)
const MOUSE_GLOBE_PUSH = 12;           // kekuatan dorong saat cursor di dalam globe
const DAMPING          = 0.012;        // time constant (bukan per-frame)

// Firing — dalam detik
const FIRE_RATE        = 0.055;        // event/detik per node
const FIRE_DURATION    = 0.65;
const FIRE_RADIUS_ADD  = 2.0;
const FIRE_GLOW        = 16;

// Perspektif
const PERSPECTIVE      = 2.2;

// Warna
const DOT_COLOR        = "110, 231, 183";
const LINE_COLOR       = "74, 222, 128";

// ── HELPERS ────────────────────────────────────────────────────
function rotate3D(
  x: number, y: number, z: number,
  rx: number, ry: number
): [number, number, number] {
  const y1 =  y * Math.cos(rx) - z * Math.sin(rx);
  const z1 =  y * Math.sin(rx) + z * Math.cos(rx);
  const x2 =  x * Math.cos(ry) + z1 * Math.sin(ry);
  const z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
  return [x2, y1, z2];
}

function project(
  x: number, y: number, z: number,
  cx: number, cy: number, r: number
): { sx: number; sy: number; depth: number } {
  const scale = PERSPECTIVE / (PERSPECTIVE + z / r);
  return {
    sx:    cx + x * scale,
    sy:    cy + y * scale,
    depth: (z / r + 1) / 2,
  };
}

export default function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wanderers = useRef<WanderParticle[]>([]);
  const spherePts = useRef<SphereParticle[]>([]);
  const mouse     = useRef({ x: -9999, y: -9999 });
  const rafId     = useRef<number | null>(null);
  const lastTime  = useRef<number>(0);   // ← timestamp frame sebelumnya
  const frameN    = useRef(0);
  const rotX      = useRef(0.3);
  const rotY      = useRef(0);

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
        vx:      (Math.random() - 0.5) * 2 * WANDER_SPEED,
        vy:      (Math.random() - 0.5) * 2 * WANDER_SPEED,
        radius:  Math.random() * 3 + 1.5,
        opacity: Math.random() * WANDER_DOT_MAX + 0.1,
      }));

      const r = Math.min(canvas.width, canvas.height) * SPHERE_RADIUS;
      spherePts.current = Array.from({ length: SPHERE_COUNT }, () => {
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        return {
          lx: r * Math.sin(phi) * Math.cos(theta),
          ly: r * Math.sin(phi) * Math.sin(theta),
          lz: r * Math.cos(phi),
          wvx: (Math.random() - 0.5) * 2 * WALK_SPEED,
          wvy: (Math.random() - 0.5) * 2 * WALK_SPEED,
          wvz: (Math.random() - 0.5) * 2 * WALK_SPEED,
          sx: 0, sy: 0, depth: 0.5,
          radius:  Math.random() * 2 + 0.8,
          opacity: Math.random() * 0.7 + 0.3,
          phase:   Math.random() * Math.PI * 2,
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

    const draw = (timestamp: number) => {
      // ── DELTA TIME ──────────────────────────────────────────
      // dt dalam detik, clamp max 0.1s agar tidak loncat saat tab idle
      const dt = Math.min((timestamp - lastTime.current) / 1000, 0.1);
      lastTime.current = timestamp;
      // skip frame pertama (dt akan sangat besar)
      if (dt <= 0) { rafId.current = requestAnimationFrame(draw); return; }

      frameN.current += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mx = mouse.current.x;
      const my = mouse.current.y;
      const cx = canvas.width  / 2 + canvas.width * 0.18;
      const cy = canvas.height / 2;
      const r  = Math.min(canvas.width, canvas.height) * SPHERE_RADIUS;

      // rotasi berbasis waktu nyata (radian/detik × dt)
      rotX.current += ROT_X_SPEED * dt;
      rotY.current += ROT_Y_SPEED * dt;

      // ── LAYER 1: Wanderers ────────────────────────────────
      const wp = wanderers.current;
      for (const p of wp) {
        // gerak berbasis dt (px/detik)
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }
      const wConnD2 = WANDER_CONN_DIST * WANDER_CONN_DIST;
      for (let i = 0; i < wp.length; i++) {
        for (let j = i + 1; j < wp.length; j++) {
          const dx = wp[i].x - wp[j].x;
          const dy = wp[i].y - wp[j].y;
          if (dx*dx + dy*dy > wConnD2) continue;
          const dist = Math.sqrt(dx*dx + dy*dy);
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${LINE_COLOR}, ${(1 - dist / WANDER_CONN_DIST) * WANDER_LINE_MAX})`;
          ctx.lineWidth = 1.2;
          ctx.moveTo(wp[i].x, wp[i].y);
          ctx.lineTo(wp[j].x, wp[j].y);
          ctx.stroke();
        }
      }
      for (const p of wp) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${DOT_COLOR}, ${p.opacity})`;
        ctx.fill();
      }

      // ── LAYER 2: Sphere cluster 3D ────────────────────────
      const sp = spherePts.current;

      // exponential damping yang benar berbasis dt
      // damping = e^(-DAMPING * dt) → kecepatan berkurang konsisten
      const dampFactor = Math.exp(-8 * dt);   // ~8 = time constant

      for (const p of sp) {

        // Random Walk: peluang ubah arah berbasis Poisson (rate × dt)
        if (Math.random() < WALK_CHANGE_RATE * dt) {
          p.wvx += (Math.random() - 0.5) * WALK_SPEED * 0.8;
          p.wvy += (Math.random() - 0.5) * WALK_SPEED * 0.8;
          p.wvz += (Math.random() - 0.5) * WALK_SPEED * 0.8;
          // clamp kecepatan
          const spd = Math.sqrt(p.wvx**2 + p.wvy**2 + p.wvz**2);
          if (spd > WALK_SPEED) {
            p.wvx = (p.wvx/spd) * WALK_SPEED;
            p.wvy = (p.wvy/spd) * WALK_SPEED;
            p.wvz = (p.wvz/spd) * WALK_SPEED;
          }
        }

        // integrasi posisi (unit/detik × dt)
        p.lx += p.wvx * dt;
        p.ly += p.wvy * dt;
        p.lz += p.wvz * dt;

        // Boundary spherical
        const dist3D = Math.sqrt(p.lx**2 + p.ly**2 + p.lz**2);
        const maxR   = r * (1 + WALK_MAX_OFFSET);
        const minR   = r * (1 - WALK_MAX_OFFSET);

        if (dist3D > maxR) {
          const s  = maxR / dist3D;
          p.lx *= s; p.ly *= s; p.lz *= s;
          const nx = p.lx/maxR, ny = p.ly/maxR, nz = p.lz/maxR;
          const dot = p.wvx*nx + p.wvy*ny + p.wvz*nz;
          p.wvx -= 2*dot*nx;
          p.wvy -= 2*dot*ny;
          p.wvz -= 2*dot*nz;
        }
        if (dist3D < minR && dist3D > 0) {
          const s = minR / dist3D;
          p.lx *= s; p.ly *= s; p.lz *= s;
        }

        // Rotasi + proyeksi
        const [rx, ry, rz] = rotate3D(p.lx, p.ly, p.lz, rotX.current, rotY.current);
        const proj = project(rx, ry, rz, cx, cy, r);
        p.sx    = proj.sx;
        p.sy    = proj.sy;
        p.depth = proj.depth;

        // Mouse repulsion — sama seperti versi asli, tanpa dt
        const dxm = p.sx - mx;
        const dym = p.sy - my;
        const dm  = Math.sqrt(dxm**2 + dym**2);
        if (dm < MOUSE_RADIUS && dm > 0) {
          const f = (1 - dm / MOUSE_RADIUS) * MOUSE_STRENGTH;
          p.wvx  += (dxm / dm) * f * dt;
          p.wvy  += (dym / dm) * f * dt;
        }

        // Cursor di dalam globe → semua dot menjauh dari kursor
        // Cek apakah cursor berada di dalam radius globe (proyeksi 2D)
        const dxGlobe = mx - cx;
        const dyGlobe = my - cy;
        const distFromCenter = Math.sqrt(dxGlobe**2 + dyGlobe**2);
        if (distFromCenter < r) {
          // cursor ada di dalam globe — dorong dot menjauh dari kursor
          if (dm > 0) {
            // kekuatan push makin kuat makin dekat ke kursor
            const pushF = (1 - Math.min(dm / (r * 1.2), 1)) * MOUSE_GLOBE_PUSH;
            p.wvx += (dxm / dm) * pushF * dt;
            p.wvy += (dym / dm) * pushF * dt;
          }
        }

        // Damping exponential — konsisten di semua frame rate
        p.wvx *= dampFactor;
        p.wvy *= dampFactor;
        p.wvz *= dampFactor;

        // Spontaneous Firing — timer dalam detik
        if (p.fireT <= 0) {
          // Poisson: peluang = rate × dt
          if (Math.random() < FIRE_RATE * dt) p.fireT = p.fireMax;
        } else {
          p.fireT -= dt;  // countdown dalam detik
        }
      }

      // Sort depth setiap 2 frame (30fps cukup untuk depth ordering)
      if (frameN.current % 2 === 0) {
        sp.sort((a, b) => a.depth - b.depth);
      }

      // Gambar garis sinaps
      const connDist2 = SPHERE_CONN_DIST * SPHERE_CONN_DIST;
      const mousR2    = MOUSE_RADIUS * MOUSE_RADIUS;

      for (let i = 0; i < sp.length; i++) {
        for (let j = i + 1; j < sp.length; j++) {
          const a = sp[i], b = sp[j];
          const dx    = a.sx - b.sx;
          const dy    = a.sy - b.sy;
          const dist2 = dx*dx + dy*dy;
          if (dist2 > connDist2) continue;

          const dist      = Math.sqrt(dist2);
          const proximity = 1 - dist / SPHERE_CONN_DIST;
          const depthAvg  = (a.depth + b.depth) / 2;

          const midX  = (a.sx + b.sx) / 2;
          const midY  = (a.sy + b.sy) / 2;
          const md2   = (midX-mx)**2 + (midY-my)**2;
          const boost = md2 < mousR2 ? (1 - md2/mousR2) * 0.5 : 0;

          const isFiring = a.fireT > 0 || b.fireT > 0;
          const fireP    = Math.max(a.fireT/a.fireMax, b.fireT/b.fireMax);
          const fireBst  = isFiring ? Math.sin(Math.max(fireP,0) * Math.PI) * 0.45 : 0;

          const alpha = proximity * (0.2 + depthAvg * 0.6 + boost + fireBst);

          ctx.beginPath();
          ctx.strokeStyle = `rgba(${LINE_COLOR}, ${Math.min(alpha, 0.95)})`;
          ctx.lineWidth   = 0.5 + depthAvg * 0.8 + boost * 0.5;

          if (boost > 0.15 || isFiring) {
            ctx.shadowBlur  = isFiring ? 7 : 4;
            ctx.shadowColor = `rgba(${LINE_COLOR}, 0.4)`;
          }

          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // Gambar titik neuron
      for (const p of sp) {
        const dxm  = p.sx - mx, dym = p.sy - my;
        const dm2  = dxm*dxm + dym*dym;
        const glow = dm2 < mousR2 ? (1 - dm2/mousR2) : 0;

        const isFiring  = p.fireT > 0;
        const fireP     = isFiring ? p.fireT / p.fireMax : 0;
        const firePulse = isFiring ? Math.sin(Math.max(fireP,0) * Math.PI) : 0;

        const depthScale   = 0.4 + p.depth * 0.9;
        const finalRadius  = (p.radius * depthScale) + glow * 1.2 + firePulse * FIRE_RADIUS_ADD;
        const finalOpacity = Math.min(
          (p.opacity * (0.25 + p.depth * 0.8)) + glow * 0.3 + firePulse * 0.4, 1
        );
        const glowBlur = glow > 0.1 ? 10*glow : isFiring ? FIRE_GLOW*firePulse : 0;

        if (glowBlur > 0) {
          ctx.shadowBlur  = glowBlur;
          ctx.shadowColor = `rgba(${DOT_COLOR}, ${isFiring ? firePulse*0.85 : glow*0.7})`;
        }

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, Math.max(finalRadius, 0.3), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${DOT_COLOR}, ${finalOpacity})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      rafId.current = requestAnimationFrame(draw);
    };

    // pass timestamp pertama
    rafId.current = requestAnimationFrame((t) => {
      lastTime.current = t;
      rafId.current = requestAnimationFrame(draw);
    });

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