"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Shield, Smartphone, Mail, Monitor, Trash2,
  CheckCircle, AlertCircle, Lock, RefreshCw, Eye,
  ChevronLeft, LogOut,
} from "lucide-react";
import PageGuide from "@/app/components/PageGuide";

const SECURITY_GUIDE = [
  { icon: <Shield  size={26} color="#f5a623" />, iconColor: "#f5a623", title: "Segurança da Conta",        description: "Esta página permite-te proteger a tua conta com autenticação em dois factores, ver todos os dispositivos ligados e consultar o histórico de acessos.", tip: "Activa o 2FA para proteger a conta mesmo que alguém descubra a tua senha." },
  { icon: <Mail    size={26} color="#38bdf8" />, iconColor: "#38bdf8", title: "2FA — Dois Factores",       description: "Com o 2FA activo, além da senha precisas de um código enviado para o teu email em cada login. Mesmo que alguém roube a tua senha, não consegue entrar.", tip: "O código expira em 10 minutos. Verifica a pasta de spam se não o encontrares." },
  { icon: <Monitor size={26} color="#a78bfa" />, iconColor: "#a78bfa", title: "Sessões Activas",          description: "Aqui vês todos os dispositivos onde a tua conta está activa. Podes encerrar sessões de dispositivos que não reconheces.", tip: "Se vires uma sessão com um IP desconhecido, encerra-a e muda a senha imediatamente." },
  { icon: <Lock    size={26} color="#22c55e" />, iconColor: "#22c55e", title: "Log de Acessos",           description: "Registo de todos os logins: bem-sucedidos, falhados e tentativas de 2FA. Permite detectar se alguém tentou aceder à tua conta.", tip: "Muitos 'login falhado' seguidos indicam que alguém está a tentar adivinhar a tua senha." },
];

type TwoFAStatus = { enabled: boolean; method: string | null };
type Session = { id: string; device: string; ip: string; createdAt: string; lastActiveAt: string; isCurrent: boolean };
type LogEntry = { id: string; label: string; color: string; ip: string; device: string; createdAt: string };

const card: React.CSSProperties = {
  background: "#111827", border: "1px solid #1e2d50",
  borderRadius: 14, padding: 24, marginBottom: 16,
};
const sectionTitle: React.CSSProperties = {
  color: "#ffffff", fontSize: 16, fontWeight: 700, margin: "0 0 4px",
};
const sub: React.CSSProperties = { color: "#94a3b8", fontSize: 13, margin: "0 0 20px" };
const btn = (color = "#f5a623", text = "#0a0f1e"): React.CSSProperties => ({
  background: color, color: text, border: "none", borderRadius: 8,
  padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
});
const outlineBtn: React.CSSProperties = {
  background: "none", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)",
  borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

function formatDate(d: string) {
  return new Date(d).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SecurityPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [twoFA, setTwoFA] = useState<TwoFAStatus | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"2fa" | "sessions" | "log">("2fa");

  // 2FA setup state
  const [setupStep, setSetupStep] = useState<"idle" | "choose" | "totp_qr" | "totp_verify" | "email_sent" | "email_verify" | "disable">("idle");
  const [totpQr, setTotpQr] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [disablePass, setDisablePass] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const load2FA = useCallback(async () => {
    const r = await fetch("/api/profile");
    if (!r.ok) return;
    const d = await r.json();
    setTwoFA({ enabled: d.twoFactorEnabled ?? false, method: d.twoFactorMethod ?? null });
  }, []);

  const loadSessions = useCallback(async () => {
    const r = await fetch("/api/sessions");
    if (r.ok) setSessions(await r.json());
  }, []);

  const loadLogs = useCallback(async () => {
    const r = await fetch("/api/access-log");
    if (r.ok) setLogs(await r.json());
  }, []);

  useEffect(() => { load2FA(); }, [load2FA]);
  useEffect(() => { if (activeTab === "sessions") loadSessions(); }, [activeTab, loadSessions]);
  useEffect(() => { if (activeTab === "log") loadLogs(); }, [activeTab, loadLogs]);

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  }

  // ── TOTP setup ──────────────────────────────────────────────────────────────
  async function startTotpSetup() {
    setLoading(true);
    const r = await fetch("/api/auth/2fa/setup", { method: "POST" });
    const d = await r.json();
    setLoading(false);
    if (!r.ok) { flash(d.error, false); return; }
    setTotpQr(d.qr);
    setTotpSecret(d.secret);
    setSetupStep("totp_qr");
  }

  async function confirmTotp() {
    setLoading(true);
    const r = await fetch("/api/auth/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "totp", token: otpInput }),
    });
    const d = await r.json();
    setLoading(false);
    if (!r.ok) { flash(d.error, false); return; }
    flash("2FA por aplicação activado!", true);
    setSetupStep("idle");
    setOtpInput("");
    load2FA();
  }

  // ── Email 2FA ───────────────────────────────────────────────────────────────
  async function startEmail2FA() {
    setLoading(true);
    const r = await fetch("/api/auth/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "email" }),
    });
    const d = await r.json();
    setLoading(false);
    if (!r.ok) { flash(d.error, false); return; }
    setSetupStep("email_sent");
  }

  async function confirmEmail2FA() {
    setLoading(true);
    const r = await fetch("/api/auth/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "email", token: otpInput }),
    });
    const d = await r.json();
    setLoading(false);
    if (!r.ok) { flash(d.error, false); return; }
    flash("2FA por email activado!", true);
    setSetupStep("idle");
    setOtpInput("");
    load2FA();
  }

  // ── Disable 2FA ─────────────────────────────────────────────────────────────
  async function disable2FA() {
    setLoading(true);
    const r = await fetch("/api/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: disablePass }),
    });
    const d = await r.json();
    setLoading(false);
    if (!r.ok) { flash(d.error, false); return; }
    flash("2FA desactivado.", true);
    setSetupStep("idle");
    setDisablePass("");
    load2FA();
  }

  // ── Sessions ─────────────────────────────────────────────────────────────────
  async function revokeSession(id: string) {
    await fetch(`/api/sessions/${id}/revoke`, { method: "POST" });
    loadSessions();
  }

  async function revokeAll() {
    await fetch("/api/sessions", { method: "DELETE" });
    loadSessions();
    flash("Todas as outras sessões encerradas.", true);
  }

  if (!session) return null;

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 600,
    cursor: "pointer", border: "none",
    background: activeTab === t ? "#1e2d50" : "none",
    color: activeTab === t ? "#ffffff" : "#94a3b8",
  });

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1e",
      fontFamily: "system-ui, -apple-system, sans-serif", padding: "24px 16px",
    }}>
      <PageGuide storageKey="dw_guide_security" steps={SECURITY_GUIDE} />
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}>
            <ChevronLeft size={22} />
          </button>
          <div style={{ width: 38, height: 38, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={20} color="#f5a623" />
          </div>
          <div>
            <div style={{ color: "#ffffff", fontSize: 18, fontWeight: 700 }}>Segurança</div>
            <div style={{ color: "#94a3b8", fontSize: 13 }}>Protege a tua conta</div>
          </div>
        </div>

        {/* Flash message */}
        {msg && (
          <div style={{
            background: msg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${msg.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: 8, padding: "10px 14px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {msg.ok ? <CheckCircle size={16} color="#22c55e" /> : <AlertCircle size={16} color="#ef4444" />}
            <span style={{ color: msg.ok ? "#22c55e" : "#ef4444", fontSize: 14 }}>{msg.text}</span>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#111827", borderRadius: 10, padding: 4 }}>
          <button style={tabStyle("2fa")} onClick={() => setActiveTab("2fa")}>2FA</button>
          <button style={tabStyle("sessions")} onClick={() => setActiveTab("sessions")}>Sessões</button>
          <button style={tabStyle("log")} onClick={() => setActiveTab("log")}>Log de Acessos</button>
        </div>

        {/* ── TAB 2FA ─────────────────────────────────────────────────────────── */}
        {activeTab === "2fa" && (
          <div style={card}>
            <p style={sectionTitle}>Autenticação em dois factores</p>
            <p style={sub}>Adiciona uma camada extra de segurança ao teu login.</p>

            {twoFA?.enabled ? (
              <>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
                  borderRadius: 10, padding: "12px 16px", marginBottom: 20,
                }}>
                  <CheckCircle size={18} color="#22c55e" />
                  <div>
                    <div style={{ color: "#22c55e", fontWeight: 600, fontSize: 14 }}>2FA activo</div>
                    <div style={{ color: "#94a3b8", fontSize: 13 }}>
                      Método: {twoFA.method === "totp" ? "Aplicação autenticadora" : "Email"}
                    </div>
                  </div>
                </div>

                {setupStep === "disable" ? (
                  <div>
                    <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 10 }}>
                      Confirma a tua senha para desactivar o 2FA:
                    </p>
                    <input
                      type="password" value={disablePass} onChange={e => setDisablePass(e.target.value)}
                      placeholder="A tua senha actual"
                      style={{
                        width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
                        borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14,
                        outline: "none", boxSizing: "border-box", marginBottom: 12,
                      }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={disable2FA} disabled={loading} style={btn("#ef4444")}>
                        {loading ? "..." : "Desactivar 2FA"}
                      </button>
                      <button onClick={() => setSetupStep("idle")} style={btn("#1e2d50", "#fff")}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setSetupStep("disable")} style={outlineBtn}>
                    Desactivar 2FA
                  </button>
                )}
              </>
            ) : (
              <>
                {setupStep === "idle" && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.15)", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
                      <Mail size={16} color="#f5a623" />
                      <span style={{ color: "#94a3b8", fontSize: 13 }}>Será enviado um código de 6 dígitos para o teu email em cada login.</span>
                    </div>
                    <button onClick={startEmail2FA} disabled={loading} style={{ ...btn(), display: "flex", alignItems: "center", gap: 8 }}>
                      <Mail size={16} /> {loading ? "A enviar código..." : "Activar 2FA por Email"}
                    </button>
                  </div>
                )}

                {setupStep === "email_sent" && (
                  <div>
                    <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 12 }}>
                      Enviámos um código para o teu email. Introduz-o abaixo para confirmar:
                    </p>
                    <input
                      type="text" inputMode="numeric" value={otpInput}
                      onChange={e => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      autoFocus
                      style={{
                        width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
                        borderRadius: 8, padding: "12px", color: "#fff",
                        fontSize: 24, fontWeight: 700, letterSpacing: 10,
                        outline: "none", boxSizing: "border-box", textAlign: "center", marginBottom: 12,
                      }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={confirmEmail2FA} disabled={loading || otpInput.length < 6} style={btn()}>
                        {loading ? "..." : "Activar 2FA"}
                      </button>
                      <button onClick={() => { setSetupStep("idle"); setOtpInput(""); }} style={btn("#1e2d50", "#fff")}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {(setupStep === "totp_qr" || setupStep === "totp_verify" || setupStep === "choose") && (
                  <button onClick={() => setSetupStep("idle")} style={btn()}>← Voltar</button>
                )}

                {setupStep === "email_sent" && (
                  <div>
                    <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 12 }}>
                      Enviámos um código para o teu email. Introduz-o abaixo:
                    </p>
                    <input
                      type="text" inputMode="numeric" value={otpInput}
                      onChange={e => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      style={{
                        width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
                        borderRadius: 8, padding: "12px", color: "#fff",
                        fontSize: 24, fontWeight: 700, letterSpacing: 10,
                        outline: "none", boxSizing: "border-box", textAlign: "center", marginBottom: 12,
                      }}
                    />
                    <button onClick={confirmEmail2FA} disabled={loading || otpInput.length < 6} style={btn()}>
                      {loading ? "..." : "Activar 2FA"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB SESSIONS ────────────────────────────────────────────────────── */}
        {activeTab === "sessions" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>{sessions.length} sessão(ões) activa(s)</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={loadSessions} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                  <RefreshCw size={16} />
                </button>
                {sessions.filter(s => !s.isCurrent).length > 0 && (
                  <button onClick={revokeAll} style={outlineBtn}>
                    Encerrar todas as outras
                  </button>
                )}
              </div>
            </div>

            {sessions.map(s => (
              <div key={s.id} style={{
                ...card, marginBottom: 10,
                border: s.isCurrent ? "1px solid rgba(245,166,35,0.4)" : "1px solid #1e2d50",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{
                      width: 36, height: 36, background: "#1e2d50", borderRadius: 8,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Monitor size={18} color="#94a3b8" />
                    </div>
                    <div>
                      <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>
                        {s.device}
                        {s.isCurrent && (
                          <span style={{
                            marginLeft: 8, background: "rgba(245,166,35,0.15)",
                            color: "#f5a623", fontSize: 11, fontWeight: 700,
                            padding: "2px 7px", borderRadius: 4,
                          }}>ACTUAL</span>
                        )}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>IP: {s.ip}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        Último acesso: {formatDate(s.lastActiveAt)}
                      </div>
                    </div>
                  </div>
                  {!s.isCurrent && (
                    <button onClick={() => revokeSession(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}>
                      <LogOut size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {sessions.length === 0 && (
              <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>
                Nenhuma sessão activa encontrada.
              </div>
            )}
          </div>
        )}

        {/* ── TAB LOG ─────────────────────────────────────────────────────────── */}
        {activeTab === "log" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>Últimos 50 eventos</span>
              <button onClick={loadLogs} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                <RefreshCw size={16} />
              </button>
            </div>

            {logs.map(l => (
              <div key={l.id} style={{ ...card, marginBottom: 8, padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
                    <div>
                      <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{l.label}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>{l.device} · IP: {l.ip}</div>
                    </div>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12, textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                    {formatDate(l.createdAt)}
                  </div>
                </div>
              </div>
            ))}

            {logs.length === 0 && (
              <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>
                Nenhum evento registado ainda.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
