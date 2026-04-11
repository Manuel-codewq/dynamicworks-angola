'use client';

import { ShieldCheck, Bot, ArrowRight, Play, GraduationCap, UserPlus, Zap, LayoutDashboard, Activity } from 'lucide-react';

export default function LandingPage({ onLoginClick, onRegisterClick, onDemoAccess }: { onLoginClick: () => void, onRegisterClick: () => void, onDemoAccess: () => void }) {
  return (
    <div id="s-landing" className="screen active">
      <div className="bg-grid"></div>
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>
      
      <nav className="land-nav">
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
           <LayoutDashboard size={24} color="var(--accent)" />
           <span>Dynamic<b>Works</b></span>
        </div>
        <div className="land-nav-btns">
          <button className="btn btn-sm btn-ghost" onClick={onDemoAccess} style={{ marginRight: '0.5rem', opacity: 0.7 }}>Acesso Demo</button>
          <button className="btn btn-sm btn-outline" onClick={onLoginClick}>Entrar</button>
          <button className="btn btn-sm btn-orange" onClick={onRegisterClick}>Criar Conta</button>
        </div>
      </nav>
      
      <div className="hero-particles" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span>
      </div>

      <div className="hero">
        <div className="pill"><div className="pill-dot"></div> #1 Plataforma Accumulators de Angola</div>

        <div className="hero-badge-row">
          <span className="hero-badge-item"><ShieldCheck width={11} height={11} /> Deriv Oficial</span>
          <span className="hero-badge-item live"><span className="live-blink"></span> LIVE 24/7</span>
          <span className="hero-badge-item"><Activity width={11} height={11} /> Ativos Sintéticos</span>
        </div>

        <h1>Ganha até <em>5%</em><br/>por cada Tick</h1>
        <p>A plataforma dos angolanos para operar <strong>Accumulators Deriv</strong>. O teu capital cresce tick a tick — sem precisares de adivinhar a direção do mercado.</p>

        <div className="hero-sim-card">
          <div className="sim-label">Simulação — Stake $10 · Taxa 3%</div>
          <div className="sim-ticks">
            <div className="sim-tick t1">+$0.30</div>
            <div className="sim-tick t2">+$0.31</div>
            <div className="sim-tick t3">+$0.32</div>
            <div className="sim-tick t4">+$0.33</div>
            <div className="sim-tick t5 active">+$0.34 ↑</div>
          </div>
          <div className="sim-total">Total acumulado: <strong>$1.60</strong></div>
        </div>

        <div className="hero-btns">
          <button className="btn btn-lg btn-accent btn-pulse" onClick={onLoginClick}>
            <Zap width={16} height={16} /> Começar a Operar Agora
          </button>
          <button className="btn btn-lg btn-ghost-border" onClick={onRegisterClick}>
            <UserPlus width={16} height={16} /> Criar Conta Grátis na Deriv
          </button>
          <a href="academia.html" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: ".5rem",
            padding: ".72rem 1rem", borderRadius: "14px", textDecoration: "none",
            background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.22)",
            fontSize: ".8rem", fontWeight: 700, color: "#a78bfa"
          }}>
            <GraduationCap width={15} height={15} style={{ stroke: "#a78bfa", flexShrink: 0 }} />
            Sou iniciante — Quero aprender primeiro
          </a>
        </div>

        <div className="stats-row">
          <div className="stat"><div className="stat-n">5%</div><div className="stat-l">Máx/Tick</div></div>
          <div className="stat"><div className="stat-n">$1</div><div className="stat-l">Stake Mín.</div></div>
          <div className="stat"><div className="stat-n">10</div><div className="stat-l">Pares Disponíveis</div></div>
          <div className="stat"><div className="stat-n"><Activity size={24} /></div><div className="stat-l">Foco Local</div></div>
        </div>

        {/* SECURITY BANNER */}
        <div style={{ margin: "1rem 0 .5rem", background: "rgba(0,230,118,.06)", border: "1px solid rgba(0,230,118,.2)", borderRadius: "16px", padding: ".9rem 1rem", position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: ".55rem" }}>
            <ShieldCheck width={18} height={18} style={{ stroke: "#00e676", flexShrink: 0 }} />
            <span style={{ fontSize: ".82rem", fontWeight: 900, color: "#00e676" }}>O teu dinheiro está sempre seguro na Deriv</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: ".38rem" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: ".5rem", fontSize: ".72rem", color: "rgba(255,255,255,.65)", lineHeight: 1.45 }}>
              <Zap width={13} height={13} style={{ stroke: "#00e676", flexShrink: 0, marginTop: ".1rem" }} />
              <span>O teu saldo fica na <strong style={{ color: "#fff" }}>tua conta Deriv</strong> — a DynamicWorks nunca toca no teu dinheiro</span>
            </div>
            {/* Omitted the rest for brevity, but they should be properly implemented */}
          </div>
        </div>
      </div>

      <div className="feats">
        <div className="feat">
          <div className="feat-ico"><Bot width={22} height={22} /></div>
          <div className="feat-t">Preço em Tempo Real</div>
          <div className="feat-d">Spot price ao vivo com barreiras dinâmicas dos Accumulators</div>
        </div>
        {/* Adicione outras features aqui */}
      </div>

    </div>
  );
}
