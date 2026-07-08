"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  X, ChevronRight, ChevronLeft, CheckCircle,
  CandlestickChart, TrendingUp, TrendingDown, Wallet,
  Clock, BarChart2, Zap, ArrowUp, ArrowDown, BookOpen,
} from "lucide-react";

const STORAGE_KEY = "dw_onboarding_v3";
const PAD = 10; // spotlight padding em px

interface TourStep {
  target?: string;        // data-tour="..."
  placement?: "top" | "bottom" | "left" | "right" | "center";
  Icon: React.ElementType;
  accent: string;
  title: string;
  body: string;
  tip?: string;
}

const STEPS: TourStep[] = [
  {
    placement: "center",
    Icon: BookOpen,
    accent: "#ffffff",
    title: "Bem-vindo à Dynamic Works!",
    body: "A primeira corretora de opções binárias angolana. Vamos fazer um tour rápido para saber como tudo funciona.",
    tip: "Podes fechar o tutorial a qualquer momento e repetir mais tarde.",
  },
  {
    target: "dw-chart",
    placement: "center",
    Icon: CandlestickChart,
    accent: "#38bdf8",
    title: "O Gráfico de Preços",
    body: "Aqui vês o movimento do preço em tempo real. Vela verde = preço subiu. Vela vermelha = preço desceu. Usa os botões de timeframe (1m, 5m, 15m…) para mudar o intervalo.",
    tip: "Dica: analisa o gráfico antes de abrir qualquer operação.",
  },
  {
    target: "dw-pair",
    placement: "bottom",
    Icon: BarChart2,
    accent: "#a78bfa",
    title: "Par e Preço Actual",
    body: "Aqui vês o ativo selecionado, o preço em tempo real e o payout da operação. Clica no nome do ativo no topo para mudar para outro par.",
    tip: "Payout de 85% significa: investes 1.000 Kz e recebes 1.850 Kz se ganhares.",
  },
  {
    target: "dw-amount",
    placement: "top",
    Icon: Wallet,
    accent: "#22c55e",
    title: "Valor do Investimento",
    body: "Define quanto queres investir nesta operação. Usa os botões − / + ou clica nos atalhos rápidos (1k, 5k, 10k, 25k).",
    tip: "Regra de ouro: nunca invistas mais de 5% do teu saldo numa única operação.",
  },
  {
    target: "dw-trade-btns",
    placement: "top",
    Icon: TrendingUp,
    accent: "#0ecb81",
    title: "ALTA ou BAIXA?",
    body: "ALTA (verde) = apostas que o preço vai subir. BAIXA (vermelho) = apostas que vai descer. Se o preço no exato momento de expiração estiver do lado correto da tua entrada, ganhas!",
    tip: "Só importa o preço no momento exato de expiração — não o movimento durante a operação.",
  },
  {
    target: "dw-payout",
    placement: "top",
    Icon: Zap,
    accent: "#ffffff",
    title: "Retorno Potencial",
    body: "Antes de clicar ALTA ou BAIXA, este painel mostra exatamente quanto vais receber se a previsão estiver correta.",
    tip: "O retorno é calculado automaticamente com base no valor investido e no payout do par.",
  },
  {
    target: "dw-account",
    placement: "bottom",
    Icon: Wallet,
    accent: "#ffffff",
    title: "Demo vs Conta Real",
    body: "Clica aqui para alternar entre conta Demo (saldo virtual de 10.000 Kz) e conta Real (o teu dinheiro depositado). Começa sempre em Demo!",
    tip: "Podes repor o saldo Demo sempre que quiser — sem custos.",
  },
  {
    placement: "center",
    Icon: CheckCircle,
    accent: "#22c55e",
    title: "Estás pronto!",
    body: "Já sabes tudo o que precisas para começar. Vai ao modo Demo, pratica algumas operações e sente como a plataforma funciona.",
    tip: "A equipa de suporte está sempre disponível no botão de chat. Boa sorte!",
  },
];

// ── Spotlight geometry ────────────────────────────────────────────────────────

interface Rect { top: number; left: number; width: number; height: number; }

function getTargetRect(target?: string): Rect | null {
  if (!target) return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

// ── Tooltip positioning ───────────────────────────────────────────────────────

const TT_H_EST  = 290; // altura estimada do tooltip em px
const SAFE_TOP  = 8;
const SAFE_BOT  = 90;  // margem inferior: barra de navegação do browser mobile
const GAP       = 10;

function tooltipStyle(rect: Rect | null, placement: TourStep["placement"]): React.CSSProperties {
  if (!rect || placement === "center") {
    return {
      position: "fixed",
      top: "50%", left: "50%",
      transform: "translate(-50%,-50%)",
      width: "min(92vw, 360px)",
    };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TT_W = Math.min(vw * 0.92, 340);

  // Centrar horizontalmente no elemento alvo, clamped
  const centerX = rect.left + rect.width / 2;
  const left = Math.max(8, Math.min(centerX - TT_W / 2, vw - TT_W - 8));

  const spaceBelow = vh - (rect.top + rect.height) - SAFE_BOT;
  const spaceAbove = rect.top - SAFE_TOP;

  // Escolher a melhor direcção (flip automático se não couber)
  let dir = placement === "top" || placement === "bottom" ? placement : "bottom";
  if (dir === "bottom" && spaceBelow < TT_H_EST && spaceAbove > spaceBelow) dir = "top";
  if (dir === "top"    && spaceAbove < TT_H_EST && spaceBelow > spaceAbove) dir = "bottom";

  // Se nenhuma direcção tem espaço suficiente → pin ao fundo do ecrã
  const noRoom = (dir === "bottom" && spaceBelow < 100) || (dir === "top" && spaceAbove < 100);
  if (noRoom) {
    return {
      position: "fixed",
      bottom: SAFE_BOT - 20,
      left,
      width: TT_W,
      maxHeight: vh * 0.45,
      overflowY: "auto" as const,
    };
  }

  if (dir === "bottom") {
    const top = Math.min(rect.top + rect.height + GAP, vh - TT_H_EST - SAFE_BOT);
    return { position: "fixed", top: Math.max(SAFE_TOP, top), left, width: TT_W };
  }

  // top
  const bottom = Math.min(vh - rect.top + GAP, vh - SAFE_TOP - TT_H_EST);
  return { position: "fixed", bottom: Math.max(SAFE_BOT, bottom), left, width: TT_W };
}

// ── Spotlight overlay (4 quads) ──────────────────────────────────────────────

function Spotlight({ rect }: { rect: Rect | null }) {
  if (!rect) return null;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;
  const { top, left, width, height } = rect;

  const quad: React.CSSProperties = { position: "fixed", background: "rgba(0,0,0,0.78)", zIndex: 9100 };
  return (
    <>
      {/* top */}
      <div style={{ ...quad, top: 0, left: 0, right: 0, height: Math.max(0, top) }} />
      {/* bottom */}
      <div style={{ ...quad, top: top + height, left: 0, right: 0, bottom: 0 }} />
      {/* left */}
      <div style={{ ...quad, top, left: 0, width: Math.max(0, left), height }} />
      {/* right */}
      <div style={{ ...quad, top, left: left + width, right: 0, height }} />
      {/* border glow */}
      <div style={{
        position: "fixed", zIndex: 9101,
        top: top - 2, left: left - 2,
        width: width + 4, height: height + 4,
        borderRadius: 12, border: "2px solid rgba(255,255,255,0.7)",
        boxShadow: "0 0 0 4px rgba(255,255,255,0.15), 0 0 30px rgba(255,255,255,0.2)",
        pointerEvents: "none",
      }} />
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingTutorial() {
  const [visible, setVisible] = useState(false);
  const [step,    setStep]    = useState(0);
  const [exiting, setExiting] = useState(false);
  const [rect,    setRect]    = useState<Rect | null>(null);
  const [ttStyle, setTtStyle] = useState<React.CSSProperties>({});
  const [touchX,  setTouchX]  = useState<number | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const updateGeometry = useCallback(() => {
    const s = STEPS[step];
    const r = getTargetRect(s.target);
    setRect(r);
    setTtStyle(tooltipStyle(r, s.placement));
  }, [step]);

  useEffect(() => {
    if (!visible) return;
    updateGeometry();
    const onResize = () => updateGeometry();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    // poll briefly to handle layout shifts (charts loading etc.)
    let polls = 0;
    const id = setInterval(() => { if (++polls < 8) updateGeometry(); else clearInterval(id); }, 300);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      clearInterval(id);
    };
  }, [visible, step, updateGeometry]);

  function finish() {
    setExiting(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, "1");
      setVisible(false);
      setExiting(false);
    }, 260);
  }

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  }, [step]);

  const prev = useCallback(() => { if (step > 0) setStep(s => s - 1); }, [step]);

  if (!visible) return null;

  const s      = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const pct    = Math.round(((step + 1) / STEPS.length) * 100);
  const hasTarget = !!s.target && !!rect;

  return (
    <>
      <style>{`
        @keyframes dwTourIn  { from { opacity:0; transform:translateY(8px) scale(0.97); } to { opacity:1; transform:none; } }
        @keyframes dwTourOut { from { opacity:1; } to { opacity:0; } }
        @keyframes dwPulse   { 0%,100% { box-shadow:0 0 0 0 rgba(255,255,255,0.4); } 50% { box-shadow:0 0 0 8px rgba(255,255,255,0); } }
      `}</style>

      {/* Dark backdrop — only full when no target */}
      {!hasTarget && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9100, background: "rgba(0,0,0,0.82)", transition: "opacity 0.26s", opacity: exiting ? 0 : 1 }}
          onClick={e => { if (e.target === e.currentTarget) finish(); }}
        />
      )}

      {/* Spotlight quads */}
      {hasTarget && <Spotlight rect={rect} />}

      {/* Tooltip card */}
      <div
        style={{
          ...ttStyle,
          zIndex: 9200,
          background: "#0d1526",
          border: "1px solid #1e3a5f",
          borderRadius: 18,
          boxShadow: "0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.12)",
          overflow: "hidden",
          animation: exiting ? "dwTourOut 0.26s ease forwards" : "dwTourIn 0.32s cubic-bezier(0.34,1.2,0.64,1)",
          transition: "top 0.35s ease, bottom 0.35s ease, left 0.35s ease, right 0.35s ease",
        }}
        onTouchStart={e => setTouchX(e.touches[0].clientX)}
        onTouchEnd={e => {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          if (dx < -50) next();
          else if (dx > 50) prev();
          setTouchX(null);
        }}
      >
        {/* Progress bar */}
        <div style={{ height: 3, background: "#1e2d50" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#ffffff,#cbd5e1)", transition: "width 0.4s ease" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo-icon.jpeg" alt="DW" style={{ width: 20, height: 20, borderRadius: 5, objectFit: "contain" }} />
            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>Tutorial</span>
            <span style={{ color: "#334155", fontSize: 11 }}>{step + 1}/{STEPS.length}</span>
          </div>
          <button onClick={finish} style={{ background: "none", border: "none", cursor: "pointer", color: "#334155", padding: 2, display: "flex", lineHeight: 1 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 18px 0" }}>
          {/* Icon + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: `${s.accent}18`, border: `1px solid ${s.accent}35`,
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "dwPulse 2s ease infinite",
            }}>
              <s.Icon size={20} color={s.accent} />
            </div>
            <h2 style={{ color: "#fff", fontWeight: 800, fontSize: 16, margin: 0, lineHeight: 1.25 }}>{s.title}</h2>
          </div>

          <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7, margin: "0 0 12px" }}>{s.body}</p>

          {s.tip && (
            <div style={{ background: `${s.accent}0e`, border: `1px solid ${s.accent}28`, borderRadius: 9, padding: "9px 12px", display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
              <Zap size={12} color={s.accent} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ color: s.accent, fontSize: 12, lineHeight: 1.55 }}>{s.tip}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ padding: "14px 18px 10px", display: "flex", gap: 8 }}>
          {step > 0 && (
            <button onClick={prev} style={{ width: 44, height: 44, background: "#141c2e", border: "1px solid #1e2d50", borderRadius: 10, color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "border-color 0.15s" }}>
              <ChevronLeft size={18} />
            </button>
          )}
          <button onClick={next} style={{
            flex: 1, height: 44,
            background: isLast
              ? "linear-gradient(135deg,#22c55e,#16a34a)"
              : "linear-gradient(135deg,#ffffff,#cbd5e1)",
            border: "none", borderRadius: 10,
            color: "#0a0f1e", fontWeight: 800, fontSize: 14,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}>
            {isLast ? <><CheckCircle size={16} /> Começar a negociar!</> : <>Próximo <ChevronRight size={16} /></>}
          </button>
        </div>

        {/* Dots + skip */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px 16px" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setStep(i)} style={{
                width: i === step ? 16 : 6, height: 6,
                borderRadius: 3, border: "none", cursor: "pointer", padding: 0,
                background: i <= step ? "#ffffff" : "#1e2d50",
                transition: "all 0.3s ease",
              }} />
            ))}
          </div>
          <button onClick={finish} style={{ background: "none", border: "none", color: "#334155", fontSize: 11, cursor: "pointer", padding: 0 }}>
            Saltar
          </button>
        </div>
      </div>
    </>
  );
}
