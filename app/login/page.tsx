"use client";
import { useState, Suspense, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle,
  Shield, TrendingUp, ArrowRight, BarChart2, Zap,
} from "lucide-react";
import { useT } from "@/lib/i18n";

type Step = "credentials" | "2fa_email" | "2fa_totp";

const STATS = [
  { label: "Traders activos",     value: "12.400+" },
  { label: "Operações por dia",   value: "38.000+" },
  { label: "Payout máximo",       value: "85%"     },
];

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useSession();
  const t = useT();
  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [showPass,       setShowPass]       = useState(false);
  const [otp,            setOtp]            = useState("");
  const [step,           setStep]           = useState<Step>("credentials");
  const [error,          setError]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const MAX_ATTEMPTS = 5;
  const isVerified = params.get("verified") === "1";
  const is2FAStep  = step === "2fa_email" || step === "2fa_totp";

  useEffect(() => {
    if (status === "authenticated") router.replace("/trade");
  }, [status, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (step === "credentials") {
      const res  = await fetch("/api/auth/2fa/initiate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ email, password }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.status === 429) { setError(data.error || t("login.error.tooMany")); return; }
      if (!res.ok || !data.valid) {
        const n = failedAttempts + 1;
        setFailedAttempts(n);
        const rem = MAX_ATTEMPTS - n;
        if (res.status === 500)   setError(t("login.error.internal"));
        else if (rem <= 0)        setError(t("login.error.blocked"));
        else if (rem <= 2)        setError(`${t("login.error.generic")} — ${rem} ${rem === 1 ? t("login.attempts") : t("login.attemptsPlural")}.`);
        else                      setError(t("login.error.generic"));
        return;
      }
      if (data.requires2FA) {
        setStep(data.method === "totp" ? "2fa_totp" : "2fa_email");
        return;
      }
      const r = await signIn("credentials", { email, password, otp: "", redirect: false });
      if (r?.ok) router.replace("/trade");
      else setError(t("login.error.generic"));
      return;
    }

    // OTP step
    const r = await signIn("credentials", { email, password, otp, redirect: false });
    setLoading(false);
    if (r?.ok) { router.replace("/trade"); return; }
    const n = failedAttempts + 1;
    setFailedAttempts(n);
    const rem = MAX_ATTEMPTS - n;
    if (rem <= 0)  setError(t("login.error.blocked"));
    else if (rem <= 2) setError(`${t("login.error.generic")} — ${rem} ${rem === 1 ? t("login.attempts") : t("login.attemptsPlural")}.`);
    else setError(t("login.error.generic"));
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "system-ui,-apple-system,sans-serif", background: "#070d1c" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes grid-move { from { transform:translateY(0); } to { transform:translateY(64px); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        .login-inp { transition: border-color .2s, box-shadow .2s; }
        .login-inp:focus { border-color: rgba(255,255,255,.6) !important; box-shadow: 0 0 0 3px rgba(255,255,255,.1); outline: none; }
        .login-btn:hover:not(:disabled) { filter:brightness(1.08); transform:translateY(-1px); }
        .login-btn:active:not(:disabled) { transform:scale(.98); }
        .login-left { display: none; }
        .login-right { width: 100%; }
        .mobile-logo { display: block; }
        @media(min-width:900px) {
          .login-left { display: flex !important; }
          .login-right { min-height: 100vh; }
          .mobile-logo { display: none; }
        }
      `}</style>

      {/* ── Left panel (desktop) ── */}
      <div style={{ flex: 1, display: "none", flexDirection: "column", justifyContent: "space-between", padding: "48px 56px", background: "linear-gradient(160deg,#0d1628 0%,#0a1220 50%,#06091a 100%)", borderRight: "1px solid rgba(30,45,80,.5)", position: "relative", overflow: "hidden" }}
        className="login-left">

        {/* Background grid */}
        <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(30,45,80,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(30,45,80,.12) 1px,transparent 1px)", backgroundSize:"48px 48px", animation:"grid-move 8s linear infinite", pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:"10%", left:"15%", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle,rgba(255,255,255,.055) 0%,transparent 70%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:"15%", right:"10%", width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle,rgba(59,130,246,.05) 0%,transparent 70%)", pointerEvents:"none" }} />

        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:12, position:"relative", zIndex:1 }}>
          <img src="/logo-icon.jpeg" alt="Dynamic Works" style={{ width:44, height:44, objectFit:"contain", borderRadius:10, background:"#111827" }} />
          <div>
            <div style={{ color:"#fff", fontWeight:900, fontSize:18, letterSpacing:-.3 }}>Dynamic Works</div>
            <div style={{ color:"#ffffff", fontSize:11, letterSpacing:1.2, fontWeight:700, textTransform:"uppercase" }}>Plataforma de Trading</div>
          </div>
        </div>

        {/* Main copy */}
        <div style={{ position:"relative", zIndex:1 }}>
          <h2 style={{ color:"#f0f4ff", fontSize:"clamp(28px,3vw,40px)", fontWeight:900, lineHeight:1.1, letterSpacing:-1, marginBottom:20 }}>
            Negoceia os<br/>
            <span style={{ background:"linear-gradient(90deg,#ffffff,#fbbf24)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>mercados globais</span><br/>
            em Kwanzas.
          </h2>
          <p style={{ color:"#475569", fontSize:15, lineHeight:1.75, maxWidth:340 }}>
            Opções binárias com preços em tempo real, indicadores profissionais e pagamentos via Multicaixa Express.
          </p>

          {/* Stats */}
          <div style={{ display:"flex", gap:0, marginTop:36, border:"1px solid rgba(30,45,80,.6)", borderRadius:14, overflow:"hidden" }}>
            {STATS.map((s, i) => (
              <div key={i} style={{ flex:1, padding:"16px 14px", borderRight: i < STATS.length-1 ? "1px solid rgba(30,45,80,.6)" : "none", textAlign:"center" }}>
                <div style={{ color:"#ffffff", fontWeight:900, fontSize:20, marginBottom:4 }}>{s.value}</div>
                <div style={{ color:"#334155", fontSize:11 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Mini features */}
          <div style={{ marginTop:28, display:"flex", flexDirection:"column", gap:12 }}>
            {[
              { icon:<TrendingUp size={15} color="#0ecb81"/>, label:"Payout até 85% por operação" },
              { icon:<Shield size={15} color="#3b82f6"/>, label:"KYC + 2FA — conta 100% segura" },
              { icon:<BarChart2 size={15} color="#ffffff"/>, label:"30+ indicadores integrados no gráfico" },
              { icon:<Zap size={15} color="#a78bfa"/>, label:"Conta demo gratuita — 10.000 Kz virtual" },
            ].map((f, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:28, height:28, borderRadius:8, background:"rgba(255,255,255,.04)", border:"1px solid rgba(30,45,80,.5)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{f.icon}</div>
                <span style={{ color:"#475569", fontSize:13 }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ color:"#1e2d50", fontSize:12, position:"relative", zIndex:1 }}>
          © {new Date().getFullYear()} Dynamic Works · Angola
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="login-right" style={{ width:"100%", maxWidth:480, margin:"0 auto", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", animation:"fadeUp .5s ease both" }}>

        {/* Mobile logo */}
        <div className="mobile-logo" style={{ textAlign:"center", marginBottom:36 }}>
          <img src="/logo-icon.jpeg" alt="Dynamic Works" style={{ width:52, height:52, objectFit:"contain", borderRadius:12, background:"#111827", marginBottom:12 }} />
          <div style={{ color:"#fff", fontWeight:900, fontSize:20 }}>Dynamic Works</div>
          <div style={{ color:"#ffffff", fontSize:11, letterSpacing:1.2, fontWeight:700, textTransform:"uppercase", marginTop:2 }}>Plataforma de Trading</div>
        </div>

        <div style={{ width:"100%", maxWidth:400 }}>
          {/* Card */}
          <div style={{ background:"rgba(17,24,39,.9)", border:"1px solid rgba(30,45,80,.7)", borderRadius:20, padding:"36px 32px", backdropFilter:"blur(16px)", boxShadow:"0 24px 60px rgba(0,0,0,.4)" }}>

            {is2FAStep ? (
              <>
                {/* 2FA header */}
                <div style={{ textAlign:"center", marginBottom:28 }}>
                  <div style={{ width:56, height:56, background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.25)", borderRadius:16, display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
                    <Shield size={26} color="#ffffff" />
                  </div>
                  <h1 style={{ color:"#fff", fontSize:22, fontWeight:800, margin:"0 0 8px", letterSpacing:-.3 }}>{t("2fa.title")}</h1>
                  <p style={{ color:"#475569", fontSize:14, margin:0, lineHeight:1.6 }}>
                    {step === "2fa_email" ? t("2fa.emailDesc") : t("2fa.totpDesc")}
                  </p>
                </div>

                {error && <AlertBox msg={error} />}

                <form onSubmit={handleSubmit}>
                  <input type="text" inputMode="numeric" value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g,"").slice(0,6))}
                    placeholder="0  0  0  0  0  0" required autoFocus
                    className="login-inp"
                    style={{ width:"100%", background:"#0a0f1e", border:"1px solid #1e2d50", borderRadius:12, padding:"16px", color:"#fff", fontSize:28, fontWeight:800, letterSpacing:14, outline:"none", boxSizing:"border-box", textAlign:"center" }} />

                  <PrimaryBtn loading={loading} disabled={loading || otp.length < 6} style={{ marginTop:16 }}>
                    {loading ? "A verificar..." : t("2fa.verify")}
                  </PrimaryBtn>

                  <button type="button" onClick={() => { setStep("credentials"); setOtp(""); setError(""); }}
                    style={{ width:"100%", background:"none", border:"none", color:"#475569", fontSize:14, cursor:"pointer", marginTop:12, padding:"8px" }}>
                    ← {t("2fa.back")}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h1 style={{ color:"#fff", fontSize:22, fontWeight:800, margin:"0 0 6px", letterSpacing:-.3 }}>{t("login.title")}</h1>
                <p style={{ color:"#475569", fontSize:14, margin:"0 0 28px" }}>{t("login.subtitle")}</p>

                {isVerified && (
                  <div style={{ background:"rgba(34,197,94,.08)", border:"1px solid rgba(34,197,94,.3)", borderRadius:10, padding:"12px 14px", marginBottom:20, display:"flex", alignItems:"center", gap:8 }}>
                    <CheckCircle size={16} color="#22c55e" />
                    <span style={{ color:"#22c55e", fontSize:13, fontWeight:600 }}>{t("login.verified")}</span>
                  </div>
                )}

                {error && <AlertBox msg={error} />}

                <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  <Field label={t("login.email")} icon={<Mail size={15} color="#475569" />}>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="email@exemplo.com" required className="login-inp"
                      style={inputSt} />
                  </Field>

                  <Field label={t("login.password")} icon={<Lock size={15} color="#475569" />}
                    right={<a href="/forgot-password" style={{ color:"#ffffff", fontSize:12, textDecoration:"none", fontWeight:600 }}>{t("login.forgotPassword")}</a>}>
                    <div style={{ position:"relative" }}>
                      <Lock size={15} color="#475569" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
                      <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••" required className="login-inp"
                        style={{ ...inputSt, paddingLeft:38, paddingRight:44 }} />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0 }}>
                        {showPass ? <EyeOff size={15} color="#475569" /> : <Eye size={15} color="#475569" />}
                      </button>
                    </div>
                  </Field>

                  <PrimaryBtn loading={loading} disabled={loading} style={{ marginTop:4 }}>
                    {loading ? "A entrar..." : t("login.submit")} {!loading && <ArrowRight size={16} strokeWidth={2.5} />}
                  </PrimaryBtn>
                </form>

                {failedAttempts >= 3 && failedAttempts < MAX_ATTEMPTS && (
                  <div style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.2)", borderRadius:8, padding:"10px 14px", marginTop:16, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ color:"#ffffff", fontSize:13 }}>{MAX_ATTEMPTS - failedAttempts} tentativas restantes</span>
                    <a href="/forgot-password" style={{ color:"#ffffff", fontSize:12, fontWeight:700, textDecoration:"none" }}>{t("login.recoverPassword")}</a>
                  </div>
                )}

                <p style={{ textAlign:"center", color:"#334155", fontSize:14, marginTop:24 }}>
                  {t("login.noAccount")}{" "}
                  <a href="/register" style={{ color:"#ffffff", textDecoration:"none", fontWeight:700 }}>{t("login.register")}</a>
                </p>
              </>
            )}
          </div>

          <p style={{ textAlign:"center", color:"#1e2d50", fontSize:12, marginTop:20 }}>
            {t("common.copyright")} ·{" "}
            <a href="/terms" style={{ color:"#334155", textDecoration:"none" }}>{t("common.terms")}</a>
          </p>
        </div>
      </div>
    </div>
  );
}

const inputSt: React.CSSProperties = {
  width:"100%", background:"#0a0f1e", border:"1px solid #1e2d50",
  borderRadius:10, padding:"12px 12px 12px 38px", color:"#fff",
  fontSize:14, outline:"none", boxSizing:"border-box",
};

function Field({ label, icon, right, children }: { label:string; icon?:React.ReactNode; right?:React.ReactNode; children:React.ReactNode }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <label style={{ color:"#64748b", fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:.5 }}>{label}</label>
        {right}
      </div>
      <div style={{ position:"relative" }}>
        {icon && <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>{icon}</span>}
        {children}
      </div>
    </div>
  );
}

function AlertBox({ msg }: { msg:string }) {
  return (
    <div style={{ background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.3)", borderRadius:10, padding:"12px 14px", marginBottom:18, display:"flex", alignItems:"center", gap:8 }}>
      <AlertCircle size={15} color="#ef4444" style={{ flexShrink:0 }} />
      <span style={{ color:"#ef4444", fontSize:13 }}>{msg}</span>
    </div>
  );
}

function PrimaryBtn({ children, loading, disabled, style }: { children:React.ReactNode; loading?:boolean; disabled?:boolean; style?:React.CSSProperties }) {
  return (
    <button type="submit" disabled={disabled} className="login-btn"
      style={{ width:"100%", background: disabled ? "#7a5118" : "linear-gradient(135deg,#ffffff,#f97316)", color:"#0a0f1e", border:"none", borderRadius:12, padding:"14px 16px", fontSize:15, fontWeight:800, cursor:disabled ? "not-allowed" : "pointer", transition:"all .18s", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow: disabled ? "none" : "0 6px 24px rgba(255,255,255,.35)", ...style }}>
      {loading ? <span style={{ width:16, height:16, border:"2px solid rgba(0,0,0,.3)", borderTopColor:"#0a0f1e", borderRadius:"50%", display:"inline-block", animation:"spin .7s linear infinite" }} /> : children}
    </button>
  );
}

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>;
}
