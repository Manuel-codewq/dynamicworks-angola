"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw, TrendingUp, BarChart2, Trophy, Download } from "lucide-react";
import { formatKz } from "@/lib/format";

interface WinRateRow {
  asset: string; wins: number; total: number; winRate: number; configuredPct: number;
}
interface PnlRow {
  date: string; profit: number; trades: number; wins: number; losses: number; volume: number; winRate: number | null;
}
interface TopUser {
  userId: string; name: string; email: string;
  trades: number; wins: number; winRate: number;
  totalBet: number; netWin: number;
}

const DAYS_OPTIONS = [7, 14, 30, 60, 90];

const sectionCard: React.CSSProperties = {
  background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: 24, marginBottom: 24,
};
const th: React.CSSProperties = {
  color: "#94a3b8", fontSize: 12, padding: "10px 14px", textAlign: "left",
  borderBottom: "1px solid #1e2d50", fontWeight: 600, whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "11px 14px", borderBottom: "1px solid rgba(30,45,80,0.4)", fontSize: 13,
};

function WinRateBar({ actual, configured }: { actual: number; configured: number }) {
  const diff  = actual - configured;
  const color = diff > 5 ? "#ef4444" : diff < -5 ? "#22c55e" : "#f5a623";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 120, height: 8, background: "#1e2d50", borderRadius: 4, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: `${Math.min(configured, 100)}%`, top: 0, bottom: 0, width: 2, background: "#94a3b8", opacity: 0.5 }} />
        <div style={{ height: "100%", width: `${Math.min(actual, 100)}%`, background: color, borderRadius: 4 }} />
      </div>
      <span style={{ color, fontSize: 13, fontWeight: 700, minWidth: 36 }}>{actual}%</span>
      <span style={{ color: "#64748b", fontSize: 11 }}>cfg: {configured}%</span>
    </div>
  );
}

function PnlChart({ data }: { data: PnlRow[] }) {
  const maxAbs = Math.max(...data.map(d => Math.abs(d.profit)), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 120, padding: "0 2px" }}>
      {data.map((d, i) => {
        const isPos = d.profit >= 0;
        const barH  = Math.round((Math.abs(d.profit) / maxAbs) * 110);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", cursor: "default" }}
            title={`${d.date}\nLucro: ${d.profit.toLocaleString("pt-PT")} Kz\nOps: ${d.trades}`}>
            <div style={{ width: "100%", height: Math.max(barH, d.profit !== 0 ? 3 : 1), background: isPos ? "#22c55e" : "#ef4444", borderRadius: "3px 3px 0 0", opacity: 0.85 }} />
          </div>
        );
      })}
    </div>
  );
}

function ImpactBar({ value, max, positive }: { value: number; max: number; positive: boolean }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: "#1e2d50", borderRadius: 3, minWidth: 80, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: positive ? "#ef4444" : "#22c55e", borderRadius: 3 }} />
    </div>
  );
}

function exportCSV(pnl: PnlRow[], days: number) {
  const header = "Data,Operações,Vitórias,Derrotas,Win Rate (%),Volume (Kz),Lucro/Prejuízo (Kz)";
  const rows = [...pnl].reverse().map(d =>
    `${d.date},${d.trades},${d.wins ?? ""},${d.losses ?? ""},${d.winRate ?? ""},${d.volume ?? ""},${d.profit}`
  );
  const csv  = [header, ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `relatorio-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminReportsPage() {
  const [days,     setDays]     = useState(30);
  const [winRate,  setWinRate]  = useState<WinRateRow[]>([]);
  const [pnl,      setPnl]      = useState<PnlRow[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const [wr, pnlRes, tu] = await Promise.all([
        fetch("/api/admin/reports/winrate").then(r => r.ok ? r.json() : []),
        fetch(`/api/admin/reports/pnl?days=${d}`).then(r => r.ok ? r.json() : []),
        fetch(`/api/admin/reports/top-users?days=${d}&limit=20`).then(r => r.ok ? r.json() : []),
      ]);
      setWinRate(wr);
      setPnl(pnlRes);
      setTopUsers(tu);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const totalPnl    = pnl.reduce((s, d) => s + d.profit, 0);
  const totalTrades = pnl.reduce((s, d) => s + d.trades, 0);
  const maxBar      = Math.max(...topUsers.map(u => Math.abs(u.netWin)), 1);

  return (
    <div style={{ padding: 28, fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Relatórios</h1>
          <p style={{ color: "#64748b", fontSize: 12, margin: "3px 0 0" }}>Análise de desempenho da corretora</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {DAYS_OPTIONS.map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{ padding: "6px 14px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: days === d ? "#f5a623" : "#1e2d50", color: days === d ? "#000" : "#94a3b8" }}>
              {d}d
            </button>
          ))}
          <button onClick={() => load(days)}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "#1e2d50", border: "none", borderRadius: 8, padding: "7px 12px", color: "#94a3b8", cursor: "pointer", fontSize: 12 }}>
            <RefreshCw size={13} /> Atualizar
          </button>
          <button onClick={() => exportCSV(pnl, days)} disabled={pnl.length === 0}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8, padding: "7px 12px", color: "#22c55e", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            <Download size={13} /> Exportar CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "#64748b", padding: 60 }}>A carregar...</div>
      ) : (
        <>
          {/* P&L chart */}
          <div style={sectionCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <BarChart2 size={17} color="#f5a623" />
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Lucro da Corretora — últimos {days} dias</span>
            </div>
            <div style={{ display: "flex", gap: 32, marginBottom: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>LUCRO TOTAL</div>
                <div style={{ color: totalPnl >= 0 ? "#22c55e" : "#ef4444", fontSize: 26, fontWeight: 800 }}>
                  {totalPnl >= 0 ? "+" : ""}{formatKz(totalPnl)}
                </div>
              </div>
              <div>
                <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>OPERAÇÕES FECHADAS</div>
                <div style={{ color: "#f5a623", fontSize: 26, fontWeight: 800 }}>{totalTrades.toLocaleString("pt-PT")}</div>
              </div>
            </div>
            {pnl.length > 0 ? (
              <>
                <PnlChart data={pnl} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, color: "#475569", fontSize: 10 }}>
                  <span>{pnl[0]?.date}</span>
                  <div style={{ display: "flex", gap: 12 }}>
                    <span style={{ color: "#22c55e" }}>■ Lucro</span>
                    <span style={{ color: "#ef4444" }}>■ Prejuízo</span>
                  </div>
                  <span>{pnl[pnl.length - 1]?.date}</span>
                </div>
              </>
            ) : (
              <div style={{ color: "#64748b", textAlign: "center", padding: 20 }}>Sem operações fechadas neste período</div>
            )}
          </div>

          {/* Win rate per pair */}
          <div style={sectionCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <TrendingUp size={17} color="#f5a623" />
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Taxa de vitória por par</span>
              <span style={{ color: "#64748b", fontSize: 12, marginLeft: 4 }}>(conta real · histórico completo)</span>
            </div>
            <div style={{ color: "#64748b", fontSize: 11, marginBottom: 14 }}>
              Barra cinza = win rate configurado. Verde = corretora ganha mais do que o previsto. Vermelho = utilizadores ganham mais.
            </div>
            {winRate.length === 0 ? (
              <div style={{ color: "#64748b", textAlign: "center", padding: 20 }}>Sem operações fechadas</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Par</th>
                    <th style={th}>Ops</th>
                    <th style={th}>Vitórias</th>
                    <th style={{ ...th, minWidth: 240 }}>Win Rate real vs configurado</th>
                  </tr>
                </thead>
                <tbody>
                  {winRate.map(r => (
                    <tr key={r.asset}>
                      <td style={{ ...td, color: "#fff", fontWeight: 700 }}>{r.asset}</td>
                      <td style={{ ...td, color: "#94a3b8" }}>{r.total}</td>
                      <td style={{ ...td, color: "#94a3b8" }}>{r.wins}</td>
                      <td style={td}><WinRateBar actual={r.winRate} configured={r.configuredPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Top winning users */}
          <div style={sectionCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Trophy size={17} color="#f5a623" />
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Utilizadores mais rentáveis</span>
              <span style={{ color: "#64748b", fontSize: 12, marginLeft: 4 }}>(maior risco para a corretora)</span>
            </div>
            {topUsers.length === 0 ? (
              <div style={{ color: "#64748b", textAlign: "center", padding: 20 }}>Sem dados neste período</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>Utilizador</th>
                    <th style={th}>Ops</th>
                    <th style={th}>Win Rate</th>
                    <th style={th}>Volume</th>
                    <th style={th}>Ganho líquido</th>
                    <th style={{ ...th, minWidth: 100 }}>Impacto</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.map((u, i) => {
                    const isRisk = u.netWin > 0;
                    return (
                      <tr key={u.userId}>
                        <td style={{ ...td, color: "#64748b", fontWeight: 700 }}>#{i + 1}</td>
                        <td style={td}>
                          <div style={{ color: "#e2e8f0", fontWeight: 600 }}>{u.name}</div>
                          <div style={{ color: "#64748b", fontSize: 11 }}>{u.email}</div>
                        </td>
                        <td style={{ ...td, color: "#94a3b8" }}>{u.trades}</td>
                        <td style={td}>
                          <span style={{ color: u.winRate >= 60 ? "#ef4444" : u.winRate >= 50 ? "#f5a623" : "#22c55e", fontWeight: 700 }}>
                            {u.winRate}%
                          </span>
                        </td>
                        <td style={{ ...td, color: "#94a3b8" }}>{formatKz(u.totalBet)}</td>
                        <td style={{ ...td, color: isRisk ? "#ef4444" : "#22c55e", fontWeight: 700 }}>
                          {isRisk ? "+" : ""}{formatKz(u.netWin)}
                        </td>
                        <td style={td}>
                          <ImpactBar value={Math.abs(u.netWin)} max={maxBar} positive={isRisk} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Daily detail table */}
          <div style={sectionCard}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart2 size={17} color="#f5a623" />
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Detalhe diário</span>
              </div>
              <button onClick={() => exportCSV(pnl, days)} disabled={pnl.length === 0}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "6px 12px", color: "#22c55e", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                <Download size={13} /> Exportar CSV
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={th}>Data</th>
                    <th style={{ ...th, textAlign: "right" }}>Operações</th>
                    <th style={{ ...th, textAlign: "right" }}>Vitórias</th>
                    <th style={{ ...th, textAlign: "right" }}>Derrotas</th>
                    <th style={{ ...th, textAlign: "right" }}>Win Rate</th>
                    <th style={{ ...th, textAlign: "right" }}>Volume</th>
                    <th style={{ ...th, textAlign: "right" }}>Lucro / Prejuízo</th>
                  </tr>
                </thead>
                <tbody>
                  {[...pnl].reverse().map((d, i) => {
                    const hasData = d.trades > 0;
                    return (
                      <tr key={i} style={{ opacity: hasData ? 1 : 0.35 }}>
                        <td style={{ ...td, color: "#94a3b8", fontFamily: "monospace" }}>{d.date}</td>
                        <td style={{ ...td, color: "#e2e8f0", textAlign: "right" }}>{hasData ? d.trades : "—"}</td>
                        <td style={{ ...td, color: "#22c55e", textAlign: "right" }}>{hasData ? d.wins : "—"}</td>
                        <td style={{ ...td, color: "#ef4444", textAlign: "right" }}>{hasData ? d.losses : "—"}</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {d.winRate !== null
                            ? <span style={{ color: d.winRate >= 55 ? "#ef4444" : d.winRate >= 47 ? "#f5a623" : "#22c55e", fontWeight: 700 }}>{d.winRate}%</span>
                            : <span style={{ color: "#334155" }}>—</span>}
                        </td>
                        <td style={{ ...td, color: "#94a3b8", textAlign: "right" }}>{hasData ? formatKz(d.volume) : "—"}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: hasData ? 700 : 400 }}>
                          {hasData
                            ? <span style={{ color: d.profit >= 0 ? "#22c55e" : "#ef4444" }}>
                                {d.profit >= 0 ? "+" : ""}{formatKz(d.profit)}
                              </span>
                            : <span style={{ color: "#334155" }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #1e2d50" }}>
                    <td style={{ ...td, color: "#fff", fontWeight: 800 }}>TOTAL</td>
                    <td style={{ ...td, color: "#e2e8f0", fontWeight: 700, textAlign: "right" }}>{totalTrades}</td>
                    <td style={{ ...td, color: "#22c55e", fontWeight: 700, textAlign: "right" }}>{pnl.reduce((s, d) => s + (d.wins ?? 0), 0)}</td>
                    <td style={{ ...td, color: "#ef4444", fontWeight: 700, textAlign: "right" }}>{pnl.reduce((s, d) => s + (d.losses ?? 0), 0)}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {totalTrades > 0
                        ? <span style={{ color: "#f5a623", fontWeight: 700 }}>
                            {Math.round((pnl.reduce((s, d) => s + (d.wins ?? 0), 0) / totalTrades) * 100)}%
                          </span>
                        : "—"}
                    </td>
                    <td style={{ ...td, color: "#94a3b8", fontWeight: 700, textAlign: "right" }}>{formatKz(pnl.reduce((s, d) => s + (d.volume ?? 0), 0))}</td>
                    <td style={{ ...td, fontWeight: 800, textAlign: "right" }}>
                      <span style={{ color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }}>
                        {totalPnl >= 0 ? "+" : ""}{formatKz(totalPnl)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
