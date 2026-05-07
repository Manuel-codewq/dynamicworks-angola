"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { TrendingUp, ChevronLeft, Trophy, Medal } from "lucide-react";

function formatKz(n: number) {
  return n.toLocaleString("pt-AO") + " Kz";
}

interface RankEntry {
  position: number;
  name: string;
  profit: number;
  wins: number;
  total: number;
  winRate: number;
}

const MEDAL: Record<number, { icon: React.ReactNode; color: string }> = {
  1: { icon: <Trophy size={18} />, color: "#f5a623" },
  2: { icon: <Medal  size={18} />, color: "#94a3b8" },
  3: { icon: <Medal  size={18} />, color: "#cd7f32" },
};

export default function RankingPage() {
  const { status } = useSession();
  const router = useRouter();
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/ranking")
      .then(r => r.json())
      .then(d => { setRanking(d); setLoading(false); });
  }, [status]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/trade")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ width: 32, height: 32, background: "#f5a623", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TrendingUp size={18} color="#0a0f1e" strokeWidth={2.5} />
        </div>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Ranking</span>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>— Top Traders</span>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>

        {/* Top 3 podium */}
        {ranking.length >= 3 && (
          <div style={{ display: "flex", gap: 12, marginBottom: 28, alignItems: "flex-end" }}>
            {/* 2nd */}
            <div style={{ flex: 1, background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
              <div style={{ color: "#94a3b8", fontSize: 22, marginBottom: 6 }}><Medal size={22} color="#94a3b8" /></div>
              <div style={{ color: "#94a3b8", fontWeight: 800, fontSize: 12, marginBottom: 4 }}>2º</div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{ranking[1].name.split(" ")[0]}</div>
              <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 13 }}>+{formatKz(ranking[1].profit)}</div>
            </div>
            {/* 1st */}
            <div style={{ flex: 1, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.4)", borderRadius: 12, padding: "20px 12px", textAlign: "center" }}>
              <div style={{ marginBottom: 6, display: "flex", justifyContent: "center" }}><Trophy size={26} color="#f5a623" /></div>
              <div style={{ color: "#f5a623", fontWeight: 800, fontSize: 12, marginBottom: 4 }}>1º</div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{ranking[0].name.split(" ")[0]}</div>
              <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 14 }}>+{formatKz(ranking[0].profit)}</div>
            </div>
            {/* 3rd */}
            <div style={{ flex: 1, background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
              <div style={{ color: "#cd7f32", marginBottom: 6, display: "flex", justifyContent: "center" }}><Medal size={22} color="#cd7f32" /></div>
              <div style={{ color: "#cd7f32", fontWeight: 800, fontSize: 12, marginBottom: 4 }}>3º</div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{ranking[2].name.split(" ")[0]}</div>
              <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 13 }}>+{formatKz(ranking[2].profit)}</div>
            </div>
          </div>
        )}

        {/* Full list */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #1e2d50", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>TRADER</span>
            <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>LUCRO · VITÓRIAS</span>
          </div>

          {loading && (
            <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>A carregar...</div>
          )}
          {!loading && ranking.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Ainda sem dados. Sê o primeiro! 🚀</div>
          )}

          {ranking.map(e => {
            const medal = MEDAL[e.position];
            return (
              <div key={e.position} style={{
                display: "flex", alignItems: "center", padding: "14px 16px",
                borderBottom: "1px solid #0d1526",
                background: e.position <= 3 ? "rgba(245,166,35,0.03)" : "transparent",
              }}>
                {/* Position */}
                <div style={{ width: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {medal
                    ? <span style={{ color: medal.color }}>{medal.icon}</span>
                    : <span style={{ color: "#4b5563", fontSize: 13, fontWeight: 700 }}>{e.position}</span>
                  }
                </div>

                {/* Avatar */}
                <div style={{ width: 34, height: 34, background: "#1e2d50", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 }}>
                  <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 13 }}>{e.name.charAt(0).toUpperCase()}</span>
                </div>

                {/* Name + win rate */}
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{e.name}</div>
                  <div style={{ color: "#94a3b8", fontSize: 11 }}>{e.wins}/{e.total} vitórias · {e.winRate}%</div>
                </div>

                {/* Profit */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: e.profit >= 0 ? "#22c55e" : "#ef4444", fontWeight: 800, fontSize: 14 }}>
                    {e.profit >= 0 ? "+" : ""}{formatKz(e.profit)}
                  </div>
                  {/* Win rate bar */}
                  <div style={{ width: 60, height: 4, background: "#1e2d50", borderRadius: 2, marginTop: 4 }}>
                    <div style={{ width: `${e.winRate}%`, height: "100%", background: e.winRate >= 50 ? "#22c55e" : "#ef4444", borderRadius: 2 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ color: "#4b5563", fontSize: 11, textAlign: "center", marginTop: 16 }}>
          Actualizado em tempo real · apenas operações reais
        </p>
      </div>
    </div>
  );
}
