"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditLog {
  id: string; adminId: string; adminName: string;
  action: string; target: string; detail: string | null; createdAt: string;
}

const ACTION_COLOR: Record<string, string> = {
  APPROVE_TXN: "#22c55e", REJECT_TXN: "#ef4444",
  APPROVE_KYC: "#22c55e", REJECT_KYC: "#ef4444",
  BLOCK_USER: "#ef4444",  UNBLOCK_USER: "#22c55e",
  EDIT_BALANCE: "#f5a623", BROADCAST: "#38bdf8",
  NOTIFY_USER: "#a78bfa", SAVE_SETTINGS: "#f5a623",
};

function formatDate(s: string) {
  return new Date(s).toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminAuditPage() {
  const [logs,    setLogs]    = useState<AuditLog[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  async function load(p = 1) {
    setLoading(true);
    const res = await fetch(`/api/admin/audit?page=${p}`);
    if (res.ok) { const d = await res.json(); setLogs(d.logs); setTotal(d.total); setPage(p); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const totalPages = Math.ceil(total / 50);

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Logs de Auditoria</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>{total} ações registadas</p>
        </div>
        <button onClick={() => load(page)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 20px", borderBottom: "1px solid #1e2d50" }}>
          <ShieldCheck size={16} color="#f5a623" />
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Histórico de ações admin</span>
        </div>

        {loading ? (
          <p style={{ color: "#94a3b8", padding: 20 }}>A carregar...</p>
        ) : logs.length === 0 ? (
          <p style={{ color: "#334155", padding: 20, fontSize: 13 }}>Nenhuma ação registada ainda.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0d1526" }}>
                  {["Data", "Admin", "Ação", "Alvo", "Detalhe"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", color: "#64748b", fontSize: 11, fontWeight: 700, textAlign: "left", letterSpacing: 0.5 }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={l.id} style={{ borderTop: "1px solid #1e2d50", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "10px 16px", color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>{formatDate(l.createdAt)}</td>
                    <td style={{ padding: "10px 16px", color: "#94a3b8", fontSize: 13 }}>{l.adminName}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ background: `${ACTION_COLOR[l.action] ?? "#94a3b8"}18`, color: ACTION_COLOR[l.action] ?? "#94a3b8", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{l.action}</span>
                    </td>
                    <td style={{ padding: "10px 16px", color: "#64748b", fontSize: 12, fontFamily: "monospace" }}>{l.target.length > 20 ? l.target.slice(0, 20) + "…" : l.target}</td>
                    <td style={{ padding: "10px 16px", color: "#94a3b8", fontSize: 12 }}>{l.detail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "14px 20px", borderTop: "1px solid #1e2d50" }}>
            <button onClick={() => load(page - 1)} disabled={page <= 1} style={{ background: "#1e2d50", border: "none", borderRadius: 6, padding: "6px 10px", color: "#94a3b8", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ color: "#94a3b8", fontSize: 13 }}>Página {page} de {totalPages}</span>
            <button onClick={() => load(page + 1)} disabled={page >= totalPages} style={{ background: "#1e2d50", border: "none", borderRadius: 6, padding: "6px 10px", color: "#94a3b8", cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1 }}>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
