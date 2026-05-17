"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, BarChart2, TrendingUp, TrendingDown,
  Trophy, Target, Zap, RefreshCw,
} from "lucide-react";
import { formatKz } from "@/lib/format";
import PageGuide from "@/app/components/PageGuide";

const DASHBOARD_GUIDE = [
  { icon: <BarChart2   size={26} color="#f5a623" />, iconColor: "#f5a623", title: "O teu Dashboard",        description: "Aqui encontras todas as estatísticas das tuas operações reais — taxa de vitória, lucro total, volume e evolução ao longo do tempo.", tip: "As estatísticas são actualizadas em tempo real após cada trade." },
  { icon: <Trophy      size={26} color="#f5a623" />, iconColor: "#f5a623", title: "Taxa de Vitória",        description: "Percentagem de operações que terminaram em ganho. Uma taxa acima de 55% é considerada positiva na maioria das estratégias de opções binárias.", tip: "Mais importante que a taxa de vitória é o valor médio ganho vs perdido." },
  { icon: <TrendingUp  size={26} color="#22c55e" />, iconColor: "#22c55e", title: "Gráfico P&L (30 dias)",  description: "Mostra a evolução do teu lucro/prejuízo acumulado nos últimos 30 dias. Uma linha a subir significa que estás a ser consistente.", tip: "Se o gráfico estiver a descer, analisa os pares onde perdes mais." },
  { icon: <Target      size={26} color="#a78bfa" />, iconColor: "#a78bfa", title: "Desempenho por Par",     description: "Vê em quais pares (EUR/USD, BTC/USD, etc.) tens melhores resultados. Foca-te nos pares onde a tua taxa de vitória é maior.", tip: "Não tentes dominar todos os pares ao mesmo tempo — especializa-te em 2 ou 3." },
];

type Stats = {
  total: number; wins: number; losses: number; winRate: number;
  totalProfit: number; totalVolume: number;
  dailyPnl:   { date: string; pnl: number; cumulative: number }[];
  byAsset:    { asset: string; trades: number; wins: number; profit: number; volume: number; winRate: number }[];
  recent:     { asset: string; result: string | null; profit: number | null; amount: number; date: string }[];
};

function formatDate(s: string) {
  const d = new Date(s);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function MiniChart({ data }: { data: { date: string; cumulative: number }[] }) {
  if (!data.length) return null;
  const values = data.map(d => d.cumulative);
  const min    = Math.min(...values);
  const max    = Math.max(...values);
  const range  = max - min || 1;
  const W = 100, H = 48;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.cumulative - min) / range) * H;
    return `${x},${y}`;
  }).join(" ");
  const isPositive = values[values.length - 1] >= 0;
  const color = isPositive ? "#22c55e" : "#ef4444";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 56, overflow: "visible" }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="0" y1={H} x2={W} y2={H} stroke="#1e2d50" strokeWidth="0.5" />
    </svg>
  );
}

export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();
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

  const card: React.CSSProperties = { background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 20, marginBottom: 14 };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#070d1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #1e2d50", borderTopColor: "#f5a623", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const s = stats;
  const lastCumulative = s?.dailyPnl?.[s.dailyPnl.length - 1]?.cumulative ?? 0;
  const pnlColor = lastCumulative >= 0 ? "#22c55e" : "#ef4444";

  return (
    <div style={{ minHeight: "100vh", background: "#070d1a", fontFamily: "system-ui, -apple-system, sans-serif", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, color: "#94a3b8" }}>
          <ChevronLeft size={20} />
        </button>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, flex: 1 }}>Dashboard</span>
        <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
          <RefreshCw size={16} />
        </button>
      </div>

      <PageGuide storageKey="dw_guide_dashboard" steps={DASHBOARD_GUIDE} />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>

        {!s || s.total === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: 48 }}>
            <BarChart2 size={48} color="#1e2d50" style={{ marginBottom: 16 }} />
            <div style={{ color: "#94a3b8", fontSize: 15 }}>Ainda não tens operações reais fechadas.</div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>As estatísticas aparecem aqui depois do primeiro trade real.</div>
            <button onClick={() => router.push("/trade")} style={{ marginTop: 20, background: "#f5a623", color: "#0a0f1e", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
              Ir Operar
            </button>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
              {[
                { label: "Taxa de Vitória",    value: `${s.winRate}%`,                           icon: <Trophy  size={18} color="#f5a623" />, color: "#f5a623" },
                { label: "Total de Trades",    value: String(s.total),                           icon: <Zap     size={18} color="#38bdf8" />, color: "#38bdf8" },
                { label: "Lucro / Prejuízo",   value: formatKz(Math.floor(s.totalProfit)),       icon: s.totalProfit >= 0 ? <TrendingUp size={18} color="#22c55e" /> : <TrendingDown size={18} color="#ef4444" />, color: s.totalProfit >= 0 ? "#22c55e" : "#ef4444" },
                { label: "Volume Total",       value: formatKz(Math.floor(s.totalVolume)),       icon: <Target  size={18} color="#a78bfa" />, color: "#a78bfa" },
              ].map(k => (
                <div key={k.label} style={{ ...card, marginBottom: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, background: "rgba(255,255,255,0.04)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {k.icon}
                    </div>
                    <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{k.label}</span>
                  </div>
                  <div style={{ color: k.color, fontSize: 22, fontWeight: 900 }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Wins/Losses bar */}
            <div style={{ ...card, marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>Vitórias vs Derrotas</span>
                <span style={{ color: "#64748b", fontSize: 12 }}>{s.wins}V · {s.losses}D</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: "#1e2d50", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${s.winRate}%`, background: "linear-gradient(90deg,#22c55e,#16a34a)", borderRadius: 5, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 600 }}>{s.winRate}% vitórias</span>
                <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 600 }}>{100 - s.winRate}% derrotas</span>
              </div>
            </div>

            {/* Gráfico P&L acumulado */}
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>P&L Acumulado (30 dias)</span>
                <span style={{ color: pnlColor, fontSize: 14, fontWeight: 800 }}>{formatKz(Math.floor(lastCumulative))}</span>
              </div>
              <MiniChart data={s.dailyPnl} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ color: "#475569", fontSize: 10 }}>{formatDate(s.dailyPnl[0]?.date ?? "")}</span>
                <span style={{ color: "#475569", fontSize: 10 }}>{formatDate(s.dailyPnl[s.dailyPnl.length - 1]?.date ?? "")}</span>
              </div>
            </div>

            {/* Breakdown por par */}
            {s.byAsset.length > 0 && (
              <div style={card}>
                <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Desempenho por Par</div>
                {s.byAsset.map(a => (
                  <div key={a.asset} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(30,45,80,0.4)" }}>
                    <div style={{ width: 80, color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{a.asset}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 6, borderRadius: 3, background: "#1e2d50", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${a.winRate}%`, background: a.winRate >= 50 ? "#22c55e" : "#ef4444", borderRadius: 3 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ color: a.profit >= 0 ? "#22c55e" : "#ef4444", fontSize: 13, fontWeight: 700 }}>
                        {a.profit >= 0 ? "+" : ""}{formatKz(Math.floor(a.profit))}
                      </div>
                      <div style={{ color: "#475569", fontSize: 11 }}>{a.winRate}% · {a.trades} trades</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Últimas operações */}
            {s.recent.length > 0 && (
              <div style={card}>
                <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Últimas Operações</div>
                {s.recent.map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < s.recent.length - 1 ? "1px solid rgba(30,45,80,0.4)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.result === "win" ? "#22c55e" : "#ef4444", flexShrink: 0 }} />
                      <div>
                        <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{t.asset}</div>
                        <div style={{ color: "#475569", fontSize: 11 }}>{new Date(t.date).toLocaleDateString("pt-PT")}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: t.result === "win" ? "#22c55e" : "#ef4444", fontSize: 13, fontWeight: 700 }}>
                        {t.result === "win" ? "+" : "−"}{formatKz(Math.floor(Math.abs(t.profit ?? t.amount)))}
                      </div>
                      <div style={{ color: "#475569", fontSize: 11 }}>{t.result === "win" ? "Vitória" : "Derrota"}</div>
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
