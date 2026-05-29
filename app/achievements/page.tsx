"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Trophy, Target, Flame, Dumbbell, Medal, Swords,
  Star, Sparkles, Gem, Crown, Award, Zap,
  Wallet, Rocket, TrendingUp, Calendar, Globe, Banknote,
  ChevronLeft, Lock,
} from "lucide-react";
import type { Achievement } from "@/app/api/achievements/route";

const ICON_MAP: Record<string, React.ElementType> = {
  target: Target, flame: Flame, dumbbell: Dumbbell, medal: Medal,
  swords: Swords, star: Star, sparkles: Sparkles, gem: Gem,
  crown: Crown, award: Award, zap: Zap, wallet: Wallet,
  rocket: Rocket, "trending-up": TrendingUp, calendar: Calendar,
  "calendar-days": Calendar, globe: Globe, banknote: Banknote, trophy: Trophy,
};

const RARITY_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  common:    { label: "Comum",    color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)" },
  rare:      { label: "Raro",     color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.25)" },
  epic:      { label: "Épico",    color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.25)" },
  legendary: { label: "Lendário", color: "#f5a623", bg: "rgba(245,166,35,0.08)",  border: "rgba(245,166,35,0.3)" },
};

const CATEGORY_LABELS: Record<string, string> = {
  trades:  "Operações",
  wins:    "Vitórias",
  streak:  "Sequências",
  volume:  "Volume",
  special: "Especial",
};

export default function AchievementsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState(0);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "unlocked" | "locked">("all");
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/achievements")
      .then(r => r.json())
      .then(d => {
        setAchievements(d.achievements ?? []);
        setUnlocked(d.unlocked ?? 0);
        setTotal(d.total ?? 0);
        setLoading(false);
      });
  }, [status]);

  const categories = ["all", ...Array.from(new Set(achievements.map(a => a.category)))];

  const filtered = achievements.filter(a => {
    if (filter === "unlocked" && !a.unlocked) return false;
    if (filter === "locked"   &&  a.unlocked) return false;
    if (category !== "all" && a.category !== category) return false;
    return true;
  });

  if (status === "loading" || loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#f5a623", fontFamily: "system-ui", fontSize: 16 }}>A carregar conquistas...</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, -apple-system, sans-serif", padding: "24px 16px", maxWidth: 900, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button onClick={() => router.back()} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}>
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Conquistas</h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: "3px 0 0" }}>
            {unlocked} de {total} desbloqueadas
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "18px 20px", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Progresso geral</span>
          <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 16 }}>{Math.round((unlocked / total) * 100)}%</span>
        </div>
        <div style={{ background: "#1e2d50", borderRadius: 99, height: 10, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(unlocked / total) * 100}%`, background: "linear-gradient(90deg, #f5a623, #ffcd6b)", borderRadius: 99, transition: "width 0.6s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ color: "#64748b", fontSize: 12 }}>{unlocked} desbloqueadas</span>
          <span style={{ color: "#64748b", fontSize: 12 }}>{total - unlocked} por desbloquear</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["all", "unlocked", "locked"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: 99, border: "1px solid",
            borderColor: filter === f ? "#f5a623" : "#1e2d50",
            background:  filter === f ? "rgba(245,166,35,0.12)" : "transparent",
            color:       filter === f ? "#f5a623" : "#64748b",
            fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
            {f === "all" ? "Todas" : f === "unlocked" ? "✓ Desbloqueadas" : "🔒 Bloqueadas"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {categories.map(c => (
          <button key={c} onClick={() => setCategory(c)} style={{
            padding: "5px 12px", borderRadius: 99, border: "1px solid",
            borderColor: category === c ? "#60a5fa" : "#1e2d50",
            background:  category === c ? "rgba(96,165,250,0.1)" : "transparent",
            color:       category === c ? "#60a5fa" : "#64748b",
            fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: ".5px",
          }}>
            {c === "all" ? "Todas as categorias" : CATEGORY_LABELS[c] ?? c}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {filtered.map(a => {
          const r = RARITY_STYLE[a.rarity];
          const Icon = ICON_MAP[a.icon] ?? Trophy;
          return (
            <div key={a.id} style={{
              background: a.unlocked ? r.bg : "rgba(17,24,39,0.6)",
              border: `1px solid ${a.unlocked ? r.border : "#1e2d50"}`,
              borderRadius: 14, padding: "18px 16px",
              opacity: a.unlocked ? 1 : 0.6,
              position: "relative", overflow: "hidden",
            }}>
              {/* Rarity tag */}
              <div style={{ position: "absolute", top: 12, right: 12, background: a.unlocked ? r.bg : "transparent", border: `1px solid ${r.border}`, borderRadius: 99, padding: "2px 8px", fontSize: 10, fontWeight: 800, color: r.color, letterSpacing: ".5px" }}>
                {r.label.toUpperCase()}
              </div>

              {/* Icon */}
              <div style={{ width: 44, height: 44, borderRadius: 12, background: a.unlocked ? `${r.color}22` : "#1e2d50", border: `1px solid ${a.unlocked ? r.color + "44" : "#2d3f6a"}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                {a.unlocked
                  ? <Icon size={22} color={r.color} />
                  : <Lock size={18} color="#475569" />
                }
              </div>

              {/* Title & description */}
              <div style={{ color: a.unlocked ? "#fff" : "#64748b", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{a.title}</div>
              <div style={{ color: "#475569", fontSize: 12, marginBottom: 12, lineHeight: 1.4 }}>{a.description}</div>

              {/* Progress bar */}
              {!a.unlocked && (
                <>
                  <div style={{ background: "#1e2d50", borderRadius: 99, height: 6, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ height: "100%", width: `${a.progress}%`, background: r.color, borderRadius: 99, transition: "width 0.5s ease" }} />
                  </div>
                  <div style={{ color: "#475569", fontSize: 11 }}>{a.detail}</div>
                </>
              )}

              {a.unlocked && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: r.color, fontSize: 12, fontWeight: 700 }}>
                  <span>✓</span> Desbloqueada
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", color: "#475569", padding: 60, fontSize: 14 }}>
          Nenhuma conquista encontrada.
        </div>
      )}
    </div>
  );
}
