"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect, Suspense } from "react";

function VerifyEmailContent() {
  const params   = useSearchParams();
  const router   = useRouter();
  const email    = params.get("email") ?? "";

  const [digits, setDigits]     = useState(["", "", "", "", "", ""]);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent]     = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function handleInput(i: number, val: string) {
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    setError("");
    if (char && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    const next = [...digits];
    text.split("").forEach((ch, idx) => { if (idx < 6) next[idx] = ch; });
    setDigits(next);
    const focus = Math.min(text.length, 5);
    inputRefs.current[focus]?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) { setError("Introduz todos os 6 dígitos"); return; }
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/auth/verify-email", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao verificar"); return; }
      router.push("/login?verified=1");
    } catch {
      setError("Erro de rede. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setResending(true);
    setResent(false);
    setError("");
    try {
      const res  = await fetch("/api/auth/resend-verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao reenviar"); return; }
      setResent(true);
      setCountdown(60);
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch {
      setError("Erro de rede. Tenta novamente.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
          <div style={{ width: 38, height: 38, background: "#f5a623", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#0a0f1e", fontSize: 20, fontWeight: 900 }}>D</span>
          </div>
          <span style={{ color: "#f5a623", fontSize: 18, fontWeight: 800, letterSpacing: "-0.3px" }}>Dynamics Works</span>
        </div>

        {/* Card */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, padding: "36px 32px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✉️</div>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>Verifica o teu email</h1>
            <p style={{ color: "#64748b", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
              Enviámos um código de 6 dígitos para<br />
              <span style={{ color: "#94a3b8", fontWeight: 600 }}>{email || "o teu email"}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* OTP inputs */}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 24 }} onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleInput(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  style={{
                    width: 52, height: 60, textAlign: "center", fontSize: 26, fontWeight: 800,
                    background: "#0a0f1e", border: `2px solid ${d ? "#f5a623" : "#1e2d50"}`,
                    borderRadius: 10, color: "#fff", outline: "none",
                    transition: "border-color 0.15s",
                    caretColor: "#f5a623",
                  }}
                />
              ))}
            </div>

            {error && (
              <p style={{ color: "#ef4444", fontSize: 13, textAlign: "center", margin: "0 0 16px" }}>{error}</p>
            )}
            {resent && (
              <p style={{ color: "#22c55e", fontSize: 13, textAlign: "center", margin: "0 0 16px" }}>Novo código enviado!</p>
            )}

            <button
              type="submit"
              disabled={loading || digits.join("").length < 6}
              style={{
                width: "100%", padding: "14px", background: loading || digits.join("").length < 6 ? "#374151" : "#f5a623",
                color: loading || digits.join("").length < 6 ? "#6b7280" : "#0a0f1e",
                fontWeight: 800, fontSize: 15, border: "none", borderRadius: 10,
                cursor: loading || digits.join("").length < 6 ? "not-allowed" : "pointer",
                transition: "background 0.2s, color 0.2s", marginBottom: 16,
              }}
            >
              {loading ? "A verificar..." : "Verificar conta"}
            </button>
          </form>

          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 8px" }}>Não recebeste o código?</p>
            <button
              onClick={handleResend}
              disabled={resending || countdown > 0}
              style={{
                background: "none", border: "none", cursor: countdown > 0 || resending ? "not-allowed" : "pointer",
                color: countdown > 0 || resending ? "#374151" : "#f5a623",
                fontSize: 14, fontWeight: 700, padding: 0,
              }}
            >
              {resending ? "A reenviar..." : countdown > 0 ? `Reenviar em ${countdown}s` : "Reenviar código"}
            </button>
          </div>
        </div>

        <p style={{ textAlign: "center", color: "#374151", fontSize: 13, marginTop: 24 }}>
          Já tens conta?{" "}
          <a href="/login" style={{ color: "#f5a623", fontWeight: 700, textDecoration: "none" }}>Entrar</a>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
