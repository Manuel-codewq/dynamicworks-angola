"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, Key, Lock, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 2500);
      } else {
        setError(data.error || "Erro ao redefinir senha");
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
          <h1 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 8, margin: "0 0 8px" }}>
            Nova senha
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 24px" }}>
            Introduz o código enviado para <strong style={{ color: "#fff" }}>{email}</strong> e escolhe uma nova senha.
          </p>

          {success && (
            <div style={{
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <CheckCircle size={16} color="#22c55e" />
              <span style={{ color: "#22c55e", fontSize: 14 }}>Senha alterada! Redirecionando para o login...</span>
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
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>
                Código de 6 dígitos
              </label>
              <div style={{ position: "relative" }}>
                <Key size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  required
                  style={{
                    width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
                    borderRadius: 8, padding: "11px 12px 11px 38px", color: "#ffffff",
                    fontSize: 16, letterSpacing: "4px", fontWeight: "700", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>
                Nova senha
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
                    borderRadius: 8, padding: "11px 40px 11px 38px", color: "#ffffff",
                    fontSize: 14, outline: "none", boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                  }}
                >
                  {showPass
                    ? <EyeOff size={16} color="#94a3b8" />
                    : <Eye size={16} color="#94a3b8" />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>
                Confirmar nova senha
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type={showPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
                    borderRadius: 8, padding: "11px 40px 11px 38px", color: "#ffffff",
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
              {loading ? "A alterar..." : "Alterar senha"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
