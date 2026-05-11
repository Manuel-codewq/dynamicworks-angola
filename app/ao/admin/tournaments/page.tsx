"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Trophy, Plus, Trash2, Edit3, X, Check, Users, Calendar, DollarSign } from "lucide-react";

function formatKz(n: number) { return n.toLocaleString("pt-AO") + " Kz"; }
function formatDate(d: string) { return new Date(d).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: "Próximo",  color: "#f5a623", bg: "rgba(245,166,35,0.12)" },
  active:   { label: "Activo",   color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
  finished: { label: "Terminado",color: "#64748b", bg: "rgba(100,116,139,0.12)"},
};

const EMPTY_FORM = { name: "", description: "", startDate: "", endDate: "", prizePool: "", prizes: [{ position: 1, amount: "" }, { position: 2, amount: "" }, { position: 3, amount: "" }] };

export default function AdminTournamentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [showForm, setShowForm]       = useState(false);
  const [editId, setEditId]           = useState<string | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [loading, setLoading]         = useState(false);
  const [msg, setMsg]                 = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role !== "admin") router.push("/trade");
  }, [status, session, router]);

  useEffect(() => { if (status === "authenticated") loadTournaments(); }, [status]);

  async function loadTournaments() {
    const r = await fetch("/api/tournaments");
    if (r.ok) setTournaments(await r.json());
  }

  function openCreate() { setForm(EMPTY_FORM); setEditId(null); setShowForm(true); setMsg(null); }
  function openEdit(t: any) {
    setForm({
      name: t.name, description: t.description ?? "",
      startDate: new Date(t.startDate).toISOString().slice(0, 16),
      endDate:   new Date(t.endDate).toISOString().slice(0, 16),
      prizePool: String(t.prizePool),
      prizes: (t.prizes as any[]).length > 0 ? t.prizes.map((p: any) => ({ ...p, amount: String(p.amount) })) : EMPTY_FORM.prizes,
    });
    setEditId(t.id); setShowForm(true); setMsg(null);
  }

  async function save() {
    setLoading(true); setMsg(null);
    const body = {
      name: form.name, description: form.description,
      startDate: form.startDate, endDate: form.endDate,
      prizePool: Number(form.prizePool),
      prizes: form.prizes.filter(p => p.amount).map(p => ({ position: p.position, amount: Number(p.amount) })),
    };
    const res = editId
      ? await fetch(`/api/tournaments/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/tournaments",            { method: "POST",  headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setMsg({ text: editId ? "Torneio actualizado." : "Torneio criado.", ok: true }); setShowForm(false); loadTournaments(); }
    else        { const d = await res.json(); setMsg({ text: d.error ?? "Erro.", ok: false }); }
    setLoading(false);
  }

  async function deleteTournament(id: string) {
    if (!confirm("Apagar torneio? Esta acção não pode ser revertida.")) return;
    await fetch(`/api/tournaments/${id}`, { method: "DELETE" });
    loadTournaments();
  }

  async function setStatus(id: string, s: string) {
    await fetch(`/api/tournaments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
    loadTournaments();
  }

  if (status === "loading") return <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#f5a623", fontFamily: "system-ui" }}>A carregar...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif", color: "#fff" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Trophy size={26} color="#f5a623" />
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Torneios</h1>
              <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>{tournaments.length} torneio(s) no total</p>
            </div>
          </div>
          <button onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f5a623", color: "#0a0f1e", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            <Plus size={16} /> Criar Torneio
          </button>
        </div>

        {msg && <div style={{ background: msg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.ok ? "#22c55e" : "#ef4444"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: msg.ok ? "#22c55e" : "#ef4444", fontSize: 13 }}>{msg.text}</div>}

        {/* Tournament list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tournaments.length === 0 && (
            <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 40, textAlign: "center", color: "#64748b" }}>
              <Trophy size={40} color="#1e2d50" style={{ marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 15 }}>Nenhum torneio ainda. Cria o primeiro!</p>
            </div>
          )}
          {tournaments.map(t => {
            const s = STATUS_LABELS[t.status] ?? STATUS_LABELS.upcoming;
            return (
              <div key={t.id} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: 16 }}>{t.name}</span>
                      <span style={{ background: s.bg, color: s.color, borderRadius: 6, fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>{s.label}</span>
                    </div>
                    {t.description && <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 10px" }}>{t.description}</p>}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, color: "#64748b" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Calendar size={12} /> {formatDate(t.startDate)} → {formatDate(t.endDate)}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><DollarSign size={12} /> {formatKz(t.prizePool)}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Users size={12} /> {t._count?.participants ?? 0} participantes</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {/* Status actions */}
                    {t.status === "upcoming" && <button onClick={() => setStatus(t.id, "active")}   style={{ background: "rgba(34,197,94,0.1)",  color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)",  borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Iniciar</button>}
                    {t.status === "active"   && <button onClick={() => setStatus(t.id, "finished")} style={{ background: "rgba(100,116,139,0.1)", color: "#64748b", border: "1px solid rgba(100,116,139,0.3)", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Terminar</button>}
                    <button onClick={() => openEdit(t)}        style={{ background: "rgba(245,166,35,0.1)", color: "#f5a623", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 7, padding: "5px 8px", cursor: "pointer" }}><Edit3 size={13} /></button>
                    <button onClick={() => deleteTournament(t.id)} style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 7, padding: "5px 8px", cursor: "pointer" }}><Trash2 size={13} /></button>
                  </div>
                </div>
                {/* Prizes preview */}
                {Array.isArray(t.prizes) && t.prizes.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {t.prizes.slice(0, 3).map((p: any, i: number) => (
                      <div key={i} style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 7, padding: "4px 10px", fontSize: 11, color: i === 0 ? "#f5a623" : i === 1 ? "#94a3b8" : "#b45309" }}>
                        {i + 1}º — {formatKz(p.amount)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Create/Edit modal */}
      {showForm && (
        <>
          <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 201, background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, padding: 28, width: "min(560px, 95vw)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{editId ? "Editar Torneio" : "Criar Torneio"}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><X size={20} /></button>
            </div>

            {[
              { label: "Nome *", key: "name", type: "text", placeholder: "Ex: Campeonato de Maio" },
              { label: "Descrição", key: "description", type: "text", placeholder: "Descrição opcional" },
              { label: "Data de início *", key: "startDate", type: "datetime-local", placeholder: "" },
              { label: "Data de fim *", key: "endDate", type: "datetime-local", placeholder: "" },
              { label: "Fundo de prémios (Kz)", key: "prizePool", type: "number", placeholder: "Ex: 50000" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}

            {/* Prizes */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 8 }}>Prémios (Kz)</label>
              {form.prizes.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ color: i === 0 ? "#f5a623" : i === 1 ? "#94a3b8" : "#b45309", fontWeight: 700, fontSize: 13, minWidth: 28 }}>{i + 1}º</span>
                  <input type="number" placeholder="Valor em Kz" value={p.amount}
                    onChange={e => { const arr = [...form.prizes]; arr[i] = { ...arr[i], amount: e.target.value }; setForm(prev => ({ ...prev, prizes: arr })); }}
                    style={{ flex: 1, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 14, outline: "none" }} />
                </div>
              ))}
            </div>

            {msg && <div style={{ background: msg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.ok ? "#22c55e" : "#ef4444"}`, borderRadius: 8, padding: "9px 12px", marginBottom: 14, color: msg.ok ? "#22c55e" : "#ef4444", fontSize: 13 }}>{msg.text}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 10, padding: 12, color: "#94a3b8", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={save} disabled={loading || !form.name || !form.startDate || !form.endDate}
                style={{ flex: 2, background: "#f5a623", border: "none", borderRadius: 10, padding: 12, color: "#0a0f1e", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Check size={16} /> {loading ? "A guardar..." : editId ? "Guardar alterações" : "Criar torneio"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
