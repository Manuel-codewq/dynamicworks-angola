"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ShieldCheck, TrendingUp, Banknote } from "lucide-react";

function formatKz(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + " Mil M Kz";
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + " M Kz";
  if (n >= 1_000)         return (n / 1_000).toFixed(0) + " mil Kz";
  return n.toLocaleString("pt-AO") + " Kz";
}

export default function LandingPage() {
  const router = useRouter();
  const [stats, setStats] = useState({ users: 0, trades: 0, volume: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(d => {
      setStats(d);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const features = [
    { Icon: Zap,         color: "#f5a623", title: "Execução Instantânea",  desc: "As suas ordens são executadas em milissegundos com preços em tempo real via Deriv." },
    { Icon: ShieldCheck, color: "#22c55e", title: "Conta Segura",          desc: "Verificação KYC obrigatória, autenticação por OTP e encriptação de dados." },
    { Icon: TrendingUp,  color: "#3b82f6", title: "16+ Ativos",            desc: "Forex, criptomoedas e metais preciosos disponíveis 24/7 para negociar." },
    { Icon: Banknote,    color: "#a78bfa", title: "Pagamentos em Kwanza",  desc: "Depósitos e levantamentos em AOA via Multicaixa Express, sem conversão cambial." },
  ];

  const assets = [
    { label: "EUR/USD", color: "#3b82f6" },
    { label: "BTC/USD", color: "#f5a623" },
    { label: "XAU/USD", color: "#fcd34d" },
    { label: "GBP/USD", color: "#22c55e" },
    { label: "ETH/USD", color: "#a78bfa" },
    { label: "XAG/USD", color: "#94a3b8" },
  ];

  const steps = [
    { n: "1", title: "Cria a tua conta", desc: "Regista-te gratuitamente em menos de 2 minutos." },
    { n: "2", title: "Faz o depósito",   desc: "Transfere via Multicaixa Express em Kwanza." },
    { n: "3", title: "Começa a negociar", desc: "Escolhe o ativo, prevê a direção e ganha." },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif", color: "#fff" }}>

      {/* ── Navbar ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(10,15,30,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1e2d50", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: "#f5a623", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#0a0f1e" }}>D</span>
          </div>
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5 }}>Dynamics Works</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => router.push("/login")}
            style={{ background: "transparent", border: "1px solid #1e2d50", color: "#94a3b8", borderRadius: 8, padding: "8px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Entrar
          </button>
          <button onClick={() => router.push("/register")}
            style={{ background: "#f5a623", border: "none", color: "#0a0f1e", borderRadius: 8, padding: "8px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Criar Conta
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px 60px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 20, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: "#f5a623", letterSpacing: 1, marginBottom: 24, textTransform: "uppercase" }}>
          Plataforma de Opções Binárias · Angola
        </div>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 58px)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 20px", letterSpacing: -1 }}>
          Negocie no Mercado Global
          <br />
          <span style={{ background: "linear-gradient(90deg, #f5a623, #fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            em Kwanzas
          </span>
        </h1>
        <p style={{ fontSize: 18, color: "#94a3b8", maxWidth: 560, margin: "0 auto 36px", lineHeight: 1.6 }}>
          A primeira corretora de opções binárias angolana com pagamentos em AOA,
          preços em tempo real e conta demo gratuita.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/register")}
            style={{ background: "#f5a623", border: "none", color: "#0a0f1e", borderRadius: 10, padding: "14px 32px", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
            Começar Grátis
          </button>
          <button onClick={() => router.push("/login")}
            style={{ background: "transparent", border: "1px solid #1e2d50", color: "#94a3b8", borderRadius: 10, padding: "14px 32px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
            Já tenho conta
          </button>
        </div>
        <p style={{ color: "#374151", fontSize: 12, marginTop: 14 }}>
          Conta demo com 10.000 Kz virtual grátis · Sem cartão de crédito
        </p>
      </section>

      {/* ── Stats reais ── */}
      <section style={{ background: "#111827", borderTop: "1px solid #1e2d50", borderBottom: "1px solid #1e2d50" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }}>
          {[
            { label: "Utilizadores Registados", value: loaded ? stats.users.toLocaleString("pt-AO") : "—" },
            { label: "Operações Concluídas",    value: loaded ? stats.trades.toLocaleString("pt-AO") : "—" },
            { label: "Volume Negociado",         value: loaded ? formatKz(stats.volume) : "—" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "8px 16px", borderRight: i < 2 ? "1px solid #1e2d50" : "none" }}>
              <div style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 900, color: "#f5a623" }}>{s.value}</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Assets ── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px 0" }}>
        <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Ativos Disponíveis</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {assets.map(a => (
            <div key={a.label} style={{ background: "#111827", border: `1px solid ${a.color}30`, borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700, color: a.color }}>
              {a.label}
            </div>
          ))}
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#374151" }}>
            +10 mais
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 800, marginBottom: 36 }}>Porque escolher a Dynamics Works?</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "24px 20px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${f.color}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <f.Icon size={22} color={f.color} strokeWidth={2} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{f.title}</div>
              <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section style={{ background: "#111827", borderTop: "1px solid #1e2d50", borderBottom: "1px solid #1e2d50" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 40 }}>Como funciona?</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start", textAlign: "left", paddingBottom: i < steps.length - 1 ? 32 : 0, position: "relative" }}>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ width: 40, height: 40, background: "#f5a623", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: "#0a0f1e" }}>{s.n}</div>
                  {i < steps.length - 1 && <div style={{ width: 2, height: "calc(100% - 40px)", background: "linear-gradient(#f5a623, #1e2d50)", margin: "0 auto" }} />}
                </div>
                <div style={{ paddingTop: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{s.title}</div>
                  <div style={{ color: "#64748b", fontSize: 14 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ maxWidth: 700, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(24px, 4vw, 38px)", fontWeight: 900, marginBottom: 16 }}>
          Pronto para começar?
        </h2>
        <p style={{ color: "#64748b", fontSize: 16, marginBottom: 32 }}>
          Regista-te agora e recebe 10.000 Kz virtual para treinar sem risco.
        </p>
        <button onClick={() => router.push("/register")}
          style={{ background: "#f5a623", border: "none", color: "#0a0f1e", borderRadius: 10, padding: "16px 48px", fontSize: 18, fontWeight: 800, cursor: "pointer" }}>
          Criar Conta Gratuita
        </button>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "#080e1d", borderTop: "1px solid #1e2d50", padding: "24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 24, height: 24, background: "#f5a623", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#0a0f1e" }}>D</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 14 }}>Dynamics Works</span>
        </div>
        <p style={{ color: "#374151", fontSize: 12, margin: 0, lineHeight: 1.8 }}>
          Opções binárias envolvem risco. Negocie com responsabilidade.
          <br />
          © {new Date().getFullYear()} Dynamics Works · Angola
        </p>
      </footer>
    </div>
  );
}
