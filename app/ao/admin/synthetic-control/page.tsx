"use client";
import { useEffect, useState } from "react";
import { RefreshCw, TrendingDown, TrendingUp, Shuffle } from "lucide-react";

interface IndexRow {
  symbol: string;
  displayName: string;
  lastPrice: number;
  volatility: number;
  drift: number;
  active: boolean;
}

// draft de edição por símbolo — separado dos valores confirmados na BD, para
// não gravar nada até o admin clicar "Guardar" nessa linha
interface Draft {
  drift: string;
  volatility: string;
  magnitude: string;
}

export default function SyntheticControlPage() {
  const [rows, setRows] = useState<IndexRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingSymbol, setSavingSymbol] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/synthetic");
    if (res.ok) {
      const data: IndexRow[] = await res.json();
      setRows(data);
      setDrafts(prev => {
        const next = { ...prev };
        for (const r of data) {
          if (!next[r.symbol]) {
            next[r.symbol] = { drift: String(r.drift), volatility: String(r.volatility), magnitude: "10" };
          }
        }
        return next;
      });
    } else {
      setMessage({ text: "Erro ao carregar os índices", ok: false });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function setDraft(symbol: string, patch: Partial<Draft>) {
    setDrafts(d => ({ ...d, [symbol]: { ...d[symbol], ...patch } }));
  }

  async function saveParams(symbol: string) {
    const draft = drafts[symbol];
    setSavingSymbol(symbol);
    setMessage(null);
    const res = await fetch(`/api/admin/synthetic/${symbol}/params`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drift: Number(draft.drift), volatility: Number(draft.volatility) }),
    });
    const data = await res.json();
    setSavingSymbol(null);
    if (res.ok) {
      setMessage({ text: `${symbol}: drift/volatility actualizados`, ok: true });
      load();
    } else {
      setMessage({ text: `${symbol}: ${data.error || "erro ao guardar"}`, ok: false });
    }
  }

  async function fireEvent(symbol: string, type: "CRASH" | "BOOM" | "JUMP") {
    const draft = drafts[symbol];
    const pct = Number(draft.magnitude);
    const label = type === "CRASH" ? "queda" : type === "BOOM" ? "subida" : "salto";
    if (!confirm(`Tens a certeza? Isto vai disparar uma ${label} garantida de ${pct}% em ${symbol} no próximo tick. Esta acção não pode ser desfeita.`)) return;

    setMessage(null);
    const res = await fetch(`/api/admin/synthetic/${symbol}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, magnitude: pct / 100 }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage({ text: `${symbol}: evento ${type} disparado — aplica-se no próximo tick`, ok: true });
    } else {
      setMessage({ text: `${symbol}: ${data.error || "erro ao disparar evento"}`, ok: false });
    }
  }

  const card: React.CSSProperties = { background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "20px 22px", marginBottom: 20 };
  const sectionTitle: React.CSSProperties = { color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 14px" };
  const numInput: React.CSSProperties = { width: 70, background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 8, padding: "6px 8px", color: "#fff", fontSize: 13, boxSizing: "border-box" };

  if (loading) return <div style={{ padding: 28 }}><p style={{ color: "#94a3b8" }}>A carregar...</p></div>;

  return (
    <div style={{ padding: 28, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Controlo de Movimento Sintético</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>
            Ajusta o comportamento dos preços sintéticos. Acção sensível — afecta directamente o que os traders vêem.
          </p>
        </div>
        <button onClick={load}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {message && (
        <div style={{ background: message.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${message.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: message.ok ? "#22c55e" : "#ef4444", fontSize: 13 }}>
          {message.text}
        </div>
      )}

      <div style={card}>
        <p style={sectionTitle}>Pares ({rows.length})</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(r => {
            const draft = drafts[r.symbol] ?? { drift: "0", volatility: "0", magnitude: "10" };
            const saving = savingSymbol === r.symbol;
            return (
              <div key={r.symbol} style={{ background: "#0a0f1e", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{r.displayName}</span>
                    <span style={{ color: "#64748b", fontSize: 12, marginLeft: 10 }}>{r.symbol}</span>
                  </div>
                  <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>{r.lastPrice.toLocaleString("pt-PT", { maximumFractionDigits: 5 })}</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <label style={{ color: "#64748b", fontSize: 12 }}>Drift</label>
                    <input type="number" step={0.01} value={draft.drift}
                      onChange={e => setDraft(r.symbol, { drift: e.target.value })}
                      style={numInput} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <label style={{ color: "#64748b", fontSize: 12 }}>Volatility</label>
                    <input type="number" step={0.01} value={draft.volatility}
                      onChange={e => setDraft(r.symbol, { volatility: e.target.value })}
                      style={numInput} />
                  </div>
                  <button onClick={() => saveParams(r.symbol)} disabled={saving}
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "6px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                    {saving ? "..." : "Guardar"}
                  </button>

                  <div style={{ width: 1, height: 24, background: "#1e2d50" }} />

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <label style={{ color: "#64748b", fontSize: 12 }}>Magnitude %</label>
                    <input type="number" step={1} min={1} max={50} value={draft.magnitude}
                      onChange={e => setDraft(r.symbol, { magnitude: e.target.value })}
                      style={numInput} />
                  </div>
                  <button onClick={() => fireEvent(r.symbol, "CRASH")}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "6px 12px", color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    <TrendingDown size={13} /> CRASH
                  </button>
                  <button onClick={() => fireEvent(r.symbol, "BOOM")}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "6px 12px", color: "#22c55e", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    <TrendingUp size={13} /> BOOM
                  </button>
                  <button onClick={() => fireEvent(r.symbol, "JUMP")}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "6px 12px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    <Shuffle size={13} /> JUMP
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
