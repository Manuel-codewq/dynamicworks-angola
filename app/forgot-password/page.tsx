"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Mail, ArrowLeft, CheckCircle, AlertCircle, Send, Clock } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email,      setEmail]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [sent,       setSent]       = useState(false);
  const [error,      setError]      = useState("");
  const [cooldown,   setCooldown]   = useState(0); // segundos até poder reenviar

  // Countdown do cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cooldown > 0) return;
    setLoading(true);
    setError("");

    const res  = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setSent(true);
      setCooldown(60); // 60s antes de poder reenviar
    } else if (res.status === 429) {
      setError("Demasiados pedidos. Aguarda 15 minutos antes de tentar novamente.");
      setCooldown(900);
    } else {
      setError(data.error || "Erro ao enviar código.");
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
    borderRadius: 8, padding: "11px 12px 11px 38px", color: "#ffffff",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1e", display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif", padding: "20px",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <img src="/logo-icon.jpeg" alt="Dynamic Works" style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 10, background: "#111827" }} />
            <div style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", letterSpacing: 0.5 }}>Dynamic Works</div>
          </div>
        </div>

        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, padding: 32 }}>

          <button onClick={() => router.push("/login")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", marginBottom: 20, padding: 0 }}>
            <ArrowLeft size={14} /> Voltar para o login
          </button>

          {/* Ícone central */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <Mail size={26} color="#f5a623" />
            </div>
            <h1 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Recuperar senha</h1>
            <p style={{ color: "#94a3b8", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
              {sent
                ? <>Enviámos um código para <strong style={{ color: "#fff" }}>{email}</strong>. Verifica o teu email e clica em continuar.</>
                : "Introduz o teu email e enviaremos um código de 6 dígitos para redefinir a senha."
              }
            </p>
          </div>

          {/* Mensagem de sucesso */}
          {sent && (
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle size={18} color="#22c55e" />
              <div>
                <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>Código enviado!</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>Verifica a pasta de spam se não o encontrares. Válido por 30 minutos.</div>
              </div>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <AlertCircle size={18} color="#ef4444" />
              <span style={{ color: "#ef4444", fontSize: 13 }}>{error}</span>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>Email da conta</label>
              <div style={{ position: "relative" }}>
                <Mail size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="exemplo@email.com" required style={inp} disabled={loading} />
              </div>
            </div>

            <button type="submit" disabled={loading || cooldown > 0}
              style={{
                width: "100%", background: (loading || cooldown > 0) ? "#1e2d50" : "#f5a623",
                color: (loading || cooldown > 0) ? "#94a3b8" : "#0a0f1e",
                border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700,
                cursor: (loading || cooldown > 0) ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "background 0.2s",
              }}>
              {loading ? (
                <>
                  <div style={{ width: 16, height: 16, border: "2px solid #64748b", borderTopColor: "#f5a623", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                  A enviar...
                </>
              ) : cooldown > 0 ? (
                <><Clock size={16} /> Reenviar em {cooldown}s</>
              ) : sent ? (
                <><Send size={16} /> Reenviar código</>
              ) : (
                <><Send size={16} /> Enviar código</>
              )}
            </button>
          </form>

          {/* Botão continuar (após enviar) */}
          {sent && (
            <button onClick={() => router.push(`/reset-password?email=${encodeURIComponent(email)}`)}
              style={{ width: "100%", marginTop: 12, background: "#22c55e", color: "#0a0f1e", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <CheckCircle size={16} /> Introduzir o código →
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
