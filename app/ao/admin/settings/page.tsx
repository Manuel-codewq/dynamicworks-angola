"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Save, RotateCcw } from "lucide-react";

interface Settings {
  payout:          Record<string, number>;
  maintenanceMode: boolean;
}

// UI works in whole-number percentages; API uses fractions
function toPercent(v: number)  { return Math.round(v * 100); }
function toFraction(v: number) { return v / 100; }

export default function AdminSettingsPage() {
  const [draft,         setDraft]         = useState<Settings | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [resetting,     setResetting]     = useState(false);
  const [resetDone,     setResetDone]     = useState(false);
  const [rankingResetAt, setRankingResetAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/settings");
    if (res.ok) {
      const d = await res.json();
      setDraft(d);
      setRankingResetAt(d.rankingResetAt ?? null);
    }
    setLoading(false);
  }

  async function resetRanking() {
    if (!confirm("Tens a certeza? O ranking será zerado para todos os traders. Esta acção não pode ser desfeita.")) return;
    setResetting(true);
    const res = await fetch("/api/admin/ranking/reset", { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      setRankingResetAt(d.resetAt);
      setResetDone(true);
      setTimeout(() => setResetDone(false), 3000);
    }
    setResetting(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!draft) return;
    setSaving(true);
    await fetch("/api/admin/settings", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(draft),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  }

  function setPayout(pair: string, pct: number) {
    setDraft(d => d ? { ...d, payout: { ...d.payout, [pair]: toFraction(pct) } } : d);
  }

  const sectionTitle: React.CSSProperties = { color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 14px" };
  const card: React.CSSProperties = { background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "20px 22px", marginBottom: 20 };

  if (loading) return <div style={{ padding: 28 }}><p style={{ color: "#94a3b8" }}>A carregar...</p></div>;
  if (!draft)  return <div style={{ padding: 28 }}><p style={{ color: "#ef4444" }}>Erro ao carregar configurações.</p></div>;

  const pairs = Object.keys(draft.payout);

  return (
    <div style={{ padding: 28, maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Configurações</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Parâmetros da plataforma</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={save} disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: 6, background: saved ? "rgba(34,197,94,0.15)" : "rgba(245,166,35,0.15)", border: `1px solid ${saved ? "rgba(34,197,94,0.3)" : "rgba(245,166,35,0.3)"}`, borderRadius: 8, padding: "8px 18px", color: saved ? "#22c55e" : "#f5a623", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            <Save size={14} /> {saved ? "Guardado!" : saving ? "A guardar..." : "Guardar"}
          </button>
        </div>
      </div>

      {/* Platform controls */}
      <div style={card}>
        <p style={sectionTitle}>Controlos da Plataforma</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>

          {/* Reset ranking */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#0a0f1e", borderRadius: 10, padding: "14px 18px", flex: 1, minWidth: 220 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Zerar ranking</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                {rankingResetAt
                  ? `Último reset: ${new Date(rankingResetAt).toLocaleString("pt-AO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                  : "Nunca foi zerado"}
              </div>
            </div>
            <button onClick={resetRanking} disabled={resetting}
              style={{ background: resetDone ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.1)", border: `1px solid ${resetDone ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 8, padding: "7px 14px", color: resetDone ? "#22c55e" : "#ef4444", fontWeight: 700, fontSize: 12, cursor: resetting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: resetting ? 0.6 : 1, flexShrink: 0 }}>
              <RotateCcw size={13} /> {resetDone ? "Zerado!" : resetting ? "..." : "Zerar"}
            </button>
          </div>

          {/* Maintenance mode */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#0a0f1e", borderRadius: 10, padding: "14px 18px", flex: 1, minWidth: 220 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Modo manutenção</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>Bloqueia todos os traders</div>
            </div>
            <button onClick={() => setDraft(d => d ? { ...d, maintenanceMode: !d.maintenanceMode } : d)}
              style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: draft.maintenanceMode ? "#ef4444" : "#1e2d50", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 3, left: draft.maintenanceMode ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </button>
          </div>

        </div>
      </div>

      {/* Payout % */}
      <div style={card}>
        <p style={sectionTitle}>Payout por Par (50% – 95%)</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
          {pairs.map(pair => {
            const pct = toPercent(draft.payout[pair]);
            return (
              <div key={pair} style={{ background: "#0a0f1e", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>{pair}</span>
                  <span style={{ color: "#f5a623", fontWeight: 700, fontSize: 14 }}>{pct}%</span>
                </div>
                <input type="range" min={50} max={95} step={1} value={pct}
                  onChange={e => setPayout(pair, Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#f5a623", cursor: "pointer" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ color: "#1e2d50", fontSize: 10 }}>50%</span>
                  <span style={{ color: "#1e2d50", fontSize: 10 }}>95%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
