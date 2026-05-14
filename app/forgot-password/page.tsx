"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        // Após 2 segundos, redireciona para a página de reset
        setTimeout(() => {
          router.push(`/reset-password?email=${encodeURIComponent(email)}`);
        }, 2000);
      } else {
        setError(data.error || "Erro ao solicitar recuperação");
      }
    } catch (err) {
      setError("Falha na ligação ao servidor");
    } finally {
      setLoading(false);
    }
  }

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
            <div style={{
              width: 48, height: 48, background: "#f5a623",
              borderRadius: 10, display: "flex", alignItems: "center",
              justifyContent: "center",
            }}>
              <TrendingUp size={28} color="#0a0f1e" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", letterSpacing: 0.5 }}>
                Dynamics Works
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: "#111827", border: "1px solid #1e2d50",
          borderRadius: 16, padding: 32,
        }}>
          <button
            onClick={() => router.push("/login")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", color: "#94a3b8",
              fontSize: 13, cursor: "pointer", marginBottom: 20, padding: 0,
            }}
          >
            <ArrowLeft size={14} /> Voltar para o login
          </button>

          <h1 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 8, margin: "0 0 8px" }}>
            Recuperar senha
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 24px" }}>
            Introduz o teu email e enviaremos um código para redefinir a tua senha.
          </p>

          {success && (
            <div style={{
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <CheckCircle size={16} color="#22c55e" />
              <span style={{ color: "#22c55e", fontSize: 14 }}>Código enviado! Redirecionando...</span>
            </div>
          )}

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertCircle size={16} color="#ef4444" />
              <span style={{ color: "#ef4444", fontSize: 14 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 24 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>
                Email da conta
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  required
                  style={{
                    width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
                    borderRadius: 8, padding: "11px 12px 11px 38px", color: "#ffffff",
                    fontSize: 14, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              style={{
                width: "100%", background: (loading || success) ? "#7a5118" : "#f5a623",
                color: "#0a0f1e", border: "none", borderRadius: 8,
                padding: "13px", fontSize: 15, fontWeight: 700,
                cursor: (loading || success) ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "A enviar..." : "Enviar código"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
