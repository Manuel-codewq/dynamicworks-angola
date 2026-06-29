"use client";
import { formatKz } from "@/lib/format";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Zap, ShieldCheck, TrendingUp, Banknote, ArrowRight,
  ChevronRight, Gift, Menu, X, MessageCircle,
  CheckCircle, ChevronDown, Star, Trophy, Lock,
  BarChart2, Clock, Users, Globe,
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
    <img src="/logo-icon.jpeg" alt="Dynamic Works" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 9, background: "#111827" }} />
    <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5, background: "linear-gradient(90deg,#fff,#94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
      Dynamic Works
    </span>
  </div>
);

// ── Mock trading chart ────────────────────────────────────────────────────────
function MiniChart() {
  const pts = [40,44,42,48,45,52,49,55,53,60,57,65,62,68,72,69,76,73,80,78,85];
  const w = 280, h = 80;
  const min = Math.min(...pts), max = Math.max(...pts);
  const toX = (i: number) => (i / (pts.length - 1)) * w;
  const toY = (v: number) => h - ((v - min) / (max - min)) * h * 0.85 - h * 0.075;
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const fill = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ecb81" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0ecb81" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#chartGrad)" />
      <path d={d} fill="none" stroke="#0ecb81" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={toX(pts.length - 1)} cy={toY(pts[pts.length - 1])} r="4" fill="#0ecb81" />
    </svg>
  );
}

// ── Platform mockup ───────────────────────────────────────────────────────────
function PlatformMockup() {
  const [price, setPrice] = useState(1.08432);
  const [up, setUp] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setPrice(p => {
        const d = (Math.random() - 0.48) * 0.00015;
        setUp(d >= 0);
        return Math.max(1.07, Math.min(1.10, p + d));
      });
    }, 800);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: "#0d1420", border: "1px solid rgba(30,45,80,0.9)", borderRadius: 16, overflow: "hidden", width: "100%", maxWidth: 420, boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,166,35,0.08)" }}>
      {/* Header bar */}
      <div style={{ background: "#111827", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(30,45,80,0.8)" }}>
        <div style={{ display: "flex", gap: 5 }}>
          {["#f6465d","#f5a623","#22c55e"].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />)}
        </div>
        <span style={{ color: "#475569", fontSize: 11, flex: 1, textAlign: "center" }}>Dynamic Works — Trading</span>
      </div>

      {/* Pair + price */}
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(30,45,80,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#3b82f6" }}>€$</div>
          <div>
            <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>EUR/USD</div>
            <div style={{ color: "#475569", fontSize: 10 }}>OTC · 24/7</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: up ? "#0ecb81" : "#f6465d", fontSize: 18, fontWeight: 900, fontVariantNumeric: "tabular-nums", transition: "color .3s" }}>{price.toFixed(5)}</div>
          <div style={{ color: up ? "#0ecb81" : "#f6465d", fontSize: 10 }}>{up ? "▲" : "▼"} {(Math.random() * 0.02 + 0.01).toFixed(2)}%</div>
        </div>
      </div>

      {/* Chart area */}
      <div style={{ padding: "12px 14px 8px", background: "#0a0f1e" }}>
        <MiniChart />
      </div>

      {/* Trade controls */}
      <div style={{ padding: "10px 14px 14px", background: "#0a0f1e", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, background: "rgba(14,203,129,0.08)", border: "1px solid rgba(14,203,129,0.25)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ color: "#0ecb81", fontSize: 11, fontWeight: 700 }}>COMPRA</div>
            <div style={{ color: "#64748b", fontSize: 10 }}>+85% payout</div>
          </div>
          <div style={{ flex: 1, background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.25)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ color: "#f6465d", fontSize: 11, fontWeight: 700 }}>VENDA</div>
            <div style={{ color: "#64748b", fontSize: 10 }}>+85% payout</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#334155" }}>
          <span>⏱ Expiração: 1m</span>
          <span>💰 Valor: 10.000 Kz</span>
        </div>
      </div>
    </div>
  );
}


// ── FAQ ───────────────────────────────────────────────────────────────────────
function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid rgba(30,45,80,0.5)" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left", gap: 16 }}>
        <span style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 600 }}>{q}</span>
        <ChevronDown size={16} color="#64748b" style={{ flexShrink: 0, transition: "transform .25s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      <div style={{ overflow: "hidden", maxHeight: open ? 200 : 0, transition: "max-height .3s ease", marginBottom: open ? 16 : 0 }}>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{a}</p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const { status } = useSession();
  const [stats,       setStats]      = useState({ users: 0, trades: 0, volume: 0 });
  const [ready,       setReady]      = useState(false);
  const [navIn,       setNavIn]      = useState(false);
  const [mobileMenu,  setMobileMenu] = useState(false);
  const [navScrolled, setNavScrolled]= useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/trade");
  }, [status, router]);

  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(setStats).catch(() => {});
    setTimeout(() => setNavIn(true), 50);
    setTimeout(() => setReady(true), 300);
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const badge = useTypewriter("Plataforma de Opções Binárias · Angola", 36, 0, ready);
  const l1    = useTypewriter("Negoceie no Mercado Global", 48, 0, badge.done);
  const l2    = useTypewriter("em Kwanzas.", 55, 0, l1.done);
  const sub   = useTypewriter("A primeira corretora de opções binárias angolana com pagamentos em AOA via Multicaixa, preços em tempo real e conta demo gratuita.", 18, 0, l2.done);

  const features = [
    { Icon: Zap,         color: "#f5a623", title: "Execução Instantânea",   desc: "Ordens executadas em milissegundos com preços do mercado global em tempo real." },
    { Icon: ShieldCheck, color: "#22c55e", title: "Segurança Avançada",     desc: "KYC obrigatório, autenticação 2FA por email e encriptação de ponta a ponta." },
    { Icon: BarChart2,   color: "#3b82f6", title: "30+ Indicadores",        desc: "RSI, MACD, Bollinger, Ichimoku, Supertrend e muito mais integrados no gráfico." },
    { Icon: Banknote,    color: "#a78bfa", title: "Pagamentos em Kwanza",   desc: "Depósitos e levantamentos em AOA via Multicaixa Express. Rápido e sem complicações." },
    { Icon: Gift,        color: "#f97316", title: "Bónus de Boas-Vindas",   desc: "Recebe +10% de bónus directo no saldo no primeiro depósito acima de 50.000 Kz." },
    { Icon: Trophy,      color: "#fbbf24", title: "Torneios & Rankings",    desc: "Compete com outros traders em torneios com prémios reais em Kwanza." },
    { Icon: Users,       color: "#22d3ee", title: "Programa de Referidos",  desc: "Ganha 2% de comissão em cada depósito dos utilizadores que trouxeres." },
    { Icon: Globe,       color: "#818cf8", title: "Conta Demo Grátis",      desc: "10.000 Kz virtual para praticar sem risco antes de investir capital real." },
  ];

  const steps = [
    { n: "01", title: "Cria a tua conta",    desc: "Regista-te com o teu BI/NIF em menos de 2 minutos. Verificação automática.",               color: "#f5a623" },
    { n: "02", title: "Faz o depósito",      desc: "Transfere em Kwanza via Multicaixa Express. Aprovação em até 24 horas. Bónus de 10% no 1.º depósito.", color: "#3b82f6" },
    { n: "03", title: "Começa a negociar",   desc: "Escolhe o ativo, analisa com indicadores profissionais e faz a tua previsão.",              color: "#22c55e" },
  ];

  const assets = [
    { label: "EUR/USD", color: "#3b82f6",  change: "+0.18%" },
    { label: "BTC/USD", color: "#f5a623",  change: "+2.41%" },
    { label: "XAU/USD", color: "#fcd34d",  change: "+0.63%" },
    { label: "GBP/USD", color: "#22c55e",  change: "-0.09%" },
    { label: "ETH/USD", color: "#a78bfa",  change: "+3.12%" },
    { label: "XAG/USD", color: "#94a3b8",  change: "+0.44%" },
    { label: "USD/JPY", color: "#f97316",  change: "-0.22%" },
    { label: "AUD/USD", color: "#22d3ee",  change: "+0.11%" },
  ];

  const faqs = [
    { q: "O que são opções binárias?", a: "Opções binárias são instrumentos financeiros onde prevês se o preço de um ativo vai subir ou descer num determinado período. Se a tua previsão estiver certa, recebes o payout (até 85%). Se estiver errada, perdes o valor apostado." },
    { q: "Como faço um depósito?", a: "Vai a Carteira → Depósito, indica o valor e confirma com o código OTP enviado para o teu email. Depois efectua o pagamento via Multicaixa Express com a referência fornecida. O admin aprova em até 24 horas úteis." },
    { q: "Preciso de fazer verificação KYC?", a: "Sim. O KYC é obrigatório para proteger a tua conta e cumprir os requisitos de segurança. O processo é simples: envia a foto do teu BI e um selfie. A aprovação demora geralmente menos de 24 horas." },
    { q: "Como funciona o bónus de 10%?", a: "No primeiro depósito de 50.000 Kz ou mais, receberes automaticamente +10% de bónus directo no teu saldo real. Por exemplo: depositas 100.000 Kz e recebes 110.000 Kz para negociar. Sem condições escondidas." },
    { q: "Em quanto tempo é processado um levantamento?", a: "Os levantamentos são processados em 1 a 3 dias úteis após aprovação, mediante verificação KYC completa. Recebes uma notificação assim que o pedido for aprovado." },
    { q: "A conta demo é realmente grátis?", a: "Sim. Ao criar a conta receberes 10.000 Kz virtual para praticar sem qualquer risco. A conta demo não tem prazo de expiração e podes recarregar quando quiser." },
  ];

  const WA_LINK = "https://wa.me/244921825299?text=" + encodeURIComponent("Olá! Preciso de ajuda com a Dynamic Works.");

  return (
    <div style={{ minHeight: "100vh", background: "#070d1c", fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#fff", overflowX: "hidden" }}>
      <style>{`
        @keyframes blink      { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes float      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes shimmer    { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 20px rgba(245,166,35,0.35)} 50%{box-shadow:0 0 44px rgba(245,166,35,0.65)} }
        @keyframes spin-slow  { to { transform: rotate(360deg); } }
        .hover-card:hover  { transform:translateY(-5px) !important; box-shadow:0 20px 50px rgba(0,0,0,0.5) !important; border-color:rgba(245,166,35,0.35) !important; }
        .hover-btn:hover   { filter:brightness(1.1); transform:scale(1.03); }
        .hover-asset:hover { transform:scale(1.06); border-color:rgba(245,166,35,0.4) !important; }
        .faq-btn:hover span { color:#f5a623 !important; }
        * { box-sizing: border-box; }
        @media(max-width:768px){
          .desktop-nav { display:none !important; }
          .mobile-menu-btn { display:flex !important; }
          .hero-grid { flex-direction:column !important; }
          .hero-mockup { display:none !important; }
          .steps-grid { flex-direction:column !important; }
        }
      `}</style>

      {/* Background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(30,45,80,0.14) 1px,transparent 1px),linear-gradient(90deg,rgba(30,45,80,0.14) 1px,transparent 1px)", backgroundSize: "64px 64px" }} />
        <div style={{ position: "absolute", top: "8%",  left: "12%",  width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,166,35,0.055) 0%,transparent 70%)", animation: "float 9s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "45%", right: "8%",  width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(59,130,246,0.055) 0%,transparent 70%)", animation: "float 11s ease-in-out infinite reverse" }} />
        <div style={{ position: "absolute", bottom: "12%", left: "28%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle,rgba(167,139,250,0.045) 0%,transparent 70%)", animation: "float 13s ease-in-out infinite" }} />
      </div>

      {/* ── Navbar ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: navScrolled ? "rgba(7,13,28,0.97)" : "rgba(7,13,28,0.80)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${navScrolled ? "rgba(245,166,35,0.15)" : "rgba(30,45,80,0.6)"}`, padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all .4s ease", transform: navIn ? "translateY(0)" : "translateY(-100%)", opacity: navIn ? 1 : 0, boxShadow: navScrolled ? "0 4px 30px rgba(0,0,0,0.3)" : "none" }}>
        <Logo />

        <div style={{ display: "flex", alignItems: "center", gap: 28 }} className="desktop-nav">
          <a href="#como-funciona" style={{ color: "#64748b", fontSize: 14, fontWeight: 500, textDecoration: "none", transition: "color .2s" }}
            onMouseOver={e => (e.currentTarget.style.color = "#e2e8f0")} onMouseOut={e => (e.currentTarget.style.color = "#64748b")}>
            Como funciona
          </a>
          <a href="#faq" style={{ color: "#64748b", fontSize: 14, fontWeight: 500, textDecoration: "none", transition: "color .2s" }}
            onMouseOver={e => (e.currentTarget.style.color = "#e2e8f0")} onMouseOut={e => (e.currentTarget.style.color = "#64748b")}>
            FAQ
          </a>
          <div style={{ width: 1, height: 20, background: "rgba(30,45,80,0.8)" }} />
          <button onClick={() => router.push("/login")} className="hover-btn"
            style={{ background: "transparent", border: "1px solid rgba(100,116,139,0.4)", color: "#94a3b8", borderRadius: 8, padding: "8px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all .2s" }}>
            Entrar
          </button>
          <button onClick={() => router.push("/register")} className="hover-btn"
            style={{ background: "linear-gradient(135deg,#f5a623,#e8940f)", border: "none", color: "#0a0f1e", borderRadius: 8, padding: "8px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all .2s", boxShadow: "0 4px 16px rgba(245,166,35,0.35)" }}>
            Criar Conta
          </button>
        </div>

        <button onClick={() => setMobileMenu(v => !v)} className="mobile-menu-btn"
          style={{ display: "none", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(30,45,80,0.6)", borderRadius: 8, cursor: "pointer", color: "#94a3b8", padding: "6px 8px", alignItems: "center", justifyContent: "center" }}>
          {mobileMenu ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileMenu && (
        <div style={{ position: "fixed", top: 64, left: 0, right: 0, bottom: 0, zIndex: 99, background: "rgba(7,13,28,0.99)", backdropFilter: "blur(20px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          {[{ label: "Como funciona", href: "#como-funciona" }, { label: "FAQ", href: "#faq" }].map(l => (
            <a key={l.label} href={l.href} onClick={() => setMobileMenu(false)}
              style={{ color: "#94a3b8", fontSize: 18, fontWeight: 600, textDecoration: "none", padding: "12px 0" }}>
              {l.label}
            </a>
          ))}
          <div style={{ width: 180, height: 1, background: "rgba(30,45,80,0.6)", margin: "8px 0" }} />
          <button onClick={() => { router.push("/login"); setMobileMenu(false); }}
            style={{ width: 260, background: "transparent", border: "1px solid rgba(30,45,80,0.8)", color: "#fff", borderRadius: 12, padding: "16px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
            Entrar
          </button>
          <button onClick={() => { router.push("/register"); setMobileMenu(false); }}
            style={{ width: 260, background: "linear-gradient(135deg,#f5a623,#e8940f)", border: "none", color: "#0a0f1e", borderRadius: 12, padding: "16px 24px", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 24px rgba(245,166,35,0.4)" }}>
            Criar Conta Grátis
          </button>
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 8, color: "#22c55e", fontSize: 14, textDecoration: "none", marginTop: 8 }}>
            <MessageCircle size={16} /> WhatsApp Suporte
          </a>
        </div>
      )}

      {/* ── Hero ── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1160, margin: "0 auto", padding: "80px 32px 60px" }}>
        <div className="hero-grid" style={{ display: "flex", alignItems: "center", gap: 64, justifyContent: "space-between" }}>
          {/* Left */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badge */}
            <div style={{ minHeight: 36, marginBottom: 24 }}>
              {ready && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.22)", borderRadius: 20, padding: "6px 16px", fontSize: 11, fontWeight: 700, color: "#f5a623", letterSpacing: 1.4, textTransform: "uppercase" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 8px #22c55e", animation: "blink 2s ease-in-out infinite" }} />
                  {badge.displayed}{!badge.done && <Cursor done={false} />}
                </div>
              )}
            </div>

            {/* Title */}
            <h1 style={{ fontSize: "clamp(36px,5.5vw,62px)", fontWeight: 900, lineHeight: 1.07, margin: "0 0 22px", letterSpacing: -1.5, minHeight: "2.3em" }}>
              <span style={{ display: "block", color: "#f0f4ff" }}>
                {l1.displayed}{!l1.done && badge.done && <Cursor done={false} />}
              </span>
              <span style={{ display: "block", background: "linear-gradient(90deg,#f5a623 0%,#fbbf24 50%,#f97316 100%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: l2.done ? "shimmer 4s linear infinite" : "none" }}>
                {l2.displayed}{!l2.done && l1.done && <Cursor done={false} />}{l2.done && <Cursor done={true} />}
              </span>
            </h1>

            {/* Sub */}
            <p style={{ fontSize: "clamp(15px,1.8vw,18px)", color: "#64748b", maxWidth: 520, margin: "0 0 40px", lineHeight: 1.75, minHeight: "4em" }}>
              {sub.displayed}{!sub.done && l2.done && <Cursor done={false} />}
            </p>

            {/* CTA */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", transition: "opacity .8s ease, transform .8s ease", opacity: sub.done ? 1 : 0, transform: sub.done ? "translateY(0)" : "translateY(20px)" }}>
              <button onClick={() => router.push("/register")} className="hover-btn"
                style={{ background: "linear-gradient(135deg,#f5a623,#f97316)", border: "none", color: "#0a0f1e", borderRadius: 12, padding: "16px 36px", fontSize: 16, fontWeight: 800, cursor: "pointer", transition: "all .2s", boxShadow: "0 6px 28px rgba(245,166,35,0.45)", display: "inline-flex", alignItems: "center", gap: 8, animation: sub.done ? "pulse-glow 3s ease-in-out infinite" : "none" }}>
                Começar Grátis <ArrowRight size={18} strokeWidth={2.5} />
              </button>
              <button onClick={() => router.push("/login")} className="hover-btn"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", borderRadius: 12, padding: "16px 32px", fontSize: 16, fontWeight: 600, cursor: "pointer", transition: "all .2s", backdropFilter: "blur(8px)" }}>
                Já tenho conta
              </button>
            </div>

            {/* Trust badges */}
            <div style={{ display: "flex", gap: 20, marginTop: 24, flexWrap: "wrap", transition: "opacity .8s ease .4s", opacity: sub.done ? 1 : 0 }}>
              {[
                { Icon: Lock,       label: "KYC verificado" },
                { Icon: ShieldCheck,label: "Pagamentos seguros" },
                { Icon: Gift,       label: "+10% bónus 1.º depósito" },
              ].map(({ Icon, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, color: "#334155", fontSize: 12 }}>
                  <Icon size={13} color="#475569" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — platform mockup */}
          <div className="hero-mockup" style={{ flexShrink: 0, transition: "opacity 1s ease .8s, transform 1s ease .8s", opacity: sub.done ? 1 : 0, transform: sub.done ? "translateY(0)" : "translateY(30px)" }}>
            <PlatformMockup />
          </div>
        </div>
      </section>


      {/* ── Stats ── */}
      <FadeIn>
        <section style={{ position: "relative", zIndex: 1, background: "rgba(17,24,39,0.6)", borderBottom: "1px solid rgba(30,45,80,0.5)", backdropFilter: "blur(12px)" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 32px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0 }}>
            <div style={{ borderRight: "1px solid rgba(30,45,80,0.5)" }}>
              <StatCard label="Traders Registados" target={stats.users} format={n => n.toLocaleString("pt-PT")} />
            </div>
            <div style={{ borderRight: "1px solid rgba(30,45,80,0.5)" }}>
              <StatCard label="Operações Concluídas" target={stats.trades} format={n => n.toLocaleString("pt-PT")} />
            </div>
            <StatCard label="Volume Negociado (Kz)" target={stats.volume} format={formatKz} />
          </div>
        </section>
      </FadeIn>

      {/* ── Assets ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <section style={{ maxWidth: 1160, margin: "0 auto", padding: "72px 32px 0" }}>
          <FadeIn>
            <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }}>Ativos Disponíveis</h2>
            <p style={{ textAlign: "center", color: "#4b5563", fontSize: 14, marginBottom: 36 }}>Negoceie os principais pares do mercado global em tempo real</p>
          </FadeIn>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {assets.map((a, i) => (
              <FadeIn key={a.label} delay={i * 60}>
                <div className="hover-asset" style={{ background: "rgba(17,24,39,0.8)", border: `1px solid ${a.color}28`, borderRadius: 12, padding: "12px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "default", transition: "all .25s", backdropFilter: "blur(8px)", minWidth: 100 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: a.color }}>{a.label}</span>
                  <span style={{ fontSize: 11, color: a.change.startsWith("+") ? "#0ecb81" : "#f6465d", fontWeight: 600 }}>{a.change}</span>
                </div>
              </FadeIn>
            ))}
            <FadeIn delay={assets.length * 60}>
              <div style={{ background: "rgba(17,24,39,0.5)", border: "1px solid rgba(30,45,80,0.4)", borderRadius: 12, padding: "12px 20px", fontSize: 13, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", minWidth: 100, justifyContent: "center" }}>+8 mais</div>
            </FadeIn>
          </div>
        </section>
      </div>

      {/* ── Features ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <section style={{ maxWidth: 1160, margin: "0 auto", padding: "72px 32px" }}>
          <FadeIn>
            <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }}>Porque escolher a Dynamic Works?</h2>
            <p style={{ textAlign: "center", color: "#4b5563", fontSize: 14, marginBottom: 48 }}>Tudo o que precisas para negociar com confiança</p>
          </FadeIn>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16 }}>
            {features.map((f, i) => (
              <FadeIn key={i} delay={i * 70}>
                <div className="hover-card" style={{ background: "rgba(17,24,39,0.7)", border: "1px solid rgba(30,45,80,0.55)", borderRadius: 18, padding: "28px 24px", transition: "all .3s", cursor: "default", backdropFilter: "blur(8px)", height: "100%" }}>
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: `linear-gradient(135deg,${f.color}20,${f.color}06)`, border: `1px solid ${f.color}28`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, boxShadow: `0 4px 20px ${f.color}18` }}>
                    <f.Icon size={24} color={f.color} strokeWidth={1.8} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: "#f0f4ff" }}>{f.title}</div>
                  <div style={{ color: "#4b5563", fontSize: 13, lineHeight: 1.75 }}>{f.desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>
      </div>

      {/* ── Pagamentos ── */}
      <FadeIn>
        <div style={{ position: "relative", zIndex: 1, background: "rgba(10,15,30,0.8)", borderTop: "1px solid rgba(30,45,80,0.4)", borderBottom: "1px solid rgba(30,45,80,0.4)", backdropFilter: "blur(12px)" }}>
          <section style={{ maxWidth: 1160, margin: "0 auto", padding: "64px 32px" }}>
            <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }}>Pagamentos em Kwanza</h2>
            <p style={{ textAlign: "center", color: "#4b5563", fontSize: 14, marginBottom: 40 }}>Depósitos e levantamentos simples, rápidos e em moeda local</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14, maxWidth: 900, margin: "0 auto" }}>
              {[
                { Icon: Banknote,    color: "#f5a623", title: "Multicaixa Express",  desc: "Depósito e levantamento directo em AOA sem complicações." },
                { Icon: Zap,         color: "#22c55e", title: "Depósito Mínimo",     desc: "Começa a negociar com apenas 5.000 Kz." },
                { Icon: Clock,       color: "#3b82f6", title: "Aprovação em 24h",    desc: "Depósitos aprovados em até 24 horas úteis." },
                { Icon: ShieldCheck, color: "#a78bfa", title: "Levantamentos Rápidos", desc: "Processados em 1 a 3 dias úteis após KYC." },
              ].map((p, i) => (
                <div key={i} style={{ background: "rgba(17,24,39,0.7)", border: `1px solid ${p.color}22`, borderRadius: 14, padding: "20px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${p.color}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <p.Icon size={18} color={p.color} />
                  </div>
                  <div>
                    <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{p.title}</div>
                    <div style={{ color: "#4b5563", fontSize: 13, lineHeight: 1.6 }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </FadeIn>

      {/* ── Como funciona ── */}
      <div id="como-funciona" style={{ position: "relative", zIndex: 1 }}>
        <section style={{ maxWidth: 800, margin: "0 auto", padding: "72px 32px", textAlign: "center" }}>
          <FadeIn>
            <h2 style={{ fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }}>Como funciona?</h2>
            <p style={{ color: "#4b5563", fontSize: 14, marginBottom: 56 }}>Começa a negociar em 3 passos simples</p>
          </FadeIn>
          <div className="steps-grid" style={{ display: "flex", gap: 0, flexDirection: "column" }}>
            {steps.map((s, i) => (
              <FadeIn key={i} delay={i * 160} y={20}>
                <div style={{ display: "flex", gap: 28, alignItems: "flex-start", textAlign: "left", paddingBottom: i < steps.length - 1 ? 44 : 0, position: "relative" }}>
                  {i < steps.length - 1 && (
                    <div style={{ position: "absolute", left: 25, top: 56, width: 2, height: "calc(100% - 12px)", background: `linear-gradient(${s.color}50,${steps[i+1].color}15)` }} />
                  )}
                  <div style={{ flexShrink: 0, width: 52, height: 52, borderRadius: "50%", background: `linear-gradient(135deg,${s.color},${s.color}80)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#0a0f1e", boxShadow: `0 6px 24px ${s.color}38`, border: `2px solid ${s.color}35`, letterSpacing: -0.5 }}>
                    {s.n}
                  </div>
                  <div style={{ paddingTop: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 7, color: "#f0f4ff" }}>{s.title}</div>
                    <div style={{ color: "#4b5563", fontSize: 14, lineHeight: 1.7 }}>{s.desc}</div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>
      </div>

      {/* ── Testimonials ── */}
      <FadeIn>
        <div style={{ position: "relative", zIndex: 1, background: "rgba(10,15,30,0.7)", borderTop: "1px solid rgba(30,45,80,0.4)", borderBottom: "1px solid rgba(30,45,80,0.4)" }}>
          <section style={{ maxWidth: 1160, margin: "0 auto", padding: "64px 32px" }}>
            <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }}>O que dizem os nossos traders</h2>
            <p style={{ textAlign: "center", color: "#4b5563", fontSize: 14, marginBottom: 44 }}>Experiências reais de traders angolanos</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
              {[
                { name: "Manuel A.", city: "Luanda",     stars: 5, text: "Plataforma muito profissional. Depósito aprovado em menos de 2 horas. Já retiro há 3 meses sem problemas." },
                { name: "Carla M.",  city: "Benguela",   stars: 5, text: "Adoro os indicadores que têm — RSI, MACD, tudo integrado. A conta demo ajudou-me muito a aprender." },
                { name: "David N.",  city: "Cabinda",    stars: 5, text: "Já experimentei outras plataformas mas esta é a única que aceita Kwanzas sem complicações. Recomendo." },
              ].map((t, i) => (
                <div key={i} style={{ background: "rgba(17,24,39,0.8)", border: "1px solid rgba(30,45,80,0.6)", borderRadius: 16, padding: "24px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {Array.from({ length: t.stars }).map((_, j) => <Star key={j} size={14} color="#f5a623" fill="#f5a623" />)}
                  </div>
                  <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>"{t.text}"</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,rgba(245,166,35,0.2),rgba(245,166,35,0.06))", display: "flex", alignItems: "center", justifyContent: "center", color: "#f5a623", fontWeight: 800, fontSize: 14 }}>{t.name[0]}</div>
                    <div>
                      <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>{t.name}</div>
                      <div style={{ color: "#334155", fontSize: 11 }}>{t.city} · Trader verificado</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </FadeIn>

      {/* ── FAQ ── */}
      <div id="faq" style={{ position: "relative", zIndex: 1 }}>
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "72px 32px" }}>
          <FadeIn>
            <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }}>Perguntas Frequentes</h2>
            <p style={{ textAlign: "center", color: "#4b5563", fontSize: 14, marginBottom: 48 }}>Tudo o que precisas de saber antes de começar</p>
          </FadeIn>
          <div>
            {faqs.map((f, i) => <FAQ key={i} q={f.q} a={f.a} />)}
          </div>
          <div style={{ textAlign: "center", marginTop: 36 }}>
            <p style={{ color: "#4b5563", fontSize: 14, marginBottom: 14 }}>Tens mais perguntas?</p>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.25)", borderRadius: 10, padding: "12px 22px", color: "#22c55e", fontSize: 14, fontWeight: 600, textDecoration: "none", transition: "all .2s" }}>
              <MessageCircle size={16} /> Fala connosco no WhatsApp
            </a>
          </div>
        </section>
      </div>

      {/* ── CTA final ── */}
      <FadeIn>
        <div style={{ position: "relative", zIndex: 1 }}>
          <section style={{ maxWidth: 800, margin: "0 auto", padding: "20px 32px 90px", textAlign: "center" }}>
            <div style={{ background: "linear-gradient(135deg,rgba(245,166,35,0.07),rgba(59,130,246,0.07))", border: "1px solid rgba(245,166,35,0.14)", borderRadius: 28, padding: "64px 48px", backdropFilter: "blur(16px)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,166,35,0.06) 0%,transparent 70%)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: -60, left: -60, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle,rgba(59,130,246,0.05) 0%,transparent 70%)", pointerEvents: "none" }} />
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {[CheckCircle, ShieldCheck, Trophy].map((Icon, i) => (
                    <div key={i} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={18} color="#f5a623" />
                    </div>
                  ))}
                </div>
              </div>
              <h2 style={{ fontSize: "clamp(22px,4vw,38px)", fontWeight: 900, marginBottom: 14, letterSpacing: -0.5, position: "relative" }}>Pronto para começar?</h2>
              <p style={{ color: "#64748b", fontSize: 16, marginBottom: 36, lineHeight: 1.7, position: "relative" }}>
                Regista-te agora e recebe <strong style={{ color: "#f5a623" }}>10.000 Kz virtual</strong> para treinar sem risco.<br />
                Primeiro depósito acima de 50.000 Kz? Receberes <strong style={{ color: "#f5a623" }}>+10% de bónus</strong>.
              </p>
              <button onClick={() => router.push("/register")} className="hover-btn"
                style={{ background: "linear-gradient(135deg,#f5a623,#f97316)", border: "none", color: "#0a0f1e", borderRadius: 14, padding: "18px 60px", fontSize: 18, fontWeight: 800, cursor: "pointer", transition: "all .2s", boxShadow: "0 8px 36px rgba(245,166,35,0.45)", display: "inline-flex", alignItems: "center", gap: 10, position: "relative" }}>
                Criar Conta Gratuita <ChevronRight size={20} strokeWidth={3} />
              </button>
              <p style={{ color: "#2d3d58", fontSize: 12, marginTop: 18, position: "relative" }}>Sem cartão de crédito · Cancela quando quiseres</p>
            </div>
          </section>
        </div>
      </FadeIn>

      {/* ── Patrocinadores ── */}
      <FadeIn>
        <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(30,45,80,0.4)", borderBottom: "1px solid rgba(30,45,80,0.4)", background: "rgba(4,7,16,0.6)", backdropFilter: "blur(12px)" }}>
          <section style={{ maxWidth: 1160, margin: "0 auto", padding: "36px 32px", textAlign: "center" }}>
            <p style={{ color: "#1e2d50", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 24 }}>Patrocinador Oficial</p>
            <a href="https://doumblemg.com" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 14, background: "rgba(17,24,39,0.8)", border: "1px solid rgba(245,166,35,0.15)", borderRadius: 14, padding: "16px 28px", textDecoration: "none", transition: "all .25s", cursor: "pointer" }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,166,35,0.4)"; (e.currentTarget as HTMLElement).style.background = "rgba(245,166,35,0.06)"; }}
              onMouseOut={e  => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,166,35,0.15)"; (e.currentTarget as HTMLElement).style.background = "rgba(17,24,39,0.8)"; }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,rgba(245,166,35,0.2),rgba(245,166,35,0.06))", border: "1px solid rgba(245,166,35,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#f5a623", letterSpacing: -0.5 }}>DM</div>
              <div style={{ textAlign: "left" }}>
                <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 14, letterSpacing: -0.3 }}>DOUBLE MG, LDA</div>
                <div style={{ color: "#374151", fontSize: 12 }}>Consultoria Financeira & Gestão</div>
              </div>
            </a>
          </section>
        </div>
      </FadeIn>

      {/* ── Footer ── */}
      <footer style={{ position: "relative", zIndex: 1, background: "rgba(4,7,16,0.98)", borderTop: "1px solid rgba(30,45,80,0.5)", padding: "52px 32px 28px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between", marginBottom: 44 }}>
            {/* Brand */}
            <div style={{ maxWidth: 280 }}>
              <Logo />
              <p style={{ color: "#2d3d58", fontSize: 13, marginTop: 14, lineHeight: 1.8 }}>
                A primeira corretora de opções binárias angolana com pagamentos em Kwanza via Multicaixa Express.
              </p>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(37,211,102,0.07)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: 8, padding: "8px 14px", color: "#22c55e", fontSize: 13, fontWeight: 600, textDecoration: "none", marginTop: 14, transition: "all .2s" }}>
                <MessageCircle size={14} /> WhatsApp Suporte
              </a>
            </div>

            {/* Links */}
            <div style={{ display: "flex", gap: 52, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 16 }}>Plataforma</div>
                {[
                  { label: "Entrar",       href: "/login" },
                  { label: "Registar",     href: "/register" },
                  { label: "Conta Demo",   href: "/register" },
                  { label: "Referidos",    href: "/register" },
                  { label: "Torneios",     href: "/register" },
                ].map(l => (
                  <div key={l.label} style={{ marginBottom: 10 }}>
                    <a href={l.href} style={{ color: "#374151", fontSize: 14, textDecoration: "none", transition: "color .2s" }}
                      onMouseOver={e => (e.currentTarget.style.color = "#f5a623")}
                      onMouseOut={e  => (e.currentTarget.style.color = "#374151")}>
                      {l.label}
                    </a>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 16 }}>Apoio</div>
                {[
                  { label: "Suporte",         href: "/support" },
                  { label: "Termos de Uso",   href: "/terms" },
                  { label: "Como funciona",   href: "#como-funciona" },
                  { label: "FAQ",             href: "#faq" },
                ].map(l => (
                  <div key={l.label} style={{ marginBottom: 10 }}>
                    <a href={l.href} style={{ color: "#374151", fontSize: 14, textDecoration: "none", transition: "color .2s" }}
                      onMouseOver={e => (e.currentTarget.style.color = "#f5a623")}
                      onMouseOut={e  => (e.currentTarget.style.color = "#374151")}>
                      {l.label}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(30,45,80,0.4)", paddingTop: 24, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <p style={{ color: "#1e2d50", fontSize: 12, margin: 0 }}>
              © {new Date().getFullYear()} Dynamic Works · Angola · Todos os direitos reservados
            </p>
            <p style={{ color: "#1e2d50", fontSize: 12, margin: 0, maxWidth: 480, textAlign: "right" }}>
              ⚠️ Opções binárias envolvem risco substancial de perda. Não invistas valores que não podes perder. Este serviço não é disponibilizado a menores de 18 anos.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
