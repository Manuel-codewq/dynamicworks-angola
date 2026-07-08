"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Target, Flame, Dumbbell, Medal, Shield, Star,
  Sparkles, Gem, Crown, Award, Zap, Wallet, Rocket,
  TrendingUp, Calendar, CalendarDays, Globe, Banknote, Trophy, Lock,
} from "lucide-react";
import type { Achievement } from "@/app/api/achievements/route";

type CategoryFilter = "all" | Achievement["category"];
type RarityFilter = "all" | Achievement["rarity"];

const RARITY_CFG: Record<Achievement["rarity"], { label: string; color: string; bg: string; border: string }> = {
  common:    { label: "Comum",    color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)" },
  rare:      { label: "Raro",     color: "#38bdf8", bg: "rgba(56,189,248,0.08)",  border: "rgba(56,189,248,0.2)"  },
  epic:      { label: "Épico",    color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)" },
  legendary: { label: "Lendário", color: "#f5a623", bg: "rgba(245,166,35,0.10)",  border: "rgba(245,166,35,0.3)"  },
};

const CAT_TABS: { key: CategoryFilter; label: string }[] = [
  { key: "all",     label: "Todas"      },
  { key: "trades",  label: "Operações"  },
  { key: "wins",    label: "Vitórias"   },
  { key: "streak",  label: "Sequências" },
  { key: "volume",  label: "Volume"     },
  { key: "special", label: "Especial"   },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  "target":       <Target        size={22} />,
  "flame":        <Flame         size={22} />,
  "dumbbell":     <Dumbbell      size={22} />,
  "medal":        <Medal         size={22} />,
  "swords":       <Shield        size={22} />,
  "star":         <Star          size={22} />,
  "sparkles":     <Sparkles      size={22} />,
  "gem":          <Gem           size={22} />,
  "crown":        <Crown         size={22} />,
  "award":        <Award         size={22} />,
  "zap":          <Zap           size={22} />,
  "wallet":       <Wallet        size={22} />,
  "rocket":       <Rocket        size={22} />,
  "trending-up":  <TrendingUp    size={22} />,
  "calendar":     <Calendar      size={22} />,
  "calendar-days":<CalendarDays  size={22} />,
  "globe":        <Globe         size={22} />,
  "banknote":     <Banknote      size={22} />,
  "trophy":       <Trophy        size={22} />,
};

function AchievementCard({ a }: { a: Achievement }) {
  const r = RARITY_CFG[a.rarity];
  const icon = ICON_MAP[a.icon] ?? <Star size={22} />;

  return (
    <div style={{
      background: a.unlocked
        ? `linear-gradient(135deg, #111827 0%, #0f1e38 100%)`
        : "#0d1525",
      border: `1px solid ${a.unlocked ? r.border : "rgba(30,45,80,0.5)"}`,
      borderRadius: 14,
      padding: 16,
      position: "relative",
      overflow: "hidden",
      opacity: a.unlocked ? 1 : 0.6,
      transition: "opacity .2s",
    }}>
      {/* Glow unlocked */}
      {a.unlocked && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(circle at top right, ${r.color}12 0%, transparent 65%)`,
        }} />
      )}

      {/* Locked overlay */}
      {!a.unlocked && (
        <div style={{ position: "absolute", top: 10, right: 10 }}>
          <Lock size={13} color="#334155" />
        </div>
      )}

      {/* Rarity badge */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: r.bg, border: `1px solid ${r.border}`,
        borderRadius: 20, padding: "2px 8px", marginBottom: 10,
      }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: r.color }} />
        <span style={{ color: r.color, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {r.label}
        </span>
      </div>

      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 12, marginBottom: 10,
        background: a.unlocked ? r.bg : "rgba(30,45,80,0.3)",
        border: `1px solid ${a.unlocked ? r.border : "rgba(30,45,80,0.5)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: a.unlocked ? r.color : "#334155",
      }}>
        {icon}
      </div>

      {/* Title + desc */}
      <div style={{ color: a.unlocked ? "#fff" : "#475569", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
        {a.title}
      </div>
      <div style={{ color: "#475569", fontSize: 11, marginBottom: 10, lineHeight: 1.4 }}>
        {a.description}
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "rgba(30,45,80,0.6)", borderRadius: 4, marginBottom: 5, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 4,
          width: `${a.progress}%`,
          background: a.unlocked
            ? `linear-gradient(90deg, ${r.color}, ${r.color}aa)`
            : "rgba(100,116,139,0.4)",
          transition: "width .5s ease",
        }} />
      </div>

      {/* Detail */}
      <div style={{ color: a.unlocked ? r.color : "#334155", fontSize: 10, fontWeight: 700 }}>
        {a.unlocked ? "✓ " : ""}{a.detail}
      </div>
    </div>
  );
}

export default function AchievementsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<{ achievements: Achievement[]; unlocked: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<CategoryFilter>("all");

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/achievements")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [status]);

  const filtered = data?.achievements.filter(a => cat === "all" || a.category === cat) ?? [];
  const unlockedFiltered = filtered.filter(a => a.unlocked).length;

  const pct = data ? Math.round((data.unlocked / data.total) * 100) : 0;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#070d1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #1e2d50", borderTopColor: "#f5a623", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#070d1a", fontFamily: "system-ui,-apple-system,sans-serif", paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, color: "#94a3b8" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ width: 34, height: 34, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trophy size={18} color="#f5a623" />
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Conquistas</div>
          <div style={{ color: "#64748b", fontSize: 12 }}>Os teus feitos na plataforma</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>

        {/* Summary card */}
        <div style={{ background: "linear-gradient(135deg, #111827 0%, #0f1e38 100%)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 16, padding: "20px 22px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, background: "radial-gradient(circle, rgba(245,166,35,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 60, height: 60, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Trophy size={28} color="#f5a623" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 22 }}>
                {data?.unlocked ?? 0}
                <span style={{ color: "#334155", fontSize: 16, fontWeight: 600 }}> / {data?.total ?? 0}</span>
              </div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>conquistas desbloqueadas</div>
              {/* Progress bar */}
              <div style={{ height: 6, background: "rgba(30,45,80,0.8)", borderRadius: 4, marginTop: 10, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, #f5a623, #e8950f)",
                  transition: "width .6s ease",
                }} />
              </div>
              <div style={{ color: "#f5a623", fontSize: 11, fontWeight: 700, marginTop: 5 }}>{pct}% completo</div>
            </div>
          </div>

          {/* Rarity legend */}
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            {(Object.entries(RARITY_CFG) as [Achievement["rarity"], typeof RARITY_CFG[Achievement["rarity"]]][]).map(([key, r]) => {
              const count = data?.achievements.filter(a => a.rarity === key && a.unlocked).length ?? 0;
              const total = data?.achievements.filter(a => a.rarity === key).length ?? 0;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 5, background: r.bg, border: `1px solid ${r.border}`, borderRadius: 20, padding: "4px 10px" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: r.color }} />
                  <span style={{ color: r.color, fontSize: 10, fontWeight: 700 }}>{r.label}: {count}/{total}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18, overflowX: "auto", paddingBottom: 4 }}>
          {CAT_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setCat(tab.key)}
              style={{
                background: cat === tab.key ? "#f5a623" : "rgba(255,255,255,0.04)",
                color: cat === tab.key ? "#0a0f1e" : "#94a3b8",
                border: cat === tab.key ? "none" : "1px solid #1e2d50",
                borderRadius: 20, padding: "7px 14px", fontSize: 12, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Count for current filter */}
        <div style={{ color: "#475569", fontSize: 12, marginBottom: 14 }}>
          {unlockedFiltered} de {filtered.length} desbloqueadas
        </div>

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Unlocked first */}
          {[...filtered.filter(a => a.unlocked), ...filtered.filter(a => !a.unlocked)].map(a => (
            <AchievementCard key={a.id} a={a} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <Trophy size={40} color="#1e2d50" style={{ marginBottom: 12 }} />
            <div style={{ color: "#475569", fontSize: 14 }}>Nenhuma conquista nesta categoria</div>
          </div>
        )}
      </div>
    </div>
  );
}
