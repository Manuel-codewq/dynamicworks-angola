"use client";
import { formatKz } from "@/lib/format";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, ChevronLeft, CheckCircle, XCircle,
  Clock, BarChart2, Trophy, ChevronLeft as Prev, ChevronRight as Next,
  Filter, RefreshCw,
} from "lucide-react";


function formatDate(d: string) {
  return new Date(d).toLocaleString("pt-AO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type FilterResult = "all" | "win" | "loss" | "draw" | "active";
type FilterMode   = "all" | "demo" | "real";

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [trades,      setTrades]      = useState<any[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [filterResult, setFilterResult] = useState<FilterResult>("all");
  const [filterMode,   setFilterMode]   = useState<FilterMode>("all");

  const LIMIT = 20;
  const totalPages = Math.ceil(total / LIMIT);

  const fetchTrades = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/trade?page=${p}&limit=${LIMIT}`);
      const data = await res.json();
      setTrades(data.trades ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchTrades(page);
  }, [status, page, fetchTrades]);

  // Filtros aplicados localmente (já temos a página inteira em memória)
  const filtered = trades.filter(t => {
    if (filterResult !== "all" && t.result !== filterResult && !(filterResult === "active" && t.status === "active")) return false;
    if (filterMode === "demo" && !t.isDemo) return false;
    if (filterMode === "real" &&  t.isDemo) return false;
    return true;
  });

  // Estatísticas da página actual (após filtro)
  const closed  = filtered.filter(t => t.status === "closed");
  const wins    = closed.filter(t => t.result === "win");
  const losses  = closed.filter(t => t.result === "loss");
  const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;
  const netProfit = closed.reduce((s: number, t: any) => s + (t.profit ?? 0), 0);

  const btnStyle = (active: boolean, color = "#f5a623"): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12,
    fontWeight: 600, background: active ? color : "#1e2d50",
    color: active ? "#0a0f1e" : "#94a3b8", transition: "all 0.15s",
  });

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#f5a623" }}>A carregar...</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ width: 32, height: 32, background: "#f5a623", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BarChart2 size={18} color="#0a0f1e" strokeWidth={2.5} />
        </div>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Histórico de Operações</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => fetchTrades(page)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total operações", value: total.toString(),         color: "#94a3b8", icon: <BarChart2 size={16} color="#94a3b8" /> },
            { label: "Vitórias",        value: wins.length.toString(),   color: "#22c55e", icon: <CheckCircle size={16} color="#22c55e" /> },
            { label: "Derrotas",        value: losses.length.toString(), color: "#ef4444", icon: <XCircle size={16} color="#ef4444" /> },
            { label: "Taxa de vitória", value: `${winRate}%`,            color: "#f5a623", icon: <Trophy size={16} color="#f5a623" /> },
            { label: "Lucro líquido",   value: formatKz(Math.round(netProfit)), color: netProfit >= 0 ? "#22c55e" : "#ef4444", icon: netProfit >= 0 ? <TrendingUp size={16} color="#22c55e" /> : <TrendingUp size={16} color="#ef4444" /> },
          ].map((s, i) => (
            <div key={i} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                {s.icon}
                <span style={{ color: "#94a3b8", fontSize: 11 }}>{s.label}</span>
              </div>
              <div style={{ color: s.color, fontSize: 18, fontWeight: 800 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <Filter size={14} color="#94a3b8" />
          <span style={{ color: "#94a3b8", fontSize: 12, marginRight: 4 }}>Resultado:</span>
          {(["all", "win", "loss", "draw", "active"] as FilterResult[]).map(f => (
            <button key={f} style={btnStyle(filterResult === f)} onClick={() => setFilterResult(f)}>
              {f === "all" ? "Todos" : f === "win" ? "Win" : f === "loss" ? "Loss" : f === "draw" ? "Empate" : "Ativo"}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: "#1e2d50", margin: "0 4px" }} />
          <span style={{ color: "#94a3b8", fontSize: 12, marginRight: 4 }}>Modo:</span>
          {(["all", "real", "demo"] as FilterMode[]).map(f => (
            <button key={f} style={btnStyle(filterMode === f, f === "demo" ? "#f5a623" : "#22c55e")} onClick={() => setFilterMode(f)}>
              {f === "all" ? "Todos" : f === "real" ? "Real" : "Demo"}
            </button>
          ))}
        </div>

        {/* Tabela */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>A carregar operações...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <BarChart2 size={36} color="#1e2d50" style={{ margin: "0 auto 12px" }} />
              <p style={{ color: "#94a3b8" }}>Nenhuma operação encontrada.</p>
              <a href="/trade" style={{ color: "#f5a623", fontSize: 13 }}>Começar a negociar →</a>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#0d1526" }}>
                    {["Ativo", "Direção", "Modo", "Valor investido", "Preço entrada", "Preço saída", "Resultado", "Lucro/Perda", "Expiração", "Data"].map(h => (
                      <th key={h} style={{ color: "#64748b", fontSize: 11, padding: "10px 12px", textAlign: "left", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => {
                    const isWin  = t.result === "win";
                    const isDraw = t.result === "draw";
                    const isActive = t.status === "active";
                    return (
                      <tr key={t.id} style={{ borderTop: "1px solid rgba(30,45,80,0.6)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                        {/* Ativo */}
                        <td style={{ padding: "11px 12px", color: "#fff", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>{t.asset}</td>
                        {/* Direção */}
                        <td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>
                          <span style={{
                            color: t.direction === "call" ? "#22c55e" : "#ef4444",
                            background: t.direction === "call" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                            borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700,
                          }}>
                            {t.direction === "call" ? "▲ ALTA" : "▼ BAIXA"}
                          </span>
                        </td>
                        {/* Modo */}
                        <td style={{ padding: "11px 12px" }}>
                          <span style={{
                            color: t.isDemo ? "#f5a623" : "#22c55e",
                            background: t.isDemo ? "rgba(245,166,35,0.1)" : "rgba(34,197,94,0.1)",
                            borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600,
                          }}>
                            {t.isDemo ? "Demo" : "Real"}
                          </span>
                        </td>
                        {/* Valor */}
                        <td style={{ padding: "11px 12px", color: "#cbd5e1", fontSize: 13 }}>{formatKz(t.amount)}</td>
                        {/* Preço entrada */}
                        <td style={{ padding: "11px 12px", color: "#64748b", fontSize: 12, fontFamily: "monospace" }}>{t.entryPrice?.toFixed(5) ?? "—"}</td>
                        {/* Preço saída */}
                        <td style={{ padding: "11px 12px", color: "#64748b", fontSize: 12, fontFamily: "monospace" }}>{t.closePrice?.toFixed(5) ?? "—"}</td>
                        {/* Resultado */}
                        <td style={{ padding: "11px 12px" }}>
                          {isActive
                            ? <span style={{ color: "#f5a623", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}><Clock size={12} /> Ativo</span>
                            : isWin
                              ? <span style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}><CheckCircle size={12} /> Win</span>
                              : isDraw
                                ? <span style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>— Empate</span>
                                : <span style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}><XCircle size={12} /> Loss</span>
                          }
                        </td>
                        {/* Lucro */}
                        <td style={{ padding: "11px 12px", fontWeight: 700, fontSize: 13, color: isActive ? "#94a3b8" : isWin ? "#22c55e" : isDraw ? "#94a3b8" : "#ef4444" }}>
                          {isActive ? "—"
                            : t.profit !== null && t.profit !== undefined
                              ? (t.profit > 0 ? "+" : "") + formatKz(Math.round(t.profit))
                              : "—"}
                        </td>
                        {/* Expiração */}
                        <td style={{ padding: "11px 12px", color: "#64748b", fontSize: 12 }}>
                          {t.expirySecs >= 3600
                            ? `${t.expirySecs / 3600}h`
                            : `${t.expirySecs / 60} min`}
                        </td>
                        {/* Data */}
                        <td style={{ padding: "11px 12px", color: "#64748b", fontSize: 11, whiteSpace: "nowrap" }}>
                          {formatDate(t.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 8, padding: "8px 14px", color: page === 1 ? "#1e2d50" : "#94a3b8", cursor: page === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center" }}
            >
              <Prev size={16} />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    background: p === page ? "#f5a623" : "#111827",
                    border: "1px solid #1e2d50", borderRadius: 8,
                    padding: "8px 14px", color: p === page ? "#0a0f1e" : "#94a3b8",
                    cursor: "pointer", fontWeight: p === page ? 700 : 400, fontSize: 13,
                  }}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 8, padding: "8px 14px", color: page === totalPages ? "#1e2d50" : "#94a3b8", cursor: page === totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center" }}
            >
              <Next size={16} />
            </button>

            <span style={{ color: "#64748b", fontSize: 12, marginLeft: 8 }}>
              Página {page} de {totalPages} · {total} operações
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
