"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  TrendingUp, User, Mail, Lock, Phone, MapPin,
  Eye, EyeOff, AlertCircle, CheckCircle, Gift,
  Hash, Loader2, ShieldCheck,
} from "lucide-react";

const PROVINCES = [
  "Bengo","Benguela","Bié","Cabinda","Cuando Cubango","Cuanza Norte",
  "Cuanza Sul","Cunene","Huambo","Huíla","Luanda","Lunda Norte",
  "Lunda Sul","Malanje","Moxico","Namibe","Uíge","Zaire",
];

type NifState = "idle" | "loading" | "valid" | "invalid";

function RegisterContent() {
  const router  = useRouter();
  const params  = useSearchParams();
  const refCode = params.get("ref") ?? "";
  const { status } = useSession();

  useEffect(() => {
    if (status === "authenticated") router.replace("/trade");
  }, [status, router]);

  const [form, setForm] = useState({
    nif: "", name: "", email: "", password: "", phone: "", province: "",
  });
  const [nifState, setNifState]         = useState<NifState>("idle");
  const [nifError, setNifError]         = useState("");
  const [showPass, setShowPass]         = useState(false);
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState(false);
  const [loading, setLoading]           = useState(false);
  const nifTimeout                      = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleNifChange(value: string) {
    // NIF angolano: dígitos e letras (ex: 005904881UE046)
    const nif = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 14);
    setForm(f => ({ ...f, nif, name: "" }));
    setNifState("idle");
    setNifError("");

    if (nifTimeout.current) clearTimeout(nifTimeout.current);
    if (nif.length >= 9) {
      nifTimeout.current = setTimeout(() => verifyNif(nif), 600);
    }
  }

  async function verifyNif(nif: string) {
    setNifState("loading");
    setNifError("");
    try {
      const res  = await fetch(`/api/nif?nif=${encodeURIComponent(nif)}`);
      const data = await res.json();
      if (data.valid && data.nome) {
        setForm(f => ({ ...f, name: data.nome }));
        setNifState("valid");
      } else {
        setForm(f => ({ ...f, name: "" }));
        setNifState("invalid");
        setNifError(data.error || "NIF não encontrado. Verifique o número.");
      }
    } catch {
      setNifState("invalid");
      setNifError("Erro ao verificar NIF. Verifique a ligação.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nifState !== "valid") {
      setError("Verifique o NIF antes de continuar.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nifNumero:      form.nif,
          email:          form.email,
          password:       form.password,
          phone:          form.phone,
          province:       form.province,
          ...(refCode ? { ref: refCode } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao registar");
      } else {
        setSuccess(true);
        setTimeout(() => router.push(data.redirect ?? "/login"), 1200);
      }
    } catch {
      setError("Erro de ligação. Tente novamente.");
    }
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
    borderRadius: 8, padding: "11px 12px 11px 38px", color: "#ffffff",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6,
  };

  const nifBorderColor =
    nifState === "valid"   ? "#22c55e" :
    nifState === "invalid" ? "#ef4444" :
    "#1e2d50";

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1e", display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif", padding: "20px",
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <img
              src="/logo-icon.jpeg" alt="Dynamic Works"
              style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 10, background: "#111827" }}
            />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#ffffff" }}>Dynamic Works</div>
              <div style={{ fontSize: 12, color: "#f5a623", letterSpacing: 1 }}>PLATAFORMA DE NEGOCIAÇÃO</div>
            </div>
          </div>
        </div>

        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, padding: 32 }}>
          <h1 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>Criar conta</h1>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 16px" }}>
            Junte-se a milhares de negociadores angolanos
          </p>

          {refCode && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
            }}>
              <Gift size={15} color="#22c55e" />
              <span style={{ color: "#22c55e", fontSize: 13 }}>
                Foste convidado com o código <strong>{refCode}</strong> — bónus activado!
              </span>
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

          {success && (
            <div style={{
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <CheckCircle size={16} color="#22c55e" />
              <span style={{ color: "#22c55e", fontSize: 14 }}>
                Conta criada! A redirecionar para verificação...
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* NIF */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>
                NIF (Número de Identificação Fiscal) <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <Hash size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.nif}
                  onChange={e => handleNifChange(e.target.value)}
                  placeholder="Ex: 5000012345"
                  required
                  style={{ ...inputStyle, paddingRight: 40, border: `1px solid ${nifBorderColor}` }}
                />
                <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
                  {nifState === "loading" && <Loader2 size={16} color="#94a3b8" style={{ animation: "spin 1s linear infinite" }} />}
                  {nifState === "valid"   && <ShieldCheck size={16} color="#22c55e" />}
                  {nifState === "invalid" && <AlertCircle size={16} color="#ef4444" />}
                </div>
              </div>
              {nifState === "valid" && (
                <p style={{ color: "#22c55e", fontSize: 12, marginTop: 4 }}>
                  ✓ NIF verificado com sucesso
                </p>
              )}
              {nifState === "invalid" && nifError && (
                <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{nifError}</p>
              )}
            </div>

            {/* Nome (preenchido automaticamente pela AGT) */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>
                Nome completo
              </label>
              <div style={{ position: "relative" }}>
                <User size={16} color={nifState === "valid" ? "#22c55e" : "#94a3b8"}
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  type="text"
                  value={form.name}
                  readOnly
                  placeholder={
                    nifState === "loading" ? "A verificar NIF..." :
                    nifState === "valid"   ? "" :
                    "Introduza o NIF para preencher automaticamente"
                  }
                  style={{
                    ...inputStyle,
                    border: `1px solid ${nifState === "valid" ? "#22c55e" : "#1e2d50"}`,
                    background: "#0d1424",
                    color: nifState === "valid" ? "#ffffff" : "#4a5568",
                    cursor: "not-allowed",
                  }}
                />
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email</label>
              <div style={{ position: "relative" }}>
                <Mail size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => update("email", e.target.value)}
                  placeholder="joao@email.com"
                  required
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Senha (mín. 8 caracteres)</label>
              <div style={{ position: "relative" }}>
                <Lock size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={e => update("password", e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ ...inputStyle, paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {showPass ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
                </button>
              </div>
            </div>

            {/* Phone */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Telefone (opcional)</label>
              <div style={{ position: "relative" }}>
                <Phone size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => update("phone", e.target.value)}
                  placeholder="+244 9xx xxx xxx"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Province */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Província</label>
              <div style={{ position: "relative" }}>
                <MapPin size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 1 }} />
                <select
                  value={form.province}
                  onChange={e => update("province", e.target.value)}
                  style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                >
                  <option value="">Selecionar província</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || nifState !== "valid"}
              style={{
                width: "100%",
                background: loading || nifState !== "valid" ? "#7a5118" : "#f5a623",
                color: "#0a0f1e", border: "none", borderRadius: 8,
                padding: "10px 16px", fontSize: 14, fontWeight: 700,
                cursor: loading || nifState !== "valid" ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "A criar conta..." : "Criar conta gratuita"}
            </button>
          </form>

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 14, margin: "20px 0 0" }}>
            Já tem conta?{" "}
            <a href="/login" style={{ color: "#f5a623", textDecoration: "none", fontWeight: 600 }}>
              Entrar
            </a>
          </p>
        </div>

        <p style={{ textAlign: "center", color: "#4a5568", fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
          Ao registar-se, aceita os nossos{" "}
          <a href="/terms" style={{ color: "#f5a623", textDecoration: "none" }}>Termos de Uso</a>.
          {" "}Negociação envolve risco. Capital em risco.
        </p>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense><RegisterContent /></Suspense>;
}
