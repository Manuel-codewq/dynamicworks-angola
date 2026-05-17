"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, KeyRound, Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";

function getStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: "Fraca",  color: "#ef4444" };
  if (score <= 2) return { score, label: "Média",  color: "#f59e0b" };
  if (score <= 3) return { score, label: "Boa",    color: "#f5a623" };
  return             { score, label: "Forte", color: "#22c55e" };
}

function ResetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email  = params.get("email") || "";

  const [code,    setCode]    = useState("");
  const [pwd,     setPwd]     = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

  const strength = getStrength(pwd);
  const pwdMatch = pwd.length > 0 && confirm.length > 0 && pwd === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd !== confirm)  { setError("As senhas não coincidem"); return; }
    if (pwd.length < 8)   { setError("A senha deve ter pelo menos 8 caracteres"); return; }
    setLoading(true); setError("");

    const res  = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password: pwd }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push("/login?reset=1"), 2500);
    } else {
      setError(data.error || "Erro ao redefinir senha.");
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
            <div style={{ width: 48, height: 48, background: "#f5a623", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={28} color="#0a0f1e" strokeWidth={2.5} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", letterSpacing: 0.5 }}>Dynamics Works</div>
          </div>
        </div>

        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, padding: 32 }}>

          <button onClick={() => router.push("/forgot-password")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", marginBottom: 20, padding: 0 }}>
            <ArrowLeft size={14} /> Voltar
          </button>

          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <KeyRound size={26} color="#f5a623" />
            </div>
            <h1 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Nova senha</h1>
            <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
              Código enviado para <strong style={{ color: "#fff" }}>{email || "o teu email"}</strong>
            </p>
          </div>

          {success && (
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle size={18} color="#22c55e" />
              <div>
                <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>Senha alterada!</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>A redirecionar para o login...</div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <AlertCircle size={18} color="#ef4444" />
              <span style={{ color: "#ef4444", fontSize: 13 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Código */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>Código de 6 dígitos</label>
              <div style={{ position: "relative" }}>
                <KeyRound size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input type="text" inputMode="numeric" value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" required autoFocus
                  style={{ ...inp, fontSize: 22, letterSpacing: 10, fontWeight: 700, textAlign: "center", paddingLeft: 12 }} />
              </div>
            </div>

            {/* Nova senha */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>Nova senha</label>
              <div style={{ position: "relative" }}>
                <Lock size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input type={showPwd ? "text" : "password"} value={pwd} onChange={e => setPwd(e.target.value)}
                  placeholder="Mínimo 8 caracteres" required
                  style={{ ...inp, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  {showPwd ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
                </button>
              </div>
            </div>

            {/* Indicador de força */}
            {pwd.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= strength.score ? strength.color : "#1e2d50", transition: "background 0.3s" }} />
                  ))}
                </div>
                <div style={{ color: strength.color, fontSize: 12, fontWeight: 600 }}>Força: {strength.label}</div>
              </div>
            )}

            {/* Confirmar senha */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>Confirmar nova senha</label>
              <div style={{ position: "relative" }}>
                <Lock size={16} color={confirm.length > 0 ? (pwdMatch ? "#22c55e" : "#ef4444") : "#94a3b8"}
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input type={showPwd ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repetir senha" required
                  style={{ ...inp, border: `1px solid ${confirm.length > 0 ? (pwdMatch ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)") : "#1e2d50"}` }} />
                {confirm.length > 0 && (
                  <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
                    {pwdMatch
                      ? <CheckCircle size={16} color="#22c55e" />
                      : <AlertCircle size={16} color="#ef4444" />}
                  </div>
                )}
              </div>
              {confirm.length > 0 && !pwdMatch && (
                <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>As senhas não coincidem</div>
              )}
            </div>

            <button type="submit" disabled={loading || success || !pwdMatch || code.length < 6}
              style={{
                width: "100%",
                background: (loading || success || !pwdMatch || code.length < 6) ? "#1e2d50" : "#f5a623",
                color: (loading || success || !pwdMatch || code.length < 6) ? "#94a3b8" : "#0a0f1e",
                border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700,
                cursor: (loading || success || !pwdMatch || code.length < 6) ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              {loading ? (
                <>
                  <div style={{ width: 16, height: 16, border: "2px solid #64748b", borderTopColor: "#f5a623", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                  A alterar...
                </>
              ) : "Alterar senha"}
            </button>
          </form>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordContent /></Suspense>;
}
