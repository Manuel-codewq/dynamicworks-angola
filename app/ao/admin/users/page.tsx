"use client";
import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, XCircle, Shield } from "lucide-react";

function formatKz(n: number) { return n.toLocaleString("pt-AO") + " Kz"; }

interface AdminUser {
  id: string; name: string; email: string; province: string | null;
  balance: number; role: string; status: string; kycStatus: string;
  createdAt: string; _count: { trades: number };
}

const KYC_LABEL: Record<string, string> = { pending: "Pendente", approved: "Verificado", rejected: "Rejeitado" };
const KYC_COLOR: Record<string, string> = { pending: "#f5a623", approved: "#22c55e", rejected: "#ef4444" };
const KYC_BG:    Record<string, string> = {
  pending:  "rgba(245,166,35,0.12)",
  approved: "rgba(34,197,94,0.12)",
  rejected: "rgba(239,68,68,0.12)",
};

export default function AdminUsersPage() {
  const [users,      setUsers]      = useState<AdminUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [busyId,     setBusyId]     = useState<string | null>(null);
  const [balInputs,  setBalInputs]  = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function patch(id: string, url: string, body: object, method: "PATCH" | "POST" = "PATCH") {
    setBusyId(id);
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusyId(null);
    load();
  }

  const th: React.CSSProperties = { color: "#94a3b8", fontSize: 12, padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #1e2d50", fontWeight: 600, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid rgba(30,45,80,0.4)", fontSize: 13 };

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Utilizadores</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>{users.length} contas registadas</p>
        </div>
        <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? <p style={{ color: "#94a3b8" }}>A carregar...</p> : (
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1050 }}>
            <thead>
              <tr>
                {["Nome","Email","Província","Saldo Real","Operações","Estado","KYC","Ações"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: busyId === u.id ? 0.5 : 1, transition: "opacity 0.2s" }}>

                  {/* Nome */}
                  <td style={{ ...td, color: "#fff", fontWeight: 600 }}>
                    {u.name}
                    {u.role === "admin" && (
                      <span style={{ marginLeft: 6, background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 10, borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>ADMIN</span>
                    )}
                  </td>

                  {/* Email */}
                  <td style={{ ...td, color: "#94a3b8" }}>{u.email}</td>

                  {/* Província */}
                  <td style={{ ...td, color: "#94a3b8" }}>{u.province ?? "—"}</td>

                  {/* Saldo + ajuste */}
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="number"
                        defaultValue={Math.floor(u.balance)}
                        onChange={e => setBalInputs(p => ({ ...p, [u.id]: e.target.value }))}
                        style={{ width: 100, background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 6, padding: "4px 8px", color: "#fff", fontSize: 12, outline: "none" }}
                      />
                      <button
                        onClick={() => patch(u.id, `/api/admin/users/${u.id}/balance`, { balance: balInputs[u.id] ?? Math.floor(u.balance) })}
                        disabled={busyId === u.id}
                        style={{ background: "#f5a623", color: "#0a0f1e", border: "none", borderRadius: 5, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        OK
                      </button>
                    </div>
                  </td>

                  {/* Operações */}
                  <td style={{ ...td, color: "#94a3b8" }}>{u._count.trades}</td>

                  {/* Estado conta */}
                  <td style={td}>
                    <span style={{ background: u.status === "active" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: u.status === "active" ? "#22c55e" : "#ef4444", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                      {u.status === "active" ? "Ativo" : "Bloqueado"}
                    </span>
                  </td>

                  {/* KYC */}
                  <td style={td}>
                    <span style={{ background: KYC_BG[u.kycStatus] ?? KYC_BG.pending, color: KYC_COLOR[u.kycStatus] ?? KYC_COLOR.pending, borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {KYC_LABEL[u.kycStatus] ?? u.kycStatus}
                    </span>
                  </td>

                  {/* Ações */}
                  <td style={td}>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {u.role !== "admin" && (
                        u.status === "active" ? (
                          <button onClick={() => patch(u.id, `/api/admin/users/${u.id}/status`, { status: "blocked" })} disabled={busyId === u.id}
                            style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: "4px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                            <XCircle size={11} /> Bloquear
                          </button>
                        ) : (
                          <button onClick={() => patch(u.id, `/api/admin/users/${u.id}/status`, { status: "active" })} disabled={busyId === u.id}
                            style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 6, padding: "4px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                            <CheckCircle size={11} /> Desbloquear
                          </button>
                        )
                      )}
                      {u.role !== "admin" && (
                        <button onClick={() => patch(u.id, `/api/admin/users/${u.id}/role`, { role: "admin" })} disabled={busyId === u.id}
                          style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(245,166,35,0.1)", color: "#f5a623", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 6, padding: "4px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          <Shield size={11} /> Admin
                        </button>
                      )}
                      {u.kycStatus === "pending" && u.role !== "admin" && (
                        <>
                          <button onClick={() => patch(u.id, `/api/admin/users/${u.id}/kyc`, { status: "approved" }, "POST")} disabled={busyId === u.id}
                            style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 6, padding: "4px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                            <CheckCircle size={11} /> KYC ✓
                          </button>
                          <button onClick={() => patch(u.id, `/api/admin/users/${u.id}/kyc`, { status: "rejected" }, "POST")} disabled={busyId === u.id}
                            style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: "4px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                            <XCircle size={11} /> KYC ✗
                          </button>
                        </>
                      )}
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
