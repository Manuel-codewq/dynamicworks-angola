"use client";
import { useEffect, useRef } from "react";
import { Trophy, TrendingDown, Info } from "lucide-react";

interface Props {
  type: "win" | "loss" | "info";
  msg:  string;
  onDone: () => void;
}

export default function TradeResultOverlay({ type, msg, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-dismiss
  useEffect(() => {
    const ms = type === "win" ? 3800 : type === "loss" ? 2800 : 3000;
    const t  = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [type, onDone]);

  // Confetti particles (win only)
  useEffect(() => {
    if (type !== "win") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const COLORS = ["#f5a623", "#22c55e", "#ffffff", "#fbbf24", "#34d399", "#a78bfa", "#f472b6"];
    const particles = Array.from({ length: 140 }, (_, i) => ({
      x:     (i / 140) * canvas.width + (Math.random() - 0.5) * 60,
      y:     -20 - Math.random() * 120,
      vx:    (Math.random() - 0.5) * 5,
      vy:    2.5 + Math.random() * 4.5,
      rot:   Math.random() * 360,
      rotV:  (Math.random() - 0.5) * 12,
      w:     7 + Math.random() * 9,
      h:     3 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life:  1,
      decay: 0.006 + Math.random() * 0.006,
    }));

    let raf: number;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        p.x   += p.vx;
        p.y   += p.vy;
        p.vy  += 0.12;
        p.rot += p.rotV;
        p.life -= p.decay;
        if (p.y > canvas.height + 20 || p.life <= 0) continue;
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life * 3);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.rect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.fill();
        ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [type]);

  // ── INFO toast — simples, não interrompe ─────────────────────────────────
  if (type === "info") return (
    <div onClick={onDone} style={{
      position: "fixed", top: 72, left: 12, right: 12, zIndex: 3000,
      background: "rgba(245,166,35,0.96)", color: "#0a0f1e",
      padding: "12px 16px", borderRadius: 12, fontWeight: 700, fontSize: 14,
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
      animation: "trToastIn .3s cubic-bezier(.22,1,.36,1)",
    }}>
      <style>{`@keyframes trToastIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <Info size={16} color="#0a0f1e" />
      {msg}
    </div>
  );

  const isWin = type === "win";

  return (
    <>
      <style>{`
        @keyframes trFlash    { 0%,100%{opacity:0} 15%{opacity:.22} 40%{opacity:.1} }
        @keyframes trCardIn   { from{opacity:0;transform:scale(.75)} to{opacity:1;transform:scale(1)} }
        @keyframes trPulse    { 0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(34,197,94,.4)} 50%{transform:scale(1.08);box-shadow:0 0 0 16px rgba(34,197,94,0)} }
        @keyframes trShake    { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-9px)} 40%{transform:translateX(9px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
        @keyframes trFadeOut  { 0%,65%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(.9)} }
        @keyframes trLossOut  { 0%,55%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(.92)} }
        @keyframes trGlow     { 0%,100%{filter:drop-shadow(0 0 8px #f5a623)} 50%{filter:drop-shadow(0 0 22px #f5a623)} }
      `}</style>

      {/* Background flash */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 2990, pointerEvents: "none",
        background: isWin ? "radial-gradient(ellipse at center,#22c55e,#14532d)" : "#ef4444",
        animation: `trFlash ${isWin ? "1.4s" : ".7s"} ease forwards`,
      }} />

      {/* Confetti canvas */}
      {isWin && (
        <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 2991, pointerEvents: "none" }} />
      )}

      {/* Overlay — click to dismiss */}
      <div onClick={onDone} style={{
        position: "fixed", inset: 0, zIndex: 2992,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
      }}>
        <div style={{
          background: isWin
            ? "linear-gradient(160deg,#052e16 0%,#064e3b 50%,#052e16 100%)"
            : "linear-gradient(160deg,#1c0505 0%,#450a0a 50%,#1c0505 100%)",
          border: `2px solid ${isWin ? "#22c55e" : "#ef4444"}`,
          borderRadius: 28, padding: "44px 52px 36px", textAlign: "center",
          boxShadow: `0 0 80px ${isWin ? "rgba(34,197,94,.5)" : "rgba(239,68,68,.5)"}, 0 24px 60px rgba(0,0,0,.6)`,
          animation: `trCardIn .4s cubic-bezier(.22,1,.36,1), ${isWin ? `trFadeOut 3.8s` : `trShake .5s .05s ease, trLossOut 2.8s`} forwards`,
          minWidth: 280, maxWidth: "80vw",
        }}>

          {/* Icon circle */}
          <div style={{
            width: 88, height: 88, borderRadius: "50%",
            background: isWin ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)",
            border: `2px solid ${isWin ? "#22c55e" : "#ef4444"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px",
            animation: isWin ? "trPulse 1.4s ease-in-out infinite" : undefined,
          }}>
            {isWin
              ? <Trophy     size={46} color="#f5a623" style={{ animation: "trGlow 1.4s ease-in-out infinite" }} />
              : <TrendingDown size={46} color="#ef4444" />
            }
          </div>

          {/* Label */}
          <div style={{
            color: isWin ? "#22c55e" : "#ef4444",
            fontWeight: 900, fontSize: 11, letterSpacing: 4,
            textTransform: "uppercase", marginBottom: 12,
          }}>
            {isWin ? "🏆 Win!" : "Loss"}
          </div>

          {/* Amount */}
          <div style={{
            color: "#ffffff", fontWeight: 900,
            fontSize: msg.length > 20 ? 24 : 30,
            letterSpacing: -0.5, lineHeight: 1.1,
          }}>
            {msg}
          </div>

          {/* Tap hint */}
          <div style={{ color: "#374151", fontSize: 11, marginTop: 20, letterSpacing: 0.5 }}>
            toca para fechar
          </div>
        </div>
      </div>
    </>
  );
}
