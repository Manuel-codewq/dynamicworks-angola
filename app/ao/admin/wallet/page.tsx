"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatKz } from "@/lib/format";
import { Wallet, TrendingUp, Clock, ArrowDownLeft, ArrowUpRight, Percent, RefreshCw } from "lucide-react";

interface WalletData {
  balance:      number;
  pendingOut:   number;
  available:    number;
  totalFees:    number;
  totalPaidOut: number;
}

interface LedgerEntry {
  id:          string;
  type:        string;
  amount:      number;
  description: string | null;
  userId:      string | null;
  txId:        string | null;
  createdAt:   string;
}

const TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode; sign: "+" | "-" }> = {
  deposit_in:          { label: "Depósito recebido",    color: "#00c076", icon: <ArrowDownLeft  size={14} />, sign: "+" },
  withdrawal_pending:  { label: "Levantamento bloqueado", color: "#fbbf24", icon: <Clock          size={14} />, sign: "-" },
  withdrawal_approved: { label: "Levantamento pago",    color: "#ff3b5c", icon: <ArrowUpRight   size={14} />, sign: "-" },
  withdrawal_rejected: { label: "Levantamento rejeitado", color: "#64748b", icon: <ArrowDownLeft  size={14} />, sign: "+" },
  fee_earned:          { label: "Taxa retida (5%)",     color: "#a78bfa", icon: <Percent        size={14} />, sign: "+" },
};

export default function AdminWalletPage() {
  const router = useRouter();
  const [data,    setData]    = useState<{ wallet: WalletData; ledger: LedgerEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/wallet");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const card: React.CSSProperties = { background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "20px 22px" };

  if (loading) return <div style={{ padding: 32, color: "#94a3b8" }}>A carregar...</div>;
  if (!data)   return <div style={{ padding: 32, color: "#ff3b5c" }}>Erro ao carregar.</div>;

  const { wallet, ledger } = data;

  const stats = [
    { label: "Disponível",         value: wallet.available,    color: "#00c076", icon: <Wallet      size={18} />, bg: "rgba(0,192,118,0.1)",    border: "rgba(0,192,118,0.25)"  },
    { label: "Saldo total",        value: wallet.balance,      color: "#ffffff", icon: <TrendingUp  size={18} />, bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)" },
    { label: "Pendente (a pagar)", value: wallet.pendingOut,   color: "#fbbf24", icon: <Clock       size={18} />, bg: "rgba(251,191,36,0.1)",   border: "rgba(251,191,36,0.25)" },
    { label: "Taxas acumuladas",   value: wallet.totalFees,    color: "#a78bfa", icon: <Percent     size={18} />, bg: "rgba(167,139,250,0.1)",  border: "rgba(167,139,250,0.25)" },
    { label: "Total pago out",     value: wallet.totalPaidOut, color: "#ff3b5c", icon: <ArrowUpRight size={18} />, bg: "rgba(255,59,92,0.1)",   border: "rgba(255,59,92,0.25)"  },
  ];

  return (
    <div style={{ padding: 28, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Carteira da Empresa</h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>Movimentos financeiros da plataforma</p>
        </div>
        <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ color: s.color, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ color: s.color, fontWeight: 900, fontSize: 18, fontVariantNumeric: "tabular-nums", marginBottom: 4 }}>
              {formatKz(Math.floor(s.value))}
            </div>
            <div style={{ color: "#64748b", fontSize: 11, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Disponível vs Pendente — barra visual */}
      {(wallet.balance > 0) && (
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>Composição do saldo</span>
            <span style={{ color: "#64748b", fontSize: 12 }}>
              {wallet.balance > 0 ? Math.round((wallet.available / wallet.balance) * 100) : 0}% disponível
            </span>
          </div>
          <div style={{ height: 10, background: "#1e2d50", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ display: "flex", height: "100%", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: `${wallet.balance > 0 ? (wallet.available / wallet.balance) * 100 : 0}%`, background: "#00c076", transition: "width 0.5s ease" }} />
              <div style={{ flex: 1, background: "#fbbf24" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <span style={{ color: "#00c076", fontSize: 11 }}>● Disponível {formatKz(Math.floor(wallet.available))}</span>
            <span style={{ color: "#fbbf24", fontSize: 11 }}>● Pendente {formatKz(Math.floor(wallet.pendingOut))}</span>
          </div>
        </div>
      )}

      {/* Ledger */}
      <div style={card}>
        <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 16px" }}>Últimos 50 movimentos</p>
        {ledger.length === 0 && (
          <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
            Sem movimentos ainda. Os registos aparecem quando depósitos e levantamentos forem aprovados.
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {ledger.map((e, i) => {
            const m = TYPE_META[e.type] ?? { label: e.type, color: "#94a3b8", icon: null, sign: "+" as const };
            return (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: i % 2 === 0 ? "#0a0f1e" : "transparent", borderRadius: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${m.color}18`, border: `1px solid ${m.color}40`, display: "flex", alignItems: "center", justifyContent: "center", color: m.color, flexShrink: 0 }}>
                  {m.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                  <div style={{ color: "#475569", fontSize: 11, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.description ?? "—"} · {new Date(e.createdAt).toLocaleString("pt-AO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div style={{ color: m.sign === "+" ? "#00c076" : "#ff3b5c", fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                  {m.sign}{formatKz(Math.floor(e.amount))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
