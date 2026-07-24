"use client";
import { useEffect, useState } from "react";
import { formatKz } from "@/lib/format";
import { ArrowDownLeft, ArrowUpRight, Clock, Percent, RefreshCw, TrendingUp } from "lucide-react";

interface WalletData {
  balance:        number;
  pendingOut:     number;
  available:      number;
  totalFees:      number;
  totalPaidOut:   number;
  totalDeposited: number;
}

interface LedgerEntry {
  id: string; type: string; amount: number;
  description: string | null; createdAt: string;
}

const TYPE_META: Record<string, { label: string; color: string; sign: "+" | "-" }> = {
  deposit_in:          { label: "Depósito recebido",      color: "#00c076", sign: "+" },
  withdrawal_pending:  { label: "Levantamento bloqueado", color: "#fbbf24", sign: "-" },
  withdrawal_approved: { label: "Levantamento pago",      color: "#ff3b5c", sign: "-" },
  withdrawal_rejected: { label: "Devolvido ao utilizador",color: "#64748b", sign: "+" },
  fee_earned:          { label: "Taxa retida (5%)",        color: "#a78bfa", sign: "+" },
};

export default function AdminWalletPage() {
  const [data,    setData]    = useState<{ wallet: WalletData; ledger: LedgerEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastAt,  setLastAt]  = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/wallet");
    if (res.ok) { setData(await res.json()); setLastAt(new Date().toLocaleTimeString("pt-AO")); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading && !data) return <div style={{ padding: 32, color: "#94a3b8", fontFamily: "system-ui" }}>A carregar...</div>;
  if (!data)            return <div style={{ padding: 32, color: "#ff3b5c", fontFamily: "system-ui" }}>Erro ao carregar.</div>;

  const { wallet, ledger } = data;
  const fillPct = wallet.balance > 0 ? Math.min(100, Math.round((wallet.available / wallet.balance) * 100)) : 0;

  return (
    <div style={{ padding: "28px 28px 40px", maxWidth: 900, fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Carteira da Empresa</h1>
          <p style={{ color: "#475569", fontSize: 13, margin: "4px 0 0" }}>
            Actualizado às {lastAt || "—"}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "1px solid #2d3e6b", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13, opacity: loading ? 0.6 : 1 }}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Actualizar
        </button>
      </div>

      {/* Cartão principal — disponível */}
      <div style={{
        background: "linear-gradient(135deg, #0d2b1a 0%, #0a1f15 50%, #071510 100%)",
        border: "1px solid rgba(0,192,118,0.35)",
        borderRadius: 20,
        padding: "28px 32px",
        marginBottom: 20,
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 0 40px rgba(0,192,118,0.08)",
      }}>
        {/* Círculo decorativo */}
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,192,118,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ color: "#00c076", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, opacity: 0.8 }}>Saldo disponível</div>
        <div style={{ color: "#00c076", fontSize: 42, fontWeight: 900, letterSpacing: -1, fontVariantNumeric: "tabular-nums", marginBottom: 4 }}>
          {formatKz(Math.floor(wallet.available))}
        </div>
        <div style={{ color: "#1a5c3a", fontSize: 13, marginBottom: 24 }}>
          Total recebido: <span style={{ color: "#2d8a5a", fontWeight: 700 }}>{formatKz(Math.floor(wallet.totalDeposited))}</span>
        </div>

        {/* Barra disponível vs pendente */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${fillPct}%`, background: "linear-gradient(90deg,#00c076,#00e890)", borderRadius: 4, transition: "width 0.6s ease" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <span style={{ color: "#00c076", fontSize: 11 }}>● Disponível {fillPct}%</span>
          <span style={{ color: "#fbbf24", fontSize: 11 }}>● Pendente {100 - fillPct}%</span>
        </div>
      </div>

      {/* Cards secundários */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>

        <div style={{ background: "#111827", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(251,191,36,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={14} color="#fbbf24" />
            </div>
            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>Pendente</span>
          </div>
          <div style={{ color: "#fbbf24", fontWeight: 900, fontSize: 20, fontVariantNumeric: "tabular-nums" }}>{formatKz(Math.floor(wallet.pendingOut))}</div>
          <div style={{ color: "#374151", fontSize: 11, marginTop: 4 }}>A pagar levantamentos</div>
        </div>

        <div style={{ background: "#111827", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(167,139,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Percent size={14} color="#a78bfa" />
            </div>
            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>Taxas (5%)</span>
          </div>
          <div style={{ color: "#a78bfa", fontWeight: 900, fontSize: 20, fontVariantNumeric: "tabular-nums" }}>{formatKz(Math.floor(wallet.totalFees))}</div>
          <div style={{ color: "#374151", fontSize: 11, marginTop: 4 }}>Retidas em levantamentos</div>
        </div>

        <div style={{ background: "#111827", border: "1px solid rgba(255,59,92,0.2)", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,59,92,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowUpRight size={14} color="#ff3b5c" />
            </div>
            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>Pago out</span>
          </div>
          <div style={{ color: "#ff3b5c", fontWeight: 900, fontSize: 20, fontVariantNumeric: "tabular-nums" }}>{formatKz(Math.floor(wallet.totalPaidOut))}</div>
          <div style={{ color: "#374151", fontSize: 11, marginTop: 4 }}>Total pago a traders</div>
        </div>

        <div style={{ background: "#111827", border: "1px solid rgba(0,192,118,0.15)", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(0,192,118,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowDownLeft size={14} color="#00c076" />
            </div>
            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>Depositado</span>
          </div>
          <div style={{ color: "#00c076", fontWeight: 900, fontSize: 20, fontVariantNumeric: "tabular-nums" }}>{formatKz(Math.floor(wallet.totalDeposited))}</div>
          <div style={{ color: "#374151", fontSize: 11, marginTop: 4 }}>Total recebido via depósitos</div>
        </div>

      </div>

      {/* Ledger */}
      <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2d50", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Últimos movimentos</span>
          <span style={{ color: "#475569", fontSize: 12 }}>{ledger.length} registos</span>
        </div>

        {ledger.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <TrendingUp size={32} color="#1e2d50" style={{ marginBottom: 12 }} />
            <p style={{ color: "#475569", fontSize: 14, margin: 0 }}>Os movimentos aparecem quando depósitos e levantamentos forem processados.</p>
          </div>
        ) : (
          <div>
            {ledger.map((e, i) => {
              const m = TYPE_META[e.type] ?? { label: e.type, color: "#94a3b8", sign: "+" as const };
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderBottom: i < ledger.length - 1 ? "1px solid #0d1526" : "none", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                    <div style={{ color: "#475569", fontSize: 11, marginTop: 1 }}>
                      {new Date(e.createdAt).toLocaleString("pt-AO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div style={{ color: m.sign === "+" ? "#00c076" : "#ff3b5c", fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                    {m.sign}{formatKz(Math.floor(e.amount))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
