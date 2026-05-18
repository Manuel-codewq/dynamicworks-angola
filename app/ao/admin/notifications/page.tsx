"use client";
import { useEffect, useState } from "react";
import { Send, Users, User, Bell, RefreshCw, CheckCircle, Zap, Rocket, Trophy, Wrench, BadgeCheck, Gift, BarChart2 } from "lucide-react";

interface SentNotif { id: string; title: string; message: string; createdAt: string; }

function formatDate(s: string) {
  return new Date(s).toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" });
}

const TEMPLATES = [
  {
    label: "Novas funcionalidades",
    icon: Rocket,
    title: "Grande actualização — novas funcionalidades!",
    message: `A plataforma acaba de receber várias melhorias:

🏅 Conquistas — desbloqueia badges por alcançar metas no teu trading (vitórias, sequências, volume e muito mais).

📊 Ranking melhorado — filtra por Hoje, Semana, Mês ou Tudo. A tua posição aparece mesmo que não estejas no top 20.

🔔 Alertas de preço — define um preço alvo e recebe uma notificação quando o activo o atingir.

🎮 Torneios Demo — compite com outros traders usando a tua conta demo. Sem risco, com prémios reais.

📤 Partilha de trades — partilha os teus resultados directamente para o WhatsApp ou Instagram com um clique.

Acede à plataforma e explora tudo!`,
  },
  {
    label: "Promoção / bónus",
    icon: Gift,
    title: "Oferta especial para ti!",
    message: "Temos uma promoção exclusiva disponível agora. Acede à plataforma para saber mais e aproveitar antes que termine!",
  },
  {
    label: "Torneio novo",
    icon: Trophy,
    title: "Novo torneio disponível!",
    message: "Um novo torneio acabou de começar na Dynamics Works. Inscreve-te agora, compete com os melhores traders e ganha prémios em Kwanza! Acede a Ranking → Torneios para participar.",
  },
  {
    label: "Manutenção programada",
    icon: Wrench,
    title: "Manutenção programada",
    message: "Informamos que a plataforma estará em manutenção brevemente por melhorias técnicas. O serviço será restabelecido em breve. Pedimos desculpa pelo inconveniente.",
  },
  {
    label: "Sistema normal",
    icon: BadgeCheck,
    title: "Plataforma a funcionar normalmente",
    message: "A manutenção foi concluída com sucesso. A plataforma está totalmente operacional. Obrigado pela vossa paciência!",
  },
];

export default function AdminNotificationsPage() {
  const [title,    setTitle]    = useState("");
  const [message,  setMessage]  = useState("");
  const [target,   setTarget]   = useState<"all" | "user">("all");
  const [userId,   setUserId]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<{ sent: number } | null>(null);
  const [history,  setHistory]  = useState<SentNotif[]>([]);

  async function loadHistory() {
    const res = await fetch("/api/admin/notifications");
    if (res.ok) setHistory(await res.json());
  }

  useEffect(() => { loadHistory(); }, []);

  function applyTemplate(t: typeof TEMPLATES[0]) {
    setTitle(t.title);
    setMessage(t.message);
    setResult(null);
  }

  async function send() {
    if (!title.trim() || !message.trim()) return;
    setLoading(true); setResult(null);
    const body: Record<string, string> = { title, message };
    if (target === "user" && userId.trim()) body.targetUserId = userId.trim();
    const res = await fetch("/api/admin/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) {
      setResult(await res.json());
      setTitle(""); setMessage(""); setUserId("");
      loadHistory();
    }
    setLoading(false);
  }

  const charCount = message.length;

  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Notificações</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Envia mensagens e anúncios aos utilizadores</p>
      </div>

      {/* Templates */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>MODELOS RÁPIDOS</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TEMPLATES.map(t => (
            <button key={t.label} onClick={() => applyTemplate(t)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "#111827", border: "1px solid #1e2d50", borderRadius: 20, color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#f5a623"; e.currentTarget.style.color = "#f5a623"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e2d50"; e.currentTarget.style.color = "#94a3b8"; }}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Compose */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <Bell size={16} color="#f5a623" />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Compor notificação</span>
          </div>

          {/* Target */}
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {([["all", "Todos os utilizadores", Users], ["user", "Utilizador específico", User]] as const).map(([val, label, Icon]) => (
              <button key={val} onClick={() => setTarget(val)}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 8, border: `1px solid ${target === val ? "#f5a623" : "#1e2d50"}`, background: target === val ? "rgba(245,166,35,0.1)" : "transparent", color: target === val ? "#f5a623" : "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {target === "user" && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>ID DO UTILIZADOR</label>
              <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="cuid do utilizador"
                style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>TÍTULO *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da notificação"
              style={{ width: "100%", background: "#0d1526", border: `1px solid ${!title.trim() && result !== null ? "#ef4444" : "#1e2d50"}`, borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>MENSAGEM *</label>
              <span style={{ color: charCount > 800 ? "#ef4444" : "#475569", fontSize: 11 }}>{charCount} caracteres</span>
            </div>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={10}
              placeholder="Escreve a mensagem completa aqui. Podes usar emojis e quebras de linha."
              style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }} />
            <p style={{ color: "#475569", fontSize: 11, margin: "5px 0 0" }}>
              As quebras de linha são preservadas na visualização do utilizador.
            </p>
          </div>

          {result && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
              <CheckCircle size={14} color="#22c55e" />
              <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>Enviado para {result.sent} utilizador{result.sent !== 1 ? "es" : ""}</span>
            </div>
          )}

          <button onClick={send} disabled={loading || !title.trim() || !message.trim()}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 0", background: loading || !title.trim() || !message.trim() ? "#1e2d50" : "linear-gradient(135deg,#f5a623,#e8940f)", border: "none", borderRadius: 10, color: loading || !title.trim() || !message.trim() ? "#475569" : "#0a0f1e", fontWeight: 800, fontSize: 14, cursor: loading || !title.trim() || !message.trim() ? "not-allowed" : "pointer" }}>
            <Send size={15} /> {loading ? "A enviar..." : `Enviar${target === "all" ? " para todos" : " para utilizador"}`}
          </button>
        </div>

        {/* Preview + History */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Preview */}
          {(title || message) && (
            <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Zap size={14} color="#f5a623" />
                <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>PRÉ-VISUALIZAÇÃO</span>
              </div>
              <div style={{ background: "#0d1526", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(245,166,35,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Bell size={18} color="#f5a623" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{title || "Título da notificação"}</div>
                    <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{message || "Mensagem..."}</div>
                    <div style={{ color: "#475569", fontSize: 11, marginTop: 8 }}>agora mesmo</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* History */}
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 24, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Enviadas recentemente</span>
              <button onClick={loadHistory} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", display: "flex" }}>
                <RefreshCw size={14} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
              {history.length === 0 ? (
                <p style={{ color: "#334155", fontSize: 13 }}>Nenhuma notificação enviada ainda.</p>
              ) : history.map(n => (
                <div key={n.id} style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, flex: 1, minWidth: 0 }}>{n.title}</span>
                    <span style={{ color: "#334155", fontSize: 11, flexShrink: 0 }}>{formatDate(n.createdAt)}</span>
                  </div>
                  <p style={{ color: "#64748b", fontSize: 12, margin: 0, whiteSpace: "pre-wrap", maxHeight: 60, overflow: "hidden" }}>{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
