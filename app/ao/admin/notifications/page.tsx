"use client";
import { useEffect, useState } from "react";
import { Send, Users, User, Bell, RefreshCw, CheckCircle } from "lucide-react";

interface SentNotif { id: string; title: string; message: string; createdAt: string; }

function formatDate(s: string) {
  return new Date(s).toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" });
}

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

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Notificações</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Enviar mensagens aos utilizadores</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Compose */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <Bell size={16} color="#f5a623" />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Nova notificação</span>
          </div>

          {/* Target toggle */}
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
            <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>TÍTULO</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da notificação"
              style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>MENSAGEM</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Escreve a mensagem..."
              style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
          </div>

          {result && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
              <CheckCircle size={14} color="#22c55e" />
              <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>Enviado para {result.sent} utilizador{result.sent !== 1 ? "es" : ""}</span>
            </div>
          )}

          <button onClick={send} disabled={loading || !title.trim() || !message.trim()}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 0", background: "linear-gradient(135deg,#f5a623,#e8940f)", border: "none", borderRadius: 10, color: "#0a0f1e", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            <Send size={15} /> {loading ? "A enviar..." : "Enviar notificação"}
          </button>
        </div>

        {/* History */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <RefreshCw size={16} color="#94a3b8" />
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Enviadas recentemente</span>
            </div>
            <button onClick={loadHistory} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>
              <RefreshCw size={14} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {history.length === 0 ? (
              <p style={{ color: "#334155", fontSize: 13 }}>Nenhuma notificação enviada ainda.</p>
            ) : history.map(n => (
              <div key={n.id} style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{n.title}</span>
                  <span style={{ color: "#334155", fontSize: 11 }}>{formatDate(n.createdAt)}</span>
                </div>
                <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
