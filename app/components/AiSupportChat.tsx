"use client";
import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Loader2, Bot, User, CheckCircle } from "lucide-react";

const HIDDEN_PATHS = ["/login", "/register", "/kyc", "/verify-email", "/terms", "/maintenance", "/trade"];
const HIDDEN_EXACT = ["/"];

type Message = { role: "user" | "assistant"; content: string };

const WELCOME: Message = {
  role:    "assistant",
  content: "Olá! Sou o assistente da Dynamic Works. Como posso ajudar?\n\nPodes perguntar sobre depósitos, levantamentos, KYC, trading ou qualquer outra dúvida.",
};

export default function AiSupportChat() {
  const { status }   = useSession();
  const pathname     = usePathname();
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [escalated, setEscalated] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

  if (status !== "authenticated") return null;
  if (HIDDEN_EXACT.includes(pathname)) return null;
  if (HIDDEN_PATHS.some(p => pathname.startsWith(p))) return null;

  async function send() {
    const text = input.trim();
    if (!text || loading || escalated) return;

    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res  = await fetch("/api/support/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ messages: next }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages(m => [...m, { role: "assistant", content: data.error ?? "Erro ao processar. Tenta novamente." }]);
        return;
      }

      setMessages(m => [...m, { role: "assistant", content: data.reply }]);
      if (data.escalated) setEscalated(true);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Erro de ligação. Tenta novamente." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div style={{ position: "fixed", bottom: 24, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse  { 0%,100% { box-shadow:0 4px 20px rgba(245,166,35,0.4) } 50% { box-shadow:0 4px 28px rgba(245,166,35,0.7) } }
        .dw-chat-bubble { animation: fadeUp .22s ease }
        .dw-chat-btn-pulse { animation: pulse 2s ease-in-out infinite }
      `}</style>

      {/* Janela de chat */}
      {open && (
        <div className="dw-chat-bubble" style={{
          width: 340, background: "#111827", border: "1px solid #1e2d50",
          borderRadius: 18, display: "flex", flexDirection: "column",
          boxShadow: "0 12px 48px rgba(0,0,0,0.6)", overflow: "hidden",
          maxHeight: "min(520px, calc(100vh - 120px))",
        }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg,#f5a623,#e8940f)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: "rgba(0,0,0,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Bot size={20} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0a0f1e" }}>Assistente Dynamic Works</div>
              <div style={{ fontSize: 11, color: "rgba(10,15,30,0.7)" }}>Resposta imediata por IA</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "rgba(10,15,30,0.7)" }}>
              <X size={18} />
            </button>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: m.role === "user" ? "#1e2d50" : "rgba(245,166,35,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {m.role === "user"
                    ? <User size={14} color="#94a3b8" />
                    : <Bot  size={14} color="#f5a623" />
                  }
                </div>
                <div style={{
                  maxWidth: "78%", padding: "9px 12px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.role === "user" ? "#1e3a5f" : "#0d1829",
                  border: "1px solid", borderColor: m.role === "user" ? "#2a4a7f" : "#1e2d50",
                  fontSize: 13, lineHeight: 1.5, color: "#e2e8f0",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(245,166,35,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bot size={14} color="#f5a623" />
                </div>
                <div style={{ padding: "9px 14px", background: "#0d1829", border: "1px solid #1e2d50", borderRadius: "14px 14px 14px 4px", display: "flex", gap: 5, alignItems: "center" }}>
                  {[0,1,2].map(j => (
                    <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "#f5a623", opacity: 0.6, animation: `pulse ${0.8 + j * 0.2}s ease-in-out infinite` }} />
                  ))}
                </div>
              </div>
            )}

            {escalated && (
              <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                <CheckCircle size={16} color="#22c55e" />
                <span style={{ fontSize: 12, color: "#22c55e" }}>Pedido enviado à equipa de suporte. Entraremos em contacto em breve.</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid #1e2d50", display: "flex", gap: 8, alignItems: "center", background: "#0d1829" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading || escalated}
              placeholder={escalated ? "Aguarda resposta da equipa..." : "Escreve a tua pergunta..."}
              style={{
                flex: 1, background: "#111827", border: "1px solid #1e2d50", borderRadius: 10,
                padding: "9px 12px", color: "#fff", fontSize: 13, outline: "none",
                opacity: escalated ? 0.5 : 1,
              }}
            />
            <button
              onClick={send}
              disabled={loading || escalated || !input.trim()}
              style={{
                width: 36, height: 36, borderRadius: 10, border: "none", cursor: "pointer",
                background: !input.trim() || loading || escalated ? "#1e2d50" : "linear-gradient(135deg,#f5a623,#e8940f)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background .2s", flexShrink: 0,
              }}>
              {loading
                ? <Loader2 size={16} color="#64748b" style={{ animation: "spin 1s linear infinite" }} />
                : <Send size={16} color={!input.trim() || escalated ? "#64748b" : "#0a0f1e"} />
              }
            </button>
          </div>
        </div>
      )}

      {/* Botão principal */}
      <button
        onClick={() => setOpen(v => !v)}
        className={!open ? "dw-chat-btn-pulse" : ""}
        style={{
          width: 52, height: 52, borderRadius: "50%",
          background: open ? "#1e2d50" : "linear-gradient(135deg,#f5a623,#e8940f)",
          border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background .2s",
        }}>
        {open ? <X size={22} color="#94a3b8" /> : <MessageCircle size={24} color="#0a0f1e" strokeWidth={2.5} />}
      </button>
    </div>
  );
}
