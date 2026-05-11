"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  MessageCircle, Send, Clock, CheckCircle, AlertCircle,
  User, ChevronLeft, Loader2, Inbox, Check,
} from "lucide-react";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  open:        { label: "Aberto",      color: "#22c55e", bg: "rgba(34,197,94,0.1)",   Icon: AlertCircle },
  in_progress: { label: "Em análise", color: "#f5a623", bg: "rgba(245,166,35,0.1)",  Icon: Clock       },
  closed:      { label: "Resolvido",  color: "#64748b", bg: "rgba(100,116,139,0.1)", Icon: CheckCircle },
};

const CATEGORIES: Record<string, string> = {
  deposito: "Depósito", levantamento: "Levantamento", kyc: "KYC",
  conta: "Conta", tecnico: "Técnico", outro: "Outro",
};

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function AdminSupportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab,      setTab]      = useState<"open" | "in_progress" | "closed">("open");
  const [tickets,  setTickets]  = useState<any[]>([]);
  const [active,   setActive]   = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply,    setReply]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const chatBottom = useRef<HTMLDivElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role !== "admin") router.push("/trade");
  }, [status, session, router]);

  const loadTickets = useCallback(async () => {
    const r = await fetch(`/api/admin/support?status=${tab}`);
    if (r.ok) setTickets(await r.json());
    setLoading(false);
  }, [tab]);

  useEffect(() => { if (status === "authenticated") { setLoading(true); loadTickets(); } }, [status, tab, loadTickets]);

  const openTicket = useCallback(async (t: any) => {
    setActive(t);
    const r = await fetch(`/api/admin/support/${t.id}`);
    if (r.ok) { const d = await r.json(); setMessages(d.messages ?? []); }
  }, []);

  useEffect(() => {
    if (!active) { if (pollRef.current) clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(async () => {
      const r = await fetch(`/api/admin/support/${active.id}`);
      if (r.ok) { const d = await r.json(); setMessages(d.messages ?? []); }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [active]);

  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendReply() {
    if (!reply.trim() || !active || sending) return;
    setSending(true);
    const body = reply.trim();
    setReply("");
    const r = await fetch(`/api/admin/support/${active.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (r.ok) {
      const msg = await r.json();
      setMessages(prev => [...prev, msg]);
      setActive((a: any) => a ? { ...a, status: "in_progress" } : a);
      loadTickets();
    }
    setSending(false);
  }

  async function setStatus(ticketId: string, newStatus: string) {
    await fetch(`/api/admin/support/${ticketId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setActive((a: any) => a ? { ...a, status: newStatus } : a);
    loadTickets();
  }

  const counts = { open: 0, in_progress: 0, closed: 0 };
  tickets.forEach(t => { if (counts[t.status as keyof typeof counts] !== undefined) counts[t.status as keyof typeof counts]++; });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        {active && (
          <button onClick={() => setActive(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: 4 }}>
            <ChevronLeft size={20} />
          </button>
        )}
        <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#f5a623,#e8940f)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MessageCircle size={18} color="#0a0f1e" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "#fff", fontWeight: 900, fontSize: 18, margin: 0 }}>
            {active ? active.subject : "Suporte ao Cliente"}
          </h1>
          {active && (
            <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>
              {active.user?.name} · {active.user?.email}
            </p>
          )}
        </div>
        {active && (
          <div style={{ display: "flex", gap: 8 }}>
            {active.status !== "in_progress" && (
              <button onClick={() => setStatus(active.id, "in_progress")}
                style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 8, padding: "6px 12px", color: "#f5a623", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                Em análise
              </button>
            )}
            {active.status !== "closed" && (
              <button onClick={() => setStatus(active.id, "closed")}
                style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "6px 12px", color: "#22c55e", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Check size={13} /> Resolver
              </button>
            )}
            {active.status === "closed" && (
              <button onClick={() => setStatus(active.id, "open")}
                style={{ background: "rgba(100,116,139,0.1)", border: "1px solid rgba(100,116,139,0.3)", borderRadius: 8, padding: "6px 12px", color: "#94a3b8", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                Reabrir
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      {!active && (
        <div style={{ display: "flex", background: "#111827", borderBottom: "1px solid #1e2d50" }}>
          {(["open", "in_progress", "closed"] as const).map(t => {
            const cfg = STATUS_CFG[t];
            return (
              <button key={t} onClick={() => setTab(t)}
                style={{ flex: 1, padding: "12px 0", background: "none", border: "none", borderBottom: `2px solid ${tab === t ? cfg.color : "transparent"}`, color: tab === t ? cfg.color : "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                <cfg.Icon size={13} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── LISTA ── */}
      {!active && (
        <div style={{ flex: 1, overflowY: "auto", padding: 16, maxWidth: 800, width: "100%", margin: "0 auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60 }}><Loader2 size={28} color="#f5a623" /></div>
          ) : tickets.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <Inbox size={48} color="#1e2d50" style={{ marginBottom: 16 }} />
              <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>Nenhum ticket {STATUS_CFG[tab]?.label.toLowerCase()}.</p>
            </div>
          ) : tickets.map(t => {
            const st = STATUS_CFG[t.status] ?? STATUS_CFG.open;
            const last = t.messages?.[0];
            return (
              <div key={t.id} onClick={() => openTicket(t)}
                style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer", transition: "border-color .2s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#f5a623")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e2d50")}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{t.subject}</span>
                      <span style={{ background: st.bg, color: st.color, borderRadius: 5, fontSize: 10, fontWeight: 700, padding: "1px 7px" }}>{st.label}</span>
                      <span style={{ background: "#0d1526", color: "#64748b", borderRadius: 5, fontSize: 10, fontWeight: 600, padding: "1px 7px" }}>{CATEGORIES[t.category] ?? t.category}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      <User size={12} color="#64748b" />
                      <span style={{ color: "#64748b", fontSize: 12 }}>{t.user?.name} · {t.user?.email}</span>
                    </div>
                    {last && <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>{last.isAdmin ? "Tu: " : `${t.user?.name?.split(" ")[0]}: `}{last.body.slice(0, 90)}{last.body.length > 90 ? "…" : ""}</p>}
                  </div>
                  <div style={{ color: "#4b5563", fontSize: 11, flexShrink: 0 }}>{timeAgo(t.updatedAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CHAT ── */}
      {active && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", maxWidth: 800, width: "100%", margin: "0 auto", alignSelf: "center" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {messages.map(m => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.isAdmin ? "flex-end" : "flex-start", marginBottom: 10 }}>
                <div style={{
                  maxWidth: "78%", borderRadius: m.isAdmin ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                  background: m.isAdmin ? "rgba(245,166,35,0.15)" : "#111827",
                  border: m.isAdmin ? "1px solid rgba(245,166,35,0.3)" : "1px solid #1e2d50",
                  padding: "10px 14px",
                }}>
                  {!m.isAdmin && <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>{active.user?.name?.split(" ")[0]?.toUpperCase()}</div>}
                  {m.isAdmin  && <div style={{ color: "#f5a623", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>SUPORTE (tu)</div>}
                  <p style={{ color: "#e2e8f0", fontSize: 14, margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.body}</p>
                  <div style={{ color: "#4b5563", fontSize: 10, marginTop: 5, textAlign: "right" }}>{timeAgo(m.createdAt)}</div>
                </div>
              </div>
            ))}
            <div ref={chatBottom} />
          </div>

          <div style={{ background: "#111827", borderTop: "1px solid #1e2d50", padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
              placeholder="Responde ao utilizador…"
              rows={2}
              style={{ flex: 1, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 10, padding: "10px 13px", color: "#fff", fontSize: 14, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5 }}
            />
            <button onClick={sendReply} disabled={sending || !reply.trim()}
              style={{ width: 42, height: 42, background: "#f5a623", border: "none", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, opacity: sending || !reply.trim() ? 0.5 : 1 }}>
              {sending ? <Loader2 size={18} color="#0a0f1e" /> : <Send size={18} color="#0a0f1e" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
