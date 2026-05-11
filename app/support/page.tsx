"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, MessageCircle, Plus, Send, X,
  Clock, CheckCircle, AlertCircle, Inbox, Loader2,
} from "lucide-react";

const CATEGORIES: Record<string, { label: string; color: string }> = {
  deposito:    { label: "Depósito",       color: "#22c55e" },
  levantamento:{ label: "Levantamento",   color: "#f5a623" },
  kyc:         { label: "KYC",            color: "#a855f7" },
  conta:       { label: "Conta",          color: "#3b82f6" },
  tecnico:     { label: "Técnico",        color: "#ef4444" },
  outro:       { label: "Outro",          color: "#64748b" },
};

const STATUS: Record<string, { label: string; color: string; Icon: any }> = {
  open:        { label: "Aberto",       color: "#22c55e", Icon: AlertCircle  },
  in_progress: { label: "Em análise",  color: "#f5a623", Icon: Clock        },
  closed:      { label: "Resolvido",   color: "#64748b", Icon: CheckCircle  },
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function SupportPage() {
  const { status } = useSession();
  const router     = useRouter();

  const [tickets,      setTickets]      = useState<any[]>([]);
  const [active,       setActive]       = useState<any | null>(null);
  const [messages,     setMessages]     = useState<any[]>([]);
  const [loadingList,  setLoadingList]  = useState(true);
  const [loadingChat,  setLoadingChat]  = useState(false);
  const [sending,      setSending]      = useState(false);
  const [msgInput,     setMsgInput]     = useState("");
  const [showNew,      setShowNew]      = useState(false);
  const [newSubject,   setNewSubject]   = useState("");
  const [newCategory,  setNewCategory]  = useState("outro");
  const [newBody,      setNewBody]      = useState("");
  const [creating,     setCreating]     = useState(false);
  const [newErr,       setNewErr]       = useState("");
  const chatBottom = useRef<HTMLDivElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const loadTickets = useCallback(async () => {
    const r = await fetch("/api/support");
    if (r.ok) setTickets(await r.json());
    setLoadingList(false);
  }, []);

  useEffect(() => { if (status === "authenticated") loadTickets(); }, [status, loadTickets]);

  const openTicket = useCallback(async (t: any) => {
    setActive(t);
    setLoadingChat(true);
    const r = await fetch(`/api/support/${t.id}`);
    if (r.ok) { const d = await r.json(); setMessages(d.messages ?? []); }
    setLoadingChat(false);
  }, []);

  // Polling das mensagens a cada 5s quando ticket aberto
  useEffect(() => {
    if (!active) { if (pollRef.current) clearInterval(pollRef.current); return; }
    const poll = async () => {
      const r = await fetch(`/api/support/${active.id}`);
      if (r.ok) { const d = await r.json(); setMessages(d.messages ?? []); }
    };
    pollRef.current = setInterval(poll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [active]);

  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage() {
    if (!msgInput.trim() || !active || sending) return;
    setSending(true);
    const body = msgInput.trim();
    setMsgInput("");
    const r = await fetch(`/api/support/${active.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (r.ok) {
      const msg = await r.json();
      setMessages(prev => [...prev, msg]);
      loadTickets();
    }
    setSending(false);
  }

  async function createTicket() {
    setNewErr("");
    if (newSubject.trim().length < 5) { setNewErr("Assunto deve ter pelo menos 5 caracteres."); return; }
    if (newBody.trim().length < 10)   { setNewErr("Mensagem deve ter pelo menos 10 caracteres."); return; }
    setCreating(true);
    const r = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: newSubject, category: newCategory, body: newBody }),
    });
    if (r.ok) {
      const t = await r.json();
      setShowNew(false);
      setNewSubject(""); setNewCategory("outro"); setNewBody("");
      await loadTickets();
      openTicket(t);
    } else {
      const d = await r.json();
      setNewErr(d.error ?? "Erro ao criar ticket.");
    }
    setCreating(false);
  }

  const s = active ? (STATUS[active.status] ?? STATUS.open) : null;

  if (status === "loading") return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={32} color="#f5a623" className="animate-spin" />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={() => active ? setActive(null) : router.back()}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ width: 32, height: 32, background: "#1e2d50", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MessageCircle size={16} color="#f5a623" />
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>
            {active ? active.subject : "Suporte"}
          </span>
          {active && s && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
              <s.Icon size={11} color={s.color} />
              <span style={{ color: s.color, fontSize: 11, fontWeight: 600 }}>{s.label}</span>
            </div>
          )}
        </div>
        {!active && (
          <button onClick={() => setShowNew(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#f5a623", color: "#0a0f1e", border: "none", borderRadius: 9, padding: "8px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
            <Plus size={15} /> Novo ticket
          </button>
        )}
      </div>

      {/* ── LISTA DE TICKETS ── */}
      {!active && (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {loadingList ? (
            <div style={{ textAlign: "center", padding: 60 }}>
              <Loader2 size={28} color="#f5a623" />
            </div>
          ) : tickets.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <Inbox size={48} color="#1e2d50" style={{ marginBottom: 16 }} />
              <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>Nenhum ticket ainda.</p>
              <p style={{ color: "#4b5563", fontSize: 13, marginTop: 6 }}>Clica em <strong style={{ color: "#f5a623" }}>Novo ticket</strong> para pedir ajuda.</p>
            </div>
          ) : tickets.map(t => {
            const st = STATUS[t.status] ?? STATUS.open;
            const cat = CATEGORIES[t.category] ?? CATEGORIES.outro;
            const last = t.messages?.[0];
            return (
              <div key={t.id} onClick={() => openTicket(t)}
                style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer", transition: "border-color .2s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#f5a623")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e2d50")}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{t.subject}</span>
                      <span style={{ background: `${cat.color}18`, color: cat.color, borderRadius: 5, fontSize: 10, fontWeight: 700, padding: "1px 7px" }}>{cat.label}</span>
                    </div>
                    {last && <p style={{ color: "#64748b", fontSize: 12, margin: 0, lineHeight: 1.4 }}>{last.isAdmin ? "Suporte: " : "Tu: "}{last.body.slice(0, 80)}{last.body.length > 80 ? "…" : ""}</p>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <span style={{ color: "#4b5563", fontSize: 11 }}>{timeAgo(t.updatedAt)}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, background: `${st.color}18`, borderRadius: 5, padding: "2px 7px" }}>
                      <st.Icon size={10} color={st.color} />
                      <span style={{ color: st.color, fontSize: 10, fontWeight: 700 }}>{st.label}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CHAT DO TICKET ── */}
      {active && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            {loadingChat ? (
              <div style={{ textAlign: "center", padding: 40 }}><Loader2 size={24} color="#f5a623" /></div>
            ) : messages.map(m => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.isAdmin ? "flex-start" : "flex-end", marginBottom: 10 }}>
                <div style={{
                  maxWidth: "78%", borderRadius: m.isAdmin ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                  background: m.isAdmin ? "#111827" : "rgba(245,166,35,0.15)",
                  border: m.isAdmin ? "1px solid #1e2d50" : "1px solid rgba(245,166,35,0.3)",
                  padding: "10px 14px",
                }}>
                  {m.isAdmin && <div style={{ color: "#f5a623", fontSize: 10, fontWeight: 800, marginBottom: 4, letterSpacing: 0.5 }}>SUPORTE</div>}
                  <p style={{ color: "#e2e8f0", fontSize: 14, margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.body}</p>
                  <div style={{ color: "#4b5563", fontSize: 10, marginTop: 5, textAlign: "right" }}>{timeAgo(m.createdAt)}</div>
                </div>
              </div>
            ))}
            <div ref={chatBottom} />
          </div>

          {/* Input */}
          {active.status !== "closed" ? (
            <div style={{ background: "#111827", borderTop: "1px solid #1e2d50", padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-end" }}>
              <textarea
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Escreve a tua mensagem…"
                rows={1}
                style={{ flex: 1, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 10, padding: "10px 13px", color: "#fff", fontSize: 14, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5 }}
              />
              <button onClick={sendMessage} disabled={sending || !msgInput.trim()}
                style={{ width: 42, height: 42, background: "#f5a623", border: "none", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, opacity: sending || !msgInput.trim() ? 0.5 : 1 }}>
                {sending ? <Loader2 size={18} color="#0a0f1e" /> : <Send size={18} color="#0a0f1e" />}
              </button>
            </div>
          ) : (
            <div style={{ background: "#111827", borderTop: "1px solid #1e2d50", padding: "14px 16px", textAlign: "center" }}>
              <span style={{ color: "#64748b", fontSize: 13 }}>Este ticket foi resolvido e está fechado.</span>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL NOVO TICKET ── */}
      {showNew && (
        <>
          <div onClick={() => setShowNew(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 201, background: "#111827", border: "1px solid #1e2d50", borderRadius: "20px 20px 0 0", padding: "24px 20px 32px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "#fff", fontWeight: 800, fontSize: 17, margin: 0 }}>Novo ticket de suporte</h2>
              <button onClick={() => setShowNew(false)} style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}><X size={16} color="#64748b" /></button>
            </div>

            <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Categoria</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <button key={k} onClick={() => setNewCategory(k)}
                  style={{ padding: "6px 13px", borderRadius: 8, border: `1px solid ${newCategory === k ? v.color : "#1e2d50"}`, background: newCategory === k ? `${v.color}18` : "#0d1526", color: newCategory === k ? v.color : "#64748b", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  {v.label}
                </button>
              ))}
            </div>

            <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Assunto *</label>
            <input value={newSubject} onChange={e => setNewSubject(e.target.value)}
              placeholder="Ex: Depósito de 5.000 Kz não foi creditado"
              style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 9, padding: "11px 13px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 14 }} />

            <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>Descreve o problema *</label>
            <textarea value={newBody} onChange={e => setNewBody(e.target.value)} rows={4}
              placeholder="Descreve o problema com o máximo de detalhe possível…"
              style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 9, padding: "10px 13px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit", lineHeight: 1.6, marginBottom: 14 }} />

            {newErr && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{newErr}</div>}

            <button onClick={createTicket} disabled={creating}
              style={{ width: "100%", background: "#f5a623", border: "none", borderRadius: 12, padding: "14px", color: "#0a0f1e", fontWeight: 800, fontSize: 15, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {creating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {creating ? "A enviar…" : "Enviar ticket"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
