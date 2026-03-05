"use client";

import { useEffect, useRef } from "react";

// ── TYPES ──────────────────────────────────────────────────────
type WanderParticle = {
  x: number; y: number;
  vx: number; vy: number;
  radius: number; opacity: number;
};

type SphereParticle = {
  // posisi 3D di ruang lokal sphere (sebelum rotasi)
  lx: number; ly: number; lz: number;

  // random walk velocity dalam ruang 3D
  wvx: number; wvy: number; wvz: number;

  // posisi layar hasil proyeksi
  sx: number; sy: number;

  // depth factor untuk efek perspektif (0=belakang, 1=depan)
  depth: number;

  radius: number;
  opacity: number;
  phase: number;

  // spontaneous firing
  fireT: number;
  fireMax: number;
};

// ── WANDERER CONSTANTS (tidak diubah) ─────────────────────────
const WANDER_COUNT     = 70;
const WANDER_SPEED     = 0.4;
const WANDER_CONN_DIST = 180;
const WANDER_LINE_MAX  = 0.55;
const WANDER_DOT_MAX   = 0.9;

// ── SPHERE CONSTANTS ───────────────────────────────────────────
const SPHERE_COUNT     = 160;
const SPHERE_CONN_DIST = 160;
const SPHERE_RADIUS    = 0.30;     // radius globe relatif terhadap layar

// Rotasi otomatis globe
const ROT_X_SPEED      = 0.0006;   // kemiringan atas-bawah
const ROT_Y_SPEED      = 0.0014;   // putaran kiri-kanan

// Random walk per dot (dalam ruang 3D)
const WALK_SPEED       = 0.012;    // kecepatan wander
const WALK_CHANGE      = 0.022;    // peluang ubah arah tiap frame
const WALK_MAX_OFFSET  = 0.18;     // max offset dari posisi asal (fraksi radius)

// Mouse
const MOUSE_RADIUS     = 130;
const MOUSE_STRENGTH   = 2.8;
const DAMPING          = 0.82;

// Spontaneous firing
const FIRE_CHANCE      = 0.0009;
const FIRE_DURATION    = 40;
const FIRE_RADIUS_ADD  = 2.0;
const FIRE_GLOW        = 16;

// Perspektif
const PERSPECTIVE      = 2.2;      // makin besar = makin flat

// Warna
const DOT_COLOR        = "110, 231, 183";
const LINE_COLOR       = "74, 222, 128";

// ── HELPER: rotasi 3D (Rx lalu Ry) ────────────────────────────
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

// ── HELPER: proyeksi 3D → 2D dengan perspektif ────────────────
function project(
  x: number, y: number, z: number,
  cx: number, cy: number,
  r: number
): { sx: number; sy: number; depth: number } {
  const scale = PERSPECTIVE / (PERSPECTIVE + z / r);
  return {
    sx:    cx + x * scale,
    sy:    cy + y * scale,
    depth: (z / r + 1) / 2,   // 0 = paling belakang, 1 = paling depan
  };
}

export default function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wanderers = useRef<WanderParticle[]>([]);
  const spherePts = useRef<SphereParticle[]>([]);
  const mouse     = useRef({ x: -9999, y: -9999 });
  const rafId     = useRef<number | null>(null);
  const tick      = useRef(0);
  const rotX      = useRef(0.3);  // sedikit miring ke depan agar tampak 3D
  const rotY      = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const init = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;

      // ── Wanderers (tidak diubah) ──────────────────────────
      wanderers.current = Array.from({ length: WANDER_COUNT }, () => ({
        x:       Math.random() * canvas.width,
        y:       Math.random() * canvas.height,
        vx:      (Math.random() - 0.5) * WANDER_SPEED,
        vy:      (Math.random() - 0.5) * WANDER_SPEED,
        radius:  Math.random() * 3 + 1.5,
        opacity: Math.random() * WANDER_DOT_MAX + 0.1,
      }));

      // ── Sphere dots: posisi awal di PERMUKAAN bola ────────
      const r = Math.min(canvas.width, canvas.height) * SPHERE_RADIUS;
      spherePts.current = Array.from({ length: SPHERE_COUNT }, () => {
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        return {
          lx: r * Math.sin(phi) * Math.cos(theta),
          ly: r * Math.sin(phi) * Math.sin(theta),
          lz: r * Math.cos(phi),

          wvx: (Math.random() - 0.5) * WALK_SPEED,
          wvy: (Math.random() - 0.5) * WALK_SPEED,
          wvz: (Math.random() - 0.5) * WALK_SPEED,

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

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tick.current += 1;
      const mx = mouse.current.x;
      const my = mouse.current.y;
      const cx = canvas.width  / 2;
      const cy = canvas.height / 2;
      const r  = Math.min(canvas.width, canvas.height) * SPHERE_RADIUS;

      // update sudut rotasi globe
      rotX.current += ROT_X_SPEED;
      rotY.current += ROT_Y_SPEED;

      // ── LAYER 1: Wanderers (tidak diubah sama sekali) ──────
      const wp = wanderers.current;
      for (const p of wp) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }
      for (let i = 0; i < wp.length; i++) {
        for (let j = i + 1; j < wp.length; j++) {
          const dx   = wp[i].x - wp[j].x;
          const dy   = wp[i].y - wp[j].y;
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

      // ── LAYER 2: Sphere cluster 3D ─────────────────────────
      const sp = spherePts.current;

      // Step 1: update posisi 3D + proyeksi ke layar
      for (const p of sp) {

        // Random Walk: sesekali ubah arah
        if (Math.random() < WALK_CHANGE) {
          p.wvx += (Math.random() - 0.5) * WALK_SPEED * 0.5;
          p.wvy += (Math.random() - 0.5) * WALK_SPEED * 0.5;
          p.wvz += (Math.random() - 0.5) * WALK_SPEED * 0.5;
          // clamp kecepatan maksimum
          const spd = Math.sqrt(p.wvx**2 + p.wvy**2 + p.wvz**2);
          if (spd > WALK_SPEED) {
            p.wvx = (p.wvx/spd) * WALK_SPEED;
            p.wvy = (p.wvy/spd) * WALK_SPEED;
            p.wvz = (p.wvz/spd) * WALK_SPEED;
          }
        }

        // Gerakkan posisi 3D
        p.lx += p.wvx;
        p.ly += p.wvy;
        p.lz += p.wvz;

        // Boundary spherical: jaga dot dalam rentang permukaan bola
        const dist3D = Math.sqrt(p.lx**2 + p.ly**2 + p.lz**2);
        const maxR   = r * (1 + WALK_MAX_OFFSET);
        const minR   = r * (1 - WALK_MAX_OFFSET);

        if (dist3D > maxR) {
          // pantulkan ke dalam
          const s  = maxR / dist3D;
          p.lx *= s; p.ly *= s; p.lz *= s;
          const nx = p.lx/maxR, ny = p.ly/maxR, nz = p.lz/maxR;
          const dot = p.wvx*nx + p.wvy*ny + p.wvz*nz;
          p.wvx -= 2*dot*nx;
          p.wvy -= 2*dot*ny;
          p.wvz -= 2*dot*nz;
        }
        if (dist3D < minR && dist3D > 0) {
          // dorong keluar
          const s = minR / dist3D;
          p.lx *= s; p.ly *= s; p.lz *= s;
        }

        // Rotasi globe + proyeksi perspektif
        const [rx, ry, rz] = rotate3D(p.lx, p.ly, p.lz, rotX.current, rotY.current);
        const proj = project(rx, ry, rz, cx, cy, r);
        p.sx    = proj.sx;
        p.sy    = proj.sy;
        p.depth = proj.depth;

        // Mouse repulsion (dalam layar → balik ke 3D approx)
        const dxm = p.sx - mx;
        const dym = p.sy - my;
        const dm  = Math.sqrt(dxm**2 + dym**2);
        if (dm < MOUSE_RADIUS && dm > 0) {
          const f = (1 - dm / MOUSE_RADIUS) * MOUSE_STRENGTH;
          p.wvx  += (dxm / dm) * f * 0.4;
          p.wvy  += (dym / dm) * f * 0.4;
        }
        p.wvx *= DAMPING;
        p.wvy *= DAMPING;
        p.wvz *= DAMPING;

        // Spontaneous Firing
        if (p.fireT <= 0) {
          if (Math.random() < FIRE_CHANCE) p.fireT = p.fireMax;
        } else {
          p.fireT -= 1;
        }
      }

      // Step 2: sort by depth — jauh dulu, dekat belakangan
      // agar dot depan menimpa dot belakang (efek 3D nyata)
      const sorted = [...sp].sort((a, b) => a.depth - b.depth);

      // Step 3: gambar garis sinaps
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const a = sorted[i], b = sorted[j];
          const dx   = a.sx - b.sx;
          const dy   = a.sy - b.sy;
          const dist = Math.sqrt(dx**2 + dy**2);
          if (dist > SPHERE_CONN_DIST) continue;

          const proximity = 1 - dist / SPHERE_CONN_DIST;
          const depthAvg  = (a.depth + b.depth) / 2;

          // mouse boost
          const midX  = (a.sx + b.sx) / 2;
          const midY  = (a.sy + b.sy) / 2;
          const dm    = Math.sqrt((midX-mx)**2 + (midY-my)**2);
          const boost = dm < MOUSE_RADIUS ? (1 - dm/MOUSE_RADIUS) * 0.5 : 0;

          // firing boost
          const isFiring = a.fireT > 0 || b.fireT > 0;
          const fireP    = Math.max(
            a.fireT / a.fireMax,
            b.fireT / b.fireMax
          );
          const fireBst  = isFiring ? Math.sin(fireP * Math.PI) * 0.45 : 0;

          // makin jauh (depth rendah) makin redup — efek 3D
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

      // Step 4: gambar titik neuron
      for (const p of sorted) {
        const dm   = Math.sqrt((p.sx-mx)**2 + (p.sy-my)**2);
        const glow = dm < MOUSE_RADIUS ? (1 - dm/MOUSE_RADIUS) : 0;

        const isFiring  = p.fireT > 0;
        const fireP     = isFiring ? p.fireT / p.fireMax : 0;
        const firePulse = isFiring ? Math.sin(fireP * Math.PI) : 0;

        // dot depan lebih besar & lebih cerah (perspektif)
        const depthScale   = 0.4 + p.depth * 0.9;
        const finalRadius  = (p.radius * depthScale) + glow * 1.2 + firePulse * FIRE_RADIUS_ADD;
        const finalOpacity = Math.min(
          (p.opacity * (0.25 + p.depth * 0.8)) + glow * 0.3 + firePulse * 0.4,
          1
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