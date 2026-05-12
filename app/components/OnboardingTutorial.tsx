"use client";
import { useState, useEffect } from "react";
import {
  X, ChevronRight, ChevronLeft, TrendingUp, TrendingDown,
  BarChart2, Clock, Wallet, BookOpen, CheckCircle,
  CandlestickChart, Zap, ShieldCheck,
} from "lucide-react";

const STORAGE_KEY = "dw_onboarding_done";

interface Step {
  Icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  tip?: string;
}

const STEPS: Step[] = [
  {
    Icon: BookOpen,
    iconColor: "#f5a623",
    title: "Bem-vindo à Dynamics Works!",
    description: "Esta plataforma permite-te negociar opções binárias em pares Forex, Cripto, Metais e Índices sintéticos. Vamos mostrar-te como funciona em poucos passos.",
    tip: "Começa sempre em modo Demo para praticar sem risco.",
  },
  {
    Icon: CandlestickChart,
    iconColor: "#38bdf8",
    title: "O Gráfico de Velas",
    description: "Cada vela representa o movimento do preço num determinado período. Uma vela verde significa que o preço subiu. Uma vela vermelha significa que o preço desceu.",
    tip: "Usa os botões 1m · 5m · 15m · 1h · 1D para mudar o timeframe.",
  },
  {
    Icon: BarChart2,
    iconColor: "#a78bfa",
    title: "Indicadores Técnicos",
    description: "Clica em IND na barra de timeframes para activar indicadores: Médias Móveis (MA/EMA), Bandas de Bollinger, RSI, MACD e Estocástico. Ajudam a identificar tendências.",
    tip: "O RSI acima de 70 indica sobrecomprado. Abaixo de 30 indica sobresoldado.",
  },
  {
    Icon: Clock,
    iconColor: "#f5a623",
    title: "Tempo de Expiração",
    description: "Escolhe quanto tempo a operação vai durar: 1 min, 5 min, 15 min ou 1 hora. Também podes personalizar o tempo tocando no campo TEMPO e digitando o número de minutos.",
    tip: "Tempos mais curtos têm mais volatilidade. Começa com 5 minutos.",
  },
  {
    Icon: Wallet,
    iconColor: "#22c55e",
    title: "Montante de Investimento",
    description: "Define quanto queres investir por operação. Usa os botões + e − para ajustar, ou toca no valor para digitar directamente. O mínimo é 1.000 Kz.",
    tip: "Nunca invistas mais de 5% do teu saldo numa única operação.",
  },
  {
    Icon: TrendingUp,
    iconColor: "#22c55e",
    title: "ALTA vs BAIXA",
    description: "Se acreditas que o preço vai subir no período escolhido, carrega em ALTA (verde). Se acreditas que vai descer, carrega em BAIXA (vermelho).",
    tip: "O payout mostrado é o lucro que recebes se a tua previsão estiver correcta.",
  },
  {
    Icon: Zap,
    iconColor: "#f5a623",
    title: "Ferramentas de Desenho",
    description: "Clica em TOOLS para aceder a linhas horizontais, linhas de tendência e retracções de Fibonacci. Ajudam a identificar suporte, resistência e alvos de preço.",
    tip: "Toca e arrasta no gráfico para desenhar linhas de tendência.",
  },
  {
    Icon: ShieldCheck,
    iconColor: "#22c55e",
    title: "Gestão de Risco",
    description: "A Dynamics Works tem modo Demo com 10.000 Kz virtuais. Pratica estratégias em Demo antes de usar saldo real. Podes repor o saldo demo quando ficar abaixo de 5.000 Kz.",
    tip: "Aprende a ler o mercado em Demo. Só passa a Real quando tiveres consistência.",
  },
  {
    Icon: CheckCircle,
    iconColor: "#22c55e",
    title: "Estás pronto!",
    description: "Já sabes o básico para começar a negociar. Explora a tab Mercados para ver todos os ativos disponíveis, e a tab Conta para gerir o teu perfil e suporte.",
    tip: "Boa sorte! A equipa de suporte está sempre disponível no WhatsApp.",
  },
];

export default function OnboardingTutorial() {
  const [visible, setVisible] = useState(false);
  const [step,    setStep]    = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  }

  function prev() { if (step > 0) setStep(s => s - 1); }

  if (!visible) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 20, width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.7)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: "#0a0f1e", borderBottom: "1px solid #1e2d50", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#f5a623,#e8940f)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={14} color="#0a0f1e" strokeWidth={2.5} />
            </div>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>Tutorial</span>
          </div>
          <button onClick={finish} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "14px 20px 0" }}>
          {STEPS.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, background: i <= step ? "#f5a623" : "#1e2d50", transition: "all 0.3s", cursor: "pointer" }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `${s.iconColor}18`, border: `1px solid ${s.iconColor}40`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <s.Icon size={26} color={s.iconColor} />
            </div>
            <h2 style={{ color: "#fff", fontWeight: 800, fontSize: 17, margin: "0 0 10px" }}>{s.title}</h2>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{s.description}</p>
          </div>

          {s.tip && (
            <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Zap size={14} color="#f5a623" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ color: "#f5a623", fontSize: 12, lineHeight: 1.5 }}>{s.tip}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ padding: "0 24px 20px", display: "flex", gap: 10 }}>
          {step > 0 && (
            <button onClick={prev} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", background: "#1e2d50", border: "none", borderRadius: 12, color: "#94a3b8", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              <ChevronLeft size={16} /> Anterior
            </button>
          )}
          <button onClick={next} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", background: isLast ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#f5a623,#e8940f)", border: "none", borderRadius: 12, color: "#0a0f1e", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            {isLast ? <><CheckCircle size={16} /> Começar a negociar!</> : <>Próximo <ChevronRight size={16} /></>}
          </button>
        </div>

        {/* Skip */}
        <div style={{ textAlign: "center", paddingBottom: 16 }}>
          <button onClick={finish} style={{ background: "none", border: "none", color: "#334155", fontSize: 12, cursor: "pointer" }}>
            Saltar tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
