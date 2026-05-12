"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { TrendingUp, ChevronLeft, Trophy, Medal, Calendar, Users, ChevronRight, BarChart2 } from "lucide-react";

function formatKz(n: number) { return n.toLocaleString("pt-PT") + " Kz"; }
function formatDate(d: string) { return new Date(d).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" }); }
function daysLeft(end: string) { return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000)); }

interface RankEntry { position: number; name: string; avatar: string | null; profit: number; wins: number; total: number; winRate: number; }

function AvatarCircle({ entry, size = 34, medal, crown }: { entry: RankEntry; size?: number; medal?: string; crown?: boolean }) {
  const border = medal ? `2.5px solid ${medal}` : "2px solid #1e2d50";
  const glow   = medal ? `0 0 12px ${medal}55` : "none";
  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto 8px" }}>
      {entry.avatar
        ? <img src={entry.avatar} alt={entry.name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border, boxShadow: glow }} />
        : <div style={{ width: size, height: size, borderRadius: "50%", background: "#1e2d50", border, boxShadow: glow, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#f5a623", fontWeight: 800, fontSize: Math.round(size * 0.38) }}>{entry.name.charAt(0).toUpperCase()}</span>
          </div>
      }
      {crown && (
        <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", fontSize: 16 }}>👑</div>
      )}
    </div>
  );
}

const MEDAL: Record<number, { icon: React.ReactNode; color: string }> = {
  1: { icon: <Trophy size={18} />, color: "#f5a623" },
  2: { icon: <Medal  size={18} />, color: "#94a3b8" },
  3: { icon: <Medal  size={18} />, color: "#cd7f32" },
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: "Próximo",  color: "#f5a623", bg: "rgba(245,166,35,0.12)" },
  active:   { label: "Activo",   color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
  finished: { label: "Terminado",color: "#64748b", bg: "rgba(100,116,139,0.12)"},
};

export default function RankingPage() {
  const { status } = useSession();
  const router = useRouter();
  const [tab, setTab]             = useState<"ranking" | "tournaments">("tournaments");
  const [ranking, setRanking]     = useState<RankEntry[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/ranking").then(r => r.json()),
      fetch("/api/tournaments").then(r => r.json()),
    ]).then(([r, t]) => { setRanking(r); setTournaments(t); setLoading(false); });
  }, [status]);

  const activeTournaments   = tournaments.filter(t => t.status === "active");
  const upcomingTournaments = tournaments.filter(t => t.status === "upcoming");
  const finishedTournaments = tournaments.filter(t => t.status === "finished");

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/trade")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ width: 32, height: 32, background: "#f5a623", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trophy size={18} color="#0a0f1e" strokeWidth={2.5} />
        </div>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Ranking & Torneios</span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#111827", borderBottom: "1px solid #1e2d50" }}>
        {(["tournaments", "ranking"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "13px 0", background: "none", border: "none", borderBottom: `2px solid ${tab === t ? "#f5a623" : "transparent"}`, color: tab === t ? "#f5a623" : "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {t === "tournaments"
              ? <><Trophy size={13} style={{ display:"inline", marginRight:5, verticalAlign:"middle" }} />Torneios</>
              : <><BarChart2 size={13} style={{ display:"inline", marginRight:5, verticalAlign:"middle" }} />Ranking Global</>
            }
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>

        {/* ── TOURNAMENTS TAB ── */}
        {tab === "tournaments" && (
          <div>
            {loading && <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>A carregar...</div>}

            {/* Active */}
            {activeTournaments.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: "#22c55e", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>EM CURSO</h3>
                {activeTournaments.map(t => <TournamentCard key={t.id} t={t} router={router} />)}
              </div>
            )}

            {/* Upcoming */}
            {upcomingTournaments.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: "#f5a623", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>PRÓXIMOS</h3>
                {upcomingTournaments.map(t => <TournamentCard key={t.id} t={t} router={router} />)}
              </div>
            )}

            {/* Finished */}
            {finishedTournaments.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: "#64748b", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>TERMINADOS</h3>
                {finishedTournaments.map(t => <TournamentCard key={t.id} t={t} router={router} />)}
              </div>
            )}

            {!loading && tournaments.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <Trophy size={48} color="#1e2d50" style={{ marginBottom: 16 }} />
                <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>Nenhum torneio disponível ainda.</p>
                <p style={{ color: "#4b5563", fontSize: 13, marginTop: 6 }}>Verifica mais tarde!</p>
              </div>
            )}
          </div>
        )}

        {/* ── RANKING TAB ── */}
        {tab === "ranking" && (
          <div>
            {ranking.length >= 3 && (
              <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "flex-end" }}>
                {/* 2nd */}
                <div style={{ flex: 1, background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
                  <AvatarCircle entry={ranking[1]} size={44} medal="#94a3b8" />
                  <div style={{ color: "#94a3b8", fontWeight: 800, fontSize: 11, marginBottom: 4 }}>2º</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{ranking[1].name.split(" ")[0]}</div>
                  <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 13 }}>+{formatKz(ranking[1].profit)}</div>
                </div>
                {/* 1st */}
                <div style={{ flex: 1, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.35)", borderRadius: 12, padding: "20px 12px", textAlign: "center" }}>
                  <AvatarCircle entry={ranking[0]} size={54} medal="#f5a623" crown />
                  <div style={{ color: "#f5a623", fontWeight: 800, fontSize: 11, marginBottom: 4 }}>1º</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{ranking[0].name.split(" ")[0]}</div>
                  <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 14 }}>+{formatKz(ranking[0].profit)}</div>
                </div>
                {/* 3rd */}
                <div style={{ flex: 1, background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
                  <AvatarCircle entry={ranking[2]} size={44} medal="#cd7f32" />
                  <div style={{ color: "#cd7f32", fontWeight: 800, fontSize: 11, marginBottom: 4 }}>3º</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{ranking[2].name.split(" ")[0]}</div>
                  <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 13 }}>+{formatKz(ranking[2].profit)}</div>
                </div>
              </div>
            )}

            <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "13px 16px", borderBottom: "1px solid #1e2d50", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>TRADER</span>
                <span style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>LUCRO · VITÓRIAS</span>
              </div>
              {loading && <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>A carregar...</div>}
              {!loading && ranking.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Ainda sem dados. Sê o primeiro!</div>}
              {ranking.map(e => {
                const medal = MEDAL[e.position];
                return (
                  <div key={e.position} style={{ display: "flex", alignItems: "center", padding: "13px 16px", borderBottom: "1px solid #0d1526", background: e.position <= 3 ? "rgba(245,166,35,0.02)" : "transparent" }}>
                    <div style={{ width: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {medal ? <span style={{ color: medal.color }}>{medal.icon}</span> : <span style={{ color: "#4b5563", fontSize: 13, fontWeight: 700 }}>{e.position}</span>}
                    </div>
                    <div style={{ marginRight: 10, flexShrink: 0 }}>
                      <AvatarCircle entry={e} size={34} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{e.name}</div>
                      <div style={{ color: "#64748b", fontSize: 11 }}>{e.wins}/{e.total} vitórias · {e.winRate}%</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: e.profit >= 0 ? "#22c55e" : "#ef4444", fontWeight: 800, fontSize: 14 }}>{e.profit >= 0 ? "+" : ""}{formatKz(e.profit)}</div>
                      <div style={{ width: 60, height: 4, background: "#1e2d50", borderRadius: 2, marginTop: 4 }}>
                        <div style={{ width: `${e.winRate}%`, height: "100%", background: e.winRate >= 50 ? "#22c55e" : "#ef4444", borderRadius: 2 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ color: "#4b5563", fontSize: 11, textAlign: "center", marginTop: 14 }}>Actualizado em tempo real · apenas operações reais</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TournamentCard({ t, router }: { t: any; router: any }) {
  const s = STATUS_STYLE[t.status] ?? STATUS_STYLE.upcoming;
  const prizes = Array.isArray(t.prizes) ? t.prizes : [];
  return (
    <div onClick={() => router.push(`/tournaments/${t.id}`)}
      style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "16px 18px", marginBottom: 10, cursor: "pointer", transition: "border-color 0.2s" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "#f5a623")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e2d50")}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Trophy size={16} color={t.status === "active" ? "#22c55e" : "#f5a623"} />
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{t.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: s.bg, color: s.color, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>{s.label}</span>
          <ChevronRight size={16} color="#4b5563" />
        </div>
      </div>
      {t.description && <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>{t.description}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12, color: "#64748b" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Calendar size={12} />
          {new Date(t.startDate).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })}
          {" → "}
          {new Date(t.endDate).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Users size={12} />{t._count?.participants ?? 0} participantes</span>
        {t.status !== "finished" && <span style={{ color: t.status === "active" ? "#22c55e" : "#f5a623" }}>
          {t.status === "active" ? `${Math.max(0, Math.ceil((new Date(t.endDate).getTime() - Date.now()) / 86400000))} dias restantes` : `Começa em ${Math.max(0, Math.ceil((new Date(t.startDate).getTime() - Date.now()) / 86400000))} dias`}
        </span>}
      </div>
      {prizes.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {prizes.slice(0, 3).map((p: any, i: number) => (
            <div key={i} style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 6, padding: "3px 9px", fontSize: 11, color: i === 0 ? "#f5a623" : i === 1 ? "#94a3b8" : "#b45309", fontWeight: 700 }}>
              {i + 1}º {(p.amount as number).toLocaleString("pt-PT")} Kz
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
