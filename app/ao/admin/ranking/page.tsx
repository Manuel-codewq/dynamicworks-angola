"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Trophy, Medal, Crown, Copy, Check, RefreshCw } from "lucide-react";

type RankEntry = {
  position: number;
  name: string;
  masked: string;
  avatar: string | null;
  profit: number;
  wins: number;
  total: number;
  winRate: number;
};

const PERIODS = [
  { value: "today", label: "Hoje"   },
  { value: "week",  label: "Semana" },
  { value: "month", label: "Mês"    },
  { value: "all",   label: "Tudo"   },
];

const PERIOD_LABELS: Record<string, string> = {
  today: "Hoje",
  week:  "Esta Semana",
  month: "Este Mês",
  all:   "Geral",
};

function medalColor(pos: number) {
  if (pos === 1) return "#f5a623";
  if (pos === 2) return "#94a3b8";
  if (pos === 3) return "#cd7f32";
  return "#64748b";
}

function MedalIcon({ pos }: { pos: number }) {
  if (pos === 1) return <Trophy size={16} color="#f5a623" />;
  if (pos === 2) return <Crown  size={16} color="#94a3b8" />;
  if (pos === 3) return <Medal  size={16} color="#cd7f32" />;
  return <span style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>{pos}º</span>;
}

function formatKz(v: number) {
  return v.toLocaleString("pt-PT") + " Kz";
}

export default function AdminRankingPage() {
  const { status } = useSession();
  const router = useRouter();

  const [period,  setPeriod]  = useState("all");
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    fetch(`/api/admin/ranking?period=${period}`)
      .then(r => r.json())
      .then(d => { setRanking(d.ranking ?? []); setLoading(false); });
  }, [status, period]);

  function generatePost() {
    const periodLabel = PERIOD_LABELS[period] ?? "Geral";
    const now = new Date().toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" });
    const medalEmoji = (pos: number) => pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `${pos}.`;
    const lines = ranking.slice(0, 10).map(e =>
      `${medalEmoji(e.position)} *${e.masked}* — +${e.profit.toLocaleString("pt-PT")} Kz | ${e.winRate}% win rate`
    );
    return [
      `🏆 *TOP TRADERS — DYNAMIC WORKS*`,
      `📅 Período: ${periodLabel} | ${now}`,
      ``,
      ...lines,
      ``,
      `🔥 Negoceia, sobe no ranking e faz parte dos melhores!`,
      `👉 Regista-te em dynamicworks.ao`,
    ].join("\n");
  }

  function copyPost() {
    navigator.clipboard.writeText(generatePost()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const card: React.CSSProperties = {
    background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: 20, marginBottom: 16,
  };

  return (
    <div style={{ padding: 28, maxWidth: 860, margin: "0 auto", fontFamily: "system-ui,-apple-system,sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trophy size={20} color="#f5a623" />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>Ranking</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>Top traders da plataforma</div>
          </div>
        </div>
        <button onClick={() => { setLoading(true); fetch(`/api/admin/ranking?period=${period}`).then(r => r.json()).then(d => { setRanking(d.ranking ?? []); setLoading(false); }); }}
          style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.05)", border: "1px solid #1e2d50", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Período */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {PERIODS.map(p => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${period === p.value ? "#f5a623" : "#1e2d50"}`, background: period === p.value ? "rgba(245,166,35,0.12)" : "transparent", color: period === p.value ? "#f5a623" : "#94a3b8", fontWeight: period === p.value ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div style={card}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>A carregar...</div>
        ) : ranking.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Sem dados para este período.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e2d50" }}>
                {["#", "Trader", "Lucro", "Operações", "Win Rate"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: h === "Lucro" || h === "Operações" || h === "Win Rate" ? "right" : "left", color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.map(e => (
                <tr key={e.position} style={{ borderBottom: "1px solid rgba(30,45,80,0.5)" }}>
                  <td style={{ padding: "12px", width: 40, textAlign: "center" }}>
                    <MedalIcon pos={e.position} />
                  </td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1e2d50", border: `2px solid ${medalColor(e.position)}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        {e.avatar
                          ? <img src={e.avatar} alt={e.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 13 }}>{e.name.charAt(0).toUpperCase()}</span>
                        }
                      </div>
                      <div>
                        <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{e.name}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{e.masked}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    <span style={{ color: e.profit >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700, fontSize: 14 }}>
                      {e.profit >= 0 ? "+" : ""}{formatKz(e.profit)}
                    </span>
                  </td>
                  <td style={{ padding: "12px", textAlign: "right", color: "#94a3b8", fontSize: 14 }}>
                    {e.wins}W / {e.total - e.wins}L
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    <span style={{ color: e.winRate >= 60 ? "#22c55e" : e.winRate >= 45 ? "#f5a623" : "#ef4444", fontWeight: 700, fontSize: 14 }}>
                      {e.winRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Gerador de post */}
      {ranking.length > 0 && (
        <div style={card}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Trophy size={15} color="#f5a623" /> Publicação para WhatsApp
          </div>
          <pre style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 10, padding: 16, color: "#94a3b8", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "0 0 14px" }}>
            {generatePost()}
          </pre>
          <button onClick={copyPost}
            style={{ display: "flex", alignItems: "center", gap: 8, background: copied ? "rgba(34,197,94,0.12)" : "rgba(37,211,102,0.08)", border: `1px solid ${copied ? "rgba(34,197,94,0.5)" : "rgba(37,211,102,0.25)"}`, borderRadius: 9, padding: "10px 18px", color: copied ? "#22c55e" : "#25d366", fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%", justifyContent: "center" }}>
            {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar post para WhatsApp</>}
          </button>
        </div>
      )}
    </div>
  );
}
