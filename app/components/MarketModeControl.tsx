"use client";
import { useState, useEffect } from "react";
import { useMarketMode } from "@/hooks/useMarketMode";
import { TrendingUp, Clock, Zap, RotateCcw } from "lucide-react";

export default function MarketModeControl() {
  const { mode, autoMode, isOverridden, override, nextSwitchAt, setMode, loading } = useMarketMode();
  const [clock, setClock] = useState("");
  const [confirm, setConfirm] = useState<"forex" | "otc" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tick = () => {
      const n   = new Date();
      const pad = (v: number) => String(v).padStart(2, "0");
      setClock(`${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  async function handleConfirm() {
    if (!confirm) return;
    setBusy(true);
    await setMode(confirm);
    setBusy(false);
    setConfirm(null);
  }

  async function handleClear() {
    setBusy(true);
    await setMode(null);
    setBusy(false);
  }

  const isForex = mode === "forex";
  const card: React.CSSProperties = { background: "#111827", border: "1px solid #1e2d50", borderRadius: 12 };

  return (
    <div style={{ ...card, padding: 24, maxWidth: 540, position: "relative" }}>

      {/* Confirmação */}
      {confirm && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(10,15,30,0.93)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div style={{ ...card, padding: "28px 24px", maxWidth: 280, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>{confirm === "otc" ? "◆" : "●"}</div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 16, marginBottom: 8 }}>
              Forçar modo <span style={{ color: confirm === "otc" ? "#f5a623" : "#22c55e" }}>{confirm === "otc" ? "OTC" : "FOREX"}</span>?
            </div>
            <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6, marginBottom: 20 }}>
              Substitui o modo automático até ser limpo manualmente.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={() => setConfirm(null)} style={{ padding: 9, borderRadius: 6, background: "transparent", border: "1px solid #1e2d50", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={handleConfirm} disabled={busy} style={{ padding: 9, borderRadius: 6, background: confirm === "otc" ? "rgba(245,166,35,0.15)" : "rgba(34,197,94,0.15)", border: `1px solid ${confirm === "otc" ? "#f5a623" : "#22c55e"}`, color: confirm === "otc" ? "#f5a623" : "#22c55e", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {busy ? "..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, marginBottom: 2 }}>Controlo de Mercado</div>
          <div style={{ color: "#64748b", fontSize: 12 }}>Gestão do modo Forex / OTC</div>
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 20, color: "#f5a623", letterSpacing: 2 }}>{clock}</div>
      </div>

      {/* Status */}
      <div style={{ ...card, padding: "14px 18px", marginBottom: 14, borderColor: isForex ? "#22c55e" : "#f5a623", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: isForex ? "#22c55e" : "#f5a623", boxShadow: `0 0 10px ${isForex ? "#22c55e" : "#f5a623"}` }} />
          <div>
            <div style={{ color: "#64748b", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Modo Activo</div>
            <div style={{ color: isForex ? "#22c55e" : "#f5a623", fontWeight: 800, fontSize: 17, letterSpacing: 2 }}>
              {loading ? "..." : isForex ? "● FOREX AO VIVO" : "◆ OTC SINTÉTICO"}
            </div>
          </div>
        </div>
        {isOverridden
          ? <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.4)", color: "#f5a623", padding: "4px 10px", borderRadius: 4 }}>⚡ OVERRIDE MANUAL</span>
          : <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, background: "rgba(148,163,184,0.08)", border: "1px solid #1e2d50", color: "#64748b", padding: "4px 10px", borderRadius: 4 }}>⏱ AUTOMÁTICO</span>
        }
      </div>

      {/* Info row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Modo Auto",        value: autoMode === "forex" ? "FOREX" : "OTC", color: autoMode === "forex" ? "#22c55e" : "#f5a623" },
          { label: "Próxima Troca",    value: nextSwitchAt, color: "#fff" },
          { label: "Horário OTC",      value: "20h → 07h WAT", color: "#94a3b8" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...card, padding: "10px 12px" }}>
            <div style={{ color: "#64748b", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
            <div style={{ color, fontWeight: 700, fontFamily: "monospace", fontSize: 13 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Botões */}
      <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Forçar Modo</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {(["forex", "otc"] as const).map(m => {
          const active  = mode === m;
          const color   = m === "forex" ? "#22c55e" : "#f5a623";
          const label   = m === "forex" ? "FOREX" : "OTC";
          const icon    = m === "forex" ? "●" : "◆";
          const hours   = m === "forex" ? "07h → 20h WAT" : "20h → 07h WAT";
          return (
            <button key={m} disabled={active || busy}
              onClick={() => setConfirm(m)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "16px 12px", borderRadius: 8, border: `1px solid ${active ? color : "#1e2d50"}`, background: active ? `${color}18` : "#0a0f1e", cursor: active ? "default" : "pointer", position: "relative", transition: "all .2s", boxShadow: active ? `0 0 14px ${color}44` : "none" }}>
              <span style={{ fontSize: 18, color }}>{icon}</span>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: 2, color: "#fff" }}>{label}</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>{hours}</span>
              {active && <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9, fontWeight: 700, letterSpacing: 1, background: `${color}30`, border: `1px solid ${color}`, color, padding: "2px 6px", borderRadius: 3 }}>ATIVO</span>}
            </button>
          );
        })}
      </div>

      {/* Clear override */}
      {isOverridden && (
        <div style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 8, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ color: "#64748b", fontSize: 12 }}>Override manual activo — modo automático suspenso</div>
          <button onClick={handleClear} disabled={busy}
            style={{ flexShrink: 0, background: "transparent", border: "1px solid rgba(245,166,35,0.4)", color: "#f5a623", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            <RotateCcw size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Voltar ao Automático
          </button>
        </div>
      )}
    </div>
  );
}
