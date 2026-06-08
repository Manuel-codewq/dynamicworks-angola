"use client";
import { useState, useEffect, useCallback } from "react";
import {
  X, ChevronRight, ChevronLeft,
  BarChart2, Clock, Wallet, BookOpen, CheckCircle,
  CandlestickChart, Zap, ShieldCheck, TrendingUp, ArrowUp, ArrowDown,
} from "lucide-react";

const STORAGE_KEY = "dw_onboarding_done_v2";

interface Step {
  Icon: React.ElementType;
  accent: string;
  title: string;
  description: string;
  tip?: string;
  visual?: React.ReactNode;
}

function MiniCandles() {
  const bars = [
    { o: 60, c: 75, h: 80, l: 55 },
    { o: 75, c: 65, h: 77, l: 60 },
    { o: 65, c: 80, h: 85, l: 62 },
    { o: 80, c: 72, h: 83, l: 68 },
    { o: 72, c: 88, h: 90, l: 70 },
  ];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60, justifyContent: "center" }}>
      {bars.map((b, i) => {
        const up   = b.c >= b.o;
        const body = Math.abs(b.c - b.o);
        const topW  = b.h - Math.max(b.o, b.c);
        const botW  = Math.min(b.o, b.c) - b.l;
        const color = up ? "#22c55e" : "#ef4444";
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <div style={{ width: 1, height: topW * 0.5, background: color }} />
            <div style={{ width: 10, height: Math.max(body * 0.5, 3), background: color, borderRadius: 2 }} />
            <div style={{ width: 1, height: botW * 0.5, background: color }} />
          </div>
        );
      })}
    </div>
  );
}

function MiniBtns() {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      <div style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 10, padding: "10px 20px", display: "flex", alignItems: "center", gap: 6 }}>
        <ArrowUp size={14} color="#22c55e" />
        <span style={{ color: "#22c55e", fontWeight: 800, fontSize: 13 }}>ALTA</span>
      </div>
      <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, padding: "10px 20px", display: "flex", alignItems: "center", gap: 6 }}>
        <ArrowDown size={14} color="#ef4444" />
        <span style={{ color: "#ef4444", fontWeight: 800, fontSize: 13 }}>BAIXA</span>
      </div>
    </div>
  );
}

const STEPS: Step[] = [
  {
    Icon: BookOpen,
    accent: "#f5a623",
    title: "Bem-vindo à Dynamic Works!",
    description: "A primeira plataforma de opções binárias angolana. Opera Forex, Cripto, Metais e Índices em Kwanza — com depósitos rápidos via Multicaixa.",
    tip: "Começa sempre em modo Demo — são 10.000 Kz virtuais para praticar sem risco.",
    visual: (
      <div style={{ textAlign: "center" }}>
        <img src="/logo-icon.jpeg" alt="Dynamic Works" style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 14, background: "#0a0f1e", margin: "0 auto" }} />
      </div>
    ),
  },
  {
    Icon: CandlestickChart,
    accent: "#38bdf8",
    title: "O Gráfico de Velas",
    description: "Cada vela mostra como o preço se moveu num período. Vela verde = preço subiu. Vela vermelha = preço desceu. Usa 1m, 5m, 15m, 1h ou 1D para mudar o intervalo.",
    tip: "Velas com mecha longa indicam indecisão do mercado.",
    visual: <MiniCandles />,
  },
  {
    Icon: TrendingUp,
    accent: "#22c55e",
    title: "ALTA ou BAIXA?",
    description: "Prevê se o preço vai subir (ALTA) ou descer (BAIXA) no tempo que escolheres. Se acertares, recebes o payout indicado. Se errares, perdes o valor investido.",
    tip: "O payout típico é 85% — investe 1.000 Kz, recebe 1.850 Kz se ganhar.",
    visual: <MiniBtns />,
  },
  {
    Icon: Clock,
    accent: "#f5a623",
    title: "Tempo de Expiração",
    description: "Define por quanto tempo a operação vai estar activa. Quanto menor o tempo, maior a volatilidade e o risco. Disponível de 30 segundos a 60 minutos.",
    tip: "Para iniciantes, começa com 5 minutos — tempo suficiente para analisar.",
  },
  {
    Icon: BarChart2,
    accent: "#a78bfa",
    title: "Indicadores Técnicos",
    description: "Activa MA, EMA, Bollinger Bands, RSI, MACD ou Estocástico tocando em IND no painel. Ajudam a identificar tendências e pontos de entrada.",
    tip: "RSI acima de 70 = mercado sobrecomprado. RSI abaixo de 30 = sobresoldado.",
  },
  {
    Icon: Wallet,
    accent: "#22c55e",
    title: "Conta Demo vs Real",
    description: "Podes alternar entre Demo e Real a qualquer momento. Na Demo usas saldo virtual. Na Real usas o teu saldo depositado. Treina em Demo antes de ir a Real.",
    tip: "Repõe o saldo demo sempre que ficar abaixo de 5.000 Kz.",
  },
  {
    Icon: ShieldCheck,
    accent: "#22c55e",
    title: "Gestão de Risco",
    description: "Nunca invistas mais de 5% do teu saldo numa única operação. Mantém um diário de trades para aprender com os teus erros. Disciplina é a chave do sucesso.",
    tip: "Perder faz parte. O segredo é perder pouco e ganhar consistentemente.",
  },
  {
    Icon: CheckCircle,
    accent: "#22c55e",
    title: "Pronto para começar!",
    description: "Já tens tudo o que precisas. Vai à secção Mercados para escolher um ativo, usa o modo Demo para praticar, e o suporte está sempre disponível.",
    tip: "Boa sorte! A equipa Dynamic Works está contigo.",
    visual: (
      <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
        {[
          { label: "Ativos", value: "17+" },
          { label: "Payout", value: "85%" },
          { label: "Demo", value: "10k Kz" },
        ].map(s => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ color: "#f5a623", fontWeight: 900, fontSize: 20 }}>{s.value}</div>
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    ),
  },
];

export default function OnboardingTutorial() {
  const [visible, setVisible] = useState(false);
  const [step,    setStep]    = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 1400);
      return () => clearTimeout(t);
    }
  }, []);

  function finish() {
    setExiting(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, "1");
      setVisible(false);
      setExiting(false);
    }, 280);
  }

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  }, [step]);

  const prev = useCallback(() => { if (step > 0) setStep(s => s - 1); }, [step]);

  // Swipe support
  const [touchX, setTouchX] = useState<number | null>(null);

  if (!visible) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9200,
        background: "rgba(0,0,0,0.82)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0 0 env(safe-area-inset-bottom,0)",
        transition: "opacity 0.28s",
        opacity: exiting ? 0 : 1,
      }}
      onClick={e => { if (e.target === e.currentTarget) finish(); }}
    >
      <style>{`@keyframes slideUp { from { transform: translateY(40px); opacity:0; } to { transform: translateY(0); opacity:1; } }`}</style>

      <div
        style={{
          background: "#0d1526",
          border: "1px solid #1e2d50",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          width: "100%",
          maxWidth: 520,
          boxShadow: "0 -20px 60px rgba(0,0,0,0.8)",
          animation: "slideUp 0.32s cubic-bezier(0.34,1.56,0.64,1)",
          overflow: "hidden",
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
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 6 }}>
          <div style={{ width: 40, height: 4, background: "#1e2d50", borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo-icon.jpeg" alt="Dynamic Works" style={{ width: 24, height: 24, objectFit: "contain", borderRadius: 5, background: "#1e2d50" }} />
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>Tutorial</span>
            <span style={{ color: "#334155", fontSize: 12 }}>— {step + 1}/{STEPS.length}</span>
          </div>
          <button onClick={finish} style={{ background: "none", border: "none", cursor: "pointer", color: "#334155", padding: 4, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: "#1e2d50", marginBottom: 20 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#f5a623,#e8940f)", borderRadius: 2, transition: "width 0.4s ease" }} />
        </div>

        {/* Content */}
        <div style={{ padding: "0 24px 20px" }}>
          {/* Icon */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: `${s.accent}18`, border: `1px solid ${s.accent}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <s.Icon size={24} color={s.accent} />
            </div>
            <h2 style={{ color: "#fff", fontWeight: 800, fontSize: 18, margin: 0, lineHeight: 1.25 }}>{s.title}</h2>
          </div>

          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 16px" }}>{s.description}</p>

          {/* Visual */}
          {s.visual && (
            <div style={{ background: "#070d1a", border: "1px solid #1e2d50", borderRadius: 12, padding: 16, marginBottom: 14 }}>
              {s.visual}
            </div>
          )}

          {/* Tip */}
          {s.tip && (
            <div style={{ background: `${s.accent}0d`, border: `1px solid ${s.accent}30`, borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 4 }}>
              <Zap size={13} color={s.accent} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ color: s.accent, fontSize: 13, lineHeight: 1.5 }}>{s.tip}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ padding: "0 24px 16px", display: "flex", gap: 10 }}>
          {step > 0 && (
            <button onClick={prev} style={{ width: 48, height: 48, background: "#1e2d50", border: "none", borderRadius: 12, color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </button>
          )}
          <button onClick={next} style={{
            flex: 1, height: 48,
            background: isLast ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#f5a623,#e8940f)",
            border: "none", borderRadius: 12, color: "#0a0f1e",
            fontWeight: 800, fontSize: 15, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {isLast ? <><CheckCircle size={17} /> Começar a negociar!</> : <>Próximo <ChevronRight size={17} /></>}
          </button>
        </div>

        {/* Dots + skip */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px 24px" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setStep(i)}
                style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, border: "none", cursor: "pointer", padding: 0, background: i <= step ? "#f5a623" : "#1e2d50", transition: "all 0.3s" }} />
            ))}
          </div>
          <button onClick={finish} style={{ background: "none", border: "none", color: "#334155", fontSize: 12, cursor: "pointer", padding: 0 }}>
            Saltar
          </button>
        </div>

        {/* safe area spacer for iPhone notch */}
        <div style={{ height: "env(safe-area-inset-bottom,0)" }} />
      </div>
    </div>
  );
}
