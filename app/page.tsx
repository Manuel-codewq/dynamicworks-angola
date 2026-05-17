"use client";
import { formatKz } from "@/lib/format";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Zap, ShieldCheck, TrendingUp, Banknote, ArrowRight,
  ChevronRight, Gift, Menu, X, MessageCircle,
} from "lucide-react";

// ── Typewriter ────────────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 45, delay = 0, active = true) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active || !text) return;
    setDisplayed(""); setDone(false);
    let i = 0;
    const t = setTimeout(() => {
      const id = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) { clearInterval(id); setDone(true); }
      }, speed);
      return () => clearInterval(id);
    }, delay);
    return () => clearTimeout(t);
  }, [text, speed, delay, active]);
  return { displayed, done };
}

// ── Count-up ──────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1800, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active || target === 0) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, active]);
  return val;
}

// ── InView ────────────────────────────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, vis };
}

function Cursor({ done }: { done: boolean }) {
  return <span style={{ display: "inline-block", width: 3, height: "0.85em", background: "#f5a623", marginLeft: 3, verticalAlign: "middle", borderRadius: 1, animation: done ? "blink 1s step-end infinite" : "none" }} />;
}

function FadeIn({ children, delay = 0, y = 30, style }: { children: React.ReactNode; delay?: number; y?: number; style?: React.CSSProperties }) {
  const { ref, vis } = useInView();
  return (
    <div ref={ref} style={{ transition: `opacity .75s ease ${delay}ms, transform .75s ease ${delay}ms`, opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : `translateY(${y}px)`, ...style }}>
      {children}
    </div>
  );
}

function StatCard({ label, target, format }: { label: string; target: number; format: (n: number) => string }) {
  const { ref, vis } = useInView(0.3);
  const val = useCountUp(target, 1800, vis);
  return (
    <div ref={ref} style={{ textAlign: "center", padding: "8px 16px" }}>
      <div style={{ fontSize: "clamp(22px,4vw,34px)", fontWeight: 900, color: "#f5a623", fontVariantNumeric: "tabular-nums" }}>{vis ? format(val) : "—"}</div>
      <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{label}</div>
    </div>
  );
}

const Logo = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#f5a623,#e8940f)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(245,166,35,0.4)" }}>
      <TrendingUp size={20} color="#0a0f1e" strokeWidth={2.5} />
    </div>
    <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5, background: "linear-gradient(90deg,#fff,#94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
      Dynamics Works
    </span>
  </div>
);

export default function LandingPage() {
  const router = useRouter();
  const { status } = useSession();
  const [stats,      setStats]      = useState({ users: 0, trades: 0, volume: 0 });
  const [ready,      setReady]      = useState(false);
  const [navIn,      setNavIn]      = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  // Redirecionar utilizadores já autenticados
  useEffect(() => {
    if (status === "authenticated") router.replace("/trade");
  }, [status, router]);

  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(setStats).catch(() => {});
    setTimeout(() => setNavIn(true), 50);
    setTimeout(() => setReady(true), 300);
  }, []);

  const badge = useTypewriter("Plataforma de Opções Binárias · Angola", 36, 0, ready);
  const l1    = useTypewriter("Negocie no Mercado Global", 48, 0, badge.done);
  const l2    = useTypewriter("em Kwanzas.", 55, 0, l1.done);
  const sub   = useTypewriter("A primeira corretora de opções binárias angolana com pagamentos em AOA via Multicaixa Express, preços em tempo real e conta demo gratuita.", 20, 0, l2.done);

  const features = [
    { Icon: Zap,         color: "#f5a623", title: "Execução Instantânea",   desc: "Ordens executadas em milissegundos com preços do mercado global em tempo real." },
    { Icon: ShieldCheck, color: "#22c55e", title: "Segurança Avançada",     desc: "KYC obrigatório, autenticação 2FA por email e encriptação de ponta a ponta." },
    { Icon: TrendingUp,  color: "#3b82f6", title: "16+ Ativos",             desc: "Forex, criptomoedas e metais preciosos disponíveis 24/7." },
    { Icon: Banknote,    color: "#a78bfa", title: "Pagamentos em Kwanza",   desc: "Depósitos e levantamentos em AOA via Multicaixa Express. Rápido e sem complicações." },
    { Icon: Gift,        color: "#22c55e", title: "Programa de Referidos",  desc: "Convida amigos e ganha 2% do primeiro depósito deles directamente no teu saldo." },
    { Icon: ChevronRight,color: "#38bdf8", title: "Conta Demo Grátis",      desc: "10.000 Kz virtual para praticar sem risco antes de investir capital real." },
  ];

  const steps = [
    { n: "01", title: "Cria a tua conta",    desc: "Regista-te gratuitamente em menos de 2 minutos.",               color: "#f5a623" },
    { n: "02", title: "Faz o depósito",      desc: "Transfere em Kwanza via Multicaixa Express. Aprovação em 24h.", color: "#3b82f6" },
    { n: "03", title: "Começa a negociar",   desc: "Escolhe o ativo, prevê a direcção e ganha.",                    color: "#22c55e" },
  ];

  const assets = [
    { label: "EUR/USD", color: "#3b82f6" },
    { label: "BTC/USD", color: "#f5a623" },
    { label: "XAU/USD", color: "#fcd34d" },
    { label: "GBP/USD", color: "#22c55e" },
    { label: "ETH/USD", color: "#a78bfa" },
    { label: "XAG/USD", color: "#94a3b8" },
    { label: "USD/JPY", color: "#f97316" },
    { label: "AUD/USD", color: "#22d3ee" },
  ];

  const WA_LINK = "https://wa.me/244921825299?text=" + encodeURIComponent("Olá! Preciso de ajuda com a Dynamics Works.");

  return (
    <div style={{ minHeight: "100vh", background: "#070d1c", fontFamily: "system-ui, sans-serif", color: "#fff", overflowX: "hidden" }}>
      <style>{`
        @keyframes blink      { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes float      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes shimmer    { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 20px rgba(245,166,35,0.3)} 50%{box-shadow:0 0 40px rgba(245,166,35,0.6)} }
        .hover-card:hover  { transform:translateY(-4px) !important; box-shadow:0 12px 40px rgba(0,0,0,0.4) !important; border-color:rgba(245,166,35,0.3) !important; }
        .hover-btn:hover   { filter:brightness(1.1); transform:scale(1.03); }
        .hover-asset:hover { transform:scale(1.05); }
        * { box-sizing: border-box; }
      `}</style>

      {/* Background grid */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(30,45,80,0.18) 1px,transparent 1px),linear-gradient(90deg,rgba(30,45,80,0.18) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
        <div style={{ position: "absolute", top: "10%", left: "15%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,166,35,0.06) 0%,transparent 70%)", animation: "float 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "40%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(59,130,246,0.06) 0%,transparent 70%)", animation: "float 10s ease-in-out infinite reverse" }} />
        <div style={{ position: "absolute", bottom: "15%", left: "30%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(167,139,250,0.05) 0%,transparent 70%)", animation: "float 12s ease-in-out infinite" }} />
      </div>

      {/* ── Navbar ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,13,28,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(30,45,80,0.8)", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all .5s ease", transform: navIn ? "translateY(0)" : "translateY(-100%)", opacity: navIn ? 1 : 0 }}>
        <Logo />

        {/* Desktop nav */}
        <div style={{ display: "flex", gap: 10 }} className="desktop-nav">
          <button onClick={() => router.push("/login")} className="hover-btn"
            style={{ background: "transparent", border: "1px solid rgba(30,45,80,0.8)", color: "#94a3b8", borderRadius: 8, padding: "8px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all .2s" }}>
            Entrar
          </button>
          <button onClick={() => router.push("/register")} className="hover-btn"
            style={{ background: "linear-gradient(135deg,#f5a623,#e8940f)", border: "none", color: "#0a0f1e", borderRadius: 8, padding: "8px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all .2s", boxShadow: "0 4px 16px rgba(245,166,35,0.3)" }}>
            Criar Conta
          </button>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileMenu(v => !v)}
          style={{ display: "none", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}
          className="mobile-menu-btn">
          {mobileMenu ? <X size={24} /> : <Menu size={24} />}
        </button>

        <style>{`
          @media (max-width: 540px) {
            .desktop-nav { display: none !important; }
            .mobile-menu-btn { display: flex !important; }
          }
        `}</style>
      </nav>

      {/* Mobile menu overlay */}
      {mobileMenu && (
        <div style={{ position: "fixed", top: 64, left: 0, right: 0, bottom: 0, zIndex: 99, background: "rgba(7,13,28,0.98)", backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <button onClick={() => { router.push("/login"); setMobileMenu(false); }}
            style={{ width: 240, background: "transparent", border: "1px solid rgba(30,45,80,0.8)", color: "#fff", borderRadius: 12, padding: "16px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
            Entrar
          </button>
          <button onClick={() => { router.push("/register"); setMobileMenu(false); }}
            style={{ width: 240, background: "linear-gradient(135deg,#f5a623,#e8940f)", border: "none", color: "#0a0f1e", borderRadius: 12, padding: "16px 24px", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 24px rgba(245,166,35,0.4)" }}>
            Criar Conta Grátis
          </button>
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 8, color: "#22c55e", fontSize: 14, textDecoration: "none", marginTop: 8 }}>
            <MessageCircle size={16} /> WhatsApp Suporte
          </a>
        </div>
      )}

      {/* ── Hero ── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto", padding: "90px 24px 70px", textAlign: "center" }}>
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 300, background: "radial-gradient(ellipse,rgba(245,166,35,0.08) 0%,transparent 70%)", pointerEvents: "none" }} />

        {/* Badge */}
        <div style={{ minHeight: 34, marginBottom: 28, display: "flex", justifyContent: "center" }}>
          {ready && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 20, padding: "6px 18px", fontSize: 11, fontWeight: 700, color: "#f5a623", letterSpacing: 1.5, textTransform: "uppercase" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 8px #22c55e", animation: "blink 2s ease-in-out infinite" }} />
              {badge.displayed}
              {!badge.done && <Cursor done={false} />}
            </div>
          )}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: "clamp(34px,6.5vw,64px)", fontWeight: 900, lineHeight: 1.08, margin: "0 0 24px", letterSpacing: -1.5, minHeight: "2.4em" }}>
          <span style={{ display: "block", color: "#f0f4ff" }}>
            {l1.displayed}
            {!l1.done && badge.done && <Cursor done={false} />}
          </span>
          <span style={{ display: "block", background: "linear-gradient(90deg,#f5a623 0%,#fbbf24 50%,#f97316 100%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: l2.done ? "shimmer 4s linear infinite" : "none" }}>
            {l2.displayed}
            {!l2.done && l1.done && <Cursor done={false} />}
            {l2.done && <Cursor done={true} />}
          </span>
        </h1>

        {/* Subtitle */}
        <p style={{ fontSize: "clamp(15px,2vw,19px)", color: "#64748b", maxWidth: 580, margin: "0 auto 44px", lineHeight: 1.7, minHeight: "4.5em" }}>
          {sub.displayed}
          {!sub.done && l2.done && <Cursor done={false} />}
        </p>

        {/* CTA */}
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", transition: "opacity .8s ease, transform .8s ease", opacity: sub.done ? 1 : 0, transform: sub.done ? "translateY(0)" : "translateY(20px)" }}>
          <button onClick={() => router.push("/register")} className="hover-btn"
            style={{ background: "linear-gradient(135deg,#f5a623,#f97316)", border: "none", color: "#0a0f1e", borderRadius: 12, padding: "16px 36px", fontSize: 16, fontWeight: 800, cursor: "pointer", transition: "all .2s", boxShadow: "0 6px 28px rgba(245,166,35,0.4)", display: "flex", alignItems: "center", gap: 8, animation: sub.done ? "pulse-glow 3s ease-in-out infinite" : "none" }}>
            Começar Grátis <ArrowRight size={18} strokeWidth={2.5} />
          </button>
          <button onClick={() => router.push("/login")} className="hover-btn"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", borderRadius: 12, padding: "16px 36px", fontSize: 16, fontWeight: 600, cursor: "pointer", transition: "all .2s", backdropFilter: "blur(8px)" }}>
            Já tenho conta
          </button>
        </div>

        <p style={{ color: "#2d3d58", fontSize: 12, marginTop: 18, transition: "opacity .8s ease .3s", opacity: sub.done ? 1 : 0 }}>
          Conta demo com 10.000 Kz virtual grátis · Sem cartão de crédito
        </p>
      </section>

      {/* ── Stats ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <FadeIn>
          <section style={{ background: "rgba(17,24,39,0.7)", borderTop: "1px solid rgba(30,45,80,0.6)", borderBottom: "1px solid rgba(30,45,80,0.6)", backdropFilter: "blur(12px)" }}>
            <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 24px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0 }}>
              <div style={{ borderRight: "1px solid rgba(30,45,80,0.6)" }}>
                <StatCard label="Utilizadores Registados" target={stats.users} format={n => n.toLocaleString("pt-PT")} />
              </div>
              <div style={{ borderRight: "1px solid rgba(30,45,80,0.6)" }}>
                <StatCard label="Operações Concluídas" target={stats.trades} format={n => n.toLocaleString("pt-PT")} />
              </div>
              <StatCard label="Volume Negociado" target={stats.volume} format={formatKz} />
            </div>
          </section>
        </FadeIn>
      </div>

      {/* ── Assets ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "70px 24px 0" }}>
          <FadeIn>
            <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, marginBottom: 10, letterSpacing: -0.5 }}>Ativos Disponíveis</h2>
            <p style={{ textAlign: "center", color: "#4b5563", fontSize: 14, marginBottom: 32 }}>Negocie os principais pares do mercado global em tempo real</p>
          </FadeIn>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {assets.map((a, i) => (
              <FadeIn key={a.label} delay={i * 70}>
                <div className="hover-asset" style={{ background: "rgba(17,24,39,0.8)", border: `1px solid ${a.color}30`, borderRadius: 10, padding: "10px 22px", fontSize: 14, fontWeight: 700, color: a.color, cursor: "default", transition: "all .25s", backdropFilter: "blur(8px)" }}>
                  {a.label}
                </div>
              </FadeIn>
            ))}
            <FadeIn delay={assets.length * 70}>
              <div style={{ background: "rgba(17,24,39,0.5)", border: "1px solid rgba(30,45,80,0.4)", borderRadius: 10, padding: "10px 22px", fontSize: 14, fontWeight: 600, color: "#374151" }}>+8 mais</div>
            </FadeIn>
          </div>
        </section>
      </div>

      {/* ── Features ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "70px 24px" }}>
          <FadeIn>
            <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, marginBottom: 10, letterSpacing: -0.5 }}>Porque escolher a Dynamics Works?</h2>
            <p style={{ textAlign: "center", color: "#4b5563", fontSize: 14, marginBottom: 44 }}>Tudo o que precisas para negociar com confiança</p>
          </FadeIn>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
            {features.map((f, i) => (
              <FadeIn key={i} delay={i * 90}>
                <div className="hover-card" style={{ background: "rgba(17,24,39,0.7)", border: "1px solid rgba(30,45,80,0.6)", borderRadius: 16, padding: "28px 22px", transition: "all .3s", cursor: "default", backdropFilter: "blur(8px)", height: "100%" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg,${f.color}22,${f.color}08)`, border: `1px solid ${f.color}30`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: `0 4px 16px ${f.color}20` }}>
                    <f.Icon size={24} color={f.color} strokeWidth={1.8} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: "#f0f4ff" }}>{f.title}</div>
                  <div style={{ color: "#4b5563", fontSize: 13, lineHeight: 1.7 }}>{f.desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>
      </div>

      {/* ── Pagamentos ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <FadeIn>
          <section style={{ background: "rgba(10,15,30,0.8)", borderTop: "1px solid rgba(30,45,80,0.5)", borderBottom: "1px solid rgba(30,45,80,0.5)", backdropFilter: "blur(12px)" }}>
            <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
              <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }}>Pagamentos em Kwanza</h2>
              <p style={{ color: "#4b5563", fontSize: 14, marginBottom: 36 }}>Depósitos e levantamentos simples, rápidos e em moeda local</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 }}>
                {[
                  { title: "Multicaixa Express",   desc: "Depósito e levantamento directo em AOA", color: "#f5a623" },
                  { title: "Saldo Mínimo",         desc: "Depósito mínimo de 5.000 Kz", color: "#22c55e" },
                  { title: "Aprovação Rápida",     desc: "Depósitos aprovados em até 24 horas úteis", color: "#3b82f6" },
                  { title: "Levantamentos",        desc: "Processados em 1 a 3 dias úteis após KYC", color: "#a78bfa" },
                ].map((p, i) => (
                  <div key={i} style={{ background: `rgba(17,24,39,0.7)`, border: `1px solid ${p.color}25`, borderRadius: 12, padding: "20px 16px", textAlign: "left" }}>
                    <div style={{ color: p.color, fontWeight: 800, fontSize: 14, marginBottom: 6 }}>{p.title}</div>
                    <div style={{ color: "#4b5563", fontSize: 13, lineHeight: 1.6 }}>{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </FadeIn>
      </div>

      {/* ── Como funciona ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "70px 24px", textAlign: "center" }}>
          <FadeIn>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }}>Como funciona?</h2>
            <p style={{ color: "#4b5563", fontSize: 14, marginBottom: 52 }}>Começa a negociar em 3 passos simples</p>
          </FadeIn>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {steps.map((s, i) => (
              <FadeIn key={i} delay={i * 180} y={20}>
                <div style={{ display: "flex", gap: 24, alignItems: "flex-start", textAlign: "left", paddingBottom: i < steps.length - 1 ? 40 : 0, position: "relative" }}>
                  {i < steps.length - 1 && (
                    <div style={{ position: "absolute", left: 23, top: 52, width: 2, height: "calc(100% - 12px)", background: `linear-gradient(${s.color}60,${steps[i+1].color}20)` }} />
                  )}
                  <div style={{ flexShrink: 0, width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${s.color},${s.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#0a0f1e", boxShadow: `0 6px 20px ${s.color}40`, border: `2px solid ${s.color}40` }}>
                    {s.n}
                  </div>
                  <div style={{ paddingTop: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: "#f0f4ff" }}>{s.title}</div>
                    <div style={{ color: "#4b5563", fontSize: 14, lineHeight: 1.6 }}>{s.desc}</div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>
      </div>

      {/* ── CTA final ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <FadeIn>
          <section style={{ maxWidth: 700, margin: "0 auto", padding: "70px 24px 90px", textAlign: "center" }}>
            <div style={{ background: "linear-gradient(135deg,rgba(245,166,35,0.08),rgba(59,130,246,0.08))", border: "1px solid rgba(245,166,35,0.15)", borderRadius: 24, padding: "60px 40px", backdropFilter: "blur(16px)" }}>
              <h2 style={{ fontSize: "clamp(22px,4vw,36px)", fontWeight: 900, marginBottom: 14, letterSpacing: -0.5 }}>Pronto para começar?</h2>
              <p style={{ color: "#4b5563", fontSize: 16, marginBottom: 36, lineHeight: 1.6 }}>
                Regista-te agora e recebe <strong style={{ color: "#f5a623" }}>10.000 Kz virtual</strong> para treinar sem risco.
              </p>
              <button onClick={() => router.push("/register")} className="hover-btn"
                style={{ background: "linear-gradient(135deg,#f5a623,#f97316)", border: "none", color: "#0a0f1e", borderRadius: 12, padding: "18px 56px", fontSize: 18, fontWeight: 800, cursor: "pointer", transition: "all .2s", boxShadow: "0 8px 32px rgba(245,166,35,0.4)", display: "inline-flex", alignItems: "center", gap: 10 }}>
                Criar Conta Gratuita <ChevronRight size={20} strokeWidth={3} />
              </button>
              <p style={{ color: "#2d3d58", fontSize: 12, marginTop: 16 }}>Sem cartão de crédito · Cancela quando quiseres</p>
            </div>
          </section>
        </FadeIn>
      </div>

      {/* ── Footer ── */}
      <footer style={{ position: "relative", zIndex: 1, background: "rgba(5,9,18,0.95)", borderTop: "1px solid rgba(30,45,80,0.5)", padding: "40px 24px 28px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          {/* Top */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 32, justifyContent: "space-between", marginBottom: 36 }}>
            {/* Brand */}
            <div style={{ maxWidth: 260 }}>
              <Logo />
              <p style={{ color: "#374151", fontSize: 13, marginTop: 12, lineHeight: 1.7 }}>
                A primeira corretora de opções binárias angolana com pagamentos em Kwanza.
              </p>
            </div>

            {/* Links */}
            <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Plataforma</div>
                {[
                  { label: "Entrar",       href: "/login" },
                  { label: "Registar",     href: "/register" },
                  { label: "Conta Demo",   href: "/register" },
                  { label: "Referidos",    href: "/register" },
                ].map(l => (
                  <div key={l.label} style={{ marginBottom: 8 }}>
                    <a href={l.href} style={{ color: "#475569", fontSize: 14, textDecoration: "none" }}
                      onMouseOver={e => (e.currentTarget.style.color = "#f5a623")}
                      onMouseOut={e  => (e.currentTarget.style.color = "#475569")}>
                      {l.label}
                    </a>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Apoio</div>
                {[
                  { label: "Suporte",       href: "/support" },
                  { label: "Termos de Uso", href: "/terms" },
                ].map(l => (
                  <div key={l.label} style={{ marginBottom: 8 }}>
                    <a href={l.href} style={{ color: "#475569", fontSize: 14, textDecoration: "none" }}
                      onMouseOver={e => (e.currentTarget.style.color = "#f5a623")}
                      onMouseOut={e  => (e.currentTarget.style.color = "#475569")}>
                      {l.label}
                    </a>
                  </div>
                ))}
                <div style={{ marginTop: 12 }}>
                  <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)", borderRadius: 8, padding: "8px 14px", color: "#22c55e", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div style={{ borderTop: "1px solid rgba(30,45,80,0.5)", paddingTop: 20, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <p style={{ color: "#1e2d50", fontSize: 12, margin: 0 }}>
              © {new Date().getFullYear()} Dynamics Works · Angola · Todos os direitos reservados
            </p>
            <p style={{ color: "#1e2d50", fontSize: 12, margin: 0 }}>
              Opções binárias envolvem risco. Negocie com responsabilidade.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
