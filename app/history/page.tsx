"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, TrendingUp, TrendingDown, Filter,
  RefreshCw, Download, Search, Trophy, Target,
  Calendar, BarChart2,
} from "lucide-react";
import { formatKz } from "@/lib/format";

type Trade = {
  id: string; asset: string; direction: string; amount: number;
  entryPrice: number; closePrice: number | null; payout: number;
  result: string | null; profit: number | null; expirySecs: number;
  status: string; isDemo: boolean; createdAt: string; closedAt: string | null;
};

type ResultFilter = "all" | "win" | "loss";
type ModeFilter   = "all" | "real" | "demo";

function formatDate(s: string) {
  return new Date(s).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function formatExpiry(secs: number) {
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs/60)}m`;
  return `${Math.floor(secs/3600)}h`;
}
function exportCsv(trades: Trade[]) {
  const rows = [
    ["Data", "Par", "Direcção", "Montante (Kz)", "Resultado", "Lucro/Perda (Kz)", "Expiração", "Conta"],
    ...trades.map(t => [
      formatDate(t.createdAt),
      t.asset,
      t.direction === "call" ? "ALTA" : "BAIXA",
      Math.floor(t.amount),
      t.result === "win" ? "Ganho" : t.result === "loss" ? "Perda" : "—",
      t.profit !== null ? Math.floor(t.profit) : "—",
      formatExpiry(t.expirySecs),
      t.isDemo ? "Demo" : "Real",
    ]),
  ];
  const csv  = rows.map(r => r.join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url; a.download = `historico_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function HistoryPage() {
  const { status } = useSession();
  const router     = useRouter();

  const [trades,       setTrades]       = useState<Trade[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [modeFilter,   setModeFilter]   = useState<ModeFilter>("real");
  const [assetSearch,  setAssetSearch]  = useState("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [page,         setPage]         = useState(1);
  const PER_PAGE = 20;

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "500", page: "1" });
    const res = await fetch("/api/trade?" + params);
    if (res.ok) {
      const d = await res.json();
      const all: Trade[] = Array.isArray(d) ? d : (d.trades ?? []);
      setTrades(all.filter(t => t.status === "closed"));
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (status === "authenticated") load(); }, [status, load]);

  const filtered = trades.filter(t => {
    if (modeFilter === "real" && t.isDemo)   return false;
    if (modeFilter === "demo" && !t.isDemo)  return false;
    if (resultFilter !== "all" && t.result !== resultFilter) return false;
    if (assetSearch.trim() && !t.asset.toLowerCase().includes(assetSearch.toLowerCase())) return false;
    if (dateFrom && new Date(t.createdAt) < new Date(dateFrom)) return false;
    if (dateTo   && new Date(t.createdAt) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));

  const wins   = filtered.filter(t => t.result === "win").length;
  const losses = filtered.filter(t => t.result === "loss").length;
  const total  = filtered.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const totalPnl = filtered.reduce((s, t) => s + (t.profit ?? 0), 0);
  const totalVol  = filtered.reduce((s, t) => s + t.amount, 0);

  const inp: React.CSSProperties = {
    background: "#111827", border: "1px solid #1e2d50", borderRadius: 7,
    padding: "7px 10px", color: "#fff", fontSize: 13, outline: "none",
  };
  const filterBtn = (active: boolean, color = "#f5a623"): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 20, border: `1px solid ${active ? color : "#1e2d50"}`,
    background: active ? `${color}18` : "transparent",
    color: active ? color : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer",
  });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#070d1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #1e2d50", borderTopColor: "#f5a623", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#070d1a", fontFamily: "system-ui,-apple-system,sans-serif", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, color: "#94a3b8" }}>
          <ChevronLeft size={20} />
        </button>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, flex: 1 }}>Histórico de Operações</span>
        <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><RefreshCw size={16} /></button>
        <button onClick={() => exportCsv(filtered)}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "7px 12px", color: "#22c55e", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          <Download size={14} /> CSV
        </button>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px" }}>

        {/* Filtros — modo */}
        <div style={{ display: "flex", gap: 4, background: "#111827", border: "1px solid #1e2d50", borderRadius: 10, padding: 4, marginBottom: 16, width: "fit-content" }}>
          {(["real","all","demo"] as ModeFilter[]).map(m => (
            <button key={m} onClick={() => { setModeFilter(m); setPage(1); }}
              style={{ padding: "7px 16px", borderRadius: 7, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: modeFilter === m ? (m === "real" ? "#22c55e" : m === "demo" ? "#f5a623" : "#94a3b8") : "transparent",
                color: modeFilter === m ? "#0a0f1e" : "#94a3b8",
              }}>
              {m === "real" ? "Real" : m === "demo" ? "Demo" : "Ambas"}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Taxa de vitória", value: `${winRate}%`,             color: "#f5a623", Icon: Trophy    },
            { label: "P&L total",       value: formatKz(Math.floor(totalPnl)), color: totalPnl >= 0 ? "#22c55e" : "#ef4444", Icon: BarChart2 },
            { label: `${wins}V / ${losses}D`, value: `${total} trades`,  color: "#94a3b8", Icon: Target    },
            { label: "Volume",          value: formatKz(Math.floor(totalVol)), color: "#64748b", Icon: BarChart2 },
          ].map((s, i) => (
            <div key={i} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <s.Icon size={18} color={s.color} />
              <div>
                <div style={{ color: s.color, fontWeight: 800, fontSize: 16 }}>{s.value}</div>
                <div style={{ color: "#64748b", fontSize: 11 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros avançados */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <Filter size={14} color="#64748b" />
            {(["all","win","loss"] as ResultFilter[]).map(r => (
              <button key={r} onClick={() => { setResultFilter(r); setPage(1); }} style={filterBtn(resultFilter === r, r === "win" ? "#22c55e" : r === "loss" ? "#ef4444" : "#94a3b8")}>
                {r === "all" ? "Todos" : r === "win" ? "Ganhos" : "Perdas"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
              <input placeholder="Par (ex: EUR/USD)" value={assetSearch} onChange={e => { setAssetSearch(e.target.value); setPage(1); }}
                style={{ ...inp, paddingLeft: 28, width: 160 }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={13} color="#64748b" />
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                style={{ ...inp, colorScheme: "dark" }} />
              <span style={{ color: "#64748b", fontSize: 12 }}>até</span>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                style={{ ...inp, colorScheme: "dark" }} />
            </div>
            {(resultFilter !== "all" || assetSearch || dateFrom || dateTo) && (
              <button onClick={() => { setResultFilter("all"); setAssetSearch(""); setDateFrom(""); setDateTo(""); setPage(1); }}
                style={{ background: "transparent", border: "1px solid #1e2d50", borderRadius: 7, padding: "6px 12px", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Tabela */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "#475569", padding: "48px 0" }}>
            <BarChart2 size={40} color="#1e2d50" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14 }}>Nenhuma operação encontrada.</div>
          </div>
        ) : (
          <>
            {paginated.map(t => {
              const isWin = t.result === "win";
              const pl    = t.profit ?? 0;
              return (
                <div key={t.id} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Ícone */}
                  <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: isWin ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
                    {isWin ? <TrendingUp size={18} color="#22c55e" /> : <TrendingDown size={18} color="#ef4444" />}
                  </div>

                  {/* Info principal */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{t.asset}</span>
                      <span style={{ background: t.direction === "call" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: t.direction === "call" ? "#22c55e" : "#ef4444", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                        {t.direction === "call" ? "ALTA" : "BAIXA"}
                      </span>
                      <span style={{ background: t.isDemo ? "rgba(245,166,35,0.1)" : "rgba(34,197,94,0.1)", color: t.isDemo ? "#f5a623" : "#22c55e", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                        {t.isDemo ? "DEMO" : "REAL"}
                      </span>
                      <span style={{ color: "#475569", fontSize: 11 }}>{formatExpiry(t.expirySecs)}</span>
                    </div>
                    <div style={{ color: "#64748b", fontSize: 11 }}>{formatDate(t.createdAt)}</div>
                  </div>

                  {/* Valores */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ color: isWin ? "#22c55e" : "#ef4444", fontWeight: 800, fontSize: 15 }}>
                      {isWin ? "+" : "−"}{formatKz(Math.floor(Math.abs(pl)))}
                    </div>
                    <div style={{ color: "#475569", fontSize: 11 }}>{formatKz(Math.floor(t.amount))}</div>
                  </div>
                </div>
              );
            })}

            {/* Paginação */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 20 }}>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  style={{ padding: "8px 16px", background: page === 1 ? "#1e2d50" : "#111827", border: "1px solid #1e2d50", borderRadius: 8, color: page === 1 ? "#475569" : "#fff", cursor: page === 1 ? "not-allowed" : "pointer", fontSize: 13 }}>
                  ←
                </button>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>Pág. {page} / {totalPages} · {filtered.length} trades</span>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                  style={{ padding: "8px 16px", background: page === totalPages ? "#1e2d50" : "#111827", border: "1px solid #1e2d50", borderRadius: 8, color: page === totalPages ? "#475569" : "#fff", cursor: page === totalPages ? "not-allowed" : "pointer", fontSize: 13 }}>
                  →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
