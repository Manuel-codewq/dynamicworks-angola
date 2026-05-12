"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Search, CheckCircle, XCircle, Download } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";

function formatKz(n: number) { return n.toLocaleString("pt-PT") + " Kz"; }
function formatDate(s: string) {
  return new Date(s).toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" });
}

interface AdminTransaction {
  id: string; type: string; amount: number; method: string | null;
  reference: string | null; status: string; createdAt: string;
  user: { name: string; email: string };
}

const TYPE_LABEL: Record<string, string>  = { deposit: "Depósito",    withdrawal: "Levantamento" };
const TYPE_COLOR: Record<string, string>  = { deposit: "#22c55e",     withdrawal: "#f5a623" };
const TYPE_BG:    Record<string, string>  = { deposit: "rgba(34,197,94,0.12)", withdrawal: "rgba(245,166,35,0.12)" };

const STATUS_LABEL: Record<string, string> = { pending: "Pendente", completed: "Aprovado", rejected: "Rejeitado" };
const STATUS_COLOR: Record<string, string> = { pending: "#f5a623",  completed: "#22c55e",  rejected: "#ef4444" };
const STATUS_BG:    Record<string, string> = {
  pending:   "rgba(245,166,35,0.12)",
  completed: "rgba(34,197,94,0.12)",
  rejected:  "rgba(239,68,68,0.12)",
};

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [busyId,   setBusyId]   = useState<string | null>(null);
  const [status,   setStatus]   = useState("");
  const [type,     setType]     = useState("");
  const [search,   setSearch]   = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (type)   params.set("type",   type);
    if (search) params.set("search", search);
    const res = await fetch("/api/admin/transactions?" + params);
    if (res.ok) setTransactions(await res.json());
    setLoading(false);
  }, [status, type, search]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, newStatus: "completed" | "rejected") {
    setBusyId(id);
    await fetch(`/api/admin/transactions/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: newStatus }),
    });
    setBusyId(null);
    load();
  }

  const pending = transactions.filter(t => t.status === "pending").length;

  const th: React.CSSProperties = {
    color: "#94a3b8", fontSize: 12, padding: "8px 12px",
    textAlign: "left", borderBottom: "1px solid #1e2d50",
    fontWeight: 600, whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: "1px solid rgba(30,45,80,0.4)",
    fontSize: 13,
  };

  return (
    <div style={{ padding: 28 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Transações</h1>
            {pending > 0 && (
              <span style={{ background: "rgba(245,166,35,0.2)", color: "#f5a623", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
                {pending} pendente{pending !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>
            {transactions.length} transação{transactions.length !== 1 ? "ões" : ""} encontrada{transactions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => exportCsv("transacoes.csv",
            ["ID", "Utilizador", "Email", "Tipo", "Valor (Kz)", "Método", "Referência", "Estado", "Data"],
            transactions.map(t => [t.id, t.user.name, t.user.email, TYPE_LABEL[t.type] ?? t.type, t.amount, t.method ?? "", t.reference ?? "", STATUS_LABEL[t.status] ?? t.status, formatDate(t.createdAt)])
          )} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "8px 14px", color: "#22c55e", cursor: "pointer", fontSize: 13 }}>
            <Download size={14} /> CSV
          </button>
          <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={13} color="#64748b" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            placeholder="Pesquisar por nome ou email..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") setSearch(searchInput); }}
            onBlur={() => setSearch(searchInput)}
            style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 7, padding: "7px 12px 7px 30px", color: "#fff", fontSize: 13, outline: "none", width: 240 }}
          />
        </div>

        {/* Status filter */}
        <select value={status} onChange={e => setStatus(e.target.value)}
          style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 7, padding: "7px 12px", color: status ? "#fff" : "#94a3b8", fontSize: 13, cursor: "pointer", outline: "none" }}>
          <option value="">Todos os estados</option>
          <option value="pending">Pendente</option>
          <option value="completed">Aprovado</option>
          <option value="rejected">Rejeitado</option>
        </select>

        {/* Type filter */}
        <select value={type} onChange={e => setType(e.target.value)}
          style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 7, padding: "7px 12px", color: type ? "#fff" : "#94a3b8", fontSize: 13, cursor: "pointer", outline: "none" }}>
          <option value="">Todos os tipos</option>
          <option value="deposit">Depósito</option>
          <option value="withdrawal">Levantamento</option>
        </select>

        {(status || type || search) && (
          <button onClick={() => { setStatus(""); setType(""); setSearch(""); setSearchInput(""); }}
            style={{ background: "transparent", border: "1px solid #1e2d50", borderRadius: 7, padding: "7px 12px", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>
            Limpar
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: "#94a3b8" }}>A carregar...</p>
      ) : (
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr>
                {["Utilizador", "Tipo", "Valor", "Método", "Referência", "Estado", "Data", "Ações"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 40 }}>
                    Nenhuma transação encontrada
                  </td>
                </tr>
              ) : transactions.map(tx => (
                <tr key={tx.id} style={{ opacity: busyId === tx.id ? 0.5 : 1, transition: "opacity 0.2s" }}>

                  {/* Utilizador */}
                  <td style={td}>
                    <div style={{ color: "#fff", fontWeight: 600 }}>{tx.user.name}</div>
                    <div style={{ color: "#64748b", fontSize: 11 }}>{tx.user.email}</div>
                  </td>

                  {/* Tipo */}
                  <td style={td}>
                    <span style={{ background: TYPE_BG[tx.type] ?? "transparent", color: TYPE_COLOR[tx.type] ?? "#94a3b8", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                      {TYPE_LABEL[tx.type] ?? tx.type}
                    </span>
                  </td>

                  {/* Valor */}
                  <td style={{ ...td, color: "#fff", fontWeight: 700 }}>
                    {formatKz(Math.floor(tx.amount))}
                  </td>

                  {/* Método */}
                  <td style={{ ...td, color: "#94a3b8" }}>
                    {tx.method ?? "—"}
                  </td>

                  {/* Referência */}
                  <td style={{ ...td, color: "#64748b", fontFamily: "monospace", fontSize: 12 }}>
                    {tx.reference ?? "—"}
                  </td>

                  {/* Estado */}
                  <td style={td}>
                    <span style={{ background: STATUS_BG[tx.status] ?? "transparent", color: STATUS_COLOR[tx.status] ?? "#94a3b8", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                      {STATUS_LABEL[tx.status] ?? tx.status}
                    </span>
                  </td>

                  {/* Data */}
                  <td style={{ ...td, color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>
                    {formatDate(tx.createdAt)}
                  </td>

                  {/* Ações */}
                  <td style={td}>
                    {tx.status === "pending" ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => act(tx.id, "completed")}
                          disabled={busyId === tx.id}
                          style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                          <CheckCircle size={12} /> Aprovar
                        </button>
                        <button
                          onClick={() => act(tx.id, "rejected")}
                          disabled={busyId === tx.id}
                          style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                          <XCircle size={12} /> Rejeitar
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: "#374151", fontSize: 12 }}>—</span>
                    )}
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
