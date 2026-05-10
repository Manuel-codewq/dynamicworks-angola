"use client";
import { useEffect, useState, useMemo } from "react";
import {
  RefreshCw, CheckCircle, XCircle, Shield, ScanFace,
  Search, Users, UserCheck, UserX, Clock,
} from "lucide-react";

function formatKz(n: number) { return n.toLocaleString("pt-AO") + " Kz"; }
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
  const [editBal,   setEditBal]   = useState<{ id: string; value: string } | null>(null);
  const [selected,  setSelected]  = useState<AdminUser | null>(null);

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

  async function saveBalance() {
    if (!editBal) return;
    await action(editBal.id, `/api/admin/users/${editBal.id}/balance`, { balance: editBal.value });
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
        <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
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
                  {["Utilizador", "Contacto", "Saldo Real", "Trades", "KYC", "Estado", "Registo", "Ações"].map(h => (
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

                      {/* Saldo */}
                      <td style={td}>
                        {isEditing ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="number"
                              value={editBal.value}
                              onChange={e => setEditBal({ id: u.id, value: e.target.value })}
                              onKeyDown={e => { if (e.key === "Enter") saveBalance(); if (e.key === "Escape") setEditBal(null); }}
                              autoFocus
                              style={{ width: 110, background: "#0a0f1e", border: "1px solid #f5a623", borderRadius: 6, padding: "5px 8px", color: "#fff", fontSize: 12, outline: "none" }}
                            />
                            <button onClick={saveBalance} disabled={busy} style={{ background: "#f5a623", color: "#000", border: "none", borderRadius: 5, padding: "5px 8px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>✓</button>
                            <button onClick={() => setEditBal(null)} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setEditBal({ id: u.id, value: String(Math.floor(u.balance)) })}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600, padding: 0, textAlign: "left" }}
                            title="Clique para editar">
                            {formatKz(Math.floor(u.balance))}
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
    </div>
  );
}
