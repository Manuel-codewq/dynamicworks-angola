"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, BarChart2, TrendingUp, TrendingDown,
  Trophy, Target, Zap, RefreshCw, Wallet, History,
  ArrowUpRight, Clock, Bot,
} from "lucide-react";
import { formatKz } from "@/lib/format";
import PageGuide from "@/app/components/PageGuide";
import { SkeletonStatCard, SkeletonCard } from "@/app/components/Skeleton";
import { useT } from "@/lib/i18n";

const DASHBOARD_GUIDE = [
  { icon: <BarChart2 size={26} color="#ffffff" />, iconColor: "#ffffff", title: "O teu Dashboard",       description: "Aqui encontras todas as estatísticas das tuas operações reais — taxa de vitória, lucro total, volume e evolução ao longo do tempo.", tip: "As estatísticas são actualizadas em tempo real após cada trade." },
  { icon: <Trophy    size={26} color="#ffffff" />, iconColor: "#ffffff", title: "Taxa de Vitória",       description: "Percentagem de operações que terminaram em ganho. Uma taxa acima de 55% é considerada positiva na maioria das estratégias de opções binárias.", tip: "Mais importante que a taxa de vitória é o valor médio ganho vs perdido." },
  { icon: <TrendingUp size={26} color="#22c55e" />, iconColor: "#22c55e", title: "Gráfico P&L (30 dias)", description: "Mostra a evolução do teu lucro/prejuízo acumulado nos últimos 30 dias. Uma linha a subir significa que estás a ser consistente.", tip: "Se o gráfico estiver a descer, analisa os pares onde perdes mais." },
  { icon: <Target    size={26} color="#a78bfa" />, iconColor: "#a78bfa", title: "Desempenho por Par",    description: "Vê em quais criptomoedas (BTC/USD, ETH/USD, etc.) tens melhores resultados. Foca-te nos pares onde a tua taxa de vitória é maior.", tip: "Não tentes dominar todos os pares ao mesmo tempo — especializa-te em 2 ou 3." },
];

type Stats = {
  total: number; wins: number; losses: number; winRate: number;
  totalProfit: number; totalVolume: number;
  dailyPnl:   { date: string; pnl: number; cumulative: number }[];
  byAsset:    { asset: string; trades: number; wins: number; profit: number; volume: number; winRate: number }[];
  byHour:     { hour: number; trades: number; wins: number; winRate: number }[];
  byDuration: { secs: number; label: string; trades: number; wins: number; winRate: number }[];
  recent:     { asset: string; result: string | null; profit: number | null; amount: number; date: string }[];
};

function fmtDate(s: string) {
  const d = new Date(s);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function PnlChart({ data }: { data: { date: string; cumulative: number }[] }) {
  if (data.length < 2) return null;
  const vals = data.map(d => d.cumulative);
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const rng  = max - min || 1;
  const W = 300, H = 72;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.cumulative - min) / rng) * H * 0.88 - H * 0.06;
    return [x, y] as [number, number];
  });
  const isPos    = vals[vals.length - 1] >= 0;
  const stroke   = isPos ? "#22c55e" : "#ef4444";
  const polyline = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area     = `${pts[0][0]},${H} ` + pts.map(([x, y]) => `${x},${y}`).join(" ") + ` ${pts[pts.length-1][0]},${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 80, overflow: "visible" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={stroke} stopOpacity=".25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0"   />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#pnlGrad)" />
      <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="0" y1={H} x2={W} y2={H} stroke="#1e2d50" strokeWidth=".5" />
    </svg>
  );
}

export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();
  const t = useT();
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/profile/stats");
    if (r.ok) setStats(await r.json());
    setLoading(false);
  }

  useEffect(() => { if (status === "authenticated") load(); }, [status]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#070d1a", padding: "24px 16px", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard />
      </div>
      <SkeletonCard rows={4} style={{ marginBottom: 14 }} />
      <SkeletonCard rows={5} />
    </div>
  );

  const s = stats;
  const lastCumulative = s?.dailyPnl?.[s.dailyPnl.length - 1]?.cumulative ?? 0;
  const pnlColor = lastCumulative >= 0 ? "#22c55e" : "#ef4444";

  return (
    <div style={{ minHeight: "100vh", background: "#070d1c", fontFamily: "system-ui,-apple-system,sans-serif", paddingBottom: 100 }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>

      {/* Header */}
      <div style={{ background: "#0d1528", borderBottom: "1px solid rgba(30,45,80,.6)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(30,45,80,.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 9, color: "#94a3b8" }}>
          <ChevronLeft size={18} />
        </button>
        <BarChart2 size={18} color="#ffffff" />
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, flex: 1, letterSpacing: -.2 }}>Dashboard</span>
        <button onClick={load} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(30,45,80,.4)", cursor: "pointer", width: 36, height: 36, borderRadius: 9, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RefreshCw size={14} />
        </button>
      </div>

      <PageGuide storageKey="dw_guide_dashboard" steps={DASHBOARD_GUIDE} />

      <div style={{ maxWidth: 660, margin: "0 auto", padding: "20px 16px", animation: "fadeUp .4s ease both" }}>

        {/* Quick nav */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Negociar",  icon: <TrendingUp size={18} color="#22c55e"/>, href: "/trade",   bg: "rgba(34,197,94,.08)",   border: "rgba(34,197,94,.2)"   },
            { label: "Bot",       icon: <Bot        size={18} color="#ffffff"/>, href: "/bot",     bg: "rgba(255,255,255,.08)",  border: "rgba(255,255,255,.2)"  },
            { label: "Carteira",  icon: <Wallet     size={18} color="#38bdf8"/>, href: "/wallet",  bg: "rgba(56,189,248,.08)",  border: "rgba(56,189,248,.2)"  },
            { label: "Histórico", icon: <History    size={18} color="#a78bfa"/>, href: "/history", bg: "rgba(167,139,250,.08)", border: "rgba(167,139,250,.2)" },
          ].map(n => (
            <button key={n.label} onClick={() => router.push(n.href)}
              style={{ background: n.bg, border: `1px solid ${n.border}`, borderRadius: 12, padding: "12px 10px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              {n.icon}
              <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>{n.label}</span>
            </button>
          ))}
        </div>

        {!s || s.total === 0 ? (
          <div style={{ background: "rgba(17,24,39,.8)", border: "1px solid rgba(30,45,80,.5)", borderRadius: 20, textAlign: "center", padding: "56px 32px" }}>
            <div style={{ width: 64, height: 64, background: "rgba(30,45,80,.4)", borderRadius: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <BarChart2 size={30} color="#1e3a5f" />
            </div>
            <div style={{ color: "#94a3b8", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t("dash.noTrades")}</div>
            <div style={{ color: "#475569", fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>{t("dash.noTradesDesc")}</div>
            <button onClick={() => router.push("/trade")} style={{ background: "linear-gradient(135deg,#ffffff,#f97316)", color: "#0a0f1e", border: "none", borderRadius: 12, padding: "13px 28px", fontSize: 14, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 6px 20px rgba(255,255,255,.3)" }}>
              <ArrowUpRight size={16} /> {t("dash.goTrade")}
            </button>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              {[
                { label: t("dash.winRate"),     value: `${s.winRate}%`,                     icon: <Trophy    size={20} color="#ffffff"/>, accent: "#ffffff",  bg: "rgba(255,255,255,.06)"  },
                { label: t("dash.totalTrades"), value: String(s.total),                     icon: <Zap       size={20} color="#38bdf8"/>, accent: "#38bdf8",  bg: "rgba(56,189,248,.06)"  },
                { label: t("dash.pnl"),         value: formatKz(Math.floor(s.totalProfit)), icon: s.totalProfit >= 0 ? <TrendingUp size={20} color="#22c55e"/> : <TrendingDown size={20} color="#ef4444"/>, accent: s.totalProfit >= 0 ? "#22c55e" : "#ef4444", bg: s.totalProfit >= 0 ? "rgba(34,197,94,.06)" : "rgba(239,68,68,.06)" },
                { label: t("dash.volume"),      value: formatKz(Math.floor(s.totalVolume)), icon: <Target    size={20} color="#a78bfa"/>, accent: "#a78bfa",  bg: "rgba(167,139,250,.06)" },
              ].map(k => (
                <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.accent}22`, borderRadius: 16, padding: "18px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, background: "rgba(255,255,255,.04)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {k.icon}
                    </div>
                    <span style={{ color: "#334155", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>{k.label}</span>
                  </div>
                  <div style={{ color: k.accent, fontSize: 24, fontWeight: 900, letterSpacing: -.5 }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Wins/Losses bar */}
            <div style={{ background: "rgba(17,24,39,.8)", border: "1px solid rgba(30,45,80,.5)", borderRadius: 16, padding: "20px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>{t("dash.winsVsLosses")}</span>
                <span style={{ color: "#475569", fontSize: 12 }}>{s.wins}V · {s.losses}D</span>
              </div>
              <div style={{ height: 12, borderRadius: 6, background: "#0f1b30", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${s.winRate}%`, background: "linear-gradient(90deg,#22c55e,#16a34a)", borderRadius: 6, transition: "width .8s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: "#22c55e" }} />
                  <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 700 }}>{s.winRate}% Vitórias</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: "#ef4444" }} />
                  <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 700 }}>{100 - s.winRate}% Derrotas</span>
                </div>
              </div>
            </div>

            {/* P&L chart */}
            <div style={{ background: "rgba(17,24,39,.8)", border: "1px solid rgba(30,45,80,.5)", borderRadius: 16, padding: "20px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{t("dash.pnlChart")}</div>
                  <div style={{ color: "#475569", fontSize: 11 }}>Últimos 30 dias</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: pnlColor, fontSize: 20, fontWeight: 900, letterSpacing: -.3 }}>{formatKz(Math.floor(lastCumulative))}</div>
                  <div style={{ color: "#475569", fontSize: 11 }}>acumulado</div>
                </div>
              </div>
              <PnlChart data={s.dailyPnl} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ color: "#334155", fontSize: 11 }}>{fmtDate(s.dailyPnl[0]?.date ?? "")}</span>
                <span style={{ color: "#334155", fontSize: 11 }}>{fmtDate(s.dailyPnl[s.dailyPnl.length - 1]?.date ?? "")}</span>
              </div>
            </div>

            {/* Por par */}
            {s.byAsset.length > 0 && (
              <div style={{ background: "rgba(17,24,39,.8)", border: "1px solid rgba(30,45,80,.5)", borderRadius: 16, padding: "20px", marginBottom: 14 }}>
                <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, marginBottom: 16 }}>{t("dash.perfByPair")}</div>
                {s.byAsset.map((a, idx) => (
                  <div key={a.asset} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: idx < s.byAsset.length - 1 ? "1px solid rgba(30,45,80,.3)" : "none" }}>
                    <div style={{ width: 88, color: "#e2e8f0", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{a.asset}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 6, borderRadius: 3, background: "#0f1b30", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${a.winRate}%`, background: a.winRate >= 50 ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#ef4444,#dc2626)", borderRadius: 3 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ color: a.profit >= 0 ? "#22c55e" : "#ef4444", fontSize: 13, fontWeight: 800 }}>
                        {a.profit >= 0 ? "+" : ""}{formatKz(Math.floor(a.profit))}
                      </div>
                      <div style={{ color: "#475569", fontSize: 11 }}>{a.winRate}% · {a.trades}T</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Por hora */}
            {s.byHour.some(h => h.trades > 0) && (
              <div style={{ background: "rgba(17,24,39,.8)", border: "1px solid rgba(30,45,80,.5)", borderRadius: 16, padding: "20px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <Clock size={14} color="#64748b" />
                  <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>{t("dash.bestHour")}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5 }}>
                  {s.byHour.map(h => {
                    const has   = h.trades > 0;
                    const bg    = !has ? "#0d1526" : h.winRate >= 60 ? "rgba(34,197,94,.2)" : h.winRate >= 45 ? "rgba(255,255,255,.15)" : "rgba(239,68,68,.15)";
                    const color = !has ? "#1e2d50" : h.winRate >= 60 ? "#22c55e" : h.winRate >= 45 ? "#ffffff" : "#ef4444";
                    return (
                      <div key={h.hour} style={{ background: bg, borderRadius: 8, padding: "6px 4px", textAlign: "center", border: `1px solid ${has ? color + "30" : "transparent"}` }}>
                        <div style={{ color: "#475569", fontSize: 9, marginBottom: 2 }}>{String(h.hour).padStart(2,"0")}h</div>
                        <div style={{ color, fontSize: 11, fontWeight: 700 }}>{has ? `${h.winRate}%` : "—"}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
                  {[{ c:"#22c55e",l:t("dash.highWin") },{ c:"#ffffff",l:t("dash.midWin") },{ c:"#ef4444",l:t("dash.lowWin") }].map(l => (
                    <div key={l.l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: l.c }} />
                      <span style={{ color: "#475569", fontSize: 10 }}>{l.l}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Por duração */}
            {s.byDuration.length > 0 && (
              <div style={{ background: "rgba(17,24,39,.8)", border: "1px solid rgba(30,45,80,.5)", borderRadius: 16, padding: "20px", marginBottom: 14 }}>
                <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, marginBottom: 16 }}>{t("dash.perfByDuration")}</div>
                {s.byDuration.map((d, idx) => (
                  <div key={d.secs} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: idx < s.byDuration.length - 1 ? "1px solid rgba(30,45,80,.3)" : "none" }}>
                    <div style={{ width: 52, color: "#ffffff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{d.label}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 6, borderRadius: 3, background: "#0f1b30", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${d.winRate}%`, background: d.winRate >= 50 ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#ef4444,#dc2626)", borderRadius: 3 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ color: d.winRate >= 50 ? "#22c55e" : "#ef4444", fontSize: 13, fontWeight: 800 }}>{d.winRate}%</div>
                      <div style={{ color: "#475569", fontSize: 11 }}>{d.trades}T</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recentes */}
            {s.recent.length > 0 && (
              <div style={{ background: "rgba(17,24,39,.8)", border: "1px solid rgba(30,45,80,.5)", borderRadius: 16, padding: "20px" }}>
                <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, marginBottom: 16 }}>{t("dash.recentTrades")}</div>
                {s.recent.map((tr, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < s.recent.length - 1 ? "1px solid rgba(30,45,80,.3)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: tr.result === "win" ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {tr.result === "win" ? <TrendingUp size={16} color="#22c55e" /> : <TrendingDown size={16} color="#ef4444" />}
                      </div>
                      <div>
                        <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>{tr.asset}</div>
                        <div style={{ color: "#475569", fontSize: 11 }}>{new Date(tr.date).toLocaleDateString("pt-PT")}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: tr.result === "win" ? "#22c55e" : "#ef4444", fontSize: 14, fontWeight: 800 }}>
                        {tr.result === "win" ? "+" : "−"}{formatKz(Math.floor(Math.abs(tr.profit ?? tr.amount)))}
                      </div>
                      <div style={{ color: "#475569", fontSize: 11, textTransform: "capitalize" }}>{tr.result === "win" ? t("dash.win") : t("dash.loss")}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
