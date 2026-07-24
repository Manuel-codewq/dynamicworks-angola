"use client";
import { formatKz } from "@/lib/format";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRight, MessageCircle, Menu, X } from "lucide-react";

// ── Mini chart ────────────────────────────────────────────────────────────────
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
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ecb81" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0ecb81" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#cg)" />
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
        const delta = (Math.random() - 0.48) * 0.00015;
        setUp(delta >= 0);
        return Math.max(1.07, Math.min(1.10, p + delta));
      });
    }, 800);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: "#0d1420", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, overflow: "hidden", width: 400, boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 60px rgba(255,255,255,0.06)" }}>
      <div style={{ background: "#111827", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", gap: 5 }}>
          {["#f6465d","#ffffff","#22c55e"].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />)}
        </div>
        <span style={{ color: "#475569", fontSize: 11, flex: 1, textAlign: "center", fontWeight: 500 }}>Dynamic Works — Trading</span>
      </div>
      <div style={{ padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(247,147,26,0.12)", border: "1px solid rgba(247,147,26,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#F7931A" }}>₿</div>
          <div>
            <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>ATIVO/USD</div>
            <div style={{ color: "#334155", fontSize: 10 }}>Cripto · 24/7</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: up ? "#0ecb81" : "#f6465d", fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums", transition: "color .3s", letterSpacing: -0.5 }}>{price.toFixed(5)}</div>
          <div style={{ color: up ? "#0ecb81" : "#f6465d", fontSize: 10, fontWeight: 600 }}>{up ? "▲" : "▼"} {(Math.random() * 0.02 + 0.01).toFixed(2)}%</div>
        </div>
      </div>
      <div style={{ padding: "14px", background: "#0a0f1e" }}>
        <MiniChart />
      </div>
      <div style={{ padding: "12px 14px 16px", background: "#0a0f1e", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, background: "rgba(14,203,129,0.07)", border: "1px solid rgba(14,203,129,0.2)", borderRadius: 8, padding: "10px", textAlign: "center" }}>
            <div style={{ color: "#0ecb81", fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>COMPRA</div>
            <div style={{ color: "#1e3a29", fontSize: 10, marginTop: 2 }}>+85% payout</div>
          </div>
          <div style={{ flex: 1, background: "rgba(246,70,93,0.07)", border: "1px solid rgba(246,70,93,0.2)", borderRadius: 8, padding: "10px", textAlign: "center" }}>
            <div style={{ color: "#f6465d", fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>VENDA</div>
            <div style={{ color: "#3a1e23", fontSize: 10, marginTop: 2 }}>+85% payout</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#1e2d50" }}>
          <span>⏱ Expiração: 1m</span>
          <span>💰 Valor: 10.000 Kz</span>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const { status } = useSession();
  const [stats, setStats] = useState({ users: 0, trades: 0, volume: 0 });
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/trade");
  }, [status, router]);

  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(setStats).catch(() => {});
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const WA = "https://wa.me/244921825299?text=" + encodeURIComponent("Olá! Preciso de ajuda com a Dynamic Works.");

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#fff", overflowX: "hidden" }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow    { 0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,.2)} 60%{box-shadow:0 0 0 18px rgba(255,255,255,0)} }
        .fu0  { animation: fadeUp .7s .05s both; }
        .fu1  { animation: fadeUp .7s .15s both; }
        .fu2  { animation: fadeUp .7s .28s both; }
        .fu3  { animation: fadeUp .7s .42s both; }
        .fu4  { animation: fadeUp .7s .56s both; }
        .btn-primary { display:inline-flex;align-items:center;gap:8px;background:#ffffff;border:none;color:#000;border-radius:10px;padding:15px 30px;font-size:15px;font-weight:800;cursor:pointer;transition:all .2s;animation:glow 2.8s ease infinite; }
        .btn-primary:hover { background:#e8e8e8;transform:translateY(-2px);box-shadow:0 10px 30px rgba(255,255,255,.15); }
        .btn-ghost { display:inline-flex;align-items:center;gap:8px;background:transparent;border:1px solid rgba(255,255,255,.1);color:#94a3b8;border-radius:10px;padding:15px 30px;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s; }
        .btn-ghost:hover { border-color:rgba(255,255,255,.25);color:#fff; }
        .nav-a { color:#64748b;font-size:14px;font-weight:500;text-decoration:none;transition:color .2s; }
        .nav-a:hover { color:#fff; }
        .feat-card { background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:40px 32px;transition:border-color .25s,background .25s; }
        .feat-card:hover { border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.03); }
        .step-num { width:52px;height:52px;border-radius:50%;border:1px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);flex-shrink:0; }
        .footer-link { color:#2d3d58;font-size:13px;text-decoration:none;transition:color .2s; }
        .footer-link:hover { color:#fff; }
        @media(max-width:900px) {
          .hero-wrap { flex-direction:column !important; padding:88px 20px 52px !important; gap:32px !important; }
          .hero-mockup { display:none !important; }
          .stats-row { grid-template-columns:1fr !important; gap:0 !important; }
          .feats { grid-template-columns:1fr !important; }
          .steps { flex-direction:column !important; gap:32px !important; }
          .step-arrow { display:none !important; }
          .nav-links { display:none !important; }
          .nav-mobile-btn { display:flex !important; }
          .footer-inner { flex-direction:column !important; align-items:flex-start !important; gap:24px !important; }
          .hero-h1 { font-size:clamp(30px,9vw,48px) !important; letter-spacing:-1.5px !important; max-width:100% !important; }
          .hero-sub { font-size:15px !important; }
          .hero-cta { flex-direction:column !important; }
          .hero-cta button { width:100% !important; justify-content:center !important; }
          .section-pad { padding:72px 20px !important; }
          .cta-pad { padding:72px 20px !important; }
          footer { padding:32px 20px 20px !important; }
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: navScrolled ? "rgba(8,12,20,.97)" : "transparent",
        backdropFilter: navScrolled ? "blur(24px)" : "none",
        borderBottom: navScrolled ? "1px solid rgba(255,255,255,.05)" : "none",
        padding: "0 48px", height: 66,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "all .35s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo-icon.jpeg" alt="Dynamic Works" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "contain" }} />
          <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.5 }}>Dynamic Works</span>
        </div>

        <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <a href="#como-funciona" className="nav-a">Como funciona</a>
          <a href="#vantagens" className="nav-a">Vantagens</a>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-ghost" style={{ padding: "8px 20px", fontSize: 14 }} onClick={() => router.push("/login")}>Entrar</button>
            <button className="btn-primary" style={{ padding: "8px 20px", fontSize: 14, animation: "none" }} onClick={() => router.push("/register")}>Criar Conta</button>
          </div>
        </div>

        <button className="nav-mobile-btn"
          style={{ display: "none", background: "transparent", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, color: "#94a3b8", padding: "8px", cursor: "pointer", alignItems: "center", justifyContent: "center" }}
          onClick={() => setMobileMenu(v => !v)}>
          {mobileMenu ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileMenu && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99, background: "#080c14", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          {[["Como funciona", "#como-funciona"], ["Vantagens", "#vantagens"]].map(([l, h]) => (
            <a key={l} href={h} onClick={() => setMobileMenu(false)} style={{ color: "#94a3b8", fontSize: 20, fontWeight: 600, textDecoration: "none" }}>{l}</a>
          ))}
          <div style={{ width: 160, height: 1, background: "rgba(255,255,255,.07)", margin: "8px 0" }} />
          <button onClick={() => { router.push("/login"); setMobileMenu(false); }}
            style={{ width: 260, padding: "15px", background: "transparent", border: "1px solid rgba(255,255,255,.12)", color: "#fff", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Entrar</button>
          <button onClick={() => { router.push("/register"); setMobileMenu(false); }}
            style={{ width: 260, padding: "15px", background: "#ffffff", border: "none", color: "#000", borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: "pointer" }}>Criar Conta</button>
        </div>
      )}

      {/* ── Hero ── */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden" }}>
        {/* Ambient glows */}
        <div style={{ position: "absolute", top: "10%", right: "0%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,.055) 0%,transparent 60%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "5%", left: "-8%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(14,203,129,.03) 0%,transparent 60%)", pointerEvents: "none" }} />

        <div className="hero-wrap" style={{ maxWidth: 1200, margin: "0 auto", padding: "140px 48px 80px", display: "flex", alignItems: "center", gap: 80, width: "100%" }}>

          {/* Left */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="fu1 hero-h1" style={{ fontSize: "clamp(38px,4.2vw,64px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-2.5px", marginBottom: 26, maxWidth: 560 }}>
              Negoceie os mercados globais{" "}
              <span style={{ color: "#fff" }}>em Kwanzas.</span>
            </h1>

            <p className="fu2 hero-sub" style={{ fontSize: 17, color: "#64748b", lineHeight: 1.75, maxWidth: 440, marginBottom: 40 }}>
              A corretora angolana de opções binárias com depósitos e levantamentos em AOA via Multicaixa. Payout até 85% por operação.
            </p>

            <div className="fu3 hero-cta" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
              <button className="btn-primary" onClick={() => router.push("/register")}>
                Começar Agora <ArrowRight size={16} strokeWidth={2.5} />
              </button>
              <button className="btn-ghost" onClick={() => router.push("/login")}>
                Já tenho conta
              </button>
            </div>

            <div className="fu4" style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
              {["Conta demo grátis", "Sem comissão de entrada", "KYC em 24h"].map(t => (
                <span key={t} style={{ display: "flex", alignItems: "center", gap: 6, color: "#2d3d58", fontSize: 13 }}>
                  <span style={{ color: "#0ecb81" }}>✓</span> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right — mockup flutuante */}
          <div className="hero-mockup" style={{ flexShrink: 0, animation: "floatY 7s ease-in-out infinite", position: "relative" }}>
            <div style={{ position: "absolute", inset: -60, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,.09) 0%,transparent 65%)", pointerEvents: "none" }} />
            <PlatformMockup />
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,.05)", borderBottom: "1px solid rgba(255,255,255,.05)", background: "rgba(255,255,255,.015)" }}>
        <div className="stats-row" style={{ maxWidth: 960, margin: "0 auto", padding: "52px 48px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
          {[
            { v: stats.users  > 0 ? stats.users.toLocaleString("pt-PT")  : "—", l: "Traders registados" },
            { v: stats.trades > 0 ? stats.trades.toLocaleString("pt-PT") : "—", l: "Operações concluídas" },
            { v: stats.volume > 0 ? formatKz(stats.volume)               : "—", l: "Volume negociado" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "8px 16px", borderRight: i < 2 ? "1px solid rgba(255,255,255,.05)" : "none" }}>
              <div style={{ fontSize: "clamp(30px,4vw,48px)", fontWeight: 900, color: "#fff", letterSpacing: -1.5, fontVariantNumeric: "tabular-nums", marginBottom: 6 }}>{s.v}</div>
              <div style={{ color: "#2d3d58", fontSize: 13, fontWeight: 500 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Vantagens ── */}
      <section id="vantagens" className="section-pad" style={{ maxWidth: 1200, margin: "0 auto", padding: "120px 48px" }}>
        <div style={{ marginBottom: 64 }}>
          <p style={{ color: "#ffffff", fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 14 }}>Porque a Dynamic Works</p>
          <h2 style={{ fontSize: "clamp(30px,4vw,52px)", fontWeight: 900, letterSpacing: -2, lineHeight: 1.1, maxWidth: 520 }}>
            Construída para o mercado angolano
          </h2>
        </div>

        <div className="feats" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
          {[
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
                </svg>
              ),
              title: "Pagamentos em Kwanza",
              body: "Deposita e levanta directamente em AOA via Multicaixa Express. Mínimo de 5.000 Kz. Sem contas internacionais, sem intermediários.",
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0ecb81" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              ),
              title: "Execução instantânea",
              body: "Preços em tempo real da Deriv. Ordens executadas em milissegundos com payout até 85% por operação ganha. 30+ activos disponíveis.",
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              ),
              title: "Seguro e verificado",
              body: "KYC com validação de BI angolano automática. Autenticação 2FA por email. Torneios e rankings com prémios reais em Kwanza.",
            },
          ].map((f, i) => (
            <div key={i} className="feat-card">
              <div style={{ marginBottom: 22 }}>{f.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.4, marginBottom: 12, color: "#f0f4ff" }}>{f.title}</div>
              <div style={{ color: "#374151", fontSize: 14, lineHeight: 1.8 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section id="como-funciona" style={{ background: "rgba(255,255,255,.018)", borderTop: "1px solid rgba(255,255,255,.05)", borderBottom: "1px solid rgba(255,255,255,.05)", padding: "120px 48px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 80 }}>
            <p style={{ color: "#ffffff", fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 14 }}>Simples e rápido</p>
            <h2 style={{ fontSize: "clamp(30px,4vw,52px)", fontWeight: 900, letterSpacing: -2, lineHeight: 1.1 }}>Começa em 3 passos</h2>
          </div>

          <div className="steps" style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
            {[
              { n: "01", title: "Cria a conta", body: "Regista-te com o teu BI em menos de 2 minutos. Verificação automática e gratuita." },
              { n: "02", title: "Faz um depósito", body: "Transfere em Kwanza via Multicaixa Express. Aprovação em até 24 horas úteis." },
              { n: "03", title: "Começa a negociar", body: "Escolhe o activo, analisa o gráfico e faz a tua previsão — ALTA ou BAIXA." },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "0 24px", position: "relative" }}>
                {i < 2 && (
                  <div className="step-arrow" style={{ position: "absolute", top: 26, left: "calc(50% + 36px)", right: "calc(-50% + 36px)", height: 1, background: "linear-gradient(90deg,rgba(255,255,255,.3) 0%,rgba(255,255,255,.05) 100%)" }} />
                )}
                <div className="step-num" style={{ marginBottom: 24 }}>
                  <span style={{ color: "#ffffff", fontWeight: 900, fontSize: 14, letterSpacing: -0.5 }}>{s.n}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: -0.3, marginBottom: 10, color: "#f0f4ff" }}>{s.title}</div>
                <div style={{ color: "#374151", fontSize: 14, lineHeight: 1.75, maxWidth: 200 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Patrocinador ── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,.04)", padding: "36px 48px", textAlign: "center" }}>
        <p style={{ color: "#1a2540", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 20 }}>Patrocinador Oficial</p>
        <a href="https://doumblemg.com" target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "14px 24px", textDecoration: "none", transition: "all .25s" }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.3)"; }}
          onMouseOut={e  => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.07)"; }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, color: "#ffffff" }}>DM</div>
          <div style={{ textAlign: "left" }}>
            <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 13 }}>DOUBLE MG, LDA</div>
            <div style={{ color: "#2d3d58", fontSize: 12 }}>Consultoria Financeira & Gestão</div>
          </div>
        </a>
      </div>

      {/* ── CTA final ── */}
      <section className="cta-pad" style={{ maxWidth: 760, margin: "0 auto", padding: "120px 48px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(36px,5vw,68px)", fontWeight: 900, letterSpacing: -3, lineHeight: 1.03, marginBottom: 22 }}>
          Pronto para<br />negociar?
        </h2>
        <p style={{ color: "#374151", fontSize: 17, lineHeight: 1.7, marginBottom: 40, maxWidth: 400, margin: "0 auto 40px" }}>
          Cria a tua conta e recebe <strong style={{ color: "#ffffff" }}>10.000 Kz de demo</strong> para praticar sem risco.
        </p>
        <button className="btn-primary" onClick={() => router.push("/register")} style={{ fontSize: 16, padding: "17px 40px" }}>
          Criar Conta Gratuita <ArrowRight size={17} strokeWidth={2.5} />
        </button>
        <div style={{ marginTop: 24 }}>
          <a href={WA} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#22c55e", fontSize: 13, textDecoration: "none", opacity: 0.7 }}>
            <MessageCircle size={14} /> Suporte via WhatsApp
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,.05)", padding: "40px 48px 28px" }}>
        <div className="footer-inner" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo-icon.jpeg" alt="Dynamic Works" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "contain" }} />
            <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: -0.3 }}>Dynamic Works</span>
          </div>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            {[["Entrar", "/login"], ["Registar", "/register"], ["Torneios", "/ranking"], ["Suporte", "/support"], ["Termos", "/terms"]].map(([l, h]) => (
              <a key={l} href={h} className="footer-link">{l}</a>
            ))}
          </div>
          <a href={WA} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.15)", borderRadius: 8, padding: "8px 14px", color: "#22c55e", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            <MessageCircle size={13} /> WhatsApp
          </a>
        </div>
        <div style={{ maxWidth: 1200, margin: "0 auto", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.03)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <p style={{ color: "#1a2540", fontSize: 12, margin: 0 }}>© {new Date().getFullYear()} Dynamic Works · Angola · Todos os direitos reservados</p>
          <p style={{ color: "#1a2540", fontSize: 12, margin: 0, maxWidth: 480, textAlign: "right" }}>⚠️ Opções binárias envolvem risco de perda. Não investir valores que não pode perder. Proibido a menores de 18 anos.</p>
        </div>
      </footer>
    </div>
  );
}
