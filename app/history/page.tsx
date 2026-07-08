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
import TradeShareButton from "@/app/components/TradeShareButton";
import { useT } from "@/lib/i18n";

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
  const t = useT();

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
  const filterBtn = (active: boolean, color = "#ffffff"): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 20, border: `1px solid ${active ? color : "#1e2d50"}`,
    background: active ? `${color}18` : "transparent",
    color: active ? color : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer",
  });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#070d1c", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #1e2d50", borderTopColor: "#ffffff", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#070d1c", fontFamily: "system-ui,-apple-system,sans-serif", paddingBottom: 100 }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>

      {/* Header */}
      <div style={{ background: "#0d1528", borderBottom: "1px solid rgba(30,45,80,.6)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(30,45,80,.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 9, color: "#94a3b8" }}>
          <ChevronLeft size={18} />
        </button>
        <BarChart2 size={16} color="#a78bfa" />
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, flex: 1, letterSpacing: -.2 }}>{t("history.title")}</span>
        <button onClick={load} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(30,45,80,.4)", cursor: "pointer", width: 36, height: 36, borderRadius: 9, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RefreshCw size={14} />
        </button>
        <button onClick={() => exportCsv(filtered)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.3)", borderRadius: 9, padding: "8px 14px", color: "#22c55e", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          <Download size={13} /> CSV
        </button>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "20px 16px", animation: "fadeUp .4s ease both" }}>

        {/* Filtros — modo */}
        <div style={{ display: "flex", gap: 4, background: "rgba(17,24,39,.8)", border: "1px solid rgba(30,45,80,.5)", borderRadius: 12, padding: 4, marginBottom: 16, width: "fit-content" }}>
          {(["real","all","demo"] as ModeFilter[]).map(m => (
            <button key={m} onClick={() => { setModeFilter(m); setPage(1); }}
              style={{ padding: "8px 18px", borderRadius: 9, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .15s",
                background: modeFilter === m ? (m === "real" ? "#22c55e" : m === "demo" ? "#ffffff" : "#64748b") : "transparent",
                color: modeFilter === m ? "#0a0f1e" : "#64748b",
              }}>
              {m === "real" ? t("history.filter.real") : m === "demo" ? t("history.filter.demo") : t("history.filter.both")}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: t("history.winRate"), value: `${winRate}%`, color: "#ffffff", bg: "rgba(255,255,255,.06)", border: "rgba(255,255,255,.18)", Icon: Trophy },
            { label: t("history.totalPnl"), value: formatKz(Math.floor(totalPnl)), color: totalPnl >= 0 ? "#22c55e" : "#ef4444", bg: totalPnl >= 0 ? "rgba(34,197,94,.06)" : "rgba(239,68,68,.06)", border: totalPnl >= 0 ? "rgba(34,197,94,.18)" : "rgba(239,68,68,.18)", Icon: BarChart2 },
            { label: `${wins}V / ${losses}D`, value: `${total} ${t("dash.trades")}`, color: "#94a3b8", bg: "rgba(148,163,184,.04)", border: "rgba(30,45,80,.5)", Icon: Target },
            { label: t("history.volume"), value: formatKz(Math.floor(totalVol)), color: "#64748b", bg: "rgba(30,45,80,.15)", border: "rgba(30,45,80,.4)", Icon: BarChart2 },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <s.Icon size={18} color={s.color} />
              <div>
                <div style={{ color: s.color, fontWeight: 900, fontSize: 17, letterSpacing: -.3 }}>{s.value}</div>
                <div style={{ color: "#475569", fontSize: 11 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros avançados */}
        <div style={{ background: "rgba(17,24,39,.8)", border: "1px solid rgba(30,45,80,.5)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <Filter size={13} color="#475569" />
            {(["all","win","loss"] as ResultFilter[]).map(r => (
              <button key={r} onClick={() => { setResultFilter(r); setPage(1); }} style={filterBtn(resultFilter === r, r === "win" ? "#22c55e" : r === "loss" ? "#ef4444" : "#94a3b8")}>
                {r === "all" ? t("history.filter.all") : r === "win" ? t("history.filter.wins") : t("history.filter.losses")}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }} />
              <input placeholder="EUR/USD" value={assetSearch} onChange={e => { setAssetSearch(e.target.value); setPage(1); }}
                style={{ ...inp, paddingLeft: 28, width: 150 }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={13} color="#475569" />
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={{ ...inp, colorScheme: "dark" }} />
              <span style={{ color: "#475569", fontSize: 12 }}>{t("history.to")}</span>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} style={{ ...inp, colorScheme: "dark" }} />
            </div>
            {(resultFilter !== "all" || assetSearch || dateFrom || dateTo) && (
              <button onClick={() => { setResultFilter("all"); setAssetSearch(""); setDateFrom(""); setDateTo(""); setPage(1); }}
                style={{ background: "transparent", border: "1px solid rgba(30,45,80,.5)", borderRadius: 8, padding: "6px 12px", color: "#64748b", fontSize: 12, cursor: "pointer" }}>
                {t("history.clear")}
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "#475569", padding: "56px 0" }}>
            <div style={{ width: 56, height: 56, background: "rgba(30,45,80,.3)", borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <BarChart2 size={26} color="#1e3a5f" />
            </div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>{t("history.noTrades")}</div>
            <div style={{ fontSize: 12, color: "#334155" }}>Tenta ajustar os filtros acima</div>
          </div>
        ) : (
          <>
            {paginated.map(tr => {
              const isWin = tr.result === "win";
              const pl    = tr.profit ?? 0;
              return (
                <div key={tr.id} style={{ background: "rgba(17,24,39,.8)", border: "1px solid rgba(30,45,80,.4)", borderLeft: `3px solid ${isWin ? "#22c55e" : "#ef4444"}`, borderRadius: 12, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Ícone */}
                  <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isWin ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)" }}>
                    {isWin ? <TrendingUp size={18} color="#22c55e" /> : <TrendingDown size={18} color="#ef4444" />}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>{tr.asset}</span>
                      <span style={{ background: tr.direction === "call" ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)", color: tr.direction === "call" ? "#22c55e" : "#ef4444", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                        {tr.direction === "call" ? t("history.call") : t("history.put")}
                      </span>
                      <span style={{ background: tr.isDemo ? "rgba(255,255,255,.1)" : "rgba(34,197,94,.1)", color: tr.isDemo ? "#ffffff" : "#22c55e", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                        {tr.isDemo ? "DEMO" : "REAL"}
                      </span>
                      <span style={{ background: "rgba(30,45,80,.4)", color: "#64748b", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>{formatExpiry(tr.expirySecs)}</span>
                    </div>
                    <div style={{ color: "#475569", fontSize: 11 }}>{formatDate(tr.createdAt)}</div>
                    {tr.entryPrice > 0 && tr.closePrice && (
                      <div style={{ color: "#2a3a55", fontSize: 10, marginTop: 3 }}>
                        {tr.entryPrice.toFixed(5)} → {tr.closePrice.toFixed(5)}
                      </div>
                    )}
                  </div>

                  {/* Valores + share */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ color: isWin ? "#22c55e" : "#ef4444", fontWeight: 900, fontSize: 16, letterSpacing: -.3 }}>
                      {isWin ? "+" : "−"}{formatKz(Math.floor(Math.abs(pl)))}
                    </div>
                    <div style={{ color: "#475569", fontSize: 11, marginBottom: tr.status === "closed" && tr.result ? 6 : 0 }}>{formatKz(Math.floor(tr.amount))}</div>
                    {tr.status === "closed" && tr.result && (
                      <TradeShareButton trade={{ asset: tr.asset, direction: tr.direction, result: tr.result, profit: pl, amount: tr.amount, payout: tr.payout, createdAt: tr.createdAt }} size="sm" />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Paginação */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 24 }}>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  style={{ padding: "9px 18px", background: page === 1 ? "rgba(30,45,80,.2)" : "rgba(17,24,39,.8)", border: "1px solid rgba(30,45,80,.5)", borderRadius: 9, color: page === 1 ? "#334155" : "#94a3b8", cursor: page === 1 ? "not-allowed" : "pointer", fontSize: 14 }}>
                  ←
                </button>
                <span style={{ color: "#475569", fontSize: 12, fontWeight: 600 }}>Pág. {page} / {totalPages} · {filtered.length} trades</span>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                  style={{ padding: "9px 18px", background: page === totalPages ? "rgba(30,45,80,.2)" : "rgba(17,24,39,.8)", border: "1px solid rgba(30,45,80,.5)", borderRadius: 9, color: page === totalPages ? "#334155" : "#94a3b8", cursor: page === totalPages ? "not-allowed" : "pointer", fontSize: 14 }}>
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
