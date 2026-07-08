"use client";
import { formatKz } from "@/lib/format";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
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
  const border = medal ? `2.5px solid ${medal}` : entry.isMe ? "2px solid #ffffff" : "2px solid #1e2d50";
  const glow   = medal ? `0 0 12px ${medal}55` : "none";
  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto 8px" }}>
      {entry.avatar
        ? <img src={entry.avatar} alt={entry.name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border, boxShadow: glow }} />
        : <div style={{ width: size, height: size, borderRadius: "50%", background: entry.isMe ? "rgba(255,255,255,0.15)" : "#1e2d50", border, boxShadow: glow, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#ffffff", fontWeight: 800, fontSize: Math.round(size * 0.38) }}>{entry.name.charAt(0).toUpperCase()}</span>
          </div>
      }
      {crown && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)" }}><Crown size={16} color="#ffffff" fill="#ffffff" /></div>}
    </div>
  );
}

const MEDAL: Record<number, { icon: React.ReactNode; color: string }> = {
  1: { icon: <Trophy size={18} />, color: "#ffffff" },
  2: { icon: <Medal  size={18} />, color: "#94a3b8" },
  3: { icon: <Medal  size={18} />, color: "#cd7f32" },
};

const RARITY_COLOR: Record<string, string> = {
  common:    "#94a3b8",
  rare:      "#3b82f6",
  epic:      "#a78bfa",
  legendary: "#ffffff",
};

const PERIOD_OPTIONS = [
  { key: "today" },
  { key: "week"  },
  { key: "month" },
  { key: "all"   },
] as const;

type PeriodKey = typeof PERIOD_OPTIONS[number]["key"];

export default function RankingPage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const t = useT();
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
    ]).then(([r, tour, a]) => {
      setRanking(r.ranking ?? []);
      setMyPosition(r.myPosition ?? null);
      setMyRankEntry(r.myRankEntry ?? null);
      setTournaments(tour);
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

  const activeTournaments   = tournaments.filter(tour => tour.status === "active");
  const upcomingTournaments = tournaments.filter(tour => tour.status === "upcoming");
  const finishedTournaments = tournaments.filter(tour => tour.status === "finished");

  const achByCategory: Record<string, any[]> = {};
  for (const a of achievements) {
    (achByCategory[a.category] ??= []).push(a);
  }

  const timeSince = Math.floor((Date.now() - lastRefresh) / 1000);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/trade")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ width: 32, height: 32, background: "#ffffff", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trophy size={18} color="#0a0f1e" strokeWidth={2.5} />
        </div>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, flex: 1 }}>{t("ranking.title")}</span>
        {tab === "ranking" && (
          <button onClick={() => loadRanking(period)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
            <RefreshCw size={13} /> {timeSince}s
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#111827", borderBottom: "1px solid #1e2d50" }}>
        {([
          { key: "ranking",    tKey: "ranking.tab.ranking",      icon: <BarChart2 size={13} /> },
          { key: "tournaments",tKey: "ranking.tab.tournaments",  icon: <Trophy    size={13} /> },
          { key: "conquistas", tKey: "ranking.tab.achievements", icon: <Star      size={13} /> },
        ] as const).map(ti => (
          <button key={ti.key} onClick={() => setTab(ti.key)}
            style={{ flex: 1, padding: "13px 0", background: "none", border: "none", borderBottom: `2px solid ${tab === ti.key ? "#ffffff" : "transparent"}`, color: tab === ti.key ? "#ffffff" : "#64748b", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            {ti.icon}{t(ti.tKey)}
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
                  style={{ flex: 1, padding: "7px 0", background: period === p.key ? "#ffffff" : "transparent", color: period === p.key ? "#0a0f1e" : "#64748b", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  {t(`ranking.period.${p.key}`)}
                </button>
              ))}
            </div>

            {/* My position banner */}
            {myPosition && (
              <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>{t("ranking.myPosition")}</span>
                <span style={{ color: "#ffffff", fontWeight: 900, fontSize: 18 }}>#{myPosition}</span>
              </div>
            )}

            {/* Top 3 podium */}
            {ranking.length >= 3 && (
              <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "flex-end" }}>
                <div style={{ flex: 1, background: ranking[1].isMe ? "rgba(255,255,255,0.08)" : "#111827", border: `1px solid ${ranking[1].isMe ? "rgba(255,255,255,0.35)" : "#1e2d50"}`, borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
                  <AvatarCircle entry={ranking[1]} size={44} medal="#94a3b8" />
                  <div style={{ color: "#94a3b8", fontWeight: 800, fontSize: 11, marginBottom: 4 }}>2º</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{ranking[1].isMe ? t("ranking.me") : ranking[1].name.split(" ")[0]}</div>
                  <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 13 }}>{ranking[1].profit >= 0 ? "+" : ""}{formatKz(ranking[1].profit)}</div>
                </div>
                <div style={{ flex: 1, background: ranking[0].isMe ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 12, padding: "20px 12px", textAlign: "center" }}>
                  <AvatarCircle entry={ranking[0]} size={54} medal="#ffffff" crown />
                  <div style={{ color: "#ffffff", fontWeight: 800, fontSize: 11, marginBottom: 4 }}>1º</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{ranking[0].isMe ? t("ranking.me") : ranking[0].name.split(" ")[0]}</div>
                  <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 14 }}>{ranking[0].profit >= 0 ? "+" : ""}{formatKz(ranking[0].profit)}</div>
                </div>
                <div style={{ flex: 1, background: ranking[2].isMe ? "rgba(255,255,255,0.08)" : "#111827", border: `1px solid ${ranking[2].isMe ? "rgba(255,255,255,0.35)" : "#1e2d50"}`, borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
                  <AvatarCircle entry={ranking[2]} size={44} medal="#cd7f32" />
                  <div style={{ color: "#cd7f32", fontWeight: 800, fontSize: 11, marginBottom: 4 }}>3º</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{ranking[2].isMe ? t("ranking.me") : ranking[2].name.split(" ")[0]}</div>
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
              {loading && <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>{t("common.loading")}</div>}
              {!loading && ranking.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>{t("ranking.noData")}</div>}
              {ranking.map(e => {
                const medal = MEDAL[e.position];
                return (
                  <div key={e.position} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #0d1526", background: e.isMe ? "rgba(255,255,255,0.05)" : e.position <= 3 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                    <div style={{ width: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {medal ? <span style={{ color: medal.color }}>{medal.icon}</span> : <span style={{ color: e.isMe ? "#ffffff" : "#4b5563", fontSize: 13, fontWeight: 700 }}>{e.position}</span>}
                    </div>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: e.isMe ? "rgba(255,255,255,0.15)" : "#1e2d50", border: `2px solid ${e.isMe ? "#ffffff" : "#1e2d50"}`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 }}>
                      {e.avatar
                        ? <img src={e.avatar} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                        : <span style={{ color: "#ffffff", fontWeight: 800, fontSize: 14 }}>{e.name[0].toUpperCase()}</span>
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: e.isMe ? "#ffffff" : "#fff", fontWeight: 600, fontSize: 14 }}>{e.isMe ? t("ranking.me") : e.name}</div>
                      <div style={{ color: "#64748b", fontSize: 11 }}>{e.wins}/{e.total} {t("ranking.wins")}</div>
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
                  <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", background: "rgba(255,255,255,0.08)", borderTop: "1px solid rgba(255,255,255,0.2)" }}>
                    <div style={{ width: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ color: "#ffffff", fontSize: 13, fontWeight: 700 }}>{myRankEntry.position}</span>
                    </div>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "2px solid #ffffff", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 }}>
                      <span style={{ color: "#ffffff", fontWeight: 800, fontSize: 14 }}>T</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#ffffff", fontWeight: 700, fontSize: 14 }}>{t("ranking.me")}</div>
                      <div style={{ color: "#64748b", fontSize: 11 }}>{myRankEntry.wins}/{myRankEntry.total} {t("ranking.wins")}</div>
                    </div>
                    <div style={{ color: myRankEntry.profit >= 0 ? "#22c55e" : "#ef4444", fontWeight: 800, fontSize: 14 }}>
                      {myRankEntry.profit >= 0 ? "+" : ""}{formatKz(myRankEntry.profit)}
                    </div>
                  </div>
                </>
              )}
            </div>
            <p style={{ color: "#4b5563", fontSize: 11, textAlign: "center", marginTop: 14 }}>{t("ranking.autoUpdate")}</p>
          </div>
        )}

        {/* ── TOURNAMENTS TAB ── */}
        {tab === "tournaments" && (
          <div>
            {(session?.user as any)?.role === "admin" && (
              <button onClick={() => router.push("/ao/admin/tournaments")}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "linear-gradient(135deg,#ffffff,#cbd5e1)", border: "none", borderRadius: 12, padding: "13px", color: "#0a0f1e", fontWeight: 900, fontSize: 14, cursor: "pointer", marginBottom: 20 }}>
                <Trophy size={16} /> Criar / Gerir Torneios
              </button>
            )}
            {loading && <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>{t("common.loading")}</div>}
            {activeTournaments.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: "#22c55e", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>{t("ranking.status.active")}</h3>
                {activeTournaments.map(tour => <TournamentCard key={tour.id} tour={tour} router={router} />)}
              </div>
            )}
            {upcomingTournaments.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: "#ffffff", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>{t("ranking.status.upcoming")}</h3>
                {upcomingTournaments.map(tour => <TournamentCard key={tour.id} tour={tour} router={router} />)}
              </div>
            )}
            {finishedTournaments.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: "#64748b", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>{t("ranking.status.finished")}</h3>
                {finishedTournaments.map(tour => <TournamentCard key={tour.id} tour={tour} router={router} />)}
              </div>
            )}
            {!loading && tournaments.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <Trophy size={48} color="#1e2d50" style={{ marginBottom: 16 }} />
                <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>{t("ranking.noTournaments")}</p>
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
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{t("ranking.yourAchievements")}</span>
                <span style={{ color: "#ffffff", fontWeight: 900, fontSize: 16 }}>{achUnlocked}/{achTotal}</span>
              </div>
              <div style={{ height: 8, background: "#1e2d50", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${achTotal ? Math.round(achUnlocked / achTotal * 100) : 0}%`, background: "linear-gradient(90deg, #ffffff, #fb923c)", borderRadius: 4, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>{achTotal ? Math.round(achUnlocked / achTotal * 100) : 0}{t("ranking.pctComplete")}</div>
            </div>

            {loading && <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>{t("common.loading")}</div>}

            {Object.entries(achByCategory).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 20 }}>
                <h3 style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>{t(`ranking.cat.${cat}`) ?? cat}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {items.map((a: any) => (
                    <div key={a.id} style={{ background: a.unlocked ? "rgba(255,255,255,0.06)" : "#111827", border: `1px solid ${a.unlocked ? "rgba(255,255,255,0.3)" : "#1e2d50"}`, borderRadius: 12, padding: "14px 14px", opacity: a.unlocked ? 1 : 0.6, position: "relative", overflow: "hidden" }}>
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
                        <div style={{ color: "#ffffff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}><Check size={10} /> {t("ranking.unlocked")}</div>
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
                <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>{t("ranking.noAchievements")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TournamentCard({ tour, router }: { tour: any; router: any }) {
  const t = useT();
  const STATUS_LABEL: Record<string, string> = {
    upcoming: t("ranking.statusLabel.upcoming"),
    active:   t("ranking.statusLabel.active"),
    finished: t("ranking.statusLabel.finished"),
  };
  const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
    upcoming: { color: "#ffffff", bg: "rgba(255,255,255,0.12)" },
    active:   { color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
    finished: { color: "#64748b", bg: "rgba(100,116,139,0.12)"},
  };
  const s      = STATUS_COLOR[tour.status] ?? STATUS_COLOR.upcoming;
  const prizes = Array.isArray(tour.prizes) ? tour.prizes : [];
  const bannerColor = tour.bannerColor ?? "#ffffff";
  return (
    <div onClick={() => router.push(`/tournaments/${tour.id}`)}
      style={{ background: "#111827", border: `1px solid ${bannerColor}33`, borderRadius: 14, marginBottom: 10, cursor: "pointer", overflow: "hidden" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = bannerColor)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = `${bannerColor}33`)}>

      {/* Faixa de cor no topo */}
      <div style={{ height: 4, background: `linear-gradient(90deg,${bannerColor},${bannerColor}44,transparent)` }} />

      <div style={{ padding: "14px 16px" }}>
        {/* Linha 1 — nome + status */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Trophy size={15} color={bannerColor} />
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{tour.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: tour.isDemo ? "rgba(99,102,241,0.15)" : "rgba(14,203,129,0.12)", color: tour.isDemo ? "#a5b4fc" : "#0ecb81", borderRadius: 5, fontSize: 9, fontWeight: 800, padding: "2px 6px" }}>{tour.isDemo ? "DEMO" : "REAL"}</span>
            <span style={{ background: s.bg, color: s.color, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>{STATUS_LABEL[tour.status] ?? tour.status}</span>
            <ChevronRight size={14} color="#4b5563" />
          </div>
        </div>

        {tour.description && <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>{tour.description}</p>}

        {/* Linha 2 — meta-info */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: "#64748b", marginBottom: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Calendar size={11} />
            {new Date(tour.startDate).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })} → {new Date(tour.endDate).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={11} />{tour._count?.participants ?? 0}{tour.maxParticipants ? `/${tour.maxParticipants}` : ""} {t("ranking.participants")}</span>
          {tour.status !== "finished" && (
            <span style={{ color: tour.status === "active" ? "#22c55e" : "#ffffff", fontWeight: 700 }}>
              {tour.status === "active"
                ? `${Math.max(0, Math.ceil((new Date(tour.endDate).getTime() - Date.now()) / 86400000))} ${t("ranking.daysLeft")}`
                : `${t("ranking.startsIn")} ${Math.max(0, Math.ceil((new Date(tour.startDate).getTime() - Date.now()) / 86400000))} ${t("ranking.days")}`}
            </span>
          )}
        </div>

        {/* Linha 3 — badges de entrada, banca, recarga */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: prizes.length > 0 ? 10 : 0 }}>
          {tour.isFree
            ? <span style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "3px 8px" }}>Entrada gratuita</span>
            : <span style={{ background: "rgba(255,255,255,0.1)", color: "#ffffff", borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "3px 8px" }}>Entrada {formatKz(tour.entryFee)}</span>
          }
          {tour.startingBalance > 0 && (
            <span style={{ background: "rgba(99,102,241,0.1)", color: "#a5b4fc", borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "3px 8px" }}>Banca {formatKz(tour.startingBalance)}</span>
          )}
          {tour.rechargeAmount > 0 && (
            <span style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "3px 8px" }}>Recarga {formatKz(tour.rechargeAmount)}</span>
          )}
          {tour.prizePool > 0 && (
            <span style={{ background: `rgba(${bannerColor === "#ffffff" ? "255,255,255" : "14,203,129"},0.1)`, color: bannerColor, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "3px 8px" }}>Prémio {formatKz(tour.prizePool)}</span>
          )}
        </div>

        {/* Prémios top 3 */}
        {prizes.length > 0 && (
          <div style={{ display: "flex", gap: 6 }}>
            {prizes.slice(0, 3).map((p: any, i: number) => (
              <div key={i} style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 6, padding: "3px 9px", fontSize: 11, color: i === 0 ? "#ffffff" : i === 1 ? "#94a3b8" : "#b45309", fontWeight: 700 }}>
                {i + 1}º {(p.amount as number).toLocaleString("pt-PT")} Kz
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
