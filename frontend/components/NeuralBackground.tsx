"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number; y: number;
  ox: number; oy: number; // origin (resting position on sphere)
  vx: number; vy: number;
  radius: number;
  opacity: number;
  phase: number; // for floating offset
};

const PARTICLE_COUNT   = 90;
const CONNECTION_DIST  = 140;
const DOT_COLOR        = "110, 231, 183";
const LINE_COLOR       = "74, 222, 128";
const DOT_OPACITY_MAX  = 0.85;
const LINE_OPACITY_MAX = 0.22;
const SPHERE_RADIUS    = 0.28; // fraction of min(width, height)
const FLOAT_SPEED      = 0.0008;
const FLOAT_AMPLITUDE  = 18;
const RETURN_STRENGTH  = 0.035;
const MOUSE_RADIUS     = 120;
const MOUSE_STRENGTH   = 2.8;
const DAMPING          = 0.82;

function onSphere(cx: number, cy: number, r: number): { x: number; y: number } {
  // Distribute points on a 2D projection of a sphere using fibonacci spiral
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  return {
    x: cx + r * Math.sin(phi) * Math.cos(theta),
    y: cy + r * Math.sin(phi) * Math.sin(theta) * 0.55, // flatten Y for perspective
  };
}

export default function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const mouse     = useRef({ x: -9999, y: -9999 });
  const rafId     = useRef<number | null>(null);
  const t         = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      const cx = canvas.width  / 2;
      const cy = canvas.height / 2;
      const r  = Math.min(canvas.width, canvas.height) * SPHERE_RADIUS;

      particles.current = Array.from({ length: PARTICLE_COUNT }, () => {
        const pos = onSphere(cx, cy, r);
        return {
          x: pos.x, y: pos.y,
          ox: pos.x, oy: pos.y,
          vx: 0, vy: 0,
          radius:  Math.random() * 2.2 + 1,
          opacity: Math.random() * DOT_OPACITY_MAX + 0.15,
          phase:   Math.random() * Math.PI * 2,
        };
      });
    };

    resize();
    window.addEventListener("resize", resize);

    const onMouseMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseLeave = () => {
      mouse.current = { x: -9999, y: -9999 };
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t.current += 1;

      const pts = particles.current;
      const mx  = mouse.current.x;
      const my  = mouse.current.y;

      // Update positions
      for (const p of pts) {
        // Floating motion around origin
        const floatX = Math.sin(t.current * FLOAT_SPEED + p.phase) * FLOAT_AMPLITUDE;
        const floatY = Math.cos(t.current * FLOAT_SPEED * 0.7 + p.phase) * FLOAT_AMPLITUDE * 0.5;
        const targetX = p.ox + floatX;
        const targetY = p.oy + floatY;

        // Spring return to floating target
        p.vx += (targetX - p.x) * RETURN_STRENGTH;
        p.vy += (targetY - p.y) * RETURN_STRENGTH;

        // Mouse repulsion
        const dxm  = p.x - mx;
        const dym  = p.y - my;
        const distM = Math.sqrt(dxm * dxm + dym * dym);
        if (distM < MOUSE_RADIUS && distM > 0) {
          const force = (1 - distM / MOUSE_RADIUS) * MOUSE_STRENGTH;
          p.vx += (dxm / distM) * force;
          p.vy += (dym / distM) * force;
        }

        p.vx *= DAMPING;
        p.vy *= DAMPING;
        p.x  += p.vx;
        p.y  += p.vy;
      }

      // Draw connections
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx   = pts[i].x - pts[j].x;
          const dy   = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DIST) {
            // Check if mouse is near this line midpoint
            const midX = (pts[i].x + pts[j].x) / 2;
            const midY = (pts[i].y + pts[j].y) / 2;
            const dmx  = midX - mx;
            const dmy  = midY - my;
            const distMid = Math.sqrt(dmx * dmx + dmy * dmy);
            const mouseBoost = distMid < MOUSE_RADIUS
              ? (1 - distMid / MOUSE_RADIUS) * 0.5
              : 0;

            const alpha = (1 - dist / CONNECTION_DIST) * (LINE_OPACITY_MAX + mouseBoost);
            const lw    = mouseBoost > 0.1 ? 1.2 : 0.5;

            ctx.beginPath();
            ctx.strokeStyle = `rgba(${LINE_COLOR}, ${alpha})`;
            ctx.lineWidth   = lw;
            if (mouseBoost > 0.15) {
              ctx.shadowBlur  = 6;
              ctx.shadowColor = `rgba(${LINE_COLOR}, 0.4)`;
            }
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      }

      // Draw particles
      for (const p of pts) {
        const dxm   = p.x - mx;
        const dym   = p.y - my;
        const distM = Math.sqrt(dxm * dxm + dym * dym);
        const glow  = distM < MOUSE_RADIUS ? (1 - distM / MOUSE_RADIUS) : 0;

        if (glow > 0.1) {
          ctx.shadowBlur  = 12 * glow;
          ctx.shadowColor = `rgba(${DOT_COLOR}, ${glow * 0.8})`;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + glow * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${DOT_COLOR}, ${p.opacity + glow * 0.3})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      rafId.current = requestAnimationFrame(draw);
    };

    rafId.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      "fixed",
        inset:         0,
        zIndex:        0,
        pointerEvents: "none",
        opacity:       1,
      }}
    />
  );
}