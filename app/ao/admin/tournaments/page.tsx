"use client";
import { formatKz } from "@/lib/format";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Trophy, Plus, Trash2, Edit3, X, Check, Users, Calendar,
  Gift, Lock, Unlock, ChevronDown, ChevronUp, Zap, Star, Crown,
  Clock, Eye, Medal, Wand2, Copy, MessageCircle,
} from "lucide-react";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function prizeLabel(i: number) {
  if (i === 0) return "1º Lugar — Campeão";
  if (i === 1) return "2º Lugar — Vice-Campeão";
  if (i === 2) return "3º Lugar — 3º Classificado";
  return `${i + 1}º Lugar`;
}
function prizeIcon(i: number, size = 14) {
  if (i === 0) return <Trophy size={size} color="#f5a623" />;
  if (i === 1) return <Crown  size={size} color="#94a3b8" />;
  if (i === 2) return <Star   size={size} color="#cd7f32" />;
  return <Medal size={size} color="#64748b" />;
}
function prizeColor(i: number) {
  return i === 0 ? "#f5a623" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : "#64748b";
}

// Prize auto-distribution percentages by number of winners
const PRIZE_DIST: Record<number, number[]> = {
  1:  [100],
  2:  [65, 35],
  3:  [60, 30, 10],
  4:  [50, 27, 15, 8],
  5:  [45, 25, 15, 10, 5],
  6:  [40, 22, 15, 10, 8, 5],
  7:  [35, 20, 15, 10, 8, 7, 5],
  8:  [32, 18, 14, 11, 9, 7, 5, 4],
  9:  [30, 17, 13, 11, 9, 7, 5, 4, 4],
  10: [28, 16, 12, 10, 9, 7, 6, 5, 4, 3],
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  upcoming: { label: "Próximo",    color: "#f5a623", bg: "rgba(245,166,35,0.1)",  dot: "#f5a623" },
  active:   { label: "A decorrer", color: "#22c55e", bg: "rgba(34,197,94,0.1)",   dot: "#22c55e" },
  finished: { label: "Terminado",  color: "#64748b", bg: "rgba(100,116,139,0.1)", dot: "#64748b" },
};

const BANNER_COLORS = [
  { value: "#f5a623", label: "Ouro"     },
  { value: "#22c55e", label: "Verde"    },
  { value: "#3b82f6", label: "Azul"     },
  { value: "#a855f7", label: "Roxo"     },
  { value: "#ef4444", label: "Vermelho" },
  { value: "#06b6d4", label: "Ciano"    },
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
    description: "Só os melhores chegam aqui. O Campeonato Elite é a competição de maior prestígio da Dynamics Works, reservada para traders com determinação, estratégia e disciplina. Os prémios são os maiores da plataforma e a glória é eterna — o teu nome ficará no hall da fama.",
    rules: "• Torneio exclusivo com entrada paga\n• Mínimo de 20 operações para qualificar\n• Classificação por lucro total em Kwanzas\n• Top 10 recebem prémios escalonados\n• Verificação de identidade (KYC) obrigatória",
  },
];

function makeEmptyPrizes(n = 3) {
  return Array.from({ length: n }, (_, i) => ({ position: i + 1, amount: "" }));
}

const EMPTY_FORM = {
  name: "", description: "", rules: "",
  startDate: "", endDate: "",
  prizePool: "", isFree: true, isDemo: false, entryFee: "",
  maxParticipants: "", bannerColor: "#f5a623",
  prizes: makeEmptyPrizes(3),
};

export default function AdminTournamentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tournaments, setTournaments]     = useState<any[]>([]);
  const [showForm, setShowForm]           = useState(false);
  const [editId, setEditId]               = useState<string | null>(null);
  const [form, setForm]                   = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [loading, setLoading]             = useState(false);
  const [msg, setMsg]                     = useState<{ text: string; ok: boolean } | null>(null);
  const [errors, setErrors]               = useState<Record<string, string>>({});
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [tab, setTab]                     = useState<"active" | "upcoming" | "finished">("active");
  const [waCopied, setWaCopied]           = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role !== "admin") router.push("/trade");
  }, [status, session, router]);

  useEffect(() => { if (status === "authenticated") load(); }, [status]);

  async function load() {
    const r = await fetch("/api/tournaments");
    if (r.ok) setTournaments(await r.json());
  }

  function setF(key: string, value: any) {
    setForm(p => ({ ...p, [key]: value }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }

  // Auto-distribute prize pool among winners
  function autoDistribute() {
    const pool = Number(form.prizePool);
    if (!pool || pool <= 0) { setMsg({ text: "Preenche o fundo total de prémios primeiro.", ok: false }); return; }
    const n = form.prizes.length;
    const pcts = PRIZE_DIST[Math.min(n, 10)] ?? PRIZE_DIST[3];
    const newPrizes = form.prizes.map((p, i) => ({
      ...p,
      amount: String(Math.round(pool * (pcts[i] ?? 0) / 100)),
    }));
    setF("prizes", newPrizes);
  }

  function addWinner() {
    if (form.prizes.length >= 10) return;
    setF("prizes", [...form.prizes, { position: form.prizes.length + 1, amount: "" }]);
  }

  function removeWinner(i: number) {
    if (form.prizes.length <= 1) return;
    const updated = form.prizes
      .filter((_, idx) => idx !== i)
      .map((p, idx) => ({ ...p, position: idx + 1 }));
    setF("prizes", updated);
  }

  function openCreate() {
    setForm(EMPTY_FORM); setEditId(null); setMsg(null); setErrors({}); setShowTemplates(false); setShowForm(true);
  }

  function openEdit(t: any) {
    setForm({
      name: t.name, description: t.description ?? "", rules: t.rules ?? "",
      startDate: new Date(t.startDate).toISOString().slice(0, 16),
      endDate:   new Date(t.endDate).toISOString().slice(0, 16),
      prizePool: String(t.prizePool), isFree: t.isFree, isDemo: t.isDemo ?? false,
      entryFee: String(t.entryFee ?? 0),
      maxParticipants: t.maxParticipants ? String(t.maxParticipants) : "",
      bannerColor: t.bannerColor ?? "#f5a623",
      prizes: (t.prizes as any[]).length > 0
        ? t.prizes.map((p: any) => ({ position: p.position, amount: String(p.amount) }))
        : makeEmptyPrizes(3),
    });
    setEditId(t.id); setMsg(null); setErrors({}); setShowForm(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim())    e.name      = "Nome obrigatório";
    if (!form.startDate)      e.startDate = "Data de início obrigatória";
    if (!form.endDate)        e.endDate   = "Data de fim obrigatória";
    if (form.startDate && form.endDate && new Date(form.startDate) >= new Date(form.endDate))
      e.endDate = "A data de fim deve ser posterior à data de início";
    if (!form.isFree && (!form.entryFee || Number(form.entryFee) <= 0))
      e.entryFee = "Valor de entrada obrigatório para torneio pago";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setLoading(true); setMsg(null);
    const body = {
      name: form.name.trim(), description: form.description.trim(), rules: form.rules.trim(),
      startDate: form.startDate, endDate: form.endDate,
      prizePool: Number(form.prizePool) || 0,
      isFree: form.isFree, isDemo: form.isDemo, entryFee: form.isFree ? 0 : Number(form.entryFee) || 0,
      maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : null,
      bannerColor: form.bannerColor,
      prizes: form.prizes.filter(p => p.amount && Number(p.amount) > 0).map(p => ({ position: p.position, amount: Number(p.amount) })),
    };
    const res = editId
      ? await fetch(`/api/tournaments/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/tournaments",            { method: "POST",  headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setShowForm(false); load();
    } else {
      let errorText = "Erro ao guardar. Tenta novamente.";
      try { const d = await res.json(); errorText = d.error ?? errorText; } catch {}
      setMsg({ text: errorText, ok: false });
    }
    setLoading(false);
  }

  async function del(id: string) {
    if (!confirm("Apagar este torneio permanentemente?")) return;
    await fetch(`/api/tournaments/${id}`, { method: "DELETE" });
    load();
  }

  function generateWhatsappPost() {
    const typeLabel  = form.isDemo ? "DEMO" : "REAL";
    const entryLine  = form.isFree
      ? "→ Entrada *gratuita* — sem custos"
      : `→ Entrada: *${Number(form.entryFee).toLocaleString("pt-PT")} Kz* do teu saldo ${form.isDemo ? "demo" : "real"}`;
    const demoLine   = form.isDemo
      ? "→ Operas com saldo demo — *sem arriscar dinheiro real*\n→ Os prémios são pagos em *saldo real*"
      : "→ Operas com a tua conta real\n→ Os prémios são pagos em *saldo real*";
    const validPrizes = form.prizes.filter(p => p.amount && Number(p.amount) > 0);
    const prizesLine = validPrizes.length > 0
      ? validPrizes.map((p, i) => `→ ${p.position}º lugar: *${Number(p.amount).toLocaleString("pt-PT")} Kz*`).join("\n")
      : "→ Prémios a anunciar";
    const vagas = form.maxParticipants
      ? `⏳ Vagas limitadas — apenas *${form.maxParticipants}* lugares disponíveis`
      : "⏳ Inscrições abertas";
    const endDate = form.endDate
      ? `📅 Termina a *${new Date(form.endDate).toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}*`
      : "";
    const name = form.name.trim() || "Novo Torneio";

    return `🚨 *TORNEIO ${typeLabel} — ${name.toUpperCase()}* 🚨\n\nAtenção traders! Novo torneio já disponível na Dynamic Works.\n\n🎯 *Como funciona:*\n${entryLine}\n${demoLine}\n→ Quem tiver mais lucro no ranking ganha\n\n🏅 *Prémios:*\n${prizesLine}\n\n${vagas}\n${endDate}\n\n👇 *Inscreve-te agora na app → Torneios*`;
  }

  async function setStatus(id: string, s: string) {
    await fetch(`/api/tournaments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
    load();
  }

  const byTab = tournaments.filter(t =>
    tab === "active" ? t.status === "active" :
    tab === "upcoming" ? t.status === "upcoming" : t.status === "finished"
  );
  const counts = {
    active:   tournaments.filter(t => t.status === "active").length,
    upcoming: tournaments.filter(t => t.status === "upcoming").length,
    finished: tournaments.filter(t => t.status === "finished").length,
  };

  if (status === "loading") return <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#f5a623", fontFamily: "system-ui" }}>A carregar...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif", color: "#fff" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, background: "linear-gradient(135deg,#f5a623,#e8940f)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(245,166,35,0.3)" }}>
              <Trophy size={22} color="#0a0f1e" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Torneios</h1>
              <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>{tournaments.length} torneio(s) · {counts.active} activo(s)</p>
            </div>
          </div>
          <button onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#f5a623,#e8940f)", color: "#0a0f1e", border: "none", borderRadius: 12, padding: "12px 22px", fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 16px rgba(245,166,35,0.35)" }}>
            <Plus size={17} /> Criar Torneio
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Em curso",   value: counts.active,   color: "#22c55e", Icon: Zap      },
            { label: "Próximos",   value: counts.upcoming, color: "#f5a623", Icon: Clock    },
            { label: "Terminados", value: counts.finished, color: "#64748b", Icon: Trophy   },
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

        {/* List */}
        {byTab.length === 0 ? (
          <div style={{ background: "#111827", border: "1px dashed #1e2d50", borderRadius: 16, padding: "56px 24px", textAlign: "center" }}>
            <Trophy size={44} color="#1e2d50" style={{ marginBottom: 14 }} />
            <p style={{ color: "#64748b", fontSize: 15, margin: "0 0 6px" }}>Nenhum torneio {tab === "active" ? "a decorrer" : tab === "upcoming" ? "próximo" : "terminado"}.</p>
            {tab !== "finished" && <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>Clica em <strong style={{ color: "#f5a623" }}>Criar Torneio</strong> para começar.</p>}
          </div>
        ) : byTab.map(t => {
          const sc = STATUS_CFG[t.status] ?? STATUS_CFG.upcoming;
          const isExpanded = expandedId === t.id;
          const prizes: any[] = Array.isArray(t.prizes) ? t.prizes : [];
          return (
            <div key={t.id} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ height: 4, background: `linear-gradient(90deg,${t.bannerColor ?? "#f5a623"},${t.bannerColor ?? "#f5a623"}44)` }} />
              <div style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: 17 }}>{t.name}</span>
                      <span style={{ background: sc.bg, color: sc.color, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>{sc.label}</span>
                      {t.isDemo && <span style={{ background: "rgba(245,166,35,0.15)", color: "#f5a623", borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>DEMO</span>}
                      {t.isFree
                        ? <span style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}><Unlock size={9} style={{ display:"inline",marginRight:3 }} />GRATUITO</span>
                        : <span style={{ background: "rgba(245,166,35,0.1)", color: "#f5a623", borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}><Lock size={9} style={{ display:"inline",marginRight:3 }} />{formatKz(t.entryFee)} {t.isDemo ? "saldo demo" : "entrada"}</span>
                      }
                    </div>
                    {t.description && <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 8px", lineHeight: 1.6, maxWidth: 580 }}>{t.description.slice(0, 140)}{t.description.length > 140 ? "…" : ""}</p>}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12, color: "#64748b" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Calendar size={12} />{formatDate(t.startDate)} → {formatDate(t.endDate)}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Gift size={12} color="#f5a623" /><span style={{ color: "#f5a623", fontWeight: 700 }}>{formatKz(t.prizePool)}</span></span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Users size={12} />{t._count?.participants ?? 0}{t.maxParticipants ? `/${t.maxParticipants}` : ""} participantes</span>
                      {prizes.length > 0 && <span style={{ color: "#4b5563" }}>· {prizes.length} vencedores</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => window.open(`/tournaments/${t.id}`, "_blank")} style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 7, padding: "6px 9px", cursor: "pointer", display: "flex" }} title="Ver"><Eye size={13} color="#64748b" /></button>
                      <button onClick={() => openEdit(t)} style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 7, padding: "6px 9px", cursor: "pointer" }}><Edit3 size={13} color="#f5a623" /></button>
                      <button onClick={() => del(t.id)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 7, padding: "6px 9px", cursor: "pointer" }}><Trash2 size={13} color="#ef4444" /></button>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {t.status === "upcoming" && <button onClick={() => setStatus(t.id, "active")}   style={{ flex: 1, background: "rgba(34,197,94,0.1)",  color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)",  borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>▶ Iniciar</button>}
                      {t.status === "active"   && <button onClick={() => setStatus(t.id, "finished")} style={{ flex: 1, background: "rgba(100,116,139,0.1)", color: "#94a3b8", border: "1px solid rgba(100,116,139,0.25)", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>■ Terminar</button>}
                      {t.status === "finished" && <button onClick={() => setStatus(t.id, "upcoming")} style={{ flex: 1, background: "rgba(245,166,35,0.1)",  color: "#f5a623", border: "1px solid rgba(245,166,35,0.25)",  borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>↺ Repor</button>}
                    </div>
                  </div>
                </div>
                {prizes.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    {prizes.slice(0, 5).map((p: any, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 7, padding: "3px 9px" }}>
                        {prizeIcon(i, 11)}<span style={{ fontSize: 11, color: prizeColor(i), fontWeight: 700 }}>{i+1}º — {formatKz(p.amount)}</span>
                      </div>
                    ))}
                    {prizes.length > 5 && <span style={{ color: "#4b5563", fontSize: 11, alignSelf: "center" }}>+{prizes.length - 5} mais</span>}
                  </div>
                )}
                <button onClick={() => setExpandedId(isExpanded ? null : t.id)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 12, marginTop: 10, padding: 0 }}>
                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {isExpanded ? "Menos detalhes" : "Ver regras"}
                </button>
                {isExpanded && t.rules && (
                  <div style={{ marginTop: 10, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>REGRAS</div>
                    <pre style={{ color: "#94a3b8", fontSize: 13, margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.7 }}>{t.rules}</pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal ── */}
      {showForm && (
        <>
          <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 201, background: "#111827", border: "1px solid #1e2d50", borderRadius: 20, width: "min(700px, 96vw)", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>

            {/* Sticky header */}
            <div style={{ padding: "20px 26px 16px", borderBottom: "1px solid #1e2d50", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#111827", zIndex: 10, borderRadius: "20px 20px 0 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, background: `linear-gradient(135deg,${form.bannerColor},${form.bannerColor}88)`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Trophy size={18} color="#fff" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{editId ? "Editar Torneio" : "Criar Novo Torneio"}</h2>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{editId ? "Actualiza os detalhes" : "Preenche o formulário para lançar"}</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <div style={{ padding: "22px 26px" }}>

              {/* ── 1. Nome e Datas ── */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>1 · NOME E DATAS</div>

                <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Nome do torneio *</label>
                <input value={form.name} onChange={e => setF("name", e.target.value)} placeholder="Ex: Campeonato Mensal de Maio 2026"
                  style={{ width: "100%", background: "#0d1526", border: `1px solid ${errors.name ? "#ef4444" : "#1e2d50"}`, borderRadius: 9, padding: "11px 13px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: errors.name ? 4 : 14 }} />
                {errors.name && <p style={{ color: "#ef4444", fontSize: 11, margin: "0 0 12px" }}>{errors.name}</p>}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[{ label: "Data de início *", key: "startDate" }, { label: "Data de fim *", key: "endDate" }].map(f => (
                    <div key={f.key}>
                      <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>{f.label}</label>
                      <input type="datetime-local" value={(form as any)[f.key]} onChange={e => setF(f.key, e.target.value)}
                        style={{ width: "100%", background: "#0d1526", border: `1px solid ${errors[f.key] ? "#ef4444" : "#1e2d50"}`, borderRadius: 9, padding: "11px 13px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                      {errors[f.key] && <p style={{ color: "#ef4444", fontSize: 11, margin: "4px 0 0" }}>{errors[f.key]}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 2. Tipo de conta ── */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>2 · TIPO DE CONTA</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[{ val: false, label: "Conta Real", color: "#22c55e" }, { val: true, label: "Conta Demo", color: "#f5a623" }].map(opt => (
                    <button key={String(opt.val)} onClick={() => setF("isDemo", opt.val)}
                      style={{ flex: 1, padding: "13px", border: `2px solid ${form.isDemo === opt.val ? opt.color : "#1e2d50"}`, borderRadius: 12, background: form.isDemo === opt.val ? `${opt.color}12` : "#0d1526", color: form.isDemo === opt.val ? opt.color : "#64748b", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p style={{ color: "#475569", fontSize: 11, margin: "8px 0 0" }}>
                  {form.isDemo ? "Torneio demo — os trades em conta demo contam para o ranking." : "Torneio real — os trades em conta real contam para o ranking."}
                </p>
              </div>

              {/* ── 3. Tipo de acesso ── */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>3 · TIPO DE ACESSO</div>
                <div style={{ display: "flex", gap: 10, marginBottom: form.isFree ? 0 : 12 }}>
                  {[{ val: true, label: "Gratuito", Icon: Unlock, color: "#22c55e" }, { val: false, label: "Pago", Icon: Lock, color: "#f5a623" }].map(opt => (
                    <button key={String(opt.val)} onClick={() => setF("isFree", opt.val)}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", border: `2px solid ${form.isFree === opt.val ? opt.color : "#1e2d50"}`, borderRadius: 12, background: form.isFree === opt.val ? `${opt.color}12` : "#0d1526", color: form.isFree === opt.val ? opt.color : "#64748b", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                      <opt.Icon size={15} /> {opt.label}
                    </button>
                  ))}
                </div>
                {!form.isFree && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Valor de entrada (Kz) *</label>
                    <input type="number" value={form.entryFee} onChange={e => setF("entryFee", e.target.value)} placeholder="Ex: 5000"
                      style={{ width: "100%", background: "#0d1526", border: `1px solid ${errors.entryFee ? "#ef4444" : "#f5a623"}`, borderRadius: 9, padding: "11px 13px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                    {errors.entryFee && <p style={{ color: "#ef4444", fontSize: 11, margin: "4px 0 0" }}>{errors.entryFee}</p>}
                    <p style={{ color: "#64748b", fontSize: 11, margin: "6px 0 0" }}>
                      {form.isDemo ? "Debitado do saldo demo do utilizador ao inscrever-se." : "Debitado do saldo real do utilizador ao inscrever-se."}
                    </p>
                  </div>
                )}
              </div>

              {/* ── 3. Prémios ── */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>3 · FUNDO E PRÉMIOS</div>

                {/* Prize pool + auto-distribute */}
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Fundo total de prémios (Kz)</label>
                    <input type="number" value={form.prizePool} onChange={e => setF("prizePool", e.target.value)} placeholder="Ex: 100000"
                      style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 9, padding: "11px 13px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <button onClick={autoDistribute} title="Distribuir automaticamente pelos vencedores"
                      style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 9, padding: "11px 14px", color: "#f5a623", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                      <Wand2 size={14} /> Auto-distribuir
                    </button>
                  </div>
                </div>

                {/* Prize positions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {form.prizes.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 160 }}>
                        {prizeIcon(i)}
                        <span style={{ color: prizeColor(i), fontWeight: 700, fontSize: 13 }}>{prizeLabel(i)}</span>
                      </div>
                      <input type="number" placeholder="Valor em Kz" value={p.amount}
                        onChange={e => { const arr = [...form.prizes]; arr[i] = { ...arr[i], amount: e.target.value }; setF("prizes", arr); }}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }} />
                      <span style={{ color: "#4b5563", fontSize: 12, marginRight: 4 }}>Kz</span>
                      {form.prizes.length > 1 && (
                        <button onClick={() => removeWinner(i)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "4px 6px", cursor: "pointer", display: "flex" }}>
                          <X size={12} color="#ef4444" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add winner button */}
                {form.prizes.length < 10 && (
                  <button onClick={addWinner} style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "1px dashed #1e2d50", borderRadius: 10, padding: "9px 14px", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", marginTop: 8, width: "100%" }}>
                    <Plus size={14} /> Adicionar posição ({form.prizes.length}/10)
                  </button>
                )}
              </div>

              {/* ── 4. Descrição e Regras ── */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>4 · DESCRIÇÃO E REGRAS</div>

                {/* Templates */}
                <button onClick={() => setShowTemplates(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.15)", borderRadius: 9, padding: "8px 13px", color: "#f5a623", fontWeight: 600, fontSize: 12, cursor: "pointer", marginBottom: 12, width: "100%" }}>
                  <Zap size={13} /> Usar template de texto {showTemplates ? "▲" : "▼"}
                </button>
                {showTemplates && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {DESCRIPTION_TEMPLATES.map(tpl => (
                      <button key={tpl.label} onClick={() => { setF("description", tpl.description); setF("rules", tpl.rules); setShowTemplates(false); }}
                        style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 10, padding: "12px 14px", textAlign: "left", cursor: "pointer", color: "#fff" }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{tpl.label}</div>
                        <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>{tpl.description.slice(0, 90)}…</div>
                      </button>
                    ))}
                  </div>
                )}

                <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Descrição (motivacional)</label>
                <textarea value={form.description} onChange={e => setF("description", e.target.value)} rows={3} placeholder="Descreve o torneio de forma apelativa para os traders..."
                  style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 9, padding: "10px 13px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, marginBottom: 12 }} />

                <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Regras</label>
                <textarea value={form.rules} onChange={e => setF("rules", e.target.value)} rows={4} placeholder={"• Apenas operações reais contam\n• Mínimo de 10 operações para qualificar\n• ..."}
                  style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 9, padding: "10px 13px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", lineHeight: 1.7 }} />
              </div>

              {/* ── 5. Personalização ── */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>5 · PERSONALIZAÇÃO</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 8 }}>Cor do banner</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {BANNER_COLORS.map(c => (
                        <button key={c.value} onClick={() => setF("bannerColor", c.value)} title={c.label}
                          style={{ width: 30, height: 30, borderRadius: "50%", background: c.value, border: `3px solid ${form.bannerColor === c.value ? "#fff" : "transparent"}`, cursor: "pointer", outline: "none", boxShadow: form.bannerColor === c.value ? `0 0 0 2px ${c.value}55` : "none" }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Máx. participantes (opcional)</label>
                    <input type="number" value={form.maxParticipants} onChange={e => setF("maxParticipants", e.target.value)} placeholder="Sem limite"
                      style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 9, padding: "11px 13px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>
              </div>

              {/* ── Post WhatsApp ── */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>6 · POST PARA WHATSAPP</div>
                <div style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 12, padding: "14px 16px" }}>
                  <pre style={{ color: "#cbd5e1", fontSize: 12, margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.8 }}>
                    {generateWhatsappPost()}
                  </pre>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generateWhatsappPost());
                    setWaCopied(true);
                    setTimeout(() => setWaCopied(false), 2500);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, background: waCopied ? "rgba(34,197,94,0.12)" : "rgba(37,211,102,0.08)", border: `1px solid ${waCopied ? "rgba(34,197,94,0.5)" : "rgba(37,211,102,0.25)"}`, borderRadius: 9, padding: "9px 16px", color: waCopied ? "#22c55e" : "#25d366", fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%", justifyContent: "center" }}>
                  {waCopied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /><MessageCircle size={14} /> Copiar post para WhatsApp</>}
                </button>
              </div>

              {msg && <div style={{ background: msg.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${msg.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 10, padding: "11px 14px", marginBottom: 16, color: msg.ok ? "#22c55e" : "#ef4444", fontSize: 13, fontWeight: 600 }}>{msg.text}</div>}

              {Object.keys(errors).length > 0 && (
                <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#ef4444" }}>
                  Corrige os campos assinalados antes de continuar.
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 12, padding: 13, color: "#64748b", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Cancelar</button>
                <button onClick={save} disabled={loading}
                  style={{ flex: 2, background: `linear-gradient(135deg,${form.bannerColor},${form.bannerColor}bb)`, border: "none", borderRadius: 12, padding: 13, color: "#fff", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Check size={16} /> {loading ? "A guardar..." : editId ? "Guardar alterações" : <><Trophy size={15} />Lançar torneio</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
