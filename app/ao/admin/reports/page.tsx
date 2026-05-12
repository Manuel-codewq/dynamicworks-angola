"use client";
import { useEffect, useState } from "react";
import { RefreshCw, TrendingUp, Users, BarChart2, Wallet } from "lucide-react";

interface DayData {
  date: string;
  revenue: number;
  trades: number;
  newUsers: number;
  deposits: number;
}

function formatKz(n: number) { return n.toLocaleString("pt-PT") + " Kz"; }
function shortDate(d: string) {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

function BarChart({ data, key, color, label }: { data: DayData[]; key: keyof DayData; color: string; label: string }) {
  const values = data.map(d => d[key] as number);
  const max = Math.max(...values, 1);
  return (
    <div>
      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
        {data.map((d, i) => {
          const h = Math.max(2, ((d[key] as number) / max) * 110);
          return (
            <div key={i} title={`${shortDate(d.date)}: ${typeof d[key] === "number" && key !== "trades" && key !== "newUsers" ? formatKz(d[key] as number) : d[key]}`}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "default" }}>
              <div style={{ width: "100%", height: h, background: color, borderRadius: "3px 3px 0 0", opacity: 0.85, transition: "height 0.3s" }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ color: "#334155", fontSize: 9 }}>{shortDate(data[0]?.date ?? "")}</span>
        <span style={{ color: "#334155", fontSize: 9 }}>{shortDate(data[data.length - 1]?.date ?? "")}</span>
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  const [data, setData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/reports");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const totalRevenue  = data.reduce((s, d) => s + d.revenue, 0);
  const totalTrades   = data.reduce((s, d) => s + d.trades, 0);
  const totalUsers    = data.reduce((s, d) => s + d.newUsers, 0);
  const totalDeposits = data.reduce((s, d) => s + d.deposits, 0);

  const summaryCards = [
    { label: "Receita (30 dias)",     value: formatKz(totalRevenue),        Icon: TrendingUp, color: "#22c55e" },
    { label: "Operações (30 dias)",   value: totalTrades.toString(),         Icon: BarChart2,  color: "#f5a623" },
    { label: "Novos users (30 dias)", value: totalUsers.toString(),          Icon: Users,      color: "#94a3b8" },
    { label: "Depósitos (30 dias)",   value: formatKz(totalDeposits),       Icon: Wallet,     color: "#38bdf8" },
  ];

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Relatórios</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Últimos 30 dias</p>
        </div>
        <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#94a3b8" }}>A carregar...</p>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 28 }}>
            {summaryCards.map((c, i) => (
              <div key={i} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "18px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <c.Icon size={16} color={c.color} />
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>{c.label}</span>
                </div>
                <div style={{ color: c.color, fontSize: 20, fontWeight: 800 }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { key: "revenue"  as keyof DayData, color: "#22c55e", label: "Receita diária (Kz)" },
              { key: "trades"   as keyof DayData, color: "#f5a623", label: "Operações por dia" },
              { key: "newUsers" as keyof DayData, color: "#94a3b8", label: "Novos utilizadores por dia" },
              { key: "deposits" as keyof DayData, color: "#38bdf8", label: "Depósitos por dia (Kz)" },
            ].map(({ key, color, label }) => (
              <div key={key} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "18px 16px" }}>
                <BarChart data={data} key={key} color={color} label={label} />
              </div>
            ))}
          </div>

          {/* Daily table */}
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, marginTop: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2d50" }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Detalhe diário</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#0d1526" }}>
                    {["Data", "Receita", "Operações", "Novos Users", "Depósitos"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", color: "#64748b", fontSize: 11, fontWeight: 700, textAlign: "left", letterSpacing: 0.5 }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().map((d, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #1e2d50" }}>
                      <td style={{ padding: "10px 16px", color: "#94a3b8", fontSize: 13 }}>{d.date}</td>
                      <td style={{ padding: "10px 16px", color: "#22c55e", fontWeight: 700, fontSize: 13 }}>{formatKz(d.revenue)}</td>
                      <td style={{ padding: "10px 16px", color: "#f5a623", fontSize: 13 }}>{d.trades}</td>
                      <td style={{ padding: "10px 16px", color: "#94a3b8", fontSize: 13 }}>{d.newUsers}</td>
                      <td style={{ padding: "10px 16px", color: "#38bdf8", fontSize: 13 }}>{formatKz(d.deposits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
