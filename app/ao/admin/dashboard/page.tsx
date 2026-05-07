"use client";
import { useEffect, useState } from "react";
import { Users, Wallet, BarChart2, TrendingDown, Trophy, RefreshCw } from "lucide-react";

function formatKz(n: number) { return n.toLocaleString("pt-AO") + " Kz"; }

interface Stats {
  totalUsers: number; totalBalance: number; todayTradesCount: number;
  platformProfit: number; winRate: number; totalTrades: number;
}

export default function AdminDashboard() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/stats");
    if (res.ok) setStats(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const cards = stats ? [
    { label: "Total utilizadores",       value: stats.totalUsers.toString(),         Icon: Users,         color: "#94a3b8" },
    { label: "Saldo total na plataforma", value: formatKz(Math.floor(stats.totalBalance)), Icon: Wallet,    color: "#22c55e" },
    { label: "Operações hoje",            value: stats.todayTradesCount.toString(),   Icon: BarChart2,     color: "#f5a623" },
    { label: "Lucro hoje (perdas traders)",value: formatKz(Math.floor(stats.platformProfit)), Icon: TrendingDown, color: "#22c55e" },
    { label: "Taxa de vitória traders",   value: `${stats.winRate}%`,                 Icon: Trophy,        color: "#f5a623" },
    { label: "Total operações",           value: stats.totalTrades.toString(),        Icon: BarChart2,     color: "#94a3b8" },
  ] : [];

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Dashboard</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Visão geral da plataforma</p>
        </div>
        <button onClick={load}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#94a3b8" }}>A carregar estatísticas...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {cards.map((c, i) => (
            <div key={i} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "20px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <c.Icon size={18} color={c.color} />
                <span style={{ color: "#94a3b8", fontSize: 13 }}>{c.label}</span>
              </div>
              <div style={{ color: c.color, fontSize: 22, fontWeight: 800 }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
