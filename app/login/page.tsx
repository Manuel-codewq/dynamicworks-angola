"use client";
import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isVerified = params.get("verified") === "1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email ou senha incorretos");
    } else {
      router.push("/trade");
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
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 12,
          }}>
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
              <div style={{ fontSize: 12, color: "#f5a623", letterSpacing: 1 }}>
                PLATAFORMA DE NEGOCIAÇÃO
              </div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "#111827", border: "1px solid #1e2d50",
          borderRadius: 16, padding: 32,
        }}>
          <h1 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 6, margin: "0 0 6px" }}>
            Entrar na conta
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 24px" }}>
            Bem-vindo de volta ao Dynamics Works
          </p>

          {isVerified && (
            <div style={{
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <CheckCircle size={16} color="#22c55e" />
              <span style={{ color: "#22c55e", fontSize: 14 }}>Email verificado! Podes entrar agora.</span>
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
                Email
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Pedromanuel@email.com"
                  required
                  style={{
                    width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
                    borderRadius: 8, padding: "11px 12px 11px 38px", color: "#ffffff",
                    fontSize: 14, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>
                Senha
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

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", background: loading ? "#7a5118" : "#f5a623",
                color: "#0a0f1e", border: "none", borderRadius: 8,
                padding: "13px", fontSize: 15, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {loading ? "A entrar..." : "Entrar"}
            </button>
          </form>

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 14, marginTop: 20, margin: "20px 0 0" }}>
            Não tem conta?{" "}
            <a href="/register" style={{ color: "#f5a623", textDecoration: "none", fontWeight: 600 }}>
              Registar
            </a>
          </p>
        </div>

        <p style={{ textAlign: "center", color: "#4a5568", fontSize: 12, marginTop: 20 }}>
          © 2025 Dynamics Works · Angola ·{" "}
          <a href="/terms" style={{ color: "#94a3b8", textDecoration: "none" }}>Termos de Uso</a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
