"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Trophy, Plus, Trash2, Edit3, X, Check, Users, Calendar,
  Gift, Lock, Unlock, ChevronDown, ChevronUp, Zap, Star, Crown,
  Clock, Eye, ToggleLeft, ToggleRight,
} from "lucide-react";

function formatKz(n: number) { return n.toLocaleString("pt-AO") + " Kz"; }
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  upcoming: { label: "Próximo",   color: "#f5a623", bg: "rgba(245,166,35,0.1)",  dot: "#f5a623" },
  active:   { label: "A decorrer",color: "#22c55e", bg: "rgba(34,197,94,0.1)",   dot: "#22c55e" },
  finished: { label: "Terminado", color: "#64748b", bg: "rgba(100,116,139,0.1)", dot: "#64748b" },
};

const BANNER_COLORS = [
  { value: "#f5a623", label: "Ouro" },
  { value: "#22c55e", label: "Verde" },
  { value: "#3b82f6", label: "Azul" },
  { value: "#a855f7", label: "Roxo" },
  { value: "#ef4444", label: "Vermelho" },
  { value: "#06b6d4", label: "Ciano" },
];

const DESCRIPTION_TEMPLATES = [
  {
    label: "Torneio Mensal",
    description: "O maior torneio do mês está de volta! Compete com os melhores traders da plataforma e prova que tens o que é preciso para chegar ao topo. Apenas os mais consistentes e estratégicos conseguirão subir no ranking. Cada operação conta — não deixes nenhuma oportunidade escapar.",
    rules: "• Apenas operações reais contam para a classificação\n• Mínimo de 10 operações para figurar no ranking\n• A classificação é baseada no lucro total em Kwanzas\n• Em caso de empate, vence quem tiver maior taxa de vitória\n• Resultados actualizados em tempo real",
  },
  {
    label: "Torneio Relâmpago",
    description: "48 horas. Apenas. Este torneio relâmpago é para os traders que gostam de adrenalina pura. Num curto espaço de tempo, terás de maximizar os teus ganhos e superar todos os outros participantes. Rápido, intenso e altamente competitivo — estás preparado?",
    rules: "• Duração limitada de 48 horas\n• Sem limite mínimo de operações\n• Foco em lucro acumulado no período\n• Prémios atribuídos imediatamente após o fim",
  },
  {
    label: "Campeonato Elite",
    description: "Só os melhores chegam aqui. O Campeonato Elite é a competição de mais prestígio da Dynamics Works, reservada para traders com determinação, estratégia e disciplina. Os prémios são os maiores da plataforma e a glória é eterna — o teu nome ficará no hall da fama.",
    rules: "• Torneio exclusivo com entrada paga\n• Mínimo de 20 operações para qualificar\n• Classificação por lucro percentual sobre o investimento\n• Top 10 recebem prémios escalonados\n• Verificação de identidade (KYC) obrigatória",
  },
];

const EMPTY_FORM = {
  name: "", description: "", rules: "",
  startDate: "", endDate: "",
  prizePool: "", isFree: true, entryFee: "",
  maxParticipants: "", bannerColor: "#f5a623",
  prizes: [
    { position: 1, amount: "", label: "1º Lugar — Campeão" },
    { position: 2, amount: "", label: "2º Lugar — Vice-Campeão" },
    { position: 3, amount: "", label: "3º Lugar — 3º Classificado" },
  ],
};

export default function AdminTournamentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tournaments, setTournaments]   = useState<any[]>([]);
  const [showForm, setShowForm]         = useState(false);
  const [editId, setEditId]             = useState<string | null>(null);
  const [form, setForm]                 = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [loading, setLoading]           = useState(false);
  const [msg, setMsg]                   = useState<{ text: string; ok: boolean } | null>(null);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [tab, setTab]                   = useState<"upcoming" | "active" | "finished">("active");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role !== "admin") router.push("/trade");
  }, [status, session, router]);

  useEffect(() => { if (status === "authenticated") load(); }, [status]);

  async function load() {
    const r = await fetch("/api/tournaments");
    if (r.ok) setTournaments(await r.json());
  }

  function setF(key: string, value: any) { setForm(p => ({ ...p, [key]: value })); }

  function openCreate() {
    setForm(EMPTY_FORM); setEditId(null); setShowForm(true); setMsg(null); setShowTemplates(false);
  }

  function openEdit(t: any) {
    setForm({
      name: t.name, description: t.description ?? "", rules: t.rules ?? "",
      startDate: new Date(t.startDate).toISOString().slice(0, 16),
      endDate:   new Date(t.endDate).toISOString().slice(0, 16),
      prizePool: String(t.prizePool), isFree: t.isFree,
      entryFee: String(t.entryFee ?? 0),
      maxParticipants: t.maxParticipants ? String(t.maxParticipants) : "",
      bannerColor: t.bannerColor ?? "#f5a623",
      prizes: (t.prizes as any[]).length > 0
        ? t.prizes.map((p: any, i: number) => ({ position: p.position, amount: String(p.amount), label: EMPTY_FORM.prizes[i]?.label ?? `${p.position}º Lugar` }))
        : EMPTY_FORM.prizes,
    });
    setEditId(t.id); setShowForm(true); setMsg(null);
  }

  function applyTemplate(tpl: typeof DESCRIPTION_TEMPLATES[0]) {
    setF("description", tpl.description);
    setF("rules", tpl.rules);
    setShowTemplates(false);
  }

  async function save() {
    if (!form.name || !form.startDate || !form.endDate) {
      setMsg({ text: "Nome, data de início e data de fim são obrigatórios.", ok: false }); return;
    }
    setLoading(true); setMsg(null);
    const body = {
      name: form.name, description: form.description, rules: form.rules,
      startDate: form.startDate, endDate: form.endDate,
      prizePool: Number(form.prizePool) || 0,
      isFree: form.isFree, entryFee: form.isFree ? 0 : Number(form.entryFee) || 0,
      maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : null,
      bannerColor: form.bannerColor,
      prizes: form.prizes.filter(p => p.amount).map(p => ({ position: p.position, amount: Number(p.amount) })),
    };
    const res = editId
      ? await fetch(`/api/tournaments/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/tournaments",            { method: "POST",  headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setMsg({ text: editId ? "Torneio actualizado com sucesso!" : "Torneio criado com sucesso!", ok: true });
      setShowForm(false); load();
    } else {
      const d = await res.json(); setMsg({ text: d.error ?? "Erro ao guardar.", ok: false });
    }
    setLoading(false);
  }

  async function del(id: string) {
    if (!confirm("Apagar este torneio permanentemente?")) return;
    await fetch(`/api/tournaments/${id}`, { method: "DELETE" });
    load();
  }

  async function setStatus(id: string, s: string) {
    await fetch(`/api/tournaments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
    load();
  }

  const byTab = tournaments.filter(t =>
    tab === "active" ? t.status === "active" :
    tab === "upcoming" ? t.status === "upcoming" : t.status === "finished"
  );
  const counts = { active: tournaments.filter(t => t.status === "active").length, upcoming: tournaments.filter(t => t.status === "upcoming").length, finished: tournaments.filter(t => t.status === "finished").length };

  if (status === "loading") return <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#f5a623", fontFamily: "system-ui" }}>A carregar...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif", color: "#fff" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 44, height: 44, background: "linear-gradient(135deg,#f5a623,#e8940f)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(245,166,35,0.3)" }}>
                <Trophy size={22} color="#0a0f1e" />
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>Torneios</h1>
                <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>{tournaments.length} torneio(s) · {counts.active} activo(s)</p>
              </div>
            </div>
          </div>
          <button onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#f5a623,#e8940f)", color: "#0a0f1e", border: "none", borderRadius: 12, padding: "12px 22px", fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 16px rgba(245,166,35,0.35)" }}>
            <Plus size={17} /> Criar Torneio
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Em curso",  value: counts.active,   color: "#22c55e", Icon: Zap    },
            { label: "Próximos",  value: counts.upcoming, color: "#f5a623", Icon: Clock  },
            { label: "Terminados",value: counts.finished, color: "#64748b", Icon: Star   },
          ].map(s => (
            <div key={s.label} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, background: `${s.color}18`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.Icon size={17} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "#111827", border: "1px solid #1e2d50", borderRadius: 10, padding: 4, marginBottom: 20, width: "fit-content" }}>
          {(["active", "upcoming", "finished"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: tab === t ? (t === "active" ? "#22c55e" : t === "upcoming" ? "#f5a623" : "#374151") : "transparent", color: tab === t ? (t === "finished" ? "#fff" : "#0a0f1e") : "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {t === "active" ? "A decorrer" : t === "upcoming" ? "Próximos" : "Terminados"}
              {counts[t] > 0 && <span style={{ marginLeft: 6, background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: "1px 6px", fontSize: 11 }}>{counts[t]}</span>}
            </button>
          ))}
        </div>

        {/* Tournament list */}
        {byTab.length === 0 ? (
          <div style={{ background: "#111827", border: "1px dashed #1e2d50", borderRadius: 16, padding: "56px 24px", textAlign: "center" }}>
            <Trophy size={48} color="#1e2d50" style={{ marginBottom: 16 }} />
            <p style={{ color: "#64748b", fontSize: 15, margin: "0 0 6px" }}>Nenhum torneio {tab === "active" ? "a decorrer" : tab === "upcoming" ? "próximo" : "terminado"}.</p>
            {tab !== "finished" && <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>Clica em <strong style={{ color: "#f5a623" }}>Criar Torneio</strong> para começar.</p>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {byTab.map(t => {
              const sc = STATUS_CFG[t.status] ?? STATUS_CFG.upcoming;
              const isExpanded = expandedId === t.id;
              const prizes: any[] = Array.isArray(t.prizes) ? t.prizes : [];
              return (
                <div key={t.id} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, overflow: "hidden" }}>
                  {/* Colour strip */}
                  <div style={{ height: 4, background: `linear-gradient(90deg,${t.bannerColor ?? "#f5a623"},${t.bannerColor ?? "#f5a623"}44)` }} />
                  <div style={{ padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        {/* Title row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 800, fontSize: 17 }}>{t.name}</span>
                          <span style={{ background: sc.bg, color: sc.color, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.dot, display: "inline-block" }} />{sc.label}
                          </span>
                          {t.isFree
                            ? <span style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}><Unlock size={10} /> GRATUITO</span>
                            : <span style={{ background: "rgba(245,166,35,0.1)", color: "#f5a623", borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}><Lock size={10} /> {formatKz(t.entryFee)} entrada</span>
                          }
                        </div>
                        {t.description && <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 10px", lineHeight: 1.6, maxWidth: 600 }}>{t.description.slice(0, 140)}{t.description.length > 140 ? "…" : ""}</p>}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, color: "#64748b" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Calendar size={12} /> {formatDate(t.startDate)} → {formatDate(t.endDate)}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Gift size={12} color="#f5a623" /> <span style={{ color: "#f5a623", fontWeight: 700 }}>{formatKz(t.prizePool)}</span></span>
                          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Users size={12} /> {t._count?.participants ?? 0}{t.maxParticipants ? `/${t.maxParticipants}` : ""} participantes</span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => window.open(`/tournaments/${t.id}`, "_blank")} style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 7, padding: "6px 9px", cursor: "pointer", display: "flex", alignItems: "center" }} title="Ver página pública"><Eye size={13} color="#64748b" /></button>
                          <button onClick={() => openEdit(t)} style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 7, padding: "6px 9px", cursor: "pointer" }} title="Editar"><Edit3 size={13} color="#f5a623" /></button>
                          <button onClick={() => del(t.id)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 7, padding: "6px 9px", cursor: "pointer" }} title="Apagar"><Trash2 size={13} color="#ef4444" /></button>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {t.status === "upcoming" && <button onClick={() => setStatus(t.id, "active")}   style={{ flex: 1, background: "rgba(34,197,94,0.1)",  color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)",  borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>▶ Iniciar</button>}
                          {t.status === "active"   && <button onClick={() => setStatus(t.id, "finished")} style={{ flex: 1, background: "rgba(100,116,139,0.1)", color: "#94a3b8", border: "1px solid rgba(100,116,139,0.25)", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>■ Terminar</button>}
                          {t.status === "finished" && <button onClick={() => setStatus(t.id, "upcoming")} style={{ flex: 1, background: "rgba(245,166,35,0.1)",  color: "#f5a623", border: "1px solid rgba(245,166,35,0.25)",  borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>↺ Repor</button>}
                        </div>
                      </div>
                    </div>

                    {/* Prizes preview */}
                    {prizes.length > 0 && (
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        {prizes.slice(0, 3).map((p: any, i: number) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 7, padding: "4px 10px" }}>
                            {i === 0 ? <Trophy size={11} color="#f5a623" /> : i === 1 ? <Crown size={11} color="#94a3b8" /> : <Star size={11} color="#cd7f32" />}
                            <span style={{ fontSize: 11, color: i === 0 ? "#f5a623" : i === 1 ? "#94a3b8" : "#cd7f32", fontWeight: 700 }}>{i+1}º — {formatKz(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Expand toggle */}
                    <button onClick={() => setExpandedId(isExpanded ? null : t.id)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 12, marginTop: 10, padding: 0 }}>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      {isExpanded ? "Menos detalhes" : "Ver regras e descrição completa"}
                    </button>
                    {isExpanded && t.rules && (
                      <div style={{ marginTop: 10, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>REGRAS</div>
                        <pre style={{ color: "#94a3b8", fontSize: 13, margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.7 }}>{t.rules}</pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create/Edit Modal ── */}
      {showForm && (
        <>
          <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 201, background: "#111827", border: "1px solid #1e2d50", borderRadius: 20, width: "min(680px, 96vw)", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>

            {/* Modal header */}
            <div style={{ padding: "22px 26px 18px", borderBottom: "1px solid #1e2d50", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#111827", zIndex: 10, borderRadius: "20px 20px 0 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, background: `linear-gradient(135deg,${form.bannerColor},${form.bannerColor}99)`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Trophy size={18} color="#fff" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{editId ? "Editar Torneio" : "Criar Novo Torneio"}</h2>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{editId ? "Actualiza os detalhes do torneio" : "Preenche todos os campos para lançar o torneio"}</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: "6px", cursor: "pointer", display: "flex" }}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <div style={{ padding: "22px 26px" }}>

              {/* Templates */}
              {!editId && (
                <div style={{ marginBottom: 20 }}>
                  <button onClick={() => setShowTemplates(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 10, padding: "9px 14px", color: "#f5a623", fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%" }}>
                    <Zap size={14} /> Usar template de descrição {showTemplates ? "▲" : "▼"}
                  </button>
                  {showTemplates && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                      {DESCRIPTION_TEMPLATES.map(tpl => (
                        <button key={tpl.label} onClick={() => applyTemplate(tpl)} style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 10, padding: "12px 14px", textAlign: "left", cursor: "pointer", color: "#fff" }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: "#f5a623" }}>{tpl.label}</div>
                          <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>{tpl.description.slice(0, 100)}…</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Section: Informações Básicas */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>INFORMAÇÕES BÁSICAS</div>

                <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Nome do torneio *</label>
                <input value={form.name} onChange={e => setF("name", e.target.value)} placeholder="Ex: Campeonato Mensal de Maio 2026"
                  style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 9, padding: "10px 13px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 14 }} />

                <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Descrição (motivacional, para os traders verem)</label>
                <textarea value={form.description} onChange={e => setF("description", e.target.value)} rows={4} placeholder="Descreve o torneio de forma apelativa e motivacional..."
                  style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 9, padding: "10px 13px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, marginBottom: 14 }} />

                <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Regras (lista clara para os participantes)</label>
                <textarea value={form.rules} onChange={e => setF("rules", e.target.value)} rows={5} placeholder="• Apenas operações reais contam&#10;• Mínimo de 10 operações para figurar no ranking&#10;• ..."
                  style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 9, padding: "10px 13px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", lineHeight: 1.7 }} />
              </div>

              {/* Section: Datas */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>DATAS E DURAÇÃO</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[{ label: "Início *", key: "startDate" }, { label: "Fim *", key: "endDate" }].map(f => (
                    <div key={f.key}>
                      <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>{f.label}</label>
                      <input type="datetime-local" value={(form as any)[f.key]} onChange={e => setF(f.key, e.target.value)}
                        style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 9, padding: "10px 13px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Section: Tipo e Acesso */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>TIPO DE ACESSO</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  {[{ val: true, label: "Gratuito", Icon: Unlock, color: "#22c55e" }, { val: false, label: "Pago", Icon: Lock, color: "#f5a623" }].map(opt => (
                    <button key={String(opt.val)} onClick={() => setF("isFree", opt.val)}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", border: `2px solid ${form.isFree === opt.val ? opt.color : "#1e2d50"}`, borderRadius: 12, background: form.isFree === opt.val ? `${opt.color}15` : "#0d1526", color: form.isFree === opt.val ? opt.color : "#64748b", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                      <opt.Icon size={16} /> {opt.label}
                    </button>
                  ))}
                </div>
                {!form.isFree && (
                  <div>
                    <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Valor de entrada (Kz) *</label>
                    <input type="number" value={form.entryFee} onChange={e => setF("entryFee", e.target.value)} placeholder="Ex: 5000"
                      style={{ width: "100%", background: "#0d1526", border: "1px solid #f5a623", borderRadius: 9, padding: "10px 13px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                    <p style={{ color: "#64748b", fontSize: 11, margin: "6px 0 0" }}>O valor será debitado do saldo real do utilizador ao inscrever-se.</p>
                  </div>
                )}
              </div>

              {/* Section: Prémios */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>PRÉMIOS E FUNDO</div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Fundo total de prémios (Kz)</label>
                  <input type="number" value={form.prizePool} onChange={e => setF("prizePool", e.target.value)} placeholder="Ex: 100000"
                    style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 9, padding: "10px 13px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {form.prizes.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 130 }}>
                        {i === 0 ? <Trophy size={14} color="#f5a623" /> : i === 1 ? <Crown size={14} color="#94a3b8" /> : <Star size={14} color="#cd7f32" />}
                        <span style={{ color: i === 0 ? "#f5a623" : i === 1 ? "#94a3b8" : "#cd7f32", fontWeight: 700, fontSize: 13 }}>{p.label}</span>
                      </div>
                      <input type="number" placeholder="Valor em Kz" value={p.amount}
                        onChange={e => { const arr = [...form.prizes]; arr[i] = { ...arr[i], amount: e.target.value }; setF("prizes", arr); }}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }} />
                      <span style={{ color: "#4b5563", fontSize: 12 }}>Kz</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section: Personalização */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>PERSONALIZAÇÃO</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 8 }}>Cor do banner</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {BANNER_COLORS.map(c => (
                        <button key={c.value} onClick={() => setF("bannerColor", c.value)} title={c.label}
                          style={{ width: 28, height: 28, borderRadius: "50%", background: c.value, border: `3px solid ${form.bannerColor === c.value ? "#fff" : "transparent"}`, cursor: "pointer", outline: "none", boxShadow: form.bannerColor === c.value ? `0 0 0 2px ${c.value}` : "none" }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Máx. participantes (opcional)</label>
                    <input type="number" value={form.maxParticipants} onChange={e => setF("maxParticipants", e.target.value)} placeholder="Sem limite"
                      style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 9, padding: "10px 13px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>
              </div>

              {msg && <div style={{ background: msg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.ok ? "#22c55e" : "#ef4444"}`, borderRadius: 10, padding: "11px 14px", marginBottom: 16, color: msg.ok ? "#22c55e" : "#ef4444", fontSize: 13, fontWeight: 600 }}>{msg.text}</div>}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 12, padding: "13px", color: "#94a3b8", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Cancelar</button>
                <button onClick={save} disabled={loading || !form.name || !form.startDate || !form.endDate}
                  style={{ flex: 2, background: `linear-gradient(135deg,${form.bannerColor},${form.bannerColor}cc)`, border: "none", borderRadius: 12, padding: "13px", color: "#fff", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Check size={16} /> {loading ? "A guardar..." : editId ? "Guardar alterações" : "🏆 Lançar torneio"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
