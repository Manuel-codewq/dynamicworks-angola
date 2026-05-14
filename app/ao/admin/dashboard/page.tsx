"use client";
import { formatKz } from "@/lib/format";
import { useEffect, useState } from "react";
import {
  Users, Wallet, BarChart2, TrendingDown, Trophy, RefreshCw,
  UserCheck, Search, ExternalLink, Circle,
} from "lucide-react";

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

interface Stats {
  totalUsers: number; totalBalance: number; todayTradesCount: number;
  platformProfit: number; winRate: number; totalTrades: number;
}

interface OnlineUser {
  id: string; name: string; email: string; phone: string | null;
  province: string | null; balance: number; kycStatus: string;
  lastSeenAt: string; isDemo: boolean;
  _count: { trades: number };
}

const KYC_STYLE: Record<string, { label: string; color: string }> = {
  "no-submit": { label: "Sem docs",   color: "#64748b" },
  pending:     { label: "A rever",    color: "#f5a623" },
  approved:    { label: "Verificado", color: "#22c55e" },
  rejected:    { label: "Rejeitado",  color: "#ef4444" },
};

export default function AdminDashboard() {
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [onlineUsers,  setOnlineUsers]  = useState<OnlineUser[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search,       setSearch]       = useState("");

  async function loadStats() {
    setLoadingStats(true);
    const res = await fetch("/api/admin/stats");
    if (res.ok) setStats(await res.json());
    setLoadingStats(false);
  }

  async function loadUsers() {
    setLoadingUsers(true);
    const res = await fetch("/api/admin/online");
    if (res.ok) {
      const data = await res.json();
      setOnlineUsers(data.users ?? []);
    }
    setLoadingUsers(false);
  }

  function loadAll() { loadStats(); loadUsers(); }

  useEffect(() => {
    loadAll();
    const id = setInterval(loadUsers, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = search.trim()
    ? onlineUsers.filter(u => {
        const q = search.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      })
    : onlineUsers;

  const cards = stats ? [
    { label: "Total utilizadores",        value: stats.totalUsers.toString(),              Icon: Users,        color: "#94a3b8" },
    { label: "Saldo total (contas reais)",  value: formatKz(Math.floor(stats.totalBalance)), Icon: Wallet,       color: "#22c55e" },
    { label: "Operações hoje (conta real)",value: stats.todayTradesCount.toString(),        Icon: BarChart2,    color: "#f5a623" },
    { label: "Lucro hoje (perdas traders)",value: formatKz(Math.floor(stats.platformProfit)), Icon: TrendingDown, color: "#22c55e" },
    { label: "Taxa de vitória (conta real)",value: `${stats.winRate}%`,                     Icon: Trophy,       color: "#f5a623" },
    { label: "Total operações (conta real)",value: stats.totalTrades.toString(),            Icon: BarChart2,    color: "#94a3b8" },
  ] : [];

  const th: React.CSSProperties = {
    color: "#64748b", fontSize: 11, padding: "10px 14px", textAlign: "left",
    borderBottom: "1px solid #1e2d50", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: ".5px", whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "11px 14px", borderBottom: "1px solid rgba(30,45,80,0.3)",
    fontSize: 13, verticalAlign: "middle",
  };

  return (
    <div style={{ padding: 28 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Dashboard</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Visão geral da plataforma</p>
        </div>
        <button onClick={loadAll}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Stats cards */}
      {loadingStats ? (
        <p style={{ color: "#94a3b8" }}>A carregar estatísticas...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 36 }}>
          {cards.map((c, i) => (
            <div key={i} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "20px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <c.Icon size={18} color={c.color} />
                <span style={{ color: "#94a3b8", fontSize: 13 }}>{c.label}</span>
              </div>
              <div style={{ color: c.color, fontSize: 22, fontWeight: 800 }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Utilizadores Ativos */}
      <div>
        {/* Secção header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserCheck size={17} color="#22c55e" />
            </div>
            <div>
              <h2 style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                Online Agora
                {!loadingUsers && (
                  <span style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", borderRadius: 20, fontSize: 11, fontWeight: 800, padding: "2px 9px" }}>
                    {onlineUsers.length}
                  </span>
                )}
              </h2>
              <p style={{ color: "#64748b", fontSize: 12, margin: "2px 0 0" }}>
                Utilizadores com atividade nos últimos 5 min · atualiza a cada 30s
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
              <input
                placeholder="Pesquisar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 8, padding: "7px 10px 7px 30px", color: "#fff", fontSize: 12, outline: "none", width: 180 }}
              />
            </div>
            <a href="/ao/admin/users"
              style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 8, padding: "7px 12px", color: "#f5a623", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
              <ExternalLink size={12} /> Ver todos
            </a>
          </div>
        </div>

        {/* Tabela */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "hidden" }}>
          {loadingUsers ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 13 }}>
              A carregar utilizadores...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 13 }}>
              {search.trim() ? "Nenhum resultado para a pesquisa." : "Nenhum utilizador ativo."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead>
                  <tr>
                    {["Utilizador", "Contacto", "Província", "Saldo Real", "Operações", "KYC", "Visto há"].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => {
                    const kyc = KYC_STYLE[u.kycStatus] ?? KYC_STYLE.pending;
                    const secsAgo = Math.floor((Date.now() - new Date(u.lastSeenAt).getTime()) / 1000);
                    const seenLabel = secsAgo < 60
                      ? `${secsAgo}s`
                      : `${Math.floor(secsAgo / 60)}min`;
                    return (
                      <tr key={u.id}>

                        {/* Utilizador */}
                        <td style={{ ...td, color: "#fff", fontWeight: 600 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Circle size={7} fill="#22c55e" color="#22c55e" style={{ flexShrink: 0 }} />
                            <div>
                              <div>{u.name}</div>
                              <div style={{ fontSize: 10, color: u.isDemo ? "#f5a623" : "#22c55e", fontWeight: 700, marginTop: 1 }}>
                                {u.isDemo ? "DEMO" : "REAL"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contacto */}
                        <td style={{ ...td, color: "#64748b" }}>
                          <div style={{ fontSize: 12 }}>{u.email}</div>
                          {u.phone && <div style={{ fontSize: 11, marginTop: 2 }}>{u.phone}</div>}
                        </td>

                        {/* Província */}
                        <td style={{ ...td, color: "#94a3b8", fontSize: 12 }}>
                          {u.province ?? "—"}
                        </td>

                        {/* Saldo */}
                        <td style={{ ...td, color: "#fff", fontWeight: 600 }}>
                          {formatKz(Math.floor(u.balance))}
                        </td>

                        {/* Operações */}
                        <td style={{ ...td, color: "#94a3b8" }}>
                          {u._count.trades}
                        </td>

                        {/* KYC */}
                        <td style={td}>
                          <span style={{ color: kyc.color, fontSize: 11, fontWeight: 700 }}>
                            {kyc.label}
                          </span>
                        </td>

                        {/* Visto há */}
                        <td style={{ ...td, color: "#22c55e", fontSize: 12, fontWeight: 600 }}>
                          {seenLabel} atrás
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Rodapé */}
          {!loadingUsers && filtered.length > 0 && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid #1e2d50", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>
                {filtered.length} utilizador{filtered.length !== 1 ? "es" : ""} online
                {search.trim() ? ` (filtrado de ${onlineUsers.length})` : ""}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#22c55e", fontSize: 11 }}>
                <Circle size={6} fill="#22c55e" color="#22c55e" />
                Atualização automática a cada 30s
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
