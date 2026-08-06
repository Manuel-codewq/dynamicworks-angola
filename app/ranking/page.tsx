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

const RANK_CSS = `
@keyframes rankFadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
@keyframes crownFloat  { 0%,100% { transform:translateX(-50%) translateY(0); } 50% { transform:translateX(-50%) translateY(-4px); } }
@keyframes goldGlow    { 0%,100% { box-shadow:0 0 0 0 rgba(255,215,0,0); } 50% { box-shadow:0 0 20px 4px rgba(255,215,0,0.18); } }
@keyframes silverGlow  { 0%,100% { box-shadow:0 0 0 0 rgba(148,163,184,0); } 50% { box-shadow:0 0 14px 3px rgba(148,163,184,0.15); } }
@keyframes bronzeGlow  { 0%,100% { box-shadow:0 0 0 0 rgba(205,127,50,0); } 50% { box-shadow:0 0 12px 3px rgba(205,127,50,0.12); } }
.rank-row { animation: rankFadeUp 0.35s ease both; }
.rank-row:nth-child(1) { animation-delay:0.04s }
.rank-row:nth-child(2) { animation-delay:0.08s }
.rank-row:nth-child(3) { animation-delay:0.12s }
.rank-row:nth-child(4) { animation-delay:0.16s }
.rank-row:nth-child(5) { animation-delay:0.20s }
.rank-row:nth-child(6) { animation-delay:0.24s }
.rank-row:nth-child(7) { animation-delay:0.28s }
.rank-row:nth-child(8) { animation-delay:0.32s }
.rank-row:nth-child(9) { animation-delay:0.36s }
.rank-row:nth-child(n+10) { animation-delay:0.40s }
`;

const ACH_ICON: Record<string, React.ReactNode> = {
  target:         <Target       size={20} />,
  flame:          <Flame        size={20} />,
  dumbbell:       <Dumbbell     size={20} />,
  medal:          <Medal        size={20} />,
  swords:         <Swords       size={20} />,
  star:           <Star         size={20} />,
  sparkles:       <Sparkles     size={20} />,
  gem:            <Gem          size={20} />,
  crown:          <Crown        size={20} />,
  award:          <Award        size={20} />,
  zap:            <Zap          size={20} />,
  wallet:         <Wallet       size={20} />,
  rocket:         <Rocket       size={20} />,
  "trending-up":  <TrendingUp   size={20} />,
  calendar:       <Calendar     size={20} />,
  "calendar-days":<CalendarDays size={20} />,
  globe:          <Globe        size={20} />,
  banknote:       <Banknote     size={20} />,
  trophy:         <Trophy       size={20} />,
};

interface RankEntry {
  position: number; name: string; avatar: string | null;
  profit: number; wins: number; total: number; winRate: number; isMe?: boolean;
}

const RARITY_COLOR: Record<string, string> = {
  common:    "#94a3b8",
  rare:      "#3b82f6",
  epic:      "#a78bfa",
  legendary: "#fbbf24",
};

// O ranking público mostra só o dia de hoje. Semana, mês e geral existem
// apenas no painel do admin — ver app/ao/admin/ranking.
type PeriodKey = "today";

// ── Avatar com borda e glow ───────────────────────────────────────────────────
function Avatar({ entry, size = 40, borderColor = "#1e2d50", glow }: {
  entry: RankEntry; size?: number; borderColor?: string; glow?: string;
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2.5px solid ${borderColor}`,
      boxShadow: glow ? `0 0 14px ${glow}` : "none",
      flexShrink: 0, overflow: "hidden",
      background: "#1e2d50",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {entry.avatar
        ? <img src={entry.avatar} alt={entry.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ color: "#fff", fontWeight: 800, fontSize: Math.round(size * 0.38) }}>{entry.name[0].toUpperCase()}</span>
      }
    </div>
  );
}

// ── Pódio 3D ─────────────────────────────────────────────────────────────────
function Podium({ top3 }: { top3: RankEntry[] }) {
  const [first, second, third] = top3;
  const t = useT();
  const me = (e: RankEntry) => e.isMe ? t("ranking.me") : e.name.split(" ")[0];

  const steps = [
    { entry: second, pos: "2º", stepH: 60, stepBg: "linear-gradient(180deg,#2d3748 0%,#1e2a3d 100%)", numColor: "#94a3b8", border: "rgba(148,163,184,0.25)", anim: "silverGlow 3s ease-in-out infinite", avatarSize: 52, borderC: "#94a3b8", glowC: "rgba(148,163,184,0.4)" },
    { entry: first,  pos: "1º", stepH: 92, stepBg: "linear-gradient(180deg,#4a3100 0%,#2d1e00 100%)", numColor: "#FFD700", border: "rgba(255,215,0,0.4)",    anim: "goldGlow 2.8s ease-in-out infinite",   avatarSize: 66, borderC: "#FFD700", glowC: "rgba(255,215,0,0.55)"    },
    { entry: third,  pos: "3º", stepH: 44, stepBg: "linear-gradient(180deg,#292210 0%,#1a1508 100%)", numColor: "#cd7f32", border: "rgba(205,127,50,0.25)", anim: "bronzeGlow 3.2s ease-in-out infinite", avatarSize: 46, borderC: "#cd7f32", glowC: "rgba(205,127,50,0.35)"  },
  ];

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Glow de fundo centrado */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, position: "relative" }}>
        {/* Halo dourado atrás do 1º */}
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,215,0,0.07) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

        {steps.map(({ entry, pos, stepH, stepBg, numColor, border, anim, avatarSize, borderC, glowC }) => (
          <div key={pos} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1 }}>
            {/* Crown para o 1º */}
            {pos === "1º" && (
              <div style={{ position: "relative", width: 24, height: 20, marginBottom: 2 }}>
                <Crown size={22} color="#FFD700" fill="#FFD700" style={{ position: "absolute", left: "50%", animation: "crownFloat 2s ease-in-out infinite", transformOrigin: "bottom center" }} />
              </div>
            )}

            {/* Avatar */}
            <Avatar entry={entry} size={avatarSize} borderColor={borderC} glow={glowC} />

            {/* Nome */}
            <div style={{ color: "#fff", fontWeight: 700, fontSize: pos === "1º" ? 13 : 11, marginTop: 6, marginBottom: 2, textAlign: "center", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 4px" }}>
              {me(entry)}
            </div>

            {/* Lucro */}
            <div style={{ color: entry.profit >= 0 ? "#00c076" : "#ff3b5c", fontWeight: 800, fontSize: pos === "1º" ? 13 : 11, marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>
              {entry.profit >= 0 ? "+" : ""}{formatKz(entry.profit)}
            </div>

            {/* Degrau */}
            <div style={{
              width: "100%", height: stepH, borderRadius: "8px 8px 0 0",
              background: stepBg,
              border: `1px solid ${border}`, borderBottom: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: anim,
            }}>
              <span style={{ color: numColor, fontWeight: 900, fontSize: pos === "1º" ? 28 : 20, fontVariantNumeric: "tabular-nums" }}>{pos === "1º" ? "1" : pos === "2º" ? "2" : "3"}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Base do pódio */}
      <div style={{ height: 6, background: "linear-gradient(90deg,#1a2540,#2d3e6b 50%,#1a2540)", borderRadius: "0 0 8px 8px" }} />
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function RankingPage() {
  const { status, data: session } = useSession();
  const router  = useRouter();
  const t       = useT();
  const [tab,          setTab]          = useState<"ranking" | "tournaments" | "conquistas">("ranking");
  const [ranking,      setRanking]      = useState<RankEntry[]>([]);
  const [myPosition,   setMyPosition]   = useState<number | null>(null);
  const [myRankEntry,  setMyRankEntry]  = useState<RankEntry | null>(null);
  const [tournaments,  setTournaments]  = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [achUnlocked,  setAchUnlocked]  = useState(0);
  const [achTotal,     setAchTotal]     = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [period]                        = useState<PeriodKey>("today");
  const [lastRefresh,  setLastRefresh]  = useState(Date.now());

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

  useEffect(() => {
    if (tab !== "ranking") return;
    const id = setInterval(() => loadRanking(period), 30_000);
    return () => clearInterval(id);
  }, [tab, period, loadRanking]);

  const activeTournaments   = tournaments.filter(t => t.status === "active");
  const upcomingTournaments = tournaments.filter(t => t.status === "upcoming");
  const finishedTournaments = tournaments.filter(t => t.status === "finished");

  const achByCategory: Record<string, any[]> = {};
  for (const a of achievements) (achByCategory[a.category] ??= []).push(a);

  const timeSince = Math.floor((Date.now() - lastRefresh) / 1000);

  // Cores por posição
  const posStyle = (pos: number) => {
    if (pos === 1) return { border: "rgba(255,215,0,0.18)", bg: "rgba(255,215,0,0.04)", accent: "#FFD700" };
    if (pos === 2) return { border: "rgba(148,163,184,0.15)", bg: "rgba(148,163,184,0.03)", accent: "#94a3b8" };
    if (pos === 3) return { border: "rgba(205,127,50,0.15)", bg: "rgba(205,127,50,0.03)", accent: "#cd7f32" };
    return { border: "#0d1526", bg: "transparent", accent: "#4b5563" };
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif" }}>
      <style>{RANK_CSS}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg,#111827 0%,#0d1526 100%)", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/trade")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#FFD700,#f59e0b)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px rgba(255,215,0,0.3)" }}>
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
      <div style={{ display: "flex", background: "#0d1526", borderBottom: "1px solid #1e2d50" }}>
        {([
          { key: "ranking",     tKey: "ranking.tab.ranking",     icon: <BarChart2 size={13} /> },
          { key: "tournaments", tKey: "ranking.tab.tournaments", icon: <Trophy    size={13} /> },
          { key: "conquistas",  tKey: "ranking.tab.achievements",icon: <Star      size={13} /> },
        ] as const).map(ti => (
          <button key={ti.key} onClick={() => setTab(ti.key)}
            style={{ flex: 1, padding: "13px 0", background: "none", border: "none", borderBottom: `2px solid ${tab === ti.key ? "#00c076" : "transparent"}`, color: tab === ti.key ? "#00c076" : "#64748b", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "color 0.15s, border-color 0.15s" }}>
            {ti.icon}{t(ti.tKey)}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>

        {/* ── RANKING TAB ── */}
        {tab === "ranking" && (
          <div>
            {/* Só o dia de hoje. O período é fixado no servidor. */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 24, background: "#111827", border: "1px solid #1e2d50", borderRadius: 10, padding: "10px 12px" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00c076" }} />
              <span style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 12 }}>{t("ranking.period.today")}</span>
              <span style={{ color: "#64748b", fontSize: 11 }}>
                {new Date().toLocaleDateString("pt-AO", { day: "2-digit", month: "long" })}
              </span>
            </div>

            {/* Pódio */}
            {!loading && ranking.length >= 3 && <Podium top3={ranking.slice(0, 3)} />}

            {/* Banner — a minha posição */}
            {myPosition && (
              <div style={{ background: "linear-gradient(135deg,rgba(0,192,118,0.1) 0%,rgba(0,192,118,0.04) 100%)", border: "1px solid rgba(0,192,118,0.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,192,118,0.15)", border: "2px solid #00c076", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#00c076", fontWeight: 900, fontSize: 14 }}>{myPosition}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#00c076", fontWeight: 800, fontSize: 12, letterSpacing: 0.5 }}>{t("ranking.myPosition")}</div>
                  {myRankEntry && <div style={{ color: "#64748b", fontSize: 11, marginTop: 1 }}>{myRankEntry.wins}V · {myRankEntry.total} trades · {myRankEntry.winRate}% win rate</div>}
                </div>
                {myRankEntry && (
                  <div style={{ color: myRankEntry.profit >= 0 ? "#00c076" : "#ff3b5c", fontWeight: 900, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>
                    {myRankEntry.profit >= 0 ? "+" : ""}{formatKz(myRankEntry.profit)}
                  </div>
                )}
              </div>
            )}

            {/* Lista completa */}
            <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e2d50", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#4b5563", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Trader</span>
                <span style={{ color: "#4b5563", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Lucro · Win Rate</span>
              </div>

              {loading && <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>{t("common.loading")}</div>}
              {!loading && ranking.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>{t("ranking.noData")}</div>}

              {ranking.map(e => {
                const ps = posStyle(e.position);
                const winColor = e.winRate >= 55 ? "#00c076" : e.winRate >= 45 ? "#fbbf24" : "#ff3b5c";
                return (
                  <div key={e.position} className="rank-row" style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderBottom: `1px solid ${ps.border}`, background: e.isMe ? "rgba(0,192,118,0.06)" : ps.bg, borderLeft: e.position <= 3 ? `3px solid ${ps.accent}` : "3px solid transparent" }}>

                    {/* Posição */}
                    <div style={{ width: 28, flexShrink: 0, textAlign: "center" }}>
                      {e.position === 1 && <Trophy size={16} color="#FFD700" />}
                      {e.position === 2 && <Medal  size={16} color="#94a3b8" />}
                      {e.position === 3 && <Medal  size={16} color="#cd7f32" />}
                      {e.position > 3  && <span style={{ color: e.isMe ? "#00c076" : "#4b5563", fontSize: 13, fontWeight: 700 }}>{e.position}</span>}
                    </div>

                    {/* Avatar */}
                    <div style={{ marginRight: 10 }}>
                      <Avatar entry={e} size={36} borderColor={e.isMe ? "#00c076" : e.position <= 3 ? ps.accent : "#1e2d50"} />
                    </div>

                    {/* Nome + wins */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: e.isMe ? "#00c076" : "#fff", fontWeight: e.isMe ? 800 : 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {e.isMe ? `${t("ranking.me")} ·  Tu` : e.name}
                      </div>
                      <div style={{ color: "#4b5563", fontSize: 11, marginTop: 1 }}>{e.wins}V / {e.total} trades</div>
                    </div>

                    {/* Lucro + win rate */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ color: e.profit >= 0 ? "#00c076" : "#ff3b5c", fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                        {e.profit >= 0 ? "+" : ""}{formatKz(e.profit)}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 3 }}>
                        <div style={{ width: 44, height: 3, background: "#1e2d50", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${e.winRate}%`, height: "100%", background: winColor, borderRadius: 2, transition: "width 0.5s ease" }} />
                        </div>
                        <span style={{ color: winColor, fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{e.winRate}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Utilizador fora do top 20 */}
              {myRankEntry && !ranking.find(e => e.isMe) && (
                <>
                  <div style={{ padding: "6px 16px", textAlign: "center", color: "#1e2d50", fontSize: 18, letterSpacing: 6 }}>· · ·</div>
                  <div style={{ display: "flex", alignItems: "center", padding: "11px 16px", background: "rgba(0,192,118,0.07)", borderTop: "1px solid rgba(0,192,118,0.2)", borderLeft: "3px solid #00c076" }}>
                    <div style={{ width: 28, flexShrink: 0, textAlign: "center" }}>
                      <span style={{ color: "#00c076", fontSize: 13, fontWeight: 700 }}>{myRankEntry.position}</span>
                    </div>
                    <div style={{ marginRight: 10 }}>
                      <Avatar entry={myRankEntry} size={36} borderColor="#00c076" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#00c076", fontWeight: 800, fontSize: 14 }}>{t("ranking.me")}</div>
                      <div style={{ color: "#4b5563", fontSize: 11 }}>{myRankEntry.wins}V / {myRankEntry.total} trades</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: myRankEntry.profit >= 0 ? "#00c076" : "#ff3b5c", fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                        {myRankEntry.profit >= 0 ? "+" : ""}{formatKz(myRankEntry.profit)}
                      </div>
                      <span style={{ color: myRankEntry.winRate >= 50 ? "#00c076" : "#ff3b5c", fontSize: 10, fontWeight: 700 }}>{myRankEntry.winRate}%</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <p style={{ color: "#4b5563", fontSize: 11, textAlign: "center", marginTop: 14 }}>{t("ranking.autoUpdate")}</p>
          </div>
        )}

        {/* ── TORNEIOS TAB ── */}
        {tab === "tournaments" && (
          <div>
            {(session?.user as any)?.role === "admin" && (
              <button onClick={() => router.push("/ao/admin/tournaments")}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "linear-gradient(135deg,#FFD700,#f59e0b)", border: "none", borderRadius: 12, padding: "13px", color: "#0a0f1e", fontWeight: 900, fontSize: 14, cursor: "pointer", marginBottom: 20, boxShadow: "0 4px 16px rgba(255,215,0,0.25)" }}>
                <Trophy size={16} /> Criar / Gerir Torneios
              </button>
            )}
            {loading && <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>{t("common.loading")}</div>}
            {activeTournaments.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: "#00c076", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>{t("ranking.status.active")}</h3>
                {activeTournaments.map(tour => <TournamentCard key={tour.id} tour={tour} router={router} />)}
              </div>
            )}
            {upcomingTournaments.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: "#ffffff", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>{t("ranking.status.upcoming")}</h3>
                {upcomingTournaments.map(tour => <TournamentCard key={tour.id} tour={tour} router={router} />)}
              </div>
            )}
            {finishedTournaments.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: "#4b5563", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>{t("ranking.status.finished")}</h3>
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
            {/* Barra de progresso */}
            <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{t("ranking.yourAchievements")}</span>
                <span style={{ color: "#00c076", fontWeight: 900, fontSize: 16 }}>{achUnlocked}/{achTotal}</span>
              </div>
              <div style={{ height: 8, background: "#1e2d50", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${achTotal ? Math.round(achUnlocked / achTotal * 100) : 0}%`, background: "linear-gradient(90deg,#00c076,#fbbf24)", borderRadius: 4, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ color: "#4b5563", fontSize: 12, marginTop: 6 }}>{achTotal ? Math.round(achUnlocked / achTotal * 100) : 0}{t("ranking.pctComplete")}</div>
            </div>

            {loading && <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>{t("common.loading")}</div>}

            {Object.entries(achByCategory).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 20 }}>
                <h3 style={{ color: "#4b5563", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>{t(`ranking.cat.${cat}`) ?? cat}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {items.map((a: any) => {
                    const rc = RARITY_COLOR[a.rarity];
                    const isLegendary = a.rarity === "legendary";
                    return (
                      <div key={a.id} style={{
                        background: a.unlocked ? "rgba(255,255,255,0.05)" : "#111827",
                        border: `1px solid ${a.unlocked ? `${rc}50` : "#1e2d50"}`,
                        borderRadius: 12, padding: "14px",
                        opacity: a.unlocked ? 1 : 0.6, position: "relative", overflow: "hidden",
                        boxShadow: a.unlocked && isLegendary ? `0 0 18px ${rc}30` : "none",
                        animation: a.unlocked && isLegendary ? "goldGlow 3s ease-in-out infinite" : "none",
                      }}>
                        {/* Faixa de raridade no topo */}
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: rc, opacity: a.unlocked ? 1 : 0.3 }} />

                        <div style={{ marginBottom: 8, color: rc, opacity: a.unlocked ? 1 : 0.4 }}>{ACH_ICON[a.icon] ?? <Star size={20} />}</div>
                        <div style={{ color: a.unlocked ? "#fff" : "#94a3b8", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{a.title}</div>
                        <div style={{ color: "#4b5563", fontSize: 11, marginBottom: 8, lineHeight: 1.4 }}>{a.description}</div>

                        {!a.unlocked && (
                          <>
                            <div style={{ height: 3, background: "#1e2d50", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
                              <div style={{ height: "100%", width: `${a.progress}%`, background: rc, borderRadius: 2, transition: "width 0.6s ease" }} />
                            </div>
                            <div style={{ color: "#374151", fontSize: 10 }}>{a.detail}</div>
                          </>
                        )}
                        {a.unlocked && (
                          <div style={{ color: rc, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                            <Check size={10} /> {t("ranking.unlocked")}
                          </div>
                        )}
                        <div style={{ position: "absolute", top: 9, right: 10, color: rc, fontSize: 9, fontWeight: 700, textTransform: "uppercase", opacity: 0.7 }}>{a.rarity}</div>
                      </div>
                    );
                  })}
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

// ── Tournament Card ───────────────────────────────────────────────────────────
function TournamentCard({ tour, router }: { tour: any; router: any }) {
  const t = useT();
  const STATUS_LABEL: Record<string, string> = {
    upcoming: t("ranking.statusLabel.upcoming"),
    active:   t("ranking.statusLabel.active"),
    finished: t("ranking.statusLabel.finished"),
  };
  const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
    upcoming: { color: "#ffffff",  bg: "rgba(255,255,255,0.1)"  },
    active:   { color: "#00c076", bg: "rgba(0,192,118,0.1)"    },
    finished: { color: "#64748b", bg: "rgba(100,116,139,0.1)"  },
  };
  const s      = STATUS_COLOR[tour.status] ?? STATUS_COLOR.upcoming;
  const prizes = Array.isArray(tour.prizes) ? tour.prizes : [];
  const bannerColor = tour.bannerColor ?? "#ffffff";
  const participants = tour._count?.participants ?? 0;
  const maxP = tour.maxParticipants ?? 0;
  const fillPct = maxP > 0 ? Math.min(100, Math.round(participants / maxP * 100)) : 0;

  return (
    <div onClick={() => router.push(`/tournaments/${tour.id}`)}
      style={{ background: "#111827", border: `1px solid ${bannerColor}30`, borderRadius: 14, marginBottom: 10, cursor: "pointer", overflow: "hidden", transition: "border-color 0.15s" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = `${bannerColor}80`)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = `${bannerColor}30`)}>

      <div style={{ height: 4, background: `linear-gradient(90deg,${bannerColor},${bannerColor}44,transparent)` }} />

      <div style={{ padding: "14px 16px" }}>
        {/* Nome + status */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Trophy size={15} color={bannerColor} />
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{tour.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: tour.isDemo ? "rgba(99,102,241,0.15)" : "rgba(0,192,118,0.12)", color: tour.isDemo ? "#a5b4fc" : "#00c076", borderRadius: 5, fontSize: 9, fontWeight: 800, padding: "2px 6px" }}>{tour.isDemo ? "DEMO" : "REAL"}</span>
            <span style={{ background: s.bg, color: s.color, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>{STATUS_LABEL[tour.status] ?? tour.status}</span>
            <ChevronRight size={14} color="#4b5563" />
          </div>
        </div>

        {tour.description && <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>{tour.description}</p>}

        {/* Datas + participantes */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: "#64748b", marginBottom: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Calendar size={11} />
            {new Date(tour.startDate).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })} → {new Date(tour.endDate).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={11} />{participants}{maxP ? `/${maxP}` : ""} {t("ranking.participants")}</span>
          {tour.status !== "finished" && (
            <span style={{ color: tour.status === "active" ? "#00c076" : "#ffffff", fontWeight: 700 }}>
              {tour.status === "active"
                ? `${Math.max(0, Math.ceil((new Date(tour.endDate).getTime() - Date.now()) / 86400000))} ${t("ranking.daysLeft")}`
                : `${t("ranking.startsIn")} ${Math.max(0, Math.ceil((new Date(tour.startDate).getTime() - Date.now()) / 86400000))} ${t("ranking.days")}`}
            </span>
          )}
        </div>

        {/* Barra de vagas preenchidas */}
        {maxP > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ color: "#4b5563", fontSize: 10 }}>Vagas preenchidas</span>
              <span style={{ color: fillPct >= 90 ? "#ff3b5c" : "#4b5563", fontSize: 10, fontWeight: 700 }}>{fillPct}%</span>
            </div>
            <div style={{ height: 3, background: "#1e2d50", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${fillPct}%`, background: fillPct >= 90 ? "#ff3b5c" : fillPct >= 70 ? "#fbbf24" : "#00c076", borderRadius: 2, transition: "width 0.5s ease" }} />
            </div>
          </div>
        )}

        {/* Badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: prizes.length > 0 ? 10 : 0 }}>
          {tour.isFree
            ? <span style={{ background: "rgba(0,192,118,0.1)", color: "#00c076", borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "3px 8px" }}>Entrada gratuita</span>
            : <span style={{ background: "rgba(255,255,255,0.08)", color: "#ffffff", borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "3px 8px" }}>Entrada {formatKz(tour.entryFee)}</span>
          }
          {tour.startingBalance > 0 && (
            <span style={{ background: "rgba(99,102,241,0.1)", color: "#a5b4fc", borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "3px 8px" }}>Banca {formatKz(tour.startingBalance)}</span>
          )}
          {tour.rechargeAmount > 0 && (
            <span style={{ background: "rgba(255,59,92,0.1)", color: "#ff3b5c", borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "3px 8px" }}>Recarga {formatKz(tour.rechargeAmount)}</span>
          )}
          {tour.prizePool > 0 && (
            <span style={{ background: "rgba(255,215,0,0.1)", color: "#FFD700", borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "3px 8px" }}>Prémio {formatKz(tour.prizePool)}</span>
          )}
        </div>

        {/* Prémios top 3 */}
        {prizes.length > 0 && (
          <div style={{ display: "flex", gap: 6 }}>
            {prizes.slice(0, 3).map((p: any, i: number) => (
              <div key={i} style={{ background: "#0d1526", border: `1px solid ${i === 0 ? "rgba(255,215,0,0.3)" : i === 1 ? "rgba(148,163,184,0.2)" : "rgba(205,127,50,0.2)"}`, borderRadius: 6, padding: "3px 9px", fontSize: 11, color: i === 0 ? "#FFD700" : i === 1 ? "#94a3b8" : "#cd7f32", fontWeight: 700 }}>
                {i + 1}º {(p.amount as number).toLocaleString("pt-PT")} Kz
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
