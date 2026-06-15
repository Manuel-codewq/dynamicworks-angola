"use client";
import { useEffect, useState } from "react";
import { ShieldAlert, RefreshCw, ChevronLeft, ChevronRight, LogIn, Ban, ShieldX, ShieldCheck, Globe, Monitor } from "lucide-react";

interface LogEntry {
  id:        string;
  action:    string;
  email:     string;
  userName:  string | null;
  ip:        string;
  country:   string | null;
  city:      string | null;
  device:    string;
  createdAt: string;
}

interface Stats {
  attacksToday: number;
  loginsToday:  number;
  blockedToday: number;
}

const ACTION_META: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  login_ok:             { label: "Login OK",          color: "#22c55e", bg: "#22c55e18", Icon: LogIn      },
  "2fa_ok":             { label: "2FA OK",            color: "#22c55e", bg: "#22c55e18", Icon: ShieldCheck },
  login_fail:           { label: "Login Falhado",     color: "#ef4444", bg: "#ef444418", Icon: ShieldX    },
  "2fa_fail":           { label: "2FA Inválido",      color: "#ef4444", bg: "#ef444418", Icon: ShieldX    },
  login_fail_ratelimit: { label: "Bloqueado (ataque)",color: "#f59e0b", bg: "#f59e0b18", Icon: Ban        },
};

const COUNTRY_NAMES: Record<string, string> = {
  AO: "Angola", PT: "Portugal", BR: "Brasil", US: "EUA", GB: "Reino Unido",
  ZA: "África do Sul", CN: "China", FR: "França", DE: "Alemanha",
  NG: "Nigéria", ZM: "Zâmbia", CD: "RD Congo", NA: "Namíbia", CG: "Congo",
  ES: "Espanha", IT: "Itália", RU: "Rússia", IN: "Índia", NL: "Países Baixos",
};

function countryFlag(code: string): string {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  );
}

function formatDate(s: string) {
  return new Date(s).toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" });
}

function StatCard({ label, value, color, Icon }: { label: string; value: number; color: string; Icon: React.ElementType }) {
  return (
    <div style={{ background: "#111827", border: `1px solid ${color}30`, borderRadius: 14, padding: "18px 22px", flex: 1, minWidth: 160 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon size={16} color={color} />
        <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ color, fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

export default function AdminSecurityPage() {
  const [logs,    setLogs]    = useState<LogEntry[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [stats,   setStats]   = useState<Stats>({ attacksToday: 0, loginsToday: 0, blockedToday: 0 });
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all");
  const [from,    setFrom]    = useState("");
  const [to,      setTo]      = useState("");

  async function load(p = 1, f = filter, df = from, dt = to) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), filter: f });
    if (df) params.set("from", df);
    if (dt) params.set("to", dt);
    const res = await fetch(`/api/admin/security-logs?${params}`);
    if (res.ok) {
      const d = await res.json();
      setLogs(d.logs);
      setTotal(d.total);
      setPage(p);
      setStats(d.stats);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function applyFilter(f: string) {
    setFilter(f);
    load(1, f, from, to);
  }

  function applyDates() {
    load(1, filter, from, to);
  }

  const totalPages = Math.ceil(total / 50);

  const filterBtn = (label: string, value: string) => (
    <button
      onClick={() => applyFilter(value)}
      style={{
        padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
        border: filter === value ? "1px solid #f5a623" : "1px solid #1e2d50",
        background: filter === value ? "rgba(245,166,35,0.12)" : "#0d1526",
        color: filter === value ? "#f5a623" : "#64748b",
      }}
    >{label}</button>
  );

  return (
    <div style={{ padding: 28 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldAlert size={22} color="#ef4444" /> Logs de Segurança
          </h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>{total} eventos registados</p>
        </div>
        <button onClick={() => load(page)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="Logins hoje"          value={stats.loginsToday}  color="#22c55e" Icon={LogIn}      />
        <StatCard label="Ataques hoje"         value={stats.attacksToday} color="#ef4444" Icon={ShieldX}   />
        <StatCard label="IPs bloqueados hoje"  value={stats.blockedToday} color="#f59e0b" Icon={Ban}        />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {filterBtn("Todos", "all")}
        {filterBtn("Ataques", "attacks")}
        {filterBtn("Logins OK", "logins")}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: "6px 10px", color: "#94a3b8", fontSize: 12 }}
          />
          <span style={{ color: "#334155", fontSize: 12 }}>até</span>
          <input
            type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: "6px 10px", color: "#94a3b8", fontSize: 12 }}
          />
          <button onClick={applyDates} style={{ background: "#1e2d50", border: "none", borderRadius: 8, padding: "7px 12px", color: "#94a3b8", cursor: "pointer", fontSize: 12 }}>
            Filtrar
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, overflow: "hidden" }}>

        {loading ? (
          <p style={{ color: "#64748b", padding: 24, textAlign: "center", fontSize: 13 }}>A carregar...</p>
        ) : logs.length === 0 ? (
          <p style={{ color: "#334155", padding: 24, textAlign: "center", fontSize: 13 }}>Nenhum evento encontrado.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0d1526" }}>
                  {["Data / Hora", "Evento", "Utilizador", "IP", "País", "Cidade", "Dispositivo"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", color: "#334155", fontSize: 11, fontWeight: 700, textAlign: "left", whiteSpace: "nowrap", letterSpacing: 0.5 }}>
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => {
                  const meta = ACTION_META[l.action] ?? { label: l.action, color: "#64748b", bg: "#64748b18", Icon: ShieldCheck };
                  const { Icon: EventIcon } = meta;
                  const isAttack = ["login_fail", "login_fail_ratelimit", "2fa_fail"].includes(l.action);
                  return (
                    <tr
                      key={l.id}
                      style={{
                        borderTop: "1px solid #1a2540",
                        background: isAttack
                          ? (i % 2 === 0 ? "rgba(239,68,68,0.03)" : "rgba(239,68,68,0.05)")
                          : (i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"),
                      }}
                    >
                      {/* Data */}
                      <td style={{ padding: "10px 16px", color: "#475569", fontSize: 12, whiteSpace: "nowrap", fontFamily: "monospace" }}>
                        {formatDate(l.createdAt)}
                      </td>

                      {/* Evento */}
                      <td style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          background: meta.bg, color: meta.color,
                          borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700,
                        }}>
                          <EventIcon size={11} />
                          {meta.label}
                        </span>
                      </td>

                      {/* Utilizador */}
                      <td style={{ padding: "10px 16px" }}>
                        {l.userName && <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>{l.userName}</div>}
                        <div style={{ color: "#475569", fontSize: 11, fontFamily: "monospace" }}>{l.email}</div>
                      </td>

                      {/* IP */}
                      <td style={{ padding: "10px 16px", color: "#64748b", fontSize: 12, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                        {l.ip}
                      </td>

                      {/* País */}
                      <td style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
                        {l.country ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 18, lineHeight: 1 }}>{countryFlag(l.country)}</span>
                            <span style={{ color: "#94a3b8", fontSize: 12 }}>
                              {COUNTRY_NAMES[l.country] ?? l.country}
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: "#334155", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Cidade */}
                      <td style={{ padding: "10px 16px", color: "#64748b", fontSize: 12 }}>
                        {l.city ?? "—"}
                      </td>

                      {/* Dispositivo */}
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#475569", fontSize: 12 }}>
                          <Monitor size={12} />
                          {l.device}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "14px 20px", borderTop: "1px solid #1e2d50" }}>
            <button onClick={() => load(page - 1)} disabled={page <= 1}
              style={{ background: "#1e2d50", border: "none", borderRadius: 6, padding: "6px 10px", color: "#94a3b8", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ color: "#64748b", fontSize: 13 }}>Página {page} de {totalPages}</span>
            <button onClick={() => load(page + 1)} disabled={page >= totalPages}
              style={{ background: "#1e2d50", border: "none", borderRadius: 6, padding: "6px 10px", color: "#94a3b8", cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1 }}>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
