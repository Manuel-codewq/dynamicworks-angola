"use client";
import { formatKz } from "@/lib/format";
import { useEffect, useState } from "react";
import {
  Users, Wallet, BarChart2, TrendingDown, Trophy, RefreshCw,
  UserCheck, Search, ExternalLink, Circle, Gamepad2,
  UserPlus, ArrowDownCircle, ArrowUpCircle, Clock, TrendingUp,
} from "lucide-react";

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

interface Stats {
  totalUsers: number;
  totalBalance: number; todayTradesCount: number; platformProfit: number; winRate: number; totalTrades: number;
  totalDemoBalance: number; demoTodayTradesCount: number; demoPlatformProfit: number; demoWinRate: number; demoTotalTrades: number;
  newUsersToday: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  todayDepositsAmount: number;
  todayDepositsCount: number;
  todayWithdrawalsAmount: number;
  todayWithdrawalsCount: number;
  pnlLast7Days: { date: string; profit: number }[];
  realAccounts: number;
  everDeposited: number;
  realTraders: number;
  kycApproved: number;
  kycWithoutDeposit: number;
  demoOnly: number;
  conversionRate: number;
}

interface OnlineUser {
  id: string; name: string; email: string; phone: string | null;
  province: string | null; balance: number; kycStatus: string;
  lastSeenAt: string; isDemo: boolean;
  _count: { trades: number };
}

const KYC_STYLE: Record<string, { label: string; color: string }> = {
  "no-submit": { label: "Sem docs",   color: "#64748b" },
  pending:     { label: "A rever",    color: "#ffffff" },
  approved:    { label: "Verificado", color: "#22c55e" },
  rejected:    { label: "Rejeitado",  color: "#ef4444" },
};

function PnlChart({ data }: { data: { date: string; profit: number }[] }) {
  if (!data.length) return null;
  const values = data.map(d => d.profit);
  const max = Math.max(...values, 1);
  const W = 280, H = 60;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
        Lucro da casa — últimos 7 dias
      </div>
      <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: "100%", overflow: "visible" }}>
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * (W - 30) + 15;
          const barH = Math.max(2, (d.profit / max) * H);
          const y = H - barH;
          const label = new Date(d.date + "T00:00:00").toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
          return (
            <g key={d.date}>
              <rect x={x - 14} y={y} width={28} height={barH} rx={4}
                fill={d.profit > 0 ? "url(#barGrad)" : "#1e2d50"} />
              <text x={x} y={H + 14} textAnchor="middle" fontSize={9} fill="#475569">{label}</text>
              {d.profit > 0 && (
                <text x={x} y={y - 3} textAnchor="middle" fontSize={8} fill="#22c55e">
                  {d.profit >= 1000 ? `${Math.round(d.profit / 1000)}k` : d.profit}
                </text>
              )}
            </g>
          );
        })}
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0.6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [onlineUsers,  setOnlineUsers]  = useState<OnlineUser[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search,       setSearch]       = useState("");
  const [mode,         setMode]         = useState<"real" | "demo">("real");

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

  const isDemo = mode === "demo";
  const s = stats;

  const mainCards = s ? [
    { label: "Total utilizadores",         value: s.totalUsers.toString(),                                                                    Icon: Users,        color: "#94a3b8" },
    { label: isDemo ? "Saldo (Demo)" : "Saldo (Real)",
                                            value: formatKz(Math.floor(isDemo ? s.totalDemoBalance : s.totalBalance)),                        Icon: Wallet,       color: isDemo ? "#ffffff" : "#22c55e" },
    { label: "Operações hoje",             value: (isDemo ? s.demoTodayTradesCount : s.todayTradesCount).toString(),                          Icon: BarChart2,    color: "#ffffff" },
    { label: "Lucro hoje",                 value: formatKz(Math.floor(isDemo ? s.demoPlatformProfit : s.platformProfit)),                     Icon: TrendingDown, color: "#22c55e" },
    { label: "Taxa de vitória",            value: `${isDemo ? s.demoWinRate : s.winRate}%`,                                                   Icon: Trophy,       color: "#ffffff" },
    { label: "Total operações",            value: (isDemo ? s.demoTotalTrades : s.totalTrades).toString(),                                    Icon: BarChart2,    color: "#94a3b8" },
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

  const card: React.CSSProperties = { background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "20px 18px" };

  return (
    <div style={{ padding: 28 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Dashboard</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Visão geral da plataforma em tempo real</p>
        </div>
        <button onClick={loadAll}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Alertas pendentes */}
      {s && (s.pendingDeposits > 0 || s.pendingWithdrawals > 0) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {s.pendingDeposits > 0 && (
            <a href="/ao/admin/transactions" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "10px 16px", textDecoration: "none" }}>
              <Clock size={15} color="#ffffff" />
              <span style={{ color: "#ffffff", fontWeight: 700, fontSize: 13 }}>{s.pendingDeposits} depósito{s.pendingDeposits !== 1 ? "s" : ""} pendente{s.pendingDeposits !== 1 ? "s" : ""}</span>
              <ExternalLink size={12} color="#ffffff" />
            </a>
          )}
          {s.pendingWithdrawals > 0 && (
            <a href="/ao/admin/transactions" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 16px", textDecoration: "none" }}>
              <Clock size={15} color="#ef4444" />
              <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 13 }}>{s.pendingWithdrawals} levantamento{s.pendingWithdrawals !== 1 ? "s" : ""} pendente{s.pendingWithdrawals !== 1 ? "s" : ""}</span>
              <ExternalLink size={12} color="#ef4444" />
            </a>
          )}
        </div>
      )}

      {/* Real / Demo tabs */}
      <div style={{ display: "flex", gap: 4, background: "#111827", border: "1px solid #1e2d50", borderRadius: 10, padding: 4, width: "fit-content", marginBottom: 20 }}>
        {(["real","demo"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: "8px 22px", borderRadius: 7, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: mode === m ? (m === "real" ? "#22c55e" : "#ffffff") : "transparent",
            color:      mode === m ? "#0a0f1e" : "#94a3b8",
          }}>
            {m === "real"
              ? <><Wallet size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />Conta Real</>
              : <><Gamepad2 size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />Conta Demo</>
            }
          </button>
        ))}
      </div>

      {loadingStats ? (
        <p style={{ color: "#94a3b8" }}>A carregar estatísticas...</p>
      ) : (
        <>
          {/* KPIs principais */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
            {mainCards.map((c, i) => (
              <div key={i} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <c.Icon size={18} color={c.color} />
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>{c.label}</span>
                </div>
                <div style={{ color: c.color, fontSize: 22, fontWeight: 800 }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Contas reais vs demo — o funil de quem se regista até depositar */}
          {s && (
          <div style={{ ...card, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={18} color="#22c55e" />
                <span style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700 }}>Contas na corretora</span>
              </div>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>
                Conta real = tem saldo real neste momento
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
              {[
                { l: "Registados",        v: s.totalUsers,     c: "#94a3b8" },
                { l: "Contas reais",      v: s.realAccounts,   c: "#22c55e" },
                { l: "Já depositaram",    v: s.everDeposited,  c: "#38bdf8" },
                { l: "Já operaram real",  v: s.realTraders,    c: "#38bdf8" },
                { l: "KYC aprovado",      v: s.kycApproved,    c: "#38bdf8" },
                { l: "Sem saldo real",    v: s.demoOnly,       c: "#64748b" },
              ].map((x, i) => (
                <div key={i} style={{ background: "#0b1120", border: "1px solid #1e2d50", borderRadius: 10, padding: "13px 14px" }}>
                  <div style={{ color: x.c, fontSize: 21, fontWeight: 800 }}>{x.v.toLocaleString("pt-PT")}</div>
                  <div style={{ color: "#64748b", fontSize: 11.5, marginTop: 2 }}>{x.l}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              <div style={{ flex: "1 1 240px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ color: "#22c55e", fontSize: 18, fontWeight: 800 }}>{s.conversionRate}%</div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
                  dos registados têm saldo real
                </div>
              </div>

              {/* Quem passou o KYC (o passo chato) e mesmo assim não depositou —
                  é onde há mais a ganhar com um empurrão. */}
              {s.kycWithoutDeposit > 0 && (
                <div style={{ flex: "1 1 240px", background: "rgba(255,255,255,0.04)", border: "1px solid #1e2d50", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ color: "#fff", fontSize: 18, fontWeight: 800 }}>{s.kycWithoutDeposit}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
                    fizeram KYC mas nunca depositaram
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Métricas de hoje */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <UserPlus size={18} color="#38bdf8" />
                <span style={{ color: "#94a3b8", fontSize: 13 }}>Novos utilizadores hoje</span>
              </div>
              <div style={{ color: "#38bdf8", fontSize: 22, fontWeight: 800 }}>{s?.newUsersToday ?? 0}</div>
            </div>
            <div style={{ ...card, cursor: "pointer" }} onClick={() => window.location.href = "/ao/admin/transactions?type=deposit&status=completed"}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <ArrowDownCircle size={18} color="#22c55e" />
                <span style={{ color: "#94a3b8", fontSize: 13 }}>Depósitos aprovados hoje</span>
              </div>
              <div style={{ color: "#22c55e", fontSize: 22, fontWeight: 800 }}>{formatKz(s?.todayDepositsAmount ?? 0)}</div>
              <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>{s?.todayDepositsCount ?? 0} transações</div>
            </div>
            <div style={{ ...card, cursor: "pointer" }} onClick={() => window.location.href = "/ao/admin/transactions?type=withdrawal&status=completed"}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <ArrowUpCircle size={18} color="#ef4444" />
                <span style={{ color: "#94a3b8", fontSize: 13 }}>Levantamentos aprovados hoje</span>
              </div>
              <div style={{ color: "#ef4444", fontSize: 22, fontWeight: 800 }}>{formatKz(s?.todayWithdrawalsAmount ?? 0)}</div>
              <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>{s?.todayWithdrawalsCount ?? 0} transações</div>
            </div>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <TrendingUp size={18} color="#a78bfa" />
                <span style={{ color: "#94a3b8", fontSize: 13 }}>Fluxo líquido hoje</span>
              </div>
              <div style={{ color: (s?.todayDepositsAmount ?? 0) >= (s?.todayWithdrawalsAmount ?? 0) ? "#22c55e" : "#ef4444", fontSize: 22, fontWeight: 800 }}>
                {formatKz(Math.abs((s?.todayDepositsAmount ?? 0) - (s?.todayWithdrawalsAmount ?? 0)))}
              </div>
              <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>
                {(s?.todayDepositsAmount ?? 0) >= (s?.todayWithdrawalsAmount ?? 0) ? "entrada líquida" : "saída líquida"}
              </div>
            </div>
          </div>

          {/* P&L chart */}
          {s?.pnlLast7Days && s.pnlLast7Days.length > 0 && (
            <div style={{ ...card, marginBottom: 20 }}>
              <PnlChart data={s.pnlLast7Days} />
            </div>
          )}
        </>
      )}

      {/* Utilizadores Online */}
      <div>
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
                Últimos 5 min · atualiza a cada 30s
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
              style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "7px 12px", color: "#ffffff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
              <ExternalLink size={12} /> Ver todos
            </a>
          </div>
        </div>

        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "hidden" }}>
          {loadingUsers ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 13 }}>A carregar...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 13 }}>
              {search.trim() ? "Nenhum resultado." : "Nenhum utilizador ativo."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead>
                  <tr>
                    {["Utilizador", "Contacto", "Província", isDemo ? "Saldo Demo" : "Saldo Real", "Operações", "KYC", "Visto há"].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => {
                    const kyc = KYC_STYLE[u.kycStatus] ?? KYC_STYLE.pending;
                    const secsAgo = Math.floor((Date.now() - new Date(u.lastSeenAt).getTime()) / 1000);
                    const seenLabel = secsAgo < 60 ? `${secsAgo}s` : `${Math.floor(secsAgo / 60)}min`;
                    return (
                      <tr key={u.id}>
                        <td style={{ ...td, color: "#fff", fontWeight: 600 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Circle size={7} fill="#22c55e" color="#22c55e" style={{ flexShrink: 0 }} />
                            <div>
                              <div>{u.name}</div>
                              <div style={{ fontSize: 10, color: u.isDemo ? "#ffffff" : "#22c55e", fontWeight: 700, marginTop: 1 }}>
                                {u.isDemo ? "DEMO" : "REAL"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, color: "#64748b" }}>
                          <div style={{ fontSize: 12 }}>{u.email}</div>
                          {u.phone && <div style={{ fontSize: 11, marginTop: 2 }}>{u.phone}</div>}
                        </td>
                        <td style={{ ...td, color: "#94a3b8", fontSize: 12 }}>{u.province ?? "—"}</td>
                        <td style={{ ...td, color: "#fff", fontWeight: 600 }}>{formatKz(Math.floor(u.balance))}</td>
                        <td style={{ ...td, color: "#94a3b8" }}>{u._count.trades}</td>
                        <td style={td}>
                          <span style={{ color: kyc.color, fontSize: 11, fontWeight: 700 }}>{kyc.label}</span>
                        </td>
                        <td style={{ ...td, color: "#22c55e", fontSize: 12, fontWeight: 600 }}>{seenLabel} atrás</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

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
