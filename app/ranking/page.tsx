"use client";
import { formatKz } from "@/lib/format";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Trophy, Medal, Calendar, Users, ChevronRight, BarChart2, Crown,
  Star, RefreshCw, Target, Flame, Dumbbell, Swords, Sparkles, Gem, Award,
  Zap, Wallet, TrendingUp, CalendarDays, Globe, Banknote, Rocket, Check,
} from "lucide-react";

const ACH_ICON: Record<string, React.ReactNode> = {
  target:       <Target       size={20} />,
  flame:        <Flame        size={20} />,
  dumbbell:     <Dumbbell     size={20} />,
  medal:        <Medal        size={20} />,
  swords:       <Swords       size={20} />,
  star:         <Star         size={20} />,
  sparkles:     <Sparkles     size={20} />,
  gem:          <Gem          size={20} />,
  crown:        <Crown        size={20} />,
  award:        <Award        size={20} />,
  zap:          <Zap          size={20} />,
  wallet:       <Wallet       size={20} />,
  rocket:       <Rocket       size={20} />,
  "trending-up":<TrendingUp   size={20} />,
  calendar:     <Calendar     size={20} />,
  "calendar-days":<CalendarDays size={20} />,
  globe:        <Globe        size={20} />,
  banknote:     <Banknote     size={20} />,
  trophy:       <Trophy       size={20} />,
};

function formatDate(d: string) { return new Date(d).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" }); }

interface RankEntry { position: number; name: string; avatar: string | null; profit: number; wins: number; total: number; winRate: number; isMe?: boolean; }

function AvatarCircle({ entry, size = 34, medal, crown }: { entry: RankEntry; size?: number; medal?: string; crown?: boolean }) {
  const border = medal ? `2.5px solid ${medal}` : entry.isMe ? "2px solid #f5a623" : "2px solid #1e2d50";
  const glow   = medal ? `0 0 12px ${medal}55` : "none";
  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto 8px" }}>
      {entry.avatar
        ? <img src={entry.avatar} alt={entry.name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border, boxShadow: glow }} />
        : <div style={{ width: size, height: size, borderRadius: "50%", background: entry.isMe ? "rgba(245,166,35,0.15)" : "#1e2d50", border, boxShadow: glow, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#f5a623", fontWeight: 800, fontSize: Math.round(size * 0.38) }}>{entry.name.charAt(0).toUpperCase()}</span>
          </div>
      }
      {crown && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)" }}><Crown size={16} color="#f5a623" fill="#f5a623" /></div>}
    </div>
  );
}

const MEDAL: Record<number, { icon: React.ReactNode; color: string }> = {
  1: { icon: <Trophy size={18} />, color: "#f5a623" },
  2: { icon: <Medal  size={18} />, color: "#94a3b8" },
  3: { icon: <Medal  size={18} />, color: "#cd7f32" },
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: "Próximo",   color: "#f5a623", bg: "rgba(245,166,35,0.12)" },
  active:   { label: "Activo",    color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
  finished: { label: "Terminado", color: "#64748b", bg: "rgba(100,116,139,0.12)"},
};

const RARITY_COLOR: Record<string, string> = {
  common:    "#94a3b8",
  rare:      "#3b82f6",
  epic:      "#a78bfa",
  legendary: "#f5a623",
};

const PERIOD_OPTIONS = [
  { key: "today", label: "Hoje" },
  { key: "week",  label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "all",   label: "Tudo" },
] as const;

type PeriodKey = typeof PERIOD_OPTIONS[number]["key"];

export default function RankingPage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const [tab, setTab]               = useState<"ranking" | "tournaments" | "conquistas">("ranking");
  const [ranking, setRanking]       = useState<RankEntry[]>([]);
  const [myPosition, setMyPosition] = useState<number | null>(null);
  const [myRankEntry, setMyRankEntry] = useState<RankEntry | null>(null);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [achUnlocked, setAchUnlocked]   = useState(0);
  const [achTotal, setAchTotal]         = useState(0);
  const [loading, setLoading]       = useState(true);
  const [period, setPeriod]         = useState<PeriodKey>("all");
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const loadRanking = useCallback(async (p: PeriodKey) => {
    const r = await fetch(`/api/ranking?period=${p}`).then(res => res.json());
    setRanking(r.ranking ?? []);
    setMyPosition(r.myPosition ?? null);
    setMyRankEntry(r.myRankEntry ?? null);
    setLastRefresh(Date.now());
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    Promise.all([
      fetch(`/api/ranking?period=${period}`).then(r => r.json()),
      fetch("/api/tournaments").then(r => r.json()),
      fetch("/api/achievements").then(r => r.json()),
    ]).then(([r, t, a]) => {
      setRanking(r.ranking ?? []);
      setMyPosition(r.myPosition ?? null);
      setMyRankEntry(r.myRankEntry ?? null);
      setTournaments(t);
      setAchievements(a.achievements ?? []);
      setAchUnlocked(a.unlocked ?? 0);
      setAchTotal(a.total ?? 0);
      setLoading(false);
    });
  }, [status, period]);

  // Auto-refresh ranking a cada 30s
  useEffect(() => {
    if (tab !== "ranking") return;
    const id = setInterval(() => loadRanking(period), 30_000);
    return () => clearInterval(id);
  }, [tab, period, loadRanking]);

  const activeTournaments   = tournaments.filter(t => t.status === "active");
  const upcomingTournaments = tournaments.filter(t => t.status === "upcoming");
  const finishedTournaments = tournaments.filter(t => t.status === "finished");

  const achByCategory: Record<string, any[]> = {};
  for (const a of achievements) {
    (achByCategory[a.category] ??= []).push(a);
  }
  const catLabels: Record<string, string> = { trades: "Operações", wins: "Vitórias", streak: "Sequências", volume: "Volume", special: "Especial" };

  const timeSince = Math.floor((Date.now() - lastRefresh) / 1000);

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
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, flex: 1 }}>Ranking & Conquistas</span>
        {tab === "ranking" && (
          <button onClick={() => loadRanking(period)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
            <RefreshCw size={13} /> {timeSince}s
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#111827", borderBottom: "1px solid #1e2d50" }}>
        {([
          { key: "ranking",    label: "Ranking",     icon: <BarChart2 size={13} /> },
          { key: "tournaments",label: "Torneios",    icon: <Trophy    size={13} /> },
          { key: "conquistas", label: "Conquistas",  icon: <Star      size={13} /> },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: "13px 0", background: "none", border: "none", borderBottom: `2px solid ${tab === t.key ? "#f5a623" : "transparent"}`, color: tab === t.key ? "#f5a623" : "#64748b", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>

        {/* ── RANKING TAB ── */}
        {tab === "ranking" && (
          <div>
            {/* Period selector */}
            <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "#111827", border: "1px solid #1e2d50", borderRadius: 10, padding: 4 }}>
              {PERIOD_OPTIONS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  style={{ flex: 1, padding: "7px 0", background: period === p.key ? "#f5a623" : "transparent", color: period === p.key ? "#0a0f1e" : "#64748b", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* My position banner */}
            {myPosition && (
              <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>A tua posição</span>
                <span style={{ color: "#f5a623", fontWeight: 900, fontSize: 18 }}>#{myPosition}</span>
              </div>
            )}

            {/* Top 3 podium */}
            {ranking.length >= 3 && (
              <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "flex-end" }}>
                <div style={{ flex: 1, background: ranking[1].isMe ? "rgba(245,166,35,0.08)" : "#111827", border: `1px solid ${ranking[1].isMe ? "rgba(245,166,35,0.35)" : "#1e2d50"}`, borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
                  <AvatarCircle entry={ranking[1]} size={44} medal="#94a3b8" />
                  <div style={{ color: "#94a3b8", fontWeight: 800, fontSize: 11, marginBottom: 4 }}>2º</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{ranking[1].isMe ? "Tu" : ranking[1].name.split(" ")[0]}</div>
                  <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 13 }}>{ranking[1].profit >= 0 ? "+" : ""}{formatKz(ranking[1].profit)}</div>
                </div>
                <div style={{ flex: 1, background: ranking[0].isMe ? "rgba(245,166,35,0.12)" : "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.35)", borderRadius: 12, padding: "20px 12px", textAlign: "center" }}>
                  <AvatarCircle entry={ranking[0]} size={54} medal="#f5a623" crown />
                  <div style={{ color: "#f5a623", fontWeight: 800, fontSize: 11, marginBottom: 4 }}>1º</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{ranking[0].isMe ? "Tu" : ranking[0].name.split(" ")[0]}</div>
                  <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 14 }}>{ranking[0].profit >= 0 ? "+" : ""}{formatKz(ranking[0].profit)}</div>
                </div>
                <div style={{ flex: 1, background: ranking[2].isMe ? "rgba(245,166,35,0.08)" : "#111827", border: `1px solid ${ranking[2].isMe ? "rgba(245,166,35,0.35)" : "#1e2d50"}`, borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
                  <AvatarCircle entry={ranking[2]} size={44} medal="#cd7f32" />
                  <div style={{ color: "#cd7f32", fontWeight: 800, fontSize: 11, marginBottom: 4 }}>3º</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{ranking[2].isMe ? "Tu" : ranking[2].name.split(" ")[0]}</div>
                  <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 13 }}>{ranking[2].profit >= 0 ? "+" : ""}{formatKz(ranking[2].profit)}</div>
                </div>
              </div>
            )}

            {/* Full list */}
            <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "13px 16px", borderBottom: "1px solid #1e2d50", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>TRADER</span>
                <span style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>LUCRO · WIN RATE</span>
              </div>
              {loading && <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>A carregar...</div>}
              {!loading && ranking.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Sem dados para este período.</div>}
              {ranking.map(e => {
                const medal = MEDAL[e.position];
                return (
                  <div key={e.position} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #0d1526", background: e.isMe ? "rgba(245,166,35,0.05)" : e.position <= 3 ? "rgba(245,166,35,0.02)" : "transparent" }}>
                    <div style={{ width: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {medal ? <span style={{ color: medal.color }}>{medal.icon}</span> : <span style={{ color: e.isMe ? "#f5a623" : "#4b5563", fontSize: 13, fontWeight: 700 }}>{e.position}</span>}
                    </div>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: e.isMe ? "rgba(245,166,35,0.15)" : "#1e2d50", border: `2px solid ${e.isMe ? "#f5a623" : "#1e2d50"}`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 }}>
                      {e.avatar
                        ? <img src={e.avatar} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                        : <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 14 }}>{e.name[0].toUpperCase()}</span>
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: e.isMe ? "#f5a623" : "#fff", fontWeight: 600, fontSize: 14 }}>{e.isMe ? "Tu" : e.name}</div>
                      <div style={{ color: "#64748b", fontSize: 11 }}>{e.wins}/{e.total} vitórias</div>
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

              {/* User below top 20 */}
              {myRankEntry && (
                <>
                  <div style={{ padding: "6px 16px", textAlign: "center", color: "#1e2d50", fontSize: 18, letterSpacing: 4 }}>· · ·</div>
                  <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", background: "rgba(245,166,35,0.08)", borderTop: "1px solid rgba(245,166,35,0.2)" }}>
                    <div style={{ width: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ color: "#f5a623", fontSize: 13, fontWeight: 700 }}>{myRankEntry.position}</span>
                    </div>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(245,166,35,0.15)", border: "2px solid #f5a623", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 }}>
                      <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 14 }}>T</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#f5a623", fontWeight: 700, fontSize: 14 }}>Tu</div>
                      <div style={{ color: "#64748b", fontSize: 11 }}>{myRankEntry.wins}/{myRankEntry.total} vitórias</div>
                    </div>
                    <div style={{ color: myRankEntry.profit >= 0 ? "#22c55e" : "#ef4444", fontWeight: 800, fontSize: 14 }}>
                      {myRankEntry.profit >= 0 ? "+" : ""}{formatKz(myRankEntry.profit)}
                    </div>
                  </div>
                </>
              )}
            </div>
            <p style={{ color: "#4b5563", fontSize: 11, textAlign: "center", marginTop: 14 }}>Actualizado automaticamente a cada 30s · só operações reais</p>
          </div>
        )}

        {/* ── TOURNAMENTS TAB ── */}
        {tab === "tournaments" && (
          <div>
            {loading && <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>A carregar...</div>}
            {activeTournaments.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: "#22c55e", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>EM CURSO</h3>
                {activeTournaments.map(t => <TournamentCard key={t.id} t={t} router={router} />)}
              </div>
            )}
            {upcomingTournaments.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: "#f5a623", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>PRÓXIMOS</h3>
                {upcomingTournaments.map(t => <TournamentCard key={t.id} t={t} router={router} />)}
              </div>
            )}
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
              </div>
            )}
          </div>
        )}

        {/* ── CONQUISTAS TAB ── */}
        {tab === "conquistas" && (
          <div>
            {/* Progress bar */}
            <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>As tuas conquistas</span>
                <span style={{ color: "#f5a623", fontWeight: 900, fontSize: 16 }}>{achUnlocked}/{achTotal}</span>
              </div>
              <div style={{ height: 8, background: "#1e2d50", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${achTotal ? Math.round(achUnlocked / achTotal * 100) : 0}%`, background: "linear-gradient(90deg, #f5a623, #fb923c)", borderRadius: 4, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>{achTotal ? Math.round(achUnlocked / achTotal * 100) : 0}% completo</div>
            </div>

            {loading && <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>A carregar...</div>}

            {Object.entries(achByCategory).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 20 }}>
                <h3 style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>{catLabels[cat] ?? cat}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {items.map((a: any) => (
                    <div key={a.id} style={{ background: a.unlocked ? "rgba(245,166,35,0.06)" : "#111827", border: `1px solid ${a.unlocked ? "rgba(245,166,35,0.3)" : "#1e2d50"}`, borderRadius: 12, padding: "14px 14px", opacity: a.unlocked ? 1 : 0.6, position: "relative", overflow: "hidden" }}>
                      {/* Rarity strip */}
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: RARITY_COLOR[a.rarity], opacity: a.unlocked ? 1 : 0.3 }} />
                      <div style={{ marginBottom: 6, color: RARITY_COLOR[a.rarity], opacity: a.unlocked ? 1 : 0.4 }}>{ACH_ICON[a.icon] ?? <Star size={20} />}</div>
                      <div style={{ color: a.unlocked ? "#fff" : "#94a3b8", fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{a.title}</div>
                      <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8, lineHeight: 1.4 }}>{a.description}</div>
                      {/* Progress bar */}
                      {!a.unlocked && (
                        <>
                          <div style={{ height: 4, background: "#1e2d50", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
                            <div style={{ height: "100%", width: `${a.progress}%`, background: RARITY_COLOR[a.rarity], borderRadius: 2 }} />
                          </div>
                          <div style={{ color: "#475569", fontSize: 10 }}>{a.detail}</div>
                        </>
                      )}
                      {a.unlocked && (
                        <div style={{ color: "#f5a623", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}><Check size={10} /> Desbloqueado</div>
                      )}
                      <div style={{ position: "absolute", top: 10, right: 10, color: RARITY_COLOR[a.rarity], fontSize: 9, fontWeight: 700, textTransform: "uppercase", opacity: 0.8 }}>{a.rarity}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {!loading && achievements.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <Star size={48} color="#1e2d50" style={{ marginBottom: 16 }} />
                <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>Faz o primeiro trade para desbloquear conquistas!</p>
              </div>
            )}
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
      style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "16px 18px", marginBottom: 10, cursor: "pointer" }}
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
          {new Date(t.startDate).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })} → {new Date(t.endDate).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Users size={12} />{t._count?.participants ?? 0} participantes</span>
        {t.status !== "finished" && (
          <span style={{ color: t.status === "active" ? "#22c55e" : "#f5a623" }}>
            {t.status === "active" ? `${Math.max(0, Math.ceil((new Date(t.endDate).getTime() - Date.now()) / 86400000))} dias restantes` : `Começa em ${Math.max(0, Math.ceil((new Date(t.startDate).getTime() - Date.now()) / 86400000))} dias`}
          </span>
        )}
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
