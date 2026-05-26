"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { Activity, RefreshCw, TrendingUp, TrendingDown, Wallet, Gamepad2, AlertTriangle } from "lucide-react";
import { formatKz } from "@/lib/format";

interface LiveTrade {
  id: string;
  asset: string;
  direction: string;
  amount: number;
  entryPrice: number;
  payout: number;
  brokerPays: number;
  remainingSecs: number;
  expiresAt: number;
  isDemo: boolean;
  user: { name: string; email: string };
}

interface Stats {
  total: number;
  realCount: number;
  demoCount: number;
  totalAmount: number;
  totalExposure: number;
}

function Countdown({ expiresAt, serverTime }: { expiresAt: number; serverTime: number }) {
  const offset = useRef(serverTime - Date.now());
  const [secs, setSecs] = useState(() => Math.max(0, Math.floor((expiresAt - (Date.now() + offset.current)) / 1000)));

  useEffect(() => {
    const id = setInterval(() => {
      setSecs(Math.max(0, Math.floor((expiresAt - (Date.now() + offset.current)) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const urgent = secs <= 10;
  return (
    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: urgent ? "#ef4444" : secs <= 30 ? "#f5a623" : "#22c55e" }}>
      {mm}:{ss}
    </span>
  );
}

const card = (bg: string, border: string): React.CSSProperties => ({
  background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "16px 20px", flex: 1, minWidth: 160,
});

export default function LivePage() {
  const [trades,     setTrades]     = useState<LiveTrade[]>([]);
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [serverTime, setServerTime] = useState(Date.now());
  const [lastUpdate, setLastUpdate] = useState("");
  const [mode,       setMode]       = useState<"real" | "demo">("real");
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/live");
      if (!res.ok) return;
      const data = await res.json();
      setTrades(data.trades ?? []);
      setStats(data.stats ?? null);
      setServerTime(data.serverTime ?? Date.now());
      setLastUpdate(new Date().toLocaleTimeString("pt-AO"));
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const shown = trades.filter(t => (mode === "real" ? !t.isDemo : t.isDemo));

  const th: React.CSSProperties = { color: "#94a3b8", fontSize: 12, padding: "10px 14px", textAlign: "left", borderBottom: "1px solid #1e2d50", fontWeight: 600, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "11px 14px", borderBottom: "1px solid rgba(30,45,80,0.4)", fontSize: 13 };

  return (
    <div style={{ padding: 28, fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <Activity size={22} color="#f5a623" />
            <span style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, background: "#22c55e", borderRadius: "50%", animation: "pulse 1.5s infinite" }} />
          </div>
          <div>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Operações ao Vivo</h1>
            <p style={{ color: "#64748b", fontSize: 12, margin: "3px 0 0" }}>
              Atualiza a cada 5s · última: {lastUpdate || "—"}
            </p>
          </div>
        </div>
        <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={card("rgba(245,166,35,0.08)", "rgba(245,166,35,0.2)")}>
            <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>OPERAÇÕES ATIVAS</div>
            <div style={{ color: "#f5a623", fontSize: 28, fontWeight: 800 }}>{stats.realCount}</div>
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{stats.demoCount} demo</div>
          </div>
          <div style={card("rgba(34,197,94,0.08)", "rgba(34,197,94,0.2)")}>
            <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>MONTANTE EM JOGO</div>
            <div style={{ color: "#22c55e", fontSize: 22, fontWeight: 800 }}>{formatKz(stats.totalAmount)}</div>
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>só conta real</div>
          </div>
          <div style={card("rgba(239,68,68,0.08)", "rgba(239,68,68,0.2)")}>
            <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>EXPOSIÇÃO MÁX. CORRETORA</div>
            <div style={{ color: "#ef4444", fontSize: 22, fontWeight: 800 }}>{formatKz(stats.totalExposure)}</div>
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>se todos ganharem</div>
          </div>
          <div style={card("rgba(59,130,246,0.08)", "rgba(59,130,246,0.2)")}>
            <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>LUCRO MÁX. CORRETORA</div>
            <div style={{ color: "#3b82f6", fontSize: 22, fontWeight: 800 }}>{formatKz(stats.totalAmount)}</div>
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>se todos perderem</div>
          </div>
        </div>
      )}

      {/* Real / Demo tabs */}
      <div style={{ display: "flex", gap: 4, background: "#111827", border: "1px solid #1e2d50", borderRadius: 10, padding: 4, marginBottom: 20, width: "fit-content" }}>
        {(["real", "demo"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{ padding: "7px 20px", borderRadius: 7, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
              background: mode === m ? (m === "real" ? "#22c55e" : "#f5a623") : "transparent",
              color:      mode === m ? "#0a0f1e" : "#94a3b8",
            }}>
            {m === "real"
              ? <><Wallet size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />Conta Real</>
              : <><Gamepad2 size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />Conta Demo</>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>A carregar...</div>
        ) : shown.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
            <Activity size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>Nenhuma operação activa neste momento</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Utilizador</th>
                <th style={th}>Par</th>
                <th style={th}>Direcção</th>
                <th style={th}>Montante</th>
                <th style={th}>Preço Entrada</th>
                <th style={th}>Tempo</th>
                <th style={th}>Exposição</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(t => {
                const isCall = t.direction === "call";
                return (
                  <tr key={t.id} style={{ transition: "background 0.2s" }}>
                    <td style={td}>
                      <div style={{ color: "#e2e8f0", fontWeight: 600 }}>{t.user.name ?? "—"}</div>
                      <div style={{ color: "#64748b", fontSize: 11 }}>{t.user.email}</div>
                    </td>
                    <td style={{ ...td, color: "#fff", fontWeight: 700 }}>{t.asset}</td>
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: isCall ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                        color:      isCall ? "#22c55e" : "#ef4444",
                      }}>
                        {isCall ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isCall ? "ALTA" : "BAIXA"}
                      </span>
                    </td>
                    <td style={{ ...td, color: "#f5a623", fontWeight: 700 }}>{formatKz(t.amount)}</td>
                    <td style={{ ...td, color: "#94a3b8", fontFamily: "monospace" }}>{t.entryPrice}</td>
                    <td style={td}>
                      <Countdown expiresAt={t.expiresAt} serverTime={serverTime} />
                    </td>
                    <td style={td}>
                      <span style={{ color: "#ef4444", fontWeight: 700 }}>{formatKz(t.brokerPays)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}
