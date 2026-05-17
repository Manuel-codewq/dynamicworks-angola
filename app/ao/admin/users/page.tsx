"use client";
import { formatKz } from "@/lib/format";
import { useEffect, useState, useMemo } from "react";
import {
  RefreshCw, CheckCircle, XCircle, Shield, ScanFace,
  Search, Users, UserCheck, UserX, Clock, Download,
  Trash2, KeyRound,
} from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

interface AdminUser {
  id: string; name: string; email: string; phone: string | null;
  province: string | null; balance: number; role: string;
  status: string; kycStatus: string; kycAttempts: number; createdAt: string;
  kycSubmission: { id: string } | null;
  _count: { trades: number; transactions: number };
}

const KYC_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  "no-submit": { label: "Sem docs",   color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  pending:     { label: "A rever",    color: "#f5a623", bg: "rgba(245,166,35,0.12)"  },
  approved:    { label: "Verificado", color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  rejected:    { label: "Rejeitado",  color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
};

type StatusFilter = "all" | "active" | "blocked";

export default function AdminUsersPage() {
  const [users,     setUsers]     = useState<AdminUser[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [busyId,    setBusyId]    = useState<string | null>(null);
  const [search,    setSearch]    = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editBal,      setEditBal]      = useState<{ id: string; value: string } | null>(null);
  const [selected,     setSelected]     = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [resetResult,   setResetResult]   = useState<{ name: string; email: string; tempPassword: string } | null>(null);
  const [resetting,     setResetting]     = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function action(id: string, url: string, body: object, method: "PATCH" | "POST" = "PATCH") {
    setBusyId(id);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Erro ao executar ação.");
    }
    setBusyId(null);
    setSelected(null);
    setEditBal(null);
    load();
  }

  async function deleteUser(u: AdminUser) {
    setBusyId(u.id);
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    setBusyId(null);
    setConfirmDelete(null);
    if (!res.ok) { alert(d.error || "Erro ao eliminar."); return; }
    load();
  }

  async function resetPassword(u: AdminUser) {
    setResetting(u.id);
    const res = await fetch(`/api/admin/users/${u.id}/reset-password`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setResetting(null);
    if (!res.ok) { alert(d.error || "Erro ao repor senha."); return; }
    setResetResult({ name: u.name, email: u.email, tempPassword: d.tempPassword });
  }

  async function saveBalance(type: "real" | "demo" = "real") {
    if (!editBal) return;
    await action(editBal.id, `/api/admin/users/${editBal.id}/balance`, { balance: editBal.value, type });
  }

  const filtered = useMemo(() => {
    let list = users;
    if (statusFilter !== "all") list = list.filter(u => u.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return list;
  }, [users, search, statusFilter]);

  const counts = useMemo(() => ({
    total:      users.length,
    active:     users.filter(u => u.status === "active").length,
    blocked:    users.filter(u => u.status === "blocked").length,
    kycSubmitted: users.filter(u => u.kycSubmission !== null && u.kycStatus === "pending").length,
  }), [users]);

  const th: React.CSSProperties = { color: "#64748b", fontSize: 11, padding: "10px 14px", textAlign: "left", borderBottom: "1px solid #1e2d50", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "11px 14px", borderBottom: "1px solid rgba(30,45,80,0.3)", fontSize: 13, verticalAlign: "middle" };

  return (
    <div style={{ padding: 28, maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={22} color="#f5a623" /> Utilizadores
          </h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>Gestão de contas e permissões</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => exportCsv("utilizadores.csv",
            ["ID", "Nome", "Email", "Telefone", "Província", "Saldo (Kz)", "Role", "Estado", "KYC", "Operações", "Registo"],
            users.map(u => [u.id, u.name, u.email, u.phone ?? "", u.province ?? "", Math.floor(u.balance), u.role, u.status, u.kycStatus, u._count.trades, formatDate(u.createdAt)])
          )} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "8px 14px", color: "#22c55e", cursor: "pointer", fontSize: 13 }}>
            <Download size={14} /> CSV
          </button>
          <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total", value: counts.total,   Icon: Users,     color: "#94a3b8", filter: "all"     as StatusFilter },
          { label: "Ativos",   value: counts.active,  Icon: UserCheck, color: "#22c55e", filter: "active"  as StatusFilter },
          { label: "Bloqueados", value: counts.blocked, Icon: UserX,    color: "#ef4444", filter: "blocked" as StatusFilter },
          { label: "KYC a rever", value: counts.kycSubmitted, Icon: Clock, color: "#f5a623", filter: null },
        ].map(s => (
          <button key={s.label} onClick={() => s.filter && setStatusFilter(s.filter)}
            style={{ background: "#111827", border: statusFilter === s.filter ? `1px solid ${s.color}` : "1px solid #1e2d50", borderRadius: 14, padding: "16px 18px", textAlign: "left", cursor: s.filter ? "pointer" : "default", transition: "border-color .2s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>{s.label}</span>
              <s.Icon size={16} color={s.color} />
            </div>
            <div style={{ color: "#fff", fontSize: 26, fontWeight: 800 }}>{s.value}</div>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
          <input
            placeholder="Pesquisar por nome ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", background: "#111827", border: "1px solid #1e2d50", borderRadius: 10, padding: "9px 12px 9px 36px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        {(["all", "active", "blocked"] as StatusFilter[]).map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid", borderColor: statusFilter === f ? "#f5a623" : "#1e2d50", background: statusFilter === f ? "rgba(245,166,35,0.12)" : "transparent", color: statusFilter === f ? "#f5a623" : "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {f === "all" ? "Todos" : f === "active" ? "Ativos" : "Bloqueados"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>A carregar...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
              <thead>
                <tr>
                  {["Utilizador", "Contacto", "Saldo Real", "Saldo Demo", "Trades", "KYC", "Estado", "Registo", "Ações"].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Nenhum utilizador encontrado.</td></tr>
                ) : filtered.map(u => {
                  const busy = busyId === u.id;
                  const kyc = KYC_STYLE[u.kycStatus] ?? KYC_STYLE.pending;
                  const isEditing = editBal?.id === u.id;
                  return (
                    <tr key={u.id} style={{ opacity: busy ? 0.5 : 1, transition: "opacity .2s", background: selected?.id === u.id ? "rgba(245,166,35,0.04)" : "transparent" }}>

                      {/* Utilizador */}
                      <td style={{ ...td, color: "#fff", fontWeight: 600 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span>
                            {u.name}
                            {u.role === "admin" && <span style={{ marginLeft: 6, background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 9, borderRadius: 4, padding: "1px 5px", fontWeight: 800, letterSpacing: ".5px" }}>ADMIN</span>}
                          </span>
                          <span style={{ color: "#64748b", fontSize: 11, fontWeight: 400 }}>{u.province ?? "—"}</span>
                        </div>
                      </td>

                      {/* Contacto */}
                      <td style={{ ...td, color: "#64748b" }}>
                        <div style={{ fontSize: 12 }}>{u.email}</div>
                        {u.phone && <div style={{ fontSize: 11, marginTop: 2 }}>{u.phone}</div>}
                      </td>

                      {/* Saldo Real */}
                      <td style={td}>
                        {isEditing ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input type="number" value={editBal.value}
                              onChange={e => setEditBal({ id: u.id, value: e.target.value })}
                              onKeyDown={e => { if (e.key === "Enter") saveBalance("real"); if (e.key === "Escape") setEditBal(null); }}
                              autoFocus
                              style={{ width: 110, background: "#0a0f1e", border: "1px solid #22c55e", borderRadius: 6, padding: "5px 8px", color: "#fff", fontSize: 12, outline: "none" }}
                            />
                            <button onClick={() => saveBalance("real")} disabled={busy} style={{ background: "#22c55e", color: "#000", border: "none", borderRadius: 5, padding: "5px 8px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>✓</button>
                            <button onClick={() => setEditBal(null)} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setEditBal({ id: u.id, value: String(Math.floor(u.balance)) })}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#22c55e", fontSize: 13, fontWeight: 700, padding: 0, textAlign: "left" }}
                            title="Clique para editar saldo real">
                            {formatKz(Math.floor(u.balance))}
                          </button>
                        )}
                      </td>

                      {/* Saldo Demo */}
                      <td style={td}>
                        {isEditing ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input type="number" defaultValue={Math.floor((u as any).demoBalance ?? 0)}
                              id={`demo-${u.id}`}
                              style={{ width: 110, background: "#0a0f1e", border: "1px solid #f5a623", borderRadius: 6, padding: "5px 8px", color: "#fff", fontSize: 12, outline: "none" }}
                            />
                            <button onClick={async () => {
                              const inp = document.getElementById(`demo-${u.id}`) as HTMLInputElement;
                              if (inp) await action(u.id, `/api/admin/users/${u.id}/balance`, { balance: inp.value, type: "demo" });
                            }} disabled={busy} style={{ background: "#f5a623", color: "#000", border: "none", borderRadius: 5, padding: "5px 8px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>✓</button>
                          </div>
                        ) : (
                          <button onClick={() => setEditBal({ id: u.id, value: String(Math.floor(u.balance)) })}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#f5a623", fontSize: 13, fontWeight: 600, padding: 0, textAlign: "left" }}
                            title="Clique para entrar no modo edição">
                            {formatKz(Math.floor((u as any).demoBalance ?? 0))}
                          </button>
                        )}
                      </td>

                      {/* Trades */}
                      <td style={{ ...td, color: "#94a3b8" }}>{u._count.trades}</td>

                      {/* KYC */}
                      <td style={td}>
                        {(() => {
                          const key = u.kycSubmission !== null ? u.kycStatus : "no-submit";
                          const s = KYC_STYLE[key];
                          return (
                            <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: "3px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                              {s.label}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Estado */}
                      <td style={td}>
                        <span style={{ background: u.status === "active" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: u.status === "active" ? "#22c55e" : "#ef4444", borderRadius: 20, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>
                          {u.status === "active" ? "Ativo" : "Bloqueado"}
                        </span>
                      </td>

                      {/* Registo */}
                      <td style={{ ...td, color: "#64748b", fontSize: 12 }}>{formatDate(u.createdAt)}</td>

                      {/* Ações */}
                      <td style={td}>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {u.role !== "admin" && (
                            u.status === "active" ? (
                              <button onClick={() => action(u.id, `/api/admin/users/${u.id}/status`, { status: "blocked" })} disabled={busy}
                                style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: "5px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                                <XCircle size={11} /> Bloquear
                              </button>
                            ) : (
                              <button onClick={() => action(u.id, `/api/admin/users/${u.id}/status`, { status: "active" })} disabled={busy}
                                style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 6, padding: "5px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                                <CheckCircle size={11} /> Ativar
                              </button>
                            )
                          )}
                          {u.role !== "admin" && (
                            <button onClick={() => { if (confirm(`Promover ${u.name} a admin?`)) action(u.id, `/api/admin/users/${u.id}/role`, { role: "admin" }); }} disabled={busy}
                              style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(245,166,35,0.1)", color: "#f5a623", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 6, padding: "5px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                              <Shield size={11} /> Admin
                            </button>
                          )}
                          {u.kycSubmission !== null && u.kycStatus === "pending" && (
                            <a href="/ao/admin/kyc"
                              style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 6, padding: "5px 9px", fontSize: 11, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
                              <ScanFace size={11} /> Ver KYC
                            </a>
                          )}
                          {u.role !== "admin" && (
                            <button onClick={() => resetPassword(u)} disabled={resetting === u.id || busy}
                              style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 6, padding: "5px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                              <KeyRound size={11} /> {resetting === u.id ? "..." : "Repor Senha"}
                            </button>
                          )}
                          {u.role !== "admin" && (
                            <button onClick={() => setConfirmDelete(u)} disabled={busy}
                              style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "5px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                              <Trash2 size={11} /> Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (
          <div style={{ padding: "10px 14px", borderTop: "1px solid #1e2d50", color: "#64748b", fontSize: 12 }}>
            {filtered.length} de {users.length} utilizadores
          </div>
        )}
      </div>

      {/* ── Modal: Confirmar Eliminação ── */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 18, padding: 32, maxWidth: 420, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
            <div style={{ width: 52, height: 52, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Trash2 size={22} color="#ef4444" />
            </div>
            <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 800, textAlign: "center", margin: "0 0 8px" }}>Eliminar utilizador?</h2>
            <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", margin: "0 0 6px", lineHeight: 1.5 }}>
              Estás prestes a eliminar permanentemente a conta de:
            </p>
            <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, textAlign: "center", margin: "0 0 6px" }}>{confirmDelete.name}</p>
            <p style={{ color: "#64748b", fontSize: 12, textAlign: "center", margin: "0 0 24px" }}>{confirmDelete.email}</p>
            <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 14px", marginBottom: 24 }}>
              <p style={{ color: "#fca5a5", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                Esta ação é <strong>irreversível</strong>. Todos os dados (trades, transações, KYC, etc.) serão eliminados permanentemente.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, background: "transparent", border: "1px solid #1e2d50", borderRadius: 10, padding: "11px 0", color: "#94a3b8", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={() => deleteUser(confirmDelete)} disabled={busyId === confirmDelete.id}
                style={{ flex: 1, background: "linear-gradient(135deg,#dc2626,#ef4444)", border: "none", borderRadius: 10, padding: "11px 0", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busyId === confirmDelete.id ? 0.6 : 1 }}>
                {busyId === confirmDelete.id ? "A eliminar..." : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Resultado de Reset de Senha ── */}
      {resetResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 18, padding: 32, maxWidth: 420, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
            <div style={{ width: 52, height: 52, background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <KeyRound size={22} color="#38bdf8" />
            </div>
            <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 800, textAlign: "center", margin: "0 0 6px" }}>Senha reposta</h2>
            <p style={{ color: "#64748b", fontSize: 12, textAlign: "center", margin: "0 0 24px" }}>
              {resetResult.name} · {resetResult.email}
            </p>
            <div style={{ background: "#0a0f1e", border: "2px solid rgba(56,189,248,0.4)", borderRadius: 12, padding: "20px", marginBottom: 16, textAlign: "center" }}>
              <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 10px" }}>Senha temporária</p>
              <p style={{ color: "#38bdf8", fontSize: 28, fontWeight: 900, letterSpacing: 4, margin: 0, fontFamily: "monospace" }}>{resetResult.tempPassword}</p>
            </div>
            <p style={{ color: "#64748b", fontSize: 12, textAlign: "center", margin: "0 0 20px", lineHeight: 1.5 }}>
              Um email foi enviado para <strong style={{ color: "#94a3b8" }}>{resetResult.email}</strong> com esta senha temporária.
            </p>
            <button onClick={() => { navigator.clipboard.writeText(resetResult.tempPassword); }}
              style={{ width: "100%", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 10, padding: "10px 0", color: "#38bdf8", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 10 }}>
              Copiar senha
            </button>
            <button onClick={() => setResetResult(null)}
              style={{ width: "100%", background: "transparent", border: "1px solid #1e2d50", borderRadius: 10, padding: "10px 0", color: "#94a3b8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
