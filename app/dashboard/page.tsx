"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, TrendingDown, Wallet, BarChart2,
  CheckCircle, XCircle, Clock, ChevronLeft, Trophy,
} from "lucide-react";

function formatKz(n: number) {
  return n.toLocaleString("pt-AO") + " Kz";
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [demoBalance, setDemoBalance] = useState(0);
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/balance").then(r => r.json()),
      fetch("/api/trade?limit=500&page=1").then(r => r.json()),
    ]).then(([bal, tr]) => {
      setBalance(bal.balance ?? 0);
      setDemoBalance(bal.demoBalance ?? 0);
      // API returns { trades: [...], total, page, ... }
      const list = Array.isArray(tr) ? tr : (tr.trades ?? []);
      setTrades(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [status]);

  const closedTrades = trades.filter(t => t.status === "closed");
  const wins = closedTrades.filter(t => t.result === "win");
  const losses = closedTrades.filter(t => t.result === "loss");
  const totalInvested = closedTrades.reduce((s, t) => s + t.amount, 0);
  const netProfit = closedTrades.reduce((s, t) => s + (t.profit ?? 0), 0);
  const winRate = closedTrades.length > 0 ? Math.round((wins.length / closedTrades.length) * 100) : 0;

  if (status === "loading" || loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#f5a623", fontSize: 16 }}>A carregar...</span>
      </div>
    );
  }

  const statCards = [
    { label: "Saldo Real", value: formatKz(Math.floor(balance)), icon: <Wallet size={20} color="#22c55e" />, color: "#22c55e" },
    { label: "Saldo Demo", value: formatKz(Math.floor(demoBalance)), icon: <Wallet size={20} color="#f5a623" />, color: "#f5a623" },
    { label: "Taxa de vitória", value: `${winRate}%`, icon: <Trophy size={20} color="#f5a623" />, color: "#f5a623" },
    { label: "Total investido", value: formatKz(totalInvested), icon: <BarChart2 size={20} color="#94a3b8" />, color: "#94a3b8" },
    { label: "Lucro líquido", value: formatKz(Math.round(netProfit)), icon: netProfit >= 0 ? <TrendingUp size={20} color="#22c55e" /> : <TrendingDown size={20} color="#ef4444" />, color: netProfit >= 0 ? "#22c55e" : "#ef4444" },
    { label: "Total operações", value: closedTrades.length.toString(), icon: <BarChart2 size={20} color="#94a3b8" />, color: "#94a3b8" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/trade")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ width: 32, height: 32, background: "#f5a623", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TrendingUp size={18} color="#0a0f1e" strokeWidth={2.5} />
        </div>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Dashboard</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Olá, {session?.user?.name?.split(" ")[0]}</span>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
          {statCards.map((s, i) => (
            <div key={i} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: "16px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {s.icon}
                <span style={{ color: "#94a3b8", fontSize: 12 }}>{s.label}</span>
              </div>
              <div style={{ color: s.color, fontSize: 18, fontWeight: 800 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Win/loss bar */}
        {closedTrades.length > 0 && (
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ color: "#22c55e", fontWeight: 700 }}>Vitórias: {wins.length}</span>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>Total: {closedTrades.length}</span>
              <span style={{ color: "#ef4444", fontWeight: 700 }}>Derrotas: {losses.length}</span>
            </div>
            <div style={{ height: 8, background: "#1e2d50", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${winRate}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)", borderRadius: 4 }} />
            </div>
          </div>
        )}

        {/* Recent trades */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: 20 }}>
          <h2 style={{ color: "#fff", fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>Operações recentes</h2>
          {trades.length === 0 ? (
            <p style={{ color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>Nenhuma operação ainda. <a href="/trade" style={{ color: "#f5a623" }}>Comece a negociar!</a></p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Ativo", "Direção", "Valor", "Entrada", "Saída", "Resultado", "Lucro", "Data"].map(h => (
                      <th key={h} style={{ color: "#94a3b8", fontSize: 12, padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #1e2d50", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 20).map(t => (
                    <tr key={t.id}>
                      <td style={{ padding: "10px", color: "#fff", fontWeight: 600, fontSize: 13, borderBottom: "1px solid rgba(30,45,80,0.5)" }}>{t.asset}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid rgba(30,45,80,0.5)" }}>
                        <span style={{ color: t.direction === "call" ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 600 }}>
                          {t.direction === "call" ? "▲ ALTA" : "▼ BAIXA"}
                        </span>
                      </td>
                      <td style={{ padding: "10px", color: "#94a3b8", fontSize: 13, borderBottom: "1px solid rgba(30,45,80,0.5)" }}>{formatKz(t.amount)}</td>
                      <td style={{ padding: "10px", color: "#94a3b8", fontSize: 12, borderBottom: "1px solid rgba(30,45,80,0.5)" }}>{t.entryPrice?.toFixed(5)}</td>
                      <td style={{ padding: "10px", color: "#94a3b8", fontSize: 12, borderBottom: "1px solid rgba(30,45,80,0.5)" }}>{t.closePrice?.toFixed(5) ?? "—"}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid rgba(30,45,80,0.5)" }}>
                        {t.status === "active"
                          ? <span style={{ color: "#f5a623", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}><Clock size={12} /> Ativo</span>
                          : t.result === "win"
                            ? <span style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}><CheckCircle size={12} /> Ganhou</span>
                            : <span style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}><XCircle size={12} /> Perdeu</span>
                        }
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid rgba(30,45,80,0.5)", color: t.profit && t.profit > 0 ? "#22c55e" : t.profit && t.profit < 0 ? "#ef4444" : "#94a3b8", fontSize: 13, fontWeight: 600 }}>
                        {t.profit !== null && t.profit !== undefined ? (t.profit > 0 ? "+" : "") + formatKz(Math.round(t.profit)) : "—"}
                      </td>
                      <td style={{ padding: "10px", color: "#94a3b8", fontSize: 11, borderBottom: "1px solid rgba(30,45,80,0.5)" }}>
                        {new Date(t.createdAt).toLocaleDateString("pt-AO")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
