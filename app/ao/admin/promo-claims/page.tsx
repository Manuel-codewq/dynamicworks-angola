"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Gift } from "lucide-react";

interface Row {
  id: string;
  userName: string;
  userEmail: string;
  amount: number;
  status: "pending" | "claimed" | "expired";
  expiresAt: string;
  claimedAt: string | null;
  createdAt: string;
}

interface Summary {
  total: number; claimed: number; pending: number; expired: number;
  totalPaid: number; totalPotential: number;
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pendente", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  claimed: { label: "Resgatado", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  expired: { label: "Expirado", color: "#64748b", bg: "rgba(100,116,139,0.12)" },
};

export default function PromoClaimsAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/promo-claims");
    if (res.ok) {
      const d = await res.json();
      setRows(d.rows);
      setSummary(d.summary);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const card: React.CSSProperties = { background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "18px 20px" };

  return (
    <div style={{ padding: 28, maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <Gift size={22} /> Links de Resgate — Promoção
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>
            Links únicos por utilizador, distinto dos códigos promocionais em "Bónus e Promoções".
          </p>
        </div>
        <button onClick={load}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div style={card}><div style={{ color: "#64748b", fontSize: 12 }}>Total de links</div><div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>{summary.total}</div></div>
          <div style={card}><div style={{ color: "#64748b", fontSize: 12 }}>Resgatados</div><div style={{ color: "#22c55e", fontSize: 22, fontWeight: 800 }}>{summary.claimed}</div></div>
          <div style={card}><div style={{ color: "#64748b", fontSize: 12 }}>Pendentes</div><div style={{ color: "#f59e0b", fontSize: 22, fontWeight: 800 }}>{summary.pending}</div></div>
          <div style={card}><div style={{ color: "#64748b", fontSize: 12 }}>Expirados</div><div style={{ color: "#64748b", fontSize: 22, fontWeight: 800 }}>{summary.expired}</div></div>
          <div style={card}><div style={{ color: "#64748b", fontSize: 12 }}>Pago até agora</div><div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>{summary.totalPaid.toLocaleString("pt-PT")} Kz</div></div>
          <div style={card}><div style={{ color: "#64748b", fontSize: 12 }}>Custo potencial total</div><div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>{summary.totalPotential.toLocaleString("pt-PT")} Kz</div></div>
        </div>
      )}

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        {loading ? (
          <p style={{ color: "#94a3b8", padding: 20 }}>A carregar...</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "#334155", padding: 20 }}>Nenhum link gerado ainda.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e2d50" }}>
                {["Utilizador", "Valor", "Estado", "Criado", "Expira", "Resgatado"].map(h => (
                  <th key={h} style={{ textAlign: "left", color: "#64748b", fontSize: 11, textTransform: "uppercase", padding: "10px 16px", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const s = STATUS_STYLE[r.status];
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #0a0f1e" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{r.userName}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>{r.userEmail}</div>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#fff", fontSize: 13, fontWeight: 700 }}>{r.amount.toLocaleString("pt-PT")} Kz</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ background: s.bg, color: s.color, fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>{s.label}</span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#94a3b8", fontSize: 12 }}>{new Date(r.createdAt).toLocaleString("pt-AO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td style={{ padding: "12px 16px", color: "#94a3b8", fontSize: 12 }}>{new Date(r.expiresAt).toLocaleString("pt-AO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td style={{ padding: "12px 16px", color: "#94a3b8", fontSize: 12 }}>{r.claimedAt ? new Date(r.claimedAt).toLocaleString("pt-AO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
