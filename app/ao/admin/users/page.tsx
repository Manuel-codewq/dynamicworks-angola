"use client";
import { formatKz } from "@/lib/format";
import { useEffect, useState, useMemo } from "react";
import {
  RefreshCw, CheckCircle, XCircle, Shield, ScanFace,
  Search, Users, UserCheck, UserX, Clock, Download,
  Trash2, KeyRound, History, X, TrendingUp, TrendingDown,
  Wallet, Trophy, Gift, Wrench, AlertCircle, Monitor,
} from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

interface AdminUser {
  id: string; name: string; email: string; phone: string | null;
  province: string | null; balance: number; demoBalance: number; role: string;
  status: string; kycStatus: string; kycAttempts: number; createdAt: string;
  kycSubmission: { id: string } | null;
  _count: { trades: number; transactions: number };
  suspicious: boolean;
}

const KYC_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  "no-submit": { label: "Sem docs",   color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  pending:     { label: "A rever",    color: "#f5a623", bg: "rgba(245,166,35,0.12)"  },
  approved:    { label: "Verificado", color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  rejected:    { label: "Rejeitado",  color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
};

type StatusFilter = "all" | "active" | "blocked" | "suspicious";

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
  const [balHistory,    setBalHistory]    = useState<{ user: any; events: any[]; summary: any } | null>(null);
  const [balHistLoading, setBalHistLoading] = useState(false);
  const [balModal,      setBalModal]      = useState<{ user: AdminUser; type: "real" | "demo"; newValue: string } | null>(null);
  const [balReason,     setBalReason]     = useState("");
  const [balSaving,     setBalSaving]     = useState(false);

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

  async function confirmBalEdit() {
    if (!balModal || !balReason.trim() || balReason.trim().length < 5) return;
    setBalSaving(true);
    const res = await fetch(`/api/admin/users/${balModal.user.id}/balance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance: balModal.newValue, type: balModal.type, reason: balReason.trim() }),
    });
    const d = await res.json().catch(() => ({}));
    setBalSaving(false);
    if (!res.ok) { alert(d.error || "Erro ao editar saldo."); return; }
    setBalModal(null); setBalReason(""); setEditBal(null);
    load();
  }

  async function openBalHistory(u: AdminUser) {
    setBalHistLoading(true);
    setBalHistory(null);
    const res = await fetch(`/api/admin/users/${u.id}/balance-history`);
    if (res.ok) setBalHistory(await res.json());
    setBalHistLoading(false);
  }

  async function saveBalance(type: "real" | "demo" = "real") {
    if (!editBal) return;
    await action(editBal.id, `/api/admin/users/${editBal.id}/balance`, { balance: editBal.value, type });
  }

  const filtered = useMemo(() => {
    let list = users;
    if (statusFilter === "suspicious") list = list.filter(u => u.suspicious);
    else if (statusFilter !== "all") list = list.filter(u => u.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return list;
  }, [users, search, statusFilter]);

  const counts = useMemo(() => ({
    total:        users.length,
    active:       users.filter(u => u.status === "active").length,
    blocked:      users.filter(u => u.status === "blocked").length,
    kycSubmitted: users.filter(u => u.kycSubmission !== null && u.kycStatus === "pending").length,
    suspicious:   users.filter(u => u.suspicious).length,
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total",       value: counts.total,        Icon: Users,       color: "#94a3b8", filter: "all"        as StatusFilter },
          { label: "Ativos",      value: counts.active,       Icon: UserCheck,   color: "#22c55e", filter: "active"     as StatusFilter },
          { label: "Bloqueados",  value: counts.blocked,      Icon: UserX,       color: "#ef4444", filter: "blocked"    as StatusFilter },
          { label: "KYC a rever", value: counts.kycSubmitted, Icon: Clock,       color: "#f5a623", filter: null },
          { label: "Suspeitos",    value: counts.suspicious,   Icon: AlertCircle, color: "#ef4444", filter: "suspicious" as StatusFilter },
        ].map(s => (
          <button key={s.label} onClick={() => s.filter && setStatusFilter(s.filter)}
            style={{ background: s.label.includes("Suspeitos") ? "rgba(239,68,68,0.06)" : "#111827", border: statusFilter === s.filter ? `1px solid ${s.color}` : `1px solid ${s.label.includes("Suspeitos") && counts.suspicious > 0 ? "rgba(239,68,68,0.4)" : "#1e2d50"}`, borderRadius: 14, padding: "16px 18px", textAlign: "left", cursor: s.filter ? "pointer" : "default", transition: "border-color .2s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>{s.label}</span>
              <s.Icon size={16} color={s.color} />
            </div>
            <div style={{ color: s.label.includes("Suspeitos") && counts.suspicious > 0 ? "#ef4444" : "#fff", fontSize: 26, fontWeight: 800 }}>{s.value}</div>
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
        {(["all", "active", "blocked", "suspicious"] as StatusFilter[]).map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid", borderColor: statusFilter === f ? (f === "suspicious" ? "#ef4444" : "#f5a623") : (f === "suspicious" && counts.suspicious > 0 ? "rgba(239,68,68,0.4)" : "#1e2d50"), background: statusFilter === f ? (f === "suspicious" ? "rgba(239,68,68,0.12)" : "rgba(245,166,35,0.12)") : "transparent", color: statusFilter === f ? (f === "suspicious" ? "#ef4444" : "#f5a623") : (f === "suspicious" && counts.suspicious > 0 ? "#ef4444" : "#64748b"), fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {f === "all" ? "Todos" : f === "active" ? "Ativos" : f === "blocked" ? "Bloqueados" : <span style={{ display:"flex", alignItems:"center", gap:5 }}><AlertCircle size={12} />Suspeitos{counts.suspicious > 0 ? ` (${counts.suspicious})` : ""}</span>}
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
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button onClick={() => { setBalModal({ user: u, type: "real", newValue: String(Math.floor(u.balance)) }); setBalReason(""); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: u.suspicious ? "#ef4444" : "#22c55e", fontSize: 13, fontWeight: 700, padding: 0, textAlign: "left" }}
                            title="Clique para editar saldo real">
                            {formatKz(Math.floor(u.balance))}
                          </button>
                          {u.suspicious && <span title="Saldo sem depósito aprovado"><AlertCircle size={14} color="#ef4444" /></span>}
                        </div>
                      </td>

                      {/* Saldo Demo */}
                      <td style={td}>
                        <button onClick={() => { setBalModal({ user: u, type: "demo", newValue: String(Math.floor(u.demoBalance ?? 0)) }); setBalReason(""); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#f5a623", fontSize: 13, fontWeight: 600, padding: 0, textAlign: "left" }}
                          title="Clique para editar saldo demo">
                          {formatKz(Math.floor(u.demoBalance ?? 0))}
                        </button>
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
                          <button onClick={() => openBalHistory(u)}
                            style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(245,166,35,0.1)", color: "#f5a623", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 6, padding: "5px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                            <History size={11} /> Historial Saldo
                          </button>
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

      {/* ── Modal: Editar Saldo (com motivo obrigatório) ── */}
      {balModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setBalModal(null); }}>
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, width: "100%", maxWidth: 420, padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>
                  <span style={{ display:"flex", alignItems:"center", gap:8 }}>{balModal.type === "real" ? <><Wallet size={16} color="#22c55e" /> Editar Saldo Real</> : <><Monitor size={16} color="#f5a623" /> Editar Saldo Demo</>}</span>
                </div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{balModal.user.name}</div>
              </div>
              <button onClick={() => setBalModal(null)} style={{ background: "#1e2d50", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={15} color="#94a3b8" />
              </button>
            </div>

            {balModal.user.suspicious && balModal.type === "real" && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 8 }}>
                <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ color: "#ef4444", fontSize: 13 }}>Este utilizador tem saldo real sem depósito aprovado. Verifica antes de editar.</span>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                NOVO VALOR (Kz) — Saldo actual: {formatKz(Math.floor(balModal.type === "real" ? balModal.user.balance : balModal.user.demoBalance))}
              </label>
              <input type="number" value={balModal.newValue}
                onChange={e => setBalModal(p => p ? { ...p, newValue: e.target.value } : null)}
                style={{ width: "100%", background: "#0a0f1e", border: `1px solid ${balModal.type === "real" ? "#22c55e" : "#f5a623"}`, borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 15, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                MOTIVO * <span style={{ color: "#475569", fontWeight: 400 }}>(obrigatório — ficará registado na auditoria)</span>
              </label>
              <input type="text" value={balReason} onChange={e => setBalReason(e.target.value)}
                placeholder="Ex: Bónus de boas-vindas, correção de erro, prémio..."
                style={{ width: "100%", background: "#0a0f1e", border: `1px solid ${balReason.trim().length > 0 && balReason.trim().length < 5 ? "#ef4444" : "#1e2d50"}`, borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              {balReason.trim().length > 0 && balReason.trim().length < 5 && (
                <p style={{ color: "#ef4444", fontSize: 11, margin: "4px 0 0" }}>Mínimo 5 caracteres</p>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setBalModal(null)}
                style={{ flex: 1, padding: "11px 0", background: "transparent", border: "1px solid #1e2d50", borderRadius: 10, color: "#64748b", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={confirmBalEdit} disabled={balSaving || balReason.trim().length < 5 || !balModal.newValue}
                style={{ flex: 1, padding: "11px 0", background: balSaving || balReason.trim().length < 5 ? "#1e2d50" : balModal.type === "real" ? "#22c55e" : "#f5a623", border: "none", borderRadius: 10, color: balSaving || balReason.trim().length < 5 ? "#475569" : "#000", fontWeight: 800, fontSize: 14, cursor: balSaving || balReason.trim().length < 5 ? "not-allowed" : "pointer" }}>
                {balSaving ? "A guardar..." : "Confirmar edição"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Historial de Saldo ── */}
      {(balHistory || balHistLoading) && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) { setBalHistory(null); setBalHistLoading(false); } }}>
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #1e2d50" }}>
              <div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>
                  <History size={16} color="#f5a623" style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
                  Historial de Saldo
                </div>
                {balHistory && <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{balHistory.user.name} · {balHistory.user.email}</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {balHistory && (
                  <button onClick={() => exportCsv(
                    `historial_${balHistory.user.name.replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.csv`,
                    ["Data", "Tipo", "Detalhe", "Valor (Kz)", "Sinal", "Estado"],
                    balHistory.events.map((ev: any) => [
                      new Date(ev.date).toLocaleString("pt-PT"),
                      ev.label,
                      ev.detail ?? "",
                      ev.amount !== null ? Math.floor(ev.amount) : "",
                      ev.sign,
                      ev.status,
                    ])
                  )} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "6px 12px", color: "#22c55e", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    <Download size={13} /> Exportar CSV
                  </button>
                )}
                <button onClick={() => { setBalHistory(null); setBalHistLoading(false); }}
                  style={{ background: "#1e2d50", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={15} color="#94a3b8" />
                </button>
              </div>
            </div>

            {balHistLoading && (
              <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>A carregar historial...</div>
            )}

            {balHistory && (
              <>
                {/* Resumo */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "#1e2d50", borderBottom: "1px solid #1e2d50" }}>
                  {[
                    { label: "Saldo actual", value: `${Math.floor(balHistory.summary.currentBalance).toLocaleString("pt-PT")} Kz`, color: "#f5a623" },
                    { label: "Total depositado", value: `+${balHistory.summary.totalDeposited.toLocaleString("pt-PT")} Kz`, color: "#22c55e" },
                    { label: "Total levantado", value: `-${balHistory.summary.totalWithdrawn.toLocaleString("pt-PT")} Kz`, color: "#ef4444" },
                    { label: "P&L trades reais", value: `${balHistory.summary.tradeNet >= 0 ? "+" : ""}${balHistory.summary.tradeNet.toLocaleString("pt-PT")} Kz`, color: balHistory.summary.tradeNet >= 0 ? "#22c55e" : "#ef4444" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "#0d1526", padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
                      <div style={{ color: s.color, fontWeight: 800, fontSize: 14 }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Timeline */}
                <div style={{ overflowY: "auto", flex: 1, padding: "16px 22px" }}>
                  {balHistory.events.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "#475569" }}>
                      <AlertCircle size={32} color="#1e2d50" style={{ marginBottom: 10 }} />
                      <div>Sem movimentos registados para este utilizador.</div>
                    </div>
                  ) : balHistory.events.map((ev: any) => {
                    const icons: Record<string, React.ReactNode> = {
                      deposit:             <Wallet size={16} color="#22c55e" />,
                      withdrawal:          <Wallet size={16} color="#ef4444" />,
                      adjustment:          <Wrench size={16} color="#f5a623" />,
                      tournament_prize:    <Trophy size={16} color="#f5a623" />,
                      tournament_entry:    <Trophy size={16} color="#ef4444" />,
                      referral_commission: <Gift   size={16} color="#22c55e" />,
                      trade:               ev.sign === "+" ? <TrendingUp size={16} color="#22c55e" /> : <TrendingDown size={16} color="#ef4444" />,
                      audit:               <Wrench size={16} color="#f5a623" />,
                    };
                    const icon = icons[ev.category] ?? <AlertCircle size={16} color="#94a3b8" />;
                    const statusBadge: Record<string, { label: string; color: string }> = {
                      completed: { label: "Aprovado",  color: "#22c55e" },
                      pending:   { label: "Pendente",  color: "#f5a623" },
                      rejected:  { label: "Rejeitado", color: "#ef4444" },
                      win:       { label: "Ganhou",    color: "#22c55e" },
                      loss:      { label: "Perdeu",    color: "#ef4444" },
                      info:      { label: "Admin",     color: "#f5a623" },
                    };
                    const badge = statusBadge[ev.status];
                    return (
                      <div key={ev.id} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px solid rgba(30,45,80,0.4)" }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${ev.color}15`, border: `1px solid ${ev.color}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                            <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{ev.label}</span>
                            {badge && <span style={{ color: badge.color, fontSize: 10, fontWeight: 700, background: `${badge.color}15`, borderRadius: 4, padding: "1px 6px" }}>{badge.label}</span>}
                          </div>
                          {ev.detail && <div style={{ color: "#64748b", fontSize: 12, marginBottom: 3 }}>{ev.detail}</div>}
                          <div style={{ color: "#475569", fontSize: 11 }}>{new Date(ev.date).toLocaleString("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {ev.amount !== null ? (
                            <div style={{ color: ev.color, fontWeight: 800, fontSize: 15 }}>
                              {ev.sign}{Math.floor(ev.amount).toLocaleString("pt-PT")} Kz
                            </div>
                          ) : (
                            <div style={{ color: "#475569", fontSize: 12 }}>ver detalhe</div>
                          )}
                          {!ev.affectsBalance && <div style={{ color: "#374151", fontSize: 10, marginTop: 2 }}>não afectou saldo</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
