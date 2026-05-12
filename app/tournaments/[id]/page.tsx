"use client";
import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Trophy, Medal, ChevronLeft, Calendar, Users, Gift,
  Clock, Check, Lock, Unlock, Star, Crown, AlertCircle, Zap,
  ClipboardList, BarChart2,
} from "lucide-react";

function formatKz(n: number) { return n.toLocaleString("pt-PT") + " Kz"; }

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: "Próximo",     color: "#f5a623", bg: "rgba(245,166,35,0.12)" },
  active:   { label: "A decorrer",  color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
  finished: { label: "Terminado",   color: "#64748b", bg: "rgba(100,116,139,0.12)"},
};

export default function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tournament, setTournament]   = useState<any>(null);
  const [balance, setBalance]         = useState(0);
  const [loading, setLoading]         = useState(true);
  const [joining, setJoining]         = useState(false);
  const [joined, setJoined]           = useState(false);
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [msg, setMsg]                 = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch(`/api/tournaments/${id}`).then(r => r.json()),
      fetch("/api/balance").then(r => r.json()),
    ]).then(([t, b]) => {
      setTournament(t);
      setBalance(b.balance ?? 0);
      const uid = (session?.user as any)?.id;
      if (uid && Array.isArray(t.participants)) setJoined(t.participants.some((p: any) => p.userId === uid));
      setLoading(false);
    });
  }, [status, id, session]);

  async function join() {
    if (!tournament.isFree && !confirmPaid) { setConfirmPaid(true); return; }
    setJoining(true); setMsg(null); setConfirmPaid(false);
    const res = await fetch(`/api/tournaments/${id}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setJoined(true);
      setBalance(b => b - (tournament.isFree ? 0 : tournament.entryFee));
      setMsg({ text: tournament.isFree ? "Inscrito com sucesso! Boa sorte!" : `Inscrito! ${formatKz(tournament.entryFee)} debitados do teu saldo real.`, ok: true });
    } else {
      setMsg({ text: data.error ?? "Erro ao inscrever.", ok: false });
    }
    setJoining(false);
  }

  if (loading || !tournament) {
    return <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#f5a623", fontFamily: "system-ui" }}>A carregar...</div>;
  }

  const s = STATUS_STYLE[tournament.status] ?? STATUS_STYLE.upcoming;
  const prizes: any[] = Array.isArray(tournament.prizes) ? tournament.prizes : [];
  const participants: any[] = Array.isArray(tournament.participants) ? tournament.participants : [];
  const total = tournament._count?.participants ?? 0;
  const maxReached = tournament.maxParticipants && total >= tournament.maxParticipants;
  const daysLeft = Math.max(0, Math.ceil((new Date(tournament.endDate).getTime() - Date.now()) / 86400000));
  const hoursLeft = Math.max(0, Math.ceil((new Date(tournament.endDate).getTime() - Date.now()) / 3600000));
  const canJoin = tournament.status !== "finished" && !joined && !maxReached;
  const hasFunds = balance >= (tournament.entryFee ?? 0);
  const bannerColor = tournament.bannerColor ?? "#f5a623";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/ranking")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ width: 30, height: 30, background: `linear-gradient(135deg,${bannerColor},${bannerColor}99)`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trophy size={15} color="#fff" />
        </div>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tournament.name}</span>
        <span style={{ background: s.bg, color: s.color, borderRadius: 6, fontSize: 11, fontWeight: 700, padding: "3px 9px", flexShrink: 0 }}>{s.label}</span>
      </div>

      {/* Banner strip */}
      <div style={{ height: 5, background: `linear-gradient(90deg,${bannerColor},${bannerColor}44,transparent)` }} />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>

        {/* Hero */}
        <div style={{ background: `linear-gradient(135deg,${bannerColor}14,${bannerColor}04)`, border: `1px solid ${bannerColor}33`, borderRadius: 20, padding: "24px 22px", marginBottom: 20 }}>
          {/* Type badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            {tournament.isFree
              ? <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.12)", color: "#22c55e", borderRadius: 8, fontSize: 12, fontWeight: 800, padding: "5px 12px" }}><Unlock size={13} /> ENTRADA GRATUITA</span>
              : <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(245,166,35,0.12)", color: "#f5a623", borderRadius: 8, fontSize: 12, fontWeight: 800, padding: "5px 12px" }}><Lock size={13} /> ENTRADA PAGA · {formatKz(tournament.entryFee)}</span>
            }
            {tournament.status === "active" && hoursLeft <= 24 && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(239,68,68,0.12)", color: "#ef4444", borderRadius: 8, fontSize: 12, fontWeight: 800, padding: "5px 12px" }}>
                <Zap size={13} /> ÚLTIMAS {hoursLeft}h!
              </span>
            )}
          </div>

          {/* Description */}
          {tournament.description && (
            <p style={{ color: "#cbd5e1", fontSize: 15, lineHeight: 1.75, margin: "0 0 20px" }}>{tournament.description}</p>
          )}

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { Icon: Calendar, label: "Início",       value: new Date(tournament.startDate).toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" }), color: bannerColor },
              { Icon: Calendar, label: "Fim",           value: new Date(tournament.endDate).toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" }), color: bannerColor },
              { Icon: Users,    label: "Participantes", value: `${total}${tournament.maxParticipants ? ` / ${tournament.maxParticipants}` : ""}`, color: "#94a3b8" },
              { Icon: Gift,     label: "Prémio total",  value: formatKz(tournament.prizePool), color: bannerColor },
              ...(tournament.status === "active" ? [{ Icon: Clock, label: daysLeft > 1 ? "Dias restantes" : "Horas restantes", value: daysLeft > 1 ? `${daysLeft} dias` : `${hoursLeft}h`, color: daysLeft <= 1 ? "#ef4444" : "#22c55e" }] : []),
            ].map((item, i) => (
              <div key={i} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <item.Icon size={12} color={item.color} />
                  <span style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>{item.label.toUpperCase()}</span>
                </div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Join / status */}
          {canJoin && !confirmPaid && (
            <>
              {!tournament.isFree && !hasFunds && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
                  <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 13 }}>Saldo insuficiente</div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>Precisas de {formatKz(tournament.entryFee)} no saldo real. O teu saldo actual é {formatKz(balance)}.</div>
                    <a href="/wallet" style={{ display: "inline-block", marginTop: 8, color: "#f5a623", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Depositar agora →</a>
                  </div>
                </div>
              )}
              <button onClick={join} disabled={joining || (!tournament.isFree && !hasFunds)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", background: `linear-gradient(135deg,${bannerColor},${bannerColor}cc)`, border: "none", borderRadius: 12, padding: "15px", color: "#fff", fontWeight: 900, fontSize: 16, cursor: (joining || (!tournament.isFree && !hasFunds)) ? "not-allowed" : "pointer", opacity: joining || (!tournament.isFree && !hasFunds) ? 0.6 : 1, boxShadow: `0 6px 24px ${bannerColor}40` }}>
                <Trophy size={19} /> {joining ? "A inscrever..." : tournament.isFree ? "Participar gratuitamente" : `Participar por ${formatKz(tournament.entryFee)}`}
              </button>
            </>
          )}

          {/* Payment confirmation */}
          {confirmPaid && (
            <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 14, padding: "18px" }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <Lock size={16} color="#f5a623" /> Confirmar pagamento de entrada
              </div>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>
                Serão debitados <strong style={{ color: "#f5a623" }}>{formatKz(tournament.entryFee)}</strong> do teu saldo real ({formatKz(balance)} disponível).<br />Esta acção não pode ser revertida.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmPaid(false)} style={{ flex: 1, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 10, padding: "11px", color: "#64748b", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                <button onClick={join} disabled={joining} style={{ flex: 2, background: "linear-gradient(135deg,#f5a623,#e8940f)", border: "none", borderRadius: 10, padding: "11px", color: "#0a0f1e", fontWeight: 900, fontSize: 14, cursor: joining ? "not-allowed" : "pointer", opacity: joining ? 0.7 : 1 }}>
                  <Check size={15} /> Confirmar e participar
                </button>
              </div>
            </div>
          )}

          {joined && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12, padding: "14px 16px" }}>
              <Check size={18} color="#22c55e" />
              <div>
                <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 15 }}>Estás inscrito!</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>As tuas operações reais contam para este torneio.</div>
              </div>
            </div>
          )}

          {maxReached && !joined && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "14px 16px" }}>
              <Users size={18} color="#ef4444" />
              <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 14 }}>Torneio sem vagas disponíveis</div>
            </div>
          )}

          {tournament.status === "finished" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(100,116,139,0.08)", border: "1px solid rgba(100,116,139,0.25)", borderRadius: 12, padding: "14px 16px" }}>
              <Trophy size={18} color="#64748b" />
              <div style={{ color: "#94a3b8", fontWeight: 700, fontSize: 14 }}>Este torneio já terminou — vê a classificação final abaixo.</div>
            </div>
          )}

          {msg && <div style={{ marginTop: 12, background: msg.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${msg.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 10, padding: "11px 14px", color: msg.ok ? "#22c55e" : "#ef4444", fontSize: 13, fontWeight: 600 }}>{msg.text}</div>}
        </div>

        {/* Rules */}
        {tournament.rules && (
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, padding: "20px 22px", marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: "#94a3b8", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 8 }}>
              <ClipboardList size={14} style={{ display:"inline", marginRight:6, verticalAlign:"middle" }} />REGRAS DO TORNEIO
            </h3>
            <pre style={{ color: "#cbd5e1", fontSize: 14, margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.8 }}>{tournament.rules}</pre>
          </div>
        )}

        {/* Prizes */}
        {prizes.length > 0 && (
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, padding: "20px 22px", marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: "#94a3b8", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 8 }}>
              <Gift size={14} color="#f5a623" /> PRÉMIOS
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {prizes.map((p: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: i === 0 ? "rgba(245,166,35,0.06)" : "#0d1526", border: `1px solid ${i === 0 ? "rgba(245,166,35,0.25)" : "#1e2d50"}`, borderRadius: 12, padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {i === 0 ? <Trophy size={20} color="#f5a623" /> : i === 1 ? <Crown size={20} color="#94a3b8" /> : <Star size={20} color="#cd7f32" />}
                    <div>
                      <div style={{ color: i === 0 ? "#f5a623" : i === 1 ? "#94a3b8" : "#cd7f32", fontWeight: 800, fontSize: 15 }}>{p.position}º Lugar</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>{i === 0 ? "Campeão" : i === 1 ? "Vice-Campeão" : `${p.position}º Classificado`}</div>
                    </div>
                  </div>
                  <div style={{ color: i === 0 ? "#f5a623" : "#fff", fontWeight: 900, fontSize: 18 }}>{formatKz(p.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2d50", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, display:"flex", alignItems:"center", gap:6 }}><BarChart2 size={13} /> CLASSIFICAÇÃO</span>
            <span style={{ color: "#64748b", fontSize: 12 }}>{total} participante(s)</span>
          </div>
          {participants.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <Users size={36} color="#1e2d50" style={{ marginBottom: 14 }} />
              <p style={{ color: "#64748b", fontSize: 15, margin: "0 0 6px", fontWeight: 600 }}>Ainda sem participantes</p>
              <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>Sê o primeiro a inscrever-te!</p>
            </div>
          ) : (
            participants.map((p: any, i: number) => {
              const isMe = (session?.user as any)?.id === p.userId;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #0d1526", background: isMe ? `${bannerColor}08` : i < 3 ? "rgba(245,166,35,0.02)" : "transparent", borderLeft: isMe ? `3px solid ${bannerColor}` : "3px solid transparent" }}>
                  <div style={{ width: 34, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {i === 0 ? <Trophy size={18} color="#f5a623" /> : i === 1 ? <Crown size={18} color="#94a3b8" /> : i === 2 ? <Star size={18} color="#cd7f32" /> : <span style={{ color: "#4b5563", fontSize: 13, fontWeight: 700 }}>{i + 1}</span>}
                  </div>
                  <div style={{ width: 36, height: 36, background: isMe ? bannerColor : "#1e2d50", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 12, flexShrink: 0 }}>
                    <span style={{ color: isMe ? "#0a0f1e" : "#f5a623", fontWeight: 900, fontSize: 14 }}>{p.user?.name?.charAt(0)?.toUpperCase() ?? "?"}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: isMe ? bannerColor : "#fff", fontWeight: isMe ? 800 : 600, fontSize: 14 }}>
                      {p.user?.name ?? "—"} {isMe && <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>(tu)</span>}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 11 }}>{p.wins}/{p.trades} vitórias</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: p.profit > 0 ? "#22c55e" : p.profit < 0 ? "#ef4444" : "#64748b", fontWeight: 800, fontSize: 15 }}>
                      {p.profit > 0 ? "+" : ""}{formatKz(p.profit)}
                    </div>
                    {i < prizes.length && <div style={{ color: i === 0 ? "#f5a623" : i === 1 ? "#94a3b8" : "#cd7f32", fontSize: 11, fontWeight: 700, display:"flex", alignItems:"center", gap:4 }}><Gift size={10} /> {formatKz(prizes[i].amount)}</div>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
