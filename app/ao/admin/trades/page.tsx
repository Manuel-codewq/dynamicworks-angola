"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Download, Filter } from "lucide-react";

function formatKz(n: number) { return n.toLocaleString("pt-AO") + " Kz"; }
function formatDate(s: string) { return new Date(s).toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" }); }

interface AdminTrade {
  id: string; asset: string; direction: string; amount: number;
  result: string; payout: number; createdAt: string;
  user: { name: string; email: string };
}

export default function AdminTradesPage() {
  const [trades,  setTrades]  = useState<AdminTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [result,  setResult]  = useState("");
  const [asset,   setAsset]   = useState("");
  const [from,    setFrom]    = useState("");
  const [to,      setTo]      = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (result) params.set("result", result);
    if (asset)  params.set("asset",  asset);
    if (from)   params.set("from",   from);
    if (to)     params.set("to",     to);
    const res = await fetch("/api/admin/trades?" + params);
    if (res.ok) setTrades(await res.json());
    setLoading(false);
  }, [result, asset, from, to]);

  useEffect(() => { load(); }, [load]);

  function exportCsv() {
    const header = ["Utilizador","Email","Par","Direcção","Montante","Resultado","Lucro/Perda","Data"];
    const rows = trades.map(t => [
      t.user.name, t.user.email, t.asset, t.direction,
      Math.floor(t.amount),
      t.result,
      t.result === "win" ? Math.floor(t.payout - t.amount) : t.result === "loss" ? -Math.floor(t.amount) : 0,
      formatDate(t.createdAt),
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `trades_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  const th: React.CSSProperties = { color: "#94a3b8", fontSize: 12, padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #1e2d50", fontWeight: 600, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid rgba(30,45,80,0.4)", fontSize: 13 };

  const resultColor = (r: string) =>
    r === "win"  ? "#22c55e" :
    r === "loss" ? "#ef4444" : "#f5a623";
  const resultLabel = (r: string) =>
    r === "win"  ? "Ganho" :
    r === "loss" ? "Perda" : "Ativo";

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Operações</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>{trades.length} operações encontradas</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
            <RefreshCw size={14} /> Atualizar
          </button>
          <button onClick={exportCsv} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 8, padding: "8px 14px", color: "#f5a623", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <Filter size={15} color="#94a3b8" />
        <select value={result} onChange={e => setResult(e.target.value)}
          style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 7, padding: "7px 12px", color: result ? "#fff" : "#94a3b8", fontSize: 13, cursor: "pointer", outline: "none" }}>
          <option value="">Todos resultados</option>
          <option value="win">Ganho</option>
          <option value="loss">Perda</option>
          <option value="active">Ativo</option>
        </select>
        <input placeholder="Par (ex: EUR/USD)" value={asset} onChange={e => setAsset(e.target.value)}
          style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 7, padding: "7px 12px", color: "#fff", fontSize: 13, outline: "none", width: 160 }} />
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 7, padding: "7px 12px", color: from ? "#fff" : "#94a3b8", fontSize: 13, outline: "none", colorScheme: "dark" }} />
        <span style={{ color: "#94a3b8", fontSize: 13 }}>até</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 7, padding: "7px 12px", color: to ? "#fff" : "#94a3b8", fontSize: 13, outline: "none", colorScheme: "dark" }} />
        {(result || asset || from || to) && (
          <button onClick={() => { setResult(""); setAsset(""); setFrom(""); setTo(""); }}
            style={{ background: "transparent", border: "1px solid #1e2d50", borderRadius: 7, padding: "7px 12px", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>
            Limpar
          </button>
        )}
      </div>

      {loading ? <p style={{ color: "#94a3b8" }}>A carregar...</p> : (
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr>
                {["Utilizador","Par","Direcção","Montante","Resultado","Lucro/Perda","Data"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 32 }}>Nenhuma operação encontrada</td></tr>
              ) : trades.map(t => {
                const pl = t.result === "win" ? Math.floor(t.payout - t.amount) : t.result === "loss" ? -Math.floor(t.amount) : 0;
                const plColor = pl > 0 ? "#22c55e" : pl < 0 ? "#ef4444" : "#94a3b8";
                return (
                  <tr key={t.id}>
                    <td style={td}>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{t.user.name}</div>
                      <div style={{ color: "#64748b", fontSize: 11 }}>{t.user.email}</div>
                    </td>
                    <td style={{ ...td, color: "#fff", fontWeight: 600 }}>{t.asset}</td>
                    <td style={td}>
                      <span style={{
                        background: t.direction === "up" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                        color: t.direction === "up" ? "#22c55e" : "#ef4444",
                        borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                      }}>
                        {t.direction === "up" ? "▲ ALTA" : "▼ BAIXA"}
                      </span>
                    </td>
                    <td style={{ ...td, color: "#fff" }}>{formatKz(Math.floor(t.amount))}</td>
                    <td style={td}>
                      <span style={{ background: `${resultColor(t.result)}20`, color: resultColor(t.result), borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                        {resultLabel(t.result)}
                      </span>
                    </td>
                    <td style={{ ...td, color: plColor, fontWeight: 700 }}>
                      {t.result === "active" ? "—" : (pl >= 0 ? "+" : "") + formatKz(pl)}
                    </td>
                    <td style={{ ...td, color: "#64748b", fontSize: 12 }}>{formatDate(t.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
