"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  TrendingUp, User, Mail, Lock, Phone, MapPin,
  Eye, EyeOff, AlertCircle, CheckCircle, Gift,
  Hash, Loader2, ShieldCheck, ArrowRight, Zap, BarChart2, Shield,
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
  const [nifState, setNifState] = useState<NifState>("idle");
  const [nifError, setNifError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleNifChange(value: string) {
    const nif = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 14);
    setForm(f => ({ ...f, nif, name: "" }));
    setNifState("idle");
    setNifError("");
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
        setNifError(data.error || "BI não encontrado. Verifique o número.");
      }
    } catch {
      setNifState("invalid");
      setNifError("Erro ao verificar BI. Verifique a ligação.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nifState !== "valid") { setError("Verifique o NIF antes de continuar."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nifNumero: form.nif, email: form.email, password: form.password,
          phone: form.phone, province: form.province,
          ...(refCode ? { ref: refCode } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao registar"); }
      else { setSuccess(true); setTimeout(() => router.push(data.redirect ?? "/login"), 1200); }
    } catch { setError("Erro de ligação. Tente novamente."); }
    setLoading(false);
  }

  const nifBorderColor =
    nifState === "valid"   ? "#22c55e" :
    nifState === "invalid" ? "#ef4444" : "#1e2d50";

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "system-ui,-apple-system,sans-serif", background: "#070d1c" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
        @keyframes spin   { to { transform:rotate(360deg); } }
        .reg-inp { transition: border-color .2s, box-shadow .2s; }
        .reg-inp:focus { border-color: rgba(255,255,255,.6) !important; box-shadow: 0 0 0 3px rgba(255,255,255,.1); outline: none; }
        .reg-btn:hover:not(:disabled) { filter:brightness(1.08); transform:translateY(-1px); }
        .reg-btn:active:not(:disabled) { transform:scale(.98); }
        .reg-left { display: none; }
        .reg-mobile-logo { display: block; }
        @media(min-width:900px) {
          .reg-left { display: flex !important; }
          .reg-right { min-height: 100vh; }
          .reg-mobile-logo { display: none; }
        }
      `}</style>

      {/* ── Left panel (desktop) ── */}
      <div style={{ flex: 1, display: "none", flexDirection: "column", justifyContent: "space-between", padding: "48px 56px", background: "linear-gradient(160deg,#0d1628 0%,#0a1220 50%,#06091a 100%)", borderRight: "1px solid rgba(30,45,80,.5)", position: "relative", overflow: "hidden" }}
        className="reg-left">

        <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(30,45,80,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(30,45,80,.12) 1px,transparent 1px)", backgroundSize:"48px 48px", pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:"20%", right:"10%", width:350, height:350, borderRadius:"50%", background:"radial-gradient(circle,rgba(34,197,94,.05) 0%,transparent 70%)", pointerEvents:"none" }} />

        <div style={{ display:"flex", alignItems:"center", gap:12, position:"relative", zIndex:1 }}>
          <img src="/logo-icon.jpeg" alt="Dynamic Works" style={{ width:44, height:44, objectFit:"contain", borderRadius:10, background:"#111827" }} />
          <div>
            <div style={{ color:"#fff", fontWeight:900, fontSize:18 }}>Dynamic Works</div>
            <div style={{ color:"#ffffff", fontSize:11, letterSpacing:1.2, fontWeight:700, textTransform:"uppercase" }}>Plataforma de Trading</div>
          </div>
        </div>

        <div style={{ position:"relative", zIndex:1 }}>
          <h2 style={{ color:"#f0f4ff", fontSize:"clamp(26px,2.8vw,38px)", fontWeight:900, lineHeight:1.1, letterSpacing:-1, marginBottom:18 }}>
            Começa a negociar<br/>
            <span style={{ background:"linear-gradient(90deg,#22c55e,#16a34a)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>hoje mesmo.</span>
          </h2>
          <p style={{ color:"#475569", fontSize:15, lineHeight:1.75, maxWidth:320, marginBottom:32 }}>
            Cria a tua conta em menos de 2 minutos e começa com 10.000 Kz de saldo demo gratuito.
          </p>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {[
              { icon:<Zap size={16} color="#ffffff"/>, label:"Conta demo gratuita — 10.000 Kz virtual" },
              { icon:<TrendingUp size={16} color="#22c55e"/>, label:"Payout real até 85% em opções binárias" },
              { icon:<Shield size={16} color="#3b82f6"/>, label:"KYC com verificação de BI via AGT Angola" },
              { icon:<BarChart2 size={16} color="#a78bfa"/>, label:"Depósitos e levantamentos via Multicaixa Express" },
            ].map((f, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:32, height:32, borderRadius:9, background:"rgba(255,255,255,.04)", border:"1px solid rgba(30,45,80,.5)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{f.icon}</div>
                <span style={{ color:"#475569", fontSize:13 }}>{f.label}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop:36, padding:"16px 20px", background:"rgba(34,197,94,.05)", border:"1px solid rgba(34,197,94,.15)", borderRadius:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <Gift size={15} color="#22c55e" />
              <span style={{ color:"#22c55e", fontSize:13, fontWeight:800 }}>Bónus de primeiro depósito</span>
            </div>
            <p style={{ color:"#475569", fontSize:12, margin:0 }}>
              Recebe um bónus percentual no teu primeiro depósito. Consulta as condições na tua carteira.
            </p>
          </div>
        </div>

        <div style={{ color:"#1e2d50", fontSize:12, position:"relative", zIndex:1 }}>
          © {new Date().getFullYear()} Dynamic Works · Angola
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="reg-right" style={{ width:"100%", maxWidth:520, margin:"0 auto", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px 60px", animation:"fadeUp .5s ease both" }}>

        <div className="reg-mobile-logo" style={{ textAlign:"center", marginBottom:32 }}>
          <img src="/logo-icon.jpeg" alt="Dynamic Works" style={{ width:52, height:52, objectFit:"contain", borderRadius:12, background:"#111827", marginBottom:10 }} />
          <div style={{ color:"#fff", fontWeight:900, fontSize:20 }}>Dynamic Works</div>
        </div>

        <div style={{ width:"100%", maxWidth:460 }}>
          <div style={{ background:"rgba(17,24,39,.9)", border:"1px solid rgba(30,45,80,.7)", borderRadius:20, padding:"32px 28px", backdropFilter:"blur(16px)", boxShadow:"0 24px 60px rgba(0,0,0,.4)" }}>
            <h1 style={{ color:"#fff", fontSize:22, fontWeight:800, margin:"0 0 4px", letterSpacing:-.3 }}>Criar conta gratuita</h1>
            <p style={{ color:"#475569", fontSize:14, margin:"0 0 24px" }}>Junte-se a milhares de negociadores angolanos</p>

            {refCode && (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(34,197,94,.08)", border:"1px solid rgba(34,197,94,.25)", borderRadius:10, padding:"12px 14px", marginBottom:18 }}>
                <Gift size={15} color="#22c55e" />
                <span style={{ color:"#22c55e", fontSize:13, fontWeight:600 }}>
                  Convidado com o código <strong>{refCode}</strong> — bónus activado!
                </span>
              </div>
            )}

            {error && (
              <div style={{ background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.3)", borderRadius:10, padding:"12px 14px", marginBottom:18, display:"flex", alignItems:"center", gap:8 }}>
                <AlertCircle size={15} color="#ef4444" style={{ flexShrink:0 }} />
                <span style={{ color:"#ef4444", fontSize:13 }}>{error}</span>
              </div>
            )}

            {success && (
              <div style={{ background:"rgba(34,197,94,.08)", border:"1px solid rgba(34,197,94,.3)", borderRadius:10, padding:"12px 14px", marginBottom:18, display:"flex", alignItems:"center", gap:8 }}>
                <CheckCircle size={15} color="#22c55e" style={{ flexShrink:0 }} />
                <span style={{ color:"#22c55e", fontSize:13, fontWeight:600 }}>Conta criada! A redirecionar para verificação...</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>

              {/* NIF */}
              <div>
                <label style={lblSt}>Nº Bilhete de Identidade <span style={{ color:"#ef4444" }}>*</span></label>
                <div style={{ display:"flex", gap:8 }}>
                  <div style={{ position:"relative", flex:1 }}>
                    <Hash size={14} color="#475569" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
                    <input type="text" value={form.nif}
                      onChange={e => handleNifChange(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (form.nif.length >= 9) verifyNif(form.nif); } }}
                      placeholder="Ex: 5000012345" required className="reg-inp"
                      style={{ ...inpSt, paddingRight:38, border:`1px solid ${nifBorderColor}` }} />
                    <div style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)" }}>
                      {nifState === "loading" && <Loader2 size={14} color="#94a3b8" style={{ animation:"spin 1s linear infinite" }} />}
                      {nifState === "valid"   && <ShieldCheck size={14} color="#22c55e" />}
                      {nifState === "invalid" && <AlertCircle size={14} color="#ef4444" />}
                    </div>
                  </div>
                  <button type="button" onClick={() => { if (form.nif.length >= 9) verifyNif(form.nif); }}
                    disabled={form.nif.length < 9 || nifState === "loading"}
                    style={{ background: nifState === "valid" ? "rgba(34,197,94,.15)" : "rgba(255,255,255,.12)", border:`1px solid ${nifState === "valid" ? "rgba(34,197,94,.4)" : "rgba(255,255,255,.3)"}`, borderRadius:10, padding:"0 14px", color: nifState === "valid" ? "#22c55e" : "#ffffff", fontWeight:700, fontSize:12, cursor: form.nif.length < 9 || nifState === "loading" ? "not-allowed" : "pointer", opacity: form.nif.length < 9 ? 0.5 : 1, whiteSpace:"nowrap", flexShrink:0 }}>
                    {nifState === "loading" ? "..." : nifState === "valid" ? "✓ Válido" : "Validar"}
                  </button>
                </div>
                {nifState === "valid"   && <p style={{ color:"#22c55e", fontSize:12, margin:"4px 0 0" }}>✓ BI verificado com sucesso</p>}
                {nifState === "invalid" && nifError && <p style={{ color:"#ef4444", fontSize:12, margin:"4px 0 0" }}>{nifError}</p>}
              </div>

              {/* Nome */}
              <div>
                <label style={lblSt}>Nome completo</label>
                <div style={{ position:"relative" }}>
                  <User size={14} color={nifState === "valid" ? "#22c55e" : "#475569"} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
                  <input type="text" value={form.name} readOnly
                    placeholder={nifState === "loading" ? "A verificar..." : nifState === "valid" ? "" : "Preenchido automaticamente pelo BI"}
                    style={{ ...inpSt, background:"#0d1424", color: nifState === "valid" ? "#fff" : "#334155", cursor:"not-allowed", border:`1px solid ${nifState === "valid" ? "#22c55e" : "#1e2d50"}` }} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={lblSt}>Email</label>
                <div style={{ position:"relative" }}>
                  <Mail size={14} color="#475569" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
                  <input type="email" value={form.email} onChange={e => update("email", e.target.value)}
                    placeholder="joao@email.com" required className="reg-inp" style={inpSt} />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={lblSt}>Senha <span style={{ color:"#475569", fontWeight:400 }}>(mín. 8 caracteres)</span></label>
                <div style={{ position:"relative" }}>
                  <Lock size={14} color="#475569" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
                  <input type={showPass ? "text" : "password"} value={form.password} onChange={e => update("password", e.target.value)}
                    placeholder="••••••••" required className="reg-inp" style={{ ...inpSt, paddingRight:44 }} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0 }}>
                    {showPass ? <EyeOff size={14} color="#475569" /> : <Eye size={14} color="#475569" />}
                  </button>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label style={lblSt}>Telefone <span style={{ color:"#475569", fontWeight:400 }}>(opcional)</span></label>
                <div style={{ position:"relative" }}>
                  <Phone size={14} color="#475569" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
                  <input type="tel" value={form.phone} onChange={e => update("phone", e.target.value)}
                    placeholder="+244 9xx xxx xxx" className="reg-inp" style={inpSt} />
                </div>
              </div>

              {/* Province */}
              <div>
                <label style={lblSt}>Província</label>
                <div style={{ position:"relative" }}>
                  <MapPin size={14} color="#475569" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", zIndex:1 }} />
                  <select value={form.province} onChange={e => update("province", e.target.value)}
                    className="reg-inp"
                    style={{ ...inpSt, appearance:"none", cursor:"pointer" }}>
                    <option value="">Selecionar província</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading || nifState !== "valid"} className="reg-btn"
                style={{ width:"100%", background: loading || nifState !== "valid" ? "#7a5118" : "linear-gradient(135deg,#ffffff,#f97316)", color:"#0a0f1e", border:"none", borderRadius:12, padding:"14px 16px", fontSize:15, fontWeight:800, cursor: loading || nifState !== "valid" ? "not-allowed" : "pointer", transition:"all .18s", display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:4, boxShadow: loading || nifState !== "valid" ? "none" : "0 6px 24px rgba(255,255,255,.3)" }}>
                {loading
                  ? <span style={{ width:16, height:16, border:"2px solid rgba(0,0,0,.3)", borderTopColor:"#0a0f1e", borderRadius:"50%", display:"inline-block", animation:"spin .7s linear infinite" }} />
                  : <><ArrowRight size={16} strokeWidth={2.5} /> Criar conta gratuita</>
                }
              </button>
            </form>

            <p style={{ textAlign:"center", color:"#334155", fontSize:14, marginTop:20 }}>
              Já tem conta?{" "}
              <a href="/login" style={{ color:"#ffffff", textDecoration:"none", fontWeight:700 }}>Entrar</a>
            </p>
          </div>

          <p style={{ textAlign:"center", color:"#1e2d50", fontSize:12, marginTop:16, lineHeight:1.7 }}>
            Ao registar-se, aceita os{" "}
            <a href="/terms" style={{ color:"#334155", textDecoration:"none" }}>Termos de Uso</a>.
            {" "}Negociação envolve risco. Capital em risco.
          </p>
        </div>
      </div>
    </div>
  );
}

const inpSt: React.CSSProperties = {
  width:"100%", background:"#0a0f1e", border:"1px solid #1e2d50",
  borderRadius:10, padding:"12px 12px 12px 38px", color:"#fff",
  fontSize:14, outline:"none", boxSizing:"border-box",
};
const lblSt: React.CSSProperties = {
  color:"#64748b", fontSize:12, fontWeight:600, display:"block",
  marginBottom:6, textTransform:"uppercase", letterSpacing:.5,
};

export default function RegisterPage() {
  return <Suspense><RegisterContent /></Suspense>;
}
