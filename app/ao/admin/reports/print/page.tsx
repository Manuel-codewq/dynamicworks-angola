"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatKz } from "@/lib/format";

interface PnlRow {
  date: string; profit: number; trades: number; wins: number; losses: number; volume: number; winRate: number | null;
}
interface WinRateRow {
  asset: string; wins: number; total: number; winRate: number; configuredPct: number;
}
interface TopUser {
  userId: string; name: string; email: string;
  trades: number; wins: number; winRate: number; totalBet: number; netWin: number;
}

export default function ReportPrintPage() {
  const searchParams  = useSearchParams();
  const days          = parseInt(searchParams.get("days") ?? "30");

  const [pnl,      setPnl]      = useState<PnlRow[]>([]);
  const [winRate,  setWinRate]  = useState<WinRateRow[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/reports/pnl?days=${days}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/admin/reports/winrate`).then(r => r.ok ? r.json() : []),
      fetch(`/api/admin/reports/top-users?days=${days}&limit=20`).then(r => r.ok ? r.json() : []),
    ]).then(([p, wr, tu]) => {
      setPnl(p);
      setWinRate(wr);
      setTopUsers(tu);
    }).finally(() => setLoading(false));
  }, [days]);

  const totalPnl    = pnl.reduce((s, d) => s + d.profit, 0);
  const totalTrades = pnl.reduce((s, d) => s + d.trades, 0);
  const totalWins   = pnl.reduce((s, d) => s + (d.wins ?? 0), 0);
  const totalVol    = pnl.reduce((s, d) => s + (d.volume ?? 0), 0);
  const now         = new Date().toLocaleDateString("pt-PT");

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui", color: "#334155" }}>
        A preparar relatório...
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
        body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #fff; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f5f9; color: #475569; font-size: 11px; padding: 8px 12px; text-align: left; border-bottom: 2px solid #e2e8f0; }
        td { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
        tr:last-child td { border-bottom: none; }
        tfoot td { font-weight: 700; background: #f8fafc; border-top: 2px solid #cbd5e1; }
        h2 { color: #0f172a; font-size: 14px; font-weight: 700; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 2px solid #f5a623; display: inline-block; }
        .section { margin-bottom: 32px; }
        .pos { color: #16a34a; }
        .neg { color: #dc2626; }
        .neu { color: #ea580c; }
      `}</style>

      {/* Botão de impressão — oculto ao imprimir */}
      <div className="no-print" style={{ position: "fixed", top: 16, right: 16, display: "flex", gap: 8, zIndex: 100 }}>
        <button onClick={() => window.print()}
          style={{ background: "#f5a623", color: "#000", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>
          Imprimir / Guardar PDF
        </button>
        <button onClick={() => window.close()}
          style={{ background: "#e2e8f0", color: "#334155", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
          Fechar
        </button>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 32px" }}>

        {/* Cabeçalho do relatório */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, borderBottom: "3px solid #f5a623", paddingBottom: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", letterSpacing: -0.5 }}>Dynamic Works</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Relatório de Desempenho — últimos {days} dias</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#94a3b8" }}>
            <div>Emitido em {now}</div>
            <div style={{ marginTop: 2 }}>Uso interno — confidencial</div>
          </div>
        </div>

        {/* Resumo */}
        <div className="section">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Lucro Total",         value: (totalPnl >= 0 ? "+" : "") + formatKz(totalPnl), color: totalPnl >= 0 ? "#16a34a" : "#dc2626" },
              { label: "Operações Fechadas",  value: totalTrades.toLocaleString("pt-PT"),             color: "#0f172a" },
              { label: "Total Vitórias",      value: totalWins.toLocaleString("pt-PT"),               color: "#16a34a" },
              { label: "Volume Total",        value: formatKz(totalVol),                              color: "#0f172a" },
            ].map(c => (
              <div key={c.label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Detalhe diário */}
        <div className="section">
          <h2>Detalhe Diário</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th style={{ textAlign: "right" }}>Operações</th>
                <th style={{ textAlign: "right" }}>Vitórias</th>
                <th style={{ textAlign: "right" }}>Derrotas</th>
                <th style={{ textAlign: "right" }}>Win Rate</th>
                <th style={{ textAlign: "right" }}>Volume (Kz)</th>
                <th style={{ textAlign: "right" }}>Lucro / Prejuízo (Kz)</th>
              </tr>
            </thead>
            <tbody>
              {[...pnl].reverse().map((d, i) => (
                <tr key={i} style={{ opacity: d.trades === 0 ? 0.4 : 1 }}>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{d.date}</td>
                  <td style={{ textAlign: "right" }}>{d.trades || "—"}</td>
                  <td style={{ textAlign: "right", color: "#16a34a" }}>{d.wins || "—"}</td>
                  <td style={{ textAlign: "right", color: "#dc2626" }}>{d.losses || "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    {d.winRate !== null
                      ? <span className={d.winRate >= 55 ? "neg" : d.winRate >= 47 ? "neu" : "pos"}>{d.winRate}%</span>
                      : "—"}
                  </td>
                  <td style={{ textAlign: "right", color: "#475569" }}>{d.volume ? formatKz(d.volume) : "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: d.trades ? 700 : 400 }}>
                    {d.trades
                      ? <span className={d.profit >= 0 ? "pos" : "neg"}>{d.profit >= 0 ? "+" : ""}{formatKz(d.profit)}</span>
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL</td>
                <td style={{ textAlign: "right" }}>{totalTrades}</td>
                <td style={{ textAlign: "right", color: "#16a34a" }}>{totalWins}</td>
                <td style={{ textAlign: "right", color: "#dc2626" }}>{totalTrades - totalWins}</td>
                <td style={{ textAlign: "right" }}>
                  {totalTrades > 0
                    ? <span className="neu">{Math.round((totalWins / totalTrades) * 100)}%</span>
                    : "—"}
                </td>
                <td style={{ textAlign: "right" }}>{formatKz(totalVol)}</td>
                <td style={{ textAlign: "right" }}>
                  <span className={totalPnl >= 0 ? "pos" : "neg"}>{totalPnl >= 0 ? "+" : ""}{formatKz(totalPnl)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Taxa de vitória por par */}
        {winRate.length > 0 && (
          <div className="section">
            <h2>Taxa de Vitória por Par</h2>
            <table>
              <thead>
                <tr>
                  <th>Par</th>
                  <th style={{ textAlign: "right" }}>Operações</th>
                  <th style={{ textAlign: "right" }}>Vitórias</th>
                  <th style={{ textAlign: "right" }}>Win Rate Real</th>
                  <th style={{ textAlign: "right" }}>Win Rate Configurado</th>
                  <th style={{ textAlign: "right" }}>Diferença</th>
                </tr>
              </thead>
              <tbody>
                {winRate.map(r => {
                  const diff = r.winRate - r.configuredPct;
                  return (
                    <tr key={r.asset}>
                      <td style={{ fontWeight: 700 }}>{r.asset}</td>
                      <td style={{ textAlign: "right" }}>{r.total}</td>
                      <td style={{ textAlign: "right" }}>{r.wins}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className={diff > 5 ? "neg" : diff < -5 ? "pos" : "neu"}>{r.winRate}%</span>
                      </td>
                      <td style={{ textAlign: "right", color: "#475569" }}>{r.configuredPct}%</td>
                      <td style={{ textAlign: "right" }}>
                        <span className={diff > 0 ? "neg" : "pos"}>{diff > 0 ? "+" : ""}{diff}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Top utilizadores */}
        {topUsers.length > 0 && (
          <div className="section">
            <h2>Utilizadores Mais Rentáveis (risco para corretora)</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nome</th>
                  <th>Email</th>
                  <th style={{ textAlign: "right" }}>Ops</th>
                  <th style={{ textAlign: "right" }}>Win Rate</th>
                  <th style={{ textAlign: "right" }}>Volume (Kz)</th>
                  <th style={{ textAlign: "right" }}>Ganho Líquido (Kz)</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u, i) => (
                  <tr key={u.userId}>
                    <td style={{ color: "#94a3b8", fontWeight: 700 }}>#{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td style={{ color: "#475569", fontSize: 11 }}>{u.email}</td>
                    <td style={{ textAlign: "right" }}>{u.trades}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className={u.winRate >= 60 ? "neg" : u.winRate >= 50 ? "neu" : "pos"}>{u.winRate}%</span>
                    </td>
                    <td style={{ textAlign: "right", color: "#475569" }}>{formatKz(u.totalBet)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      <span className={u.netWin > 0 ? "neg" : "pos"}>{u.netWin > 0 ? "+" : ""}{formatKz(u.netWin)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 40, borderTop: "1px solid #e2e8f0", paddingTop: 12, fontSize: 10, color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
          <span>Dynamic Works © {new Date().getFullYear()} — Documento confidencial</span>
          <span>Gerado em {new Date().toLocaleString("pt-PT")}</span>
        </div>

      </div>
    </>
  );
}
