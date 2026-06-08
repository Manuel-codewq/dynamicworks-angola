"use client";
import { useState, Suspense, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Shield } from "lucide-react";

type Step = "credentials" | "2fa_email" | "2fa_totp";

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isVerified = params.get("verified") === "1";
  const [failedAttempts, setFailedAttempts] = useState(0);
  const MAX_ATTEMPTS = 5;

  useEffect(() => {
    if (status === "authenticated") router.replace("/trade");
  }, [status, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // ── Passo 1: credenciais (usa endpoint dedicado para 2FA fiável) ──────────
    if (step === "credentials") {
      const res  = await fetch("/api/auth/2fa/initiate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      setLoading(false);

      if (res.status === 429) {
        setError(data.error || "Demasiadas tentativas. Aguarda antes de tentar de novo.");
        return;
      }
      if (!res.ok || !data.valid) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        const remaining = MAX_ATTEMPTS - newAttempts;
        if (remaining <= 0) {
          setError("Conta temporariamente bloqueada. Recupera a senha ou tenta mais tarde.");
        } else if (remaining <= 2) {
          setError(`Email ou senha incorretos — ${remaining} tentativa${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}.`);
        } else {
          setError("Email ou senha incorretos");
        }
        return;
      }

      if (data.needs2fa) {
        setStep(data.method === "totp" ? "2fa_totp" : "2fa_email");
        setOtp("");
        return;
      }

      // Sem 2FA — fazer login directo
      const result = await signIn("credentials", {
        email, password, otp: "", redirect: false,
      });
      setLoading(false);
      if (!result?.error) { router.push("/trade"); return; }
      setError("Erro ao autenticar. Tenta novamente.");
      return;
    }

    // ── Passo 2: verificação OTP 2FA ──────────────────────────────────────────
    const result = await signIn("credentials", {
      email,
      password,
      otp,
      redirect: false,
    });

    setLoading(false);

    if (!result?.error) {
      router.push("/trade");
      return;
    }

    if (result.error === "2FA_INVALID") {
      setError("Código inválido. Tenta novamente.");
      setOtp("");
      return;
    }

    // Erro genérico no OTP
    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);
    const remaining = MAX_ATTEMPTS - newAttempts;
    if (remaining <= 0) {
      setError("Conta temporariamente bloqueada por excesso de tentativas. Tenta mais tarde ou recupera a senha.");
    } else if (remaining <= 2) {
      setError(`Email ou senha incorretos — ${remaining} tentativa${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}.`);
    } else {
      setError("Email ou senha incorretos");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
    borderRadius: 8, padding: "11px 12px 11px 38px", color: "#ffffff",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  const isCredentialsStep = step === "credentials";
  const is2FAStep = step === "2fa_email" || step === "2fa_totp";
  const btnDisabled = loading;

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
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", letterSpacing: 0.5 }}>Dynamic Works</div>
              <div style={{ fontSize: 12, color: "#f5a623", letterSpacing: 1 }}>PLATAFORMA DE NEGOCIAÇÃO</div>
            </div>
          </div>
        </div>

        <div style={{
          background: "#111827", border: "1px solid #1e2d50",
          borderRadius: 16, padding: 32,
        }}>
          {is2FAStep ? (
            <>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{
                  width: 52, height: 52, background: "rgba(245,166,35,0.1)",
                  border: "1px solid rgba(245,166,35,0.3)", borderRadius: 12,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 12,
                }}>
                  <Shield size={24} color="#f5a623" />
                </div>
                <h1 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>
                  Verificação em dois passos
                </h1>
                <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
                  {step === "2fa_email"
                    ? "Introduz o código de 6 dígitos enviado para o teu email."
                    : "Introduz o código do teu Google Authenticator."}
                </p>
              </div>

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
                <div style={{ marginBottom: 20 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    required
                    autoFocus
                    style={{
                      width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
                      borderRadius: 8, padding: "14px", color: "#ffffff",
                      fontSize: 28, fontWeight: 700, letterSpacing: 12,
                      outline: "none", boxSizing: "border-box", textAlign: "center",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  style={{
                    width: "100%", background: (loading || otp.length < 6) ? "#7a5118" : "#f5a623",
                    color: "#0a0f1e", border: "none", borderRadius: 8,
                    padding: "10px 16px", fontSize: 14, fontWeight: 700,
                    cursor: (loading || otp.length < 6) ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "A verificar..." : "Verificar"}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setOtp(""); setError(""); }}
                  style={{
                    width: "100%", background: "none", border: "none",
                    color: "#94a3b8", fontSize: 14, cursor: "pointer",
                    marginTop: 12, padding: "8px",
                  }}
                >
                  ← Voltar ao login
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>
                Entrar na conta
              </h1>
              <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 24px" }}>
                Bem-vindo de volta ao Dynamic Works
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
                  <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>Email</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="Pedromanuel@email.com" required style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ color: "#94a3b8", fontSize: 13 }}>Senha</label>
                    <a href="/forgot-password" style={{ color: "#f5a623", fontSize: 13, textDecoration: "none" }}>
                      Esqueci a senha
                    </a>
                  </div>
                  <div style={{ position: "relative" }}>
                    <Lock size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type={showPass ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" required
                      style={{ ...inputStyle, paddingRight: 40 }}
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      {showPass ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={btnDisabled}
                  style={{
                    width: "100%", background: btnDisabled ? "#7a5118" : "#f5a623",
                    color: "#0a0f1e", border: "none", borderRadius: 8,
                    padding: "10px 16px", fontSize: 14, fontWeight: 700,
                    cursor: btnDisabled ? "not-allowed" : "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  {loading ? "A entrar..." : "Entrar"}
                </button>
              </form>

              {failedAttempts >= 3 && failedAttempts < MAX_ATTEMPTS && (
                <div style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 8, padding: "10px 14px", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "#f5a623", fontSize: 13 }}>
                    {MAX_ATTEMPTS - failedAttempts} tentativa{MAX_ATTEMPTS - failedAttempts === 1 ? "" : "s"} restante{MAX_ATTEMPTS - failedAttempts === 1 ? "" : "s"}
                  </span>
                  <a href="/forgot-password" style={{ color: "#f5a623", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Recuperar senha →</a>
                </div>
              )}

              <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 14, marginTop: 20, margin: "20px 0 0" }}>
                Não tem conta?{" "}
                <a href="/register" style={{ color: "#f5a623", textDecoration: "none", fontWeight: 600 }}>
                  Registar
                </a>
              </p>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", color: "#4a5568", fontSize: 12, marginTop: 20 }}>
          © 2025 Dynamic Works · Angola ·{" "}
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
