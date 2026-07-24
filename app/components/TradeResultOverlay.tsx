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

  useEffect(() => {
    const ms = type === "win" ? 4200 : type === "loss" ? 3000 : 3000;
    const t  = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [type, onDone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    let raf: number;

    if (type === "win") {
      const COLORS = ["#00c076","#ffffff","#fbbf24","#34d399","#a78bfa","#f472b6","#38bdf8","#4ade80"];

      // Confetti cai do topo em toda a largura
      const confetti = Array.from({ length: 220 }, (_, i) => ({
        x:    (i / 220) * canvas.width + (Math.random() - 0.5) * 90,
        y:    -30 - Math.random() * 180,
        vx:   (Math.random() - 0.5) * 6,
        vy:   3 + Math.random() * 5.5,
        rot:  Math.random() * 360,
        rotV: (Math.random() - 0.5) * 14,
        w:    8 + Math.random() * 10,
        h:    3 + Math.random() * 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life:  1,
        decay: 0.0035 + Math.random() * 0.005,
        round: Math.random() > 0.55,
      }));

      // Burst de partículas a partir do centro do card
      const burst = Array.from({ length: 80 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 10;
        return {
          x: cx, y: cy - 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 1,
          decay: 0.016 + Math.random() * 0.014,
          size: 3 + Math.random() * 6,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          grav: 0.18 + Math.random() * 0.12,
        };
      });

      const tick = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        for (const p of confetti) {
          p.x += p.vx; p.y += p.vy; p.vy += 0.11; p.rot += p.rotV; p.life -= p.decay;
          if (p.y > canvas.height + 20 || p.life <= 0) continue;
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.min(1, p.life * 2.5);
          ctx.translate(p.x, p.y); ctx.rotate((p.rot * Math.PI) / 180);
          ctx.fillStyle = p.color;
          if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.h, 0, Math.PI * 2); ctx.fill(); }
          else { ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
          ctx.restore();
        }
        for (const b of burst) {
          b.x += b.vx; b.y += b.vy; b.vy += b.grav; b.life -= b.decay;
          if (b.life <= 0) continue;
          alive = true;
          ctx.save();
          ctx.globalAlpha = b.life * 0.9;
          ctx.fillStyle = b.color;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.size * b.life, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        if (alive) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

    } else if (type === "loss") {
      // Faíscas vermelhas convergem para o centro
      const REDS = ["#ff3b5c","#ef4444","#ff6b6b","#fca5a5","#dc2626"];
      const sparks = Array.from({ length: 70 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.min(canvas.width, canvas.height) * 0.55;
        return {
          x: cx + Math.cos(angle) * r * (0.6 + Math.random() * 0.6),
          y: cy + Math.sin(angle) * r * (0.6 + Math.random() * 0.6),
          tx: cx + (Math.random() - 0.5) * 120,
          ty: cy + (Math.random() - 0.5) * 120,
          life: 1, decay: 0.022 + Math.random() * 0.018,
          size: 2 + Math.random() * 4.5,
          color: REDS[Math.floor(Math.random() * REDS.length)],
          speed: 0.05 + Math.random() * 0.07,
        };
      });
      const tick = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        for (const s of sparks) {
          s.x += (s.tx - s.x) * s.speed; s.y += (s.ty - s.y) * s.speed; s.life -= s.decay;
          if (s.life <= 0) continue;
          alive = true;
          ctx.save(); ctx.globalAlpha = s.life;
          ctx.fillStyle = s.color;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        if (alive) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(raf);
  }, [type]);

  // ── INFO ─────────────────────────────────────────────────────────────────────
  if (type === "info") return (
    <div onClick={onDone} style={{ position:"fixed", inset:0, zIndex:99999, backgroundColor:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor:"#111827", border:"2px solid #ffffff", borderRadius:20, padding:"32px 36px", maxWidth:"80vw", width:300, display:"flex", flexDirection:"column", alignItems:"center", gap:14, textAlign:"center", boxShadow:"0 0 40px rgba(255,255,255,0.3), 0 20px 60px rgba(0,0,0,0.8)" }}>
        <Info size={32} color="#ffffff" />
        <div style={{ color:"#ffffff", fontWeight:700, fontSize:16, lineHeight:1.4 }}>{msg}</div>
        <button onClick={onDone} style={{ marginTop:4, background:"#ffffff", color:"#0a0f1e", border:"none", borderRadius:10, padding:"10px 32px", fontWeight:800, fontSize:14, cursor:"pointer", width:"100%" }}>OK</button>
      </div>
    </div>
  );

  const isWin = type === "win";

  return (
    <>
      <style>{`
        @keyframes trFlashWin  { 0%{opacity:0} 8%{opacity:.4} 35%{opacity:.15} 100%{opacity:0} }
        @keyframes trFlashLoss { 0%{opacity:0} 12%{opacity:.65} 45%{opacity:.3} 100%{opacity:0} }
        @keyframes trCardIn    { from{opacity:0;transform:scale(.68) translateY(24px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes trWinOut    { 0%,62%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(.88) translateY(-16px)} }
        @keyframes trLossOut   { 0%,52%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(.9)} }
        @keyframes trShake     { 0%,100%{transform:translateX(0)} 12%{transform:translateX(-14px)} 28%{transform:translateX(14px)} 44%{transform:translateX(-9px)} 60%{transform:translateX(9px)} 76%{transform:translateX(-4px)} }
        @keyframes trRingOut   { 0%{transform:scale(.4);opacity:1} 100%{transform:scale(3.2);opacity:0} }
        @keyframes trRing2Out  { 0%{transform:scale(.4);opacity:1} 100%{transform:scale(2.6);opacity:0} }
        @keyframes trIconGlow  { 0%,100%{filter:drop-shadow(0 0 8px #00c076)} 50%{filter:drop-shadow(0 0 30px #00c076) drop-shadow(0 0 6px #fff)} }
        @keyframes trAmountPop { 0%{opacity:0;transform:scale(.4)} 65%{transform:scale(1.14)} 100%{opacity:1;transform:scale(1)} }
        @keyframes trPulseRing { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(2.4);opacity:0} }
        @keyframes trLabelIn   { from{opacity:0;letter-spacing:12px} to{opacity:1;letter-spacing:5px} }
      `}</style>

      {/* Background radial flash */}
      <div style={{
        position:"fixed", inset:0, zIndex:2990, pointerEvents:"none",
        background: isWin
          ? "radial-gradient(ellipse at 50% 50%, rgba(0,192,118,.55) 0%, transparent 70%)"
          : "radial-gradient(ellipse at 50% 50%, rgba(255,59,92,.65) 0%, transparent 70%)",
        animation: `${isWin ? "trFlashWin 1.8s" : "trFlashLoss .9s"} ease forwards`,
      }} />

      {/* Expanding rings (win) */}
      {isWin && (<>
        <div style={{ position:"fixed", inset:0, zIndex:2991, pointerEvents:"none", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:160, height:160, borderRadius:"50%", border:"2px solid rgba(0,192,118,.7)", animation:"trRingOut 1.1s cubic-bezier(0,0,.2,1) .1s forwards" }} />
        </div>
        <div style={{ position:"fixed", inset:0, zIndex:2991, pointerEvents:"none", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:160, height:160, borderRadius:"50%", border:"2px solid rgba(251,191,36,.5)", animation:"trRing2Out 1.4s cubic-bezier(0,0,.2,1) .35s forwards" }} />
        </div>
      </>)}

      {/* Particles canvas */}
      <canvas ref={canvasRef} style={{ position:"fixed", inset:0, zIndex:2992, pointerEvents:"none" }} />

      {/* Overlay + card */}
      <div onClick={onDone} style={{
        position:"fixed", inset:0, zIndex:2993,
        display:"flex", alignItems:"center", justifyContent:"center",
        background:"rgba(0,0,0,0.58)", backdropFilter:"blur(4px)",
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: isWin
            ? "linear-gradient(160deg,#031209 0%,#052e16 45%,#031a0b 100%)"
            : "linear-gradient(160deg,#150203 0%,#3b0808 45%,#150203 100%)",
          border:`2.5px solid ${isWin ? "#00c076" : "#ff3b5c"}`,
          borderRadius:36, padding:"52px 60px 44px", textAlign:"center",
          boxShadow: isWin
            ? "0 0 0 1px rgba(0,192,118,.12), 0 0 100px rgba(0,192,118,.35), 0 0 200px rgba(0,192,118,.1), 0 28px 80px rgba(0,0,0,.75)"
            : "0 0 0 1px rgba(255,59,92,.12), 0 0 100px rgba(255,59,92,.35), 0 28px 80px rgba(0,0,0,.75)",
          animation: isWin
            ? "trCardIn .5s cubic-bezier(.22,1,.36,1), trWinOut 4.2s forwards"
            : "trCardIn .42s cubic-bezier(.22,1,.36,1), trShake .55s .06s ease, trLossOut 3s forwards",
          minWidth:300, maxWidth:"85vw", position:"relative", overflow:"hidden",
        }}>

          {/* Pulse ring (win) */}
          {isWin && <div style={{ position:"absolute", top:52, left:"50%", transform:"translateX(-50%)", width:88, height:88, borderRadius:"50%", border:"2px solid rgba(0,192,118,.35)", animation:"trPulseRing 1.8s ease-out .4s infinite" }} />}

          {/* Icon circle */}
          <div style={{
            width:88, height:88, borderRadius:"50%",
            background: isWin ? "rgba(0,192,118,.15)" : "rgba(255,59,92,.15)",
            border:`2px solid ${isWin ? "#00c076" : "#ff3b5c"}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            margin:"0 auto 28px", position:"relative", zIndex:1,
          }}>
            {isWin
              ? <Trophy size={44} color="#00c076" style={{ animation:"trIconGlow 1.8s ease-in-out infinite" }} />
              : <TrendingDown size={44} color="#ff3b5c" />
            }
          </div>

          {/* Label */}
          <div style={{ color:isWin?"#00c076":"#ff3b5c", fontWeight:900, fontSize:12, letterSpacing:5, textTransform:"uppercase", marginBottom:18, animation:"trLabelIn .6s ease .2s both" }}>
            {isWin ? "✦  GANHOU!  ✦" : "✕  PERDEU"}
          </div>

          {/* Amount */}
          <div style={{ color:"#ffffff", fontWeight:900, fontSize:msg.length > 18 ? 26 : 34, letterSpacing:-0.5, lineHeight:1, animation:"trAmountPop .55s cubic-bezier(.22,1,.36,1) .18s both" }}>
            {msg}
          </div>

          <div style={{ color:"#1f2937", fontSize:11, marginTop:26, letterSpacing:0.5 }}>toca para fechar</div>
        </div>
      </div>
    </>
  );
}
