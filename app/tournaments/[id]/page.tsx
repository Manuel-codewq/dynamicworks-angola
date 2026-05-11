"use client";
import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Trophy, Medal, ChevronLeft, Calendar, Users, Gift, Clock, Check } from "lucide-react";

function formatKz(n: number) { return n.toLocaleString("pt-AO") + " Kz"; }

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: "Próximo",  color: "#f5a623", bg: "rgba(245,166,35,0.12)" },
  active:   { label: "Activo",   color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
  finished: { label: "Terminado",color: "#64748b", bg: "rgba(100,116,139,0.12)"},
};

const MEDAL_COLOR = ["#f5a623", "#94a3b8", "#cd7f32"];

export default function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [joining, setJoining]       = useState(false);
  const [joined, setJoined]         = useState(false);
  const [msg, setMsg]               = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/tournaments/${id}`)
      .then(r => r.json())
      .then(d => {
        setTournament(d);
        const uid = (session?.user as any)?.id;
        if (uid && Array.isArray(d.participants)) {
          setJoined(d.participants.some((p: any) => p.userId === uid));
        }
        setLoading(false);
      });
  }, [status, id, session]);

  async function join() {
    setJoining(true); setMsg(null);
    const res = await fetch(`/api/tournaments/${id}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) { setJoined(true); setMsg({ text: "Inscrito com sucesso! Boa sorte!", ok: true }); }
    else        { setMsg({ text: data.error ?? "Erro ao inscrever.", ok: false }); }
    setJoining(false);
  }

  if (loading || !tournament) {
    return <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#f5a623", fontFamily: "system-ui" }}>A carregar...</div>;
  }

  const s = STATUS_STYLE[tournament.status] ?? STATUS_STYLE.upcoming;
  const prizes: any[] = Array.isArray(tournament.prizes) ? tournament.prizes : [];
  const participants: any[] = Array.isArray(tournament.participants) ? tournament.participants : [];
  const totalParticipants = tournament._count?.participants ?? 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(tournament.endDate).getTime() - Date.now()) / 86400000));
  const canJoin = tournament.status !== "finished" && !joined;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/ranking")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
          <ChevronLeft size={20} />
        </button>
        <Trophy size={20} color="#f5a623" />
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, flex: 1 }}>{tournament.name}</span>
        <span style={{ background: s.bg, color: s.color, borderRadius: 6, fontSize: 11, fontWeight: 700, padding: "3px 9px" }}>{s.label}</span>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>

        {/* Hero card */}
        <div style={{ background: "linear-gradient(135deg,rgba(245,166,35,0.12),rgba(245,166,35,0.04))", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 16, padding: "24px 20px", marginBottom: 20 }}>
          {tournament.description && <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 16px", lineHeight: 1.6 }}>{tournament.description}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={15} color="#f5a623" />
              <div>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>PERÍODO</div>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
                  {new Date(tournament.startDate).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })}
                  {" → "}
                  {new Date(tournament.endDate).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={15} color="#f5a623" />
              <div>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>PARTICIPANTES</div>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{totalParticipants}</div>
              </div>
            </div>
            {tournament.status === "active" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={15} color="#22c55e" />
                <div>
                  <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>TERMINA EM</div>
                  <div style={{ color: "#22c55e", fontSize: 13, fontWeight: 700 }}>{daysLeft} dias</div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Gift size={15} color="#f5a623" />
              <div>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>FUNDO DE PRÉMIOS</div>
                <div style={{ color: "#f5a623", fontSize: 13, fontWeight: 800 }}>{formatKz(tournament.prizePool)}</div>
              </div>
            </div>
          </div>

          {/* Join button */}
          {canJoin && (
            <button onClick={join} disabled={joining}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", marginTop: 20, background: "linear-gradient(135deg,#f5a623,#e8940f)", border: "none", borderRadius: 12, padding: "14px", color: "#0a0f1e", fontWeight: 900, fontSize: 15, cursor: joining ? "not-allowed" : "pointer", opacity: joining ? 0.7 : 1 }}>
              <Trophy size={18} /> {joining ? "A inscrever..." : "Participar no torneio"}
            </button>
          )}
          {joined && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12, padding: "12px 16px" }}>
              <Check size={16} color="#22c55e" />
              <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>Estás inscrito neste torneio!</span>
            </div>
          )}
          {msg && <div style={{ marginTop: 10, background: msg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.ok ? "#22c55e" : "#ef4444"}`, borderRadius: 8, padding: "10px 14px", color: msg.ok ? "#22c55e" : "#ef4444", fontSize: 13 }}>{msg.text}</div>}
        </div>

        {/* Prizes */}
        {prizes.length > 0 && (
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: "#f5a623", display: "flex", alignItems: "center", gap: 8 }}>
              <Gift size={15} /> Prémios
            </h3>
            {prizes.map((p: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < prizes.length - 1 ? "1px solid #0d1526" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {i === 0 ? <Trophy size={18} color="#f5a623" /> : i === 1 ? <Medal size={18} color="#94a3b8" /> : <Medal size={18} color="#cd7f32" />}
                  <span style={{ color: MEDAL_COLOR[i] ?? "#fff", fontWeight: 700, fontSize: 14 }}>{p.position}º lugar</span>
                </div>
                <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 15 }}>{formatKz(p.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Leaderboard */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #1e2d50", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>CLASSIFICAÇÃO</span>
            <span style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>LUCRO · TRADES</span>
          </div>
          {participants.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
              <Users size={32} color="#1e2d50" style={{ marginBottom: 12 }} />
              <p style={{ margin: 0 }}>Ainda sem participantes. Sê o primeiro!</p>
            </div>
          ) : (
            participants.map((p: any, i: number) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", padding: "13px 18px", borderBottom: "1px solid #0d1526", background: i < 3 ? "rgba(245,166,35,0.02)" : "transparent" }}>
                <div style={{ width: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {i === 0 ? <Trophy size={17} color="#f5a623" /> : i === 1 ? <Medal size={17} color="#94a3b8" /> : i === 2 ? <Medal size={17} color="#cd7f32" /> : <span style={{ color: "#4b5563", fontSize: 13, fontWeight: 700 }}>{i + 1}</span>}
                </div>
                <div style={{ width: 34, height: 34, background: "#1e2d50", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 }}>
                  <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 13 }}>{p.user?.name?.charAt(0)?.toUpperCase() ?? "?"}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{p.user?.name ?? "—"}</div>
                  <div style={{ color: "#64748b", fontSize: 11 }}>{p.wins}/{p.trades} vitórias</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: p.profit >= 0 ? "#22c55e" : "#ef4444", fontWeight: 800, fontSize: 14 }}>
                    {p.profit >= 0 ? "+" : ""}{formatKz(p.profit)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
