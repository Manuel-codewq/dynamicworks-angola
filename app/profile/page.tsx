"use client";
import { formatKz } from "@/lib/format";
"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft, User, Shield, BarChart2, Lock,
  CheckCircle, Clock, XCircle, Save, ScanFace,
  TrendingUp, TrendingDown, Edit3, AlertTriangle,
  Eye, EyeOff, BadgeCheck, Mail, Send, KeyRound, Camera, Loader2,
} from "lucide-react";

const PROVINCES = [
  "Bengo","Benguela","Bié","Cabinda","Cuando Cubango","Cuanza Norte",
  "Cuanza Sul","Cunene","Huambo","Huíla","Luanda","Lunda Norte",
  "Lunda Sul","Malanje","Moxico","Namibe","Uíge","Zaire",
];

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("pt-AO", { year: "numeric", month: "long", day: "numeric" });
}
function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}
function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, local.length - 2))}@${domain}`;
}
function maskValue(val: string, hidden: boolean) {
  return hidden ? "••••••" : val;
}

type Feedback = { text: string; ok: boolean } | null;
type PwdStep = "idle" | "sending" | "verify";

const KYC_CFG = {
  pending:     { color: "#f5a623", bg: "rgba(245,166,35,0.10)", border: "rgba(245,166,35,0.25)", Icon: Clock,          label: "Pendente",     desc: "A aguardar verificação da identidade" },
  approved:    { color: "#22c55e", bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.25)",  Icon: CheckCircle,    label: "Verificado",   desc: "Identidade verificada com sucesso" },
  rejected:    { color: "#ef4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.25)",  Icon: XCircle,        label: "Rejeitado",    desc: "Documentos rejeitados. Submeta novamente." },
  unsubmitted: { color: "#64748b", bg: "rgba(100,116,139,0.10)",border: "rgba(100,116,139,0.25)",Icon: AlertTriangle,  label: "Não iniciado", desc: "Inicie a verificação para desbloquear saques" },
};

function KycRedirectBanner() {
  const searchParams = useSearchParams();
  const kycParam = searchParams.get("kyc");
  if (kycParam === "done") return (
    <div style={{ background: "rgba(34,197,94,0.1)", borderBottom: "1px solid rgba(34,197,94,0.25)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
      <CheckCircle size={16} color="#22c55e" />
      <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>A tua identidade já foi verificada. Não é necessário repetir o processo.</span>
    </div>
  );
  if (kycParam === "pending") return (
    <div style={{ background: "rgba(245,166,35,0.08)", borderBottom: "1px solid rgba(245,166,35,0.25)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
      <Clock size={16} color="#f5a623" />
      <span style={{ color: "#f5a623", fontSize: 13, fontWeight: 600 }}>Os teus documentos já foram submetidos e estão em análise. Aguarda a aprovação.</span>
    </div>
  );
  return null;
}

export default function ProfilePage() {
  const { status } = useSession();
  const router = useRouter();

  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [phone,       setPhone]       = useState("");
  const [province,    setProvince]    = useState("");
  const [kycStatus,   setKycStatus]   = useState("unsubmitted");
  const [kycAttempts, setKycAttempts] = useState(0);
  const [blockedUntil,setBlockedUntil]= useState<Date | null>(null);
  const [createdAt,   setCreatedAt]   = useState("");
  const [balance,     setBalance]     = useState(0);

  const [editMode,    setEditMode]    = useState(false);
  const [showValues,  setShowValues]  = useState(true);

  // Password OTP flow
  const [pwdStep,   setPwdStep]   = useState<PwdStep>("idle");
  const [otpInput,  setOtpInput]  = useState("");
  const [newPwd,    setNewPwd]    = useState("");
  const [confPwd,   setConfPwd]   = useState("");
  const [otpTimer,  setOtpTimer]  = useState(0);

  // Stats
  const [totalTrades, setTotalTrades] = useState(0);
  const [wins,        setWins]        = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);

  const [avatar,        setAvatar]        = useState<string>("");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [profileBusy,  setProfileBusy]  = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [sendingOtp,   setSendingOtp]   = useState(false);
  const [profileMsg,   setProfileMsg]   = useState<Feedback>(null);
  const [passwordMsg,  setPasswordMsg]  = useState<Feedback>(null);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/profile").then(r => r.json()),
      fetch("/api/profile/kyc").then(r => r.json()),
      fetch("/api/trade?limit=500&page=1").then(r => r.json()),
    ]).then(([profile, kyc, tradeData]) => {
      setName(profile.name ?? "");
      setEmail(profile.email ?? "");
      setPhone(profile.phone ?? "");
      setProvince(profile.province ?? "");
      setBalance(profile.balance ?? 0);
      setCreatedAt(profile.createdAt ?? "");
      setAvatar(profile.avatar ?? "");

      if (kyc.kycBlockedUntil && new Date(kyc.kycBlockedUntil) > new Date()) {
        setBlockedUntil(new Date(kyc.kycBlockedUntil));
      }
      setKycAttempts(kyc.kycAttempts ?? 0);
      if (kyc.kycStatus === "approved")      setKycStatus("approved");
      else if (kyc.kycStatus === "rejected") setKycStatus("rejected");
      else if (kyc.kycAttempts > 0)          setKycStatus("pending");
      else                                   setKycStatus("unsubmitted");

      // API returns { trades: [...], total, page, ... } — filter real trades only
      const allTrades: any[] = Array.isArray(tradeData) ? tradeData : (tradeData.trades ?? []);
      const realTrades = allTrades.filter((t: any) => !t.isDemo);
      const closed = realTrades.filter((t: any) => t.status === "closed");
      const w = closed.filter((t: any) => t.result === "win");
      const profit = closed.reduce((s: number, t: any) => s + (t.profit ?? 0), 0);
      setTotalTrades(closed.length);
      setWins(w.length);
      setTotalProfit(profit);

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [status]);

  // OTP countdown
  useEffect(() => {
    if (otpTimer <= 0) return;
    const id = setInterval(() => setOtpTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [otpTimer]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = "";
    setAvatarLoading(true);
    setProfileMsg(null);
    try {
      // 1. Comprimir imagem (igual ao KYC)
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const MAX = 400;
            let w = img.width, h = img.height;
            if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
            if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.82));
          };
          img.onerror = reject;
          img.src = reader.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 2. Upload via servidor (signed) — as credenciais Cloudinary nunca são expostas ao browser
      const up = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: b64, folder: "avatars" }),
      });
      if (!up.ok) throw new Error("Cloudinary upload failed");
      const { url: secure_url } = await up.json();

      // 3. Guardar URL na DB via API
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: secure_url }),
      });
      const d = await res.json();
      if (res.ok) {
        setAvatar(d.avatar);
        setProfileMsg({ text: "Foto de perfil actualizada!", ok: true });
      } else {
        setProfileMsg({ text: d.error ?? "Erro ao guardar foto.", ok: false });
      }
    } catch {
      setProfileMsg({ text: "Erro ao fazer upload. Tente novamente.", ok: false });
    }
    setAvatarLoading(false);
  }

  async function saveProfile() {
    setProfileBusy(true); setProfileMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, province }),
    });
    const d = await res.json();
    setProfileMsg(res.ok ? { text: "Perfil atualizado!", ok: true } : { text: d.error, ok: false });
    setProfileBusy(false);
    if (res.ok) setEditMode(false);
  }

  async function sendOtp() {
    setSendingOtp(true); setPasswordMsg(null);
    const res = await fetch("/api/profile/password-otp", { method: "POST" });
    const d = await res.json();
    if (res.ok) {
      setPwdStep("verify");
      setOtpTimer(600);
      setPasswordMsg({ text: `Código enviado para ${maskEmail(email)}`, ok: true });
    } else {
      setPasswordMsg({ text: d.error || "Erro ao enviar código", ok: false });
    }
    setSendingOtp(false);
  }

  async function confirmPassword() {
    setPasswordMsg(null);
    if (newPwd.length < 8)    { setPasswordMsg({ text: "Mínimo 8 caracteres", ok: false }); return; }
    if (newPwd !== confPwd)   { setPasswordMsg({ text: "As senhas não coincidem", ok: false }); return; }
    if (!otpInput.trim())     { setPasswordMsg({ text: "Introduza o código recebido", ok: false }); return; }
    setPasswordBusy(true);
    const res = await fetch("/api/profile/password", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpCode: otpInput.trim(), newPassword: newPwd }),
    });
    const d = await res.json();
    if (res.ok) {
      setPasswordMsg({ text: "Senha alterada com sucesso!", ok: true });
      setPwdStep("idle"); setOtpInput(""); setNewPwd(""); setConfPwd(""); setOtpTimer(0);
    } else {
      setPasswordMsg({ text: d.error, ok: false });
    }
    setPasswordBusy(false);
  }

  const kyc = KYC_CFG[kycStatus as keyof typeof KYC_CFG] ?? KYC_CFG.unsubmitted;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

  const inp: React.CSSProperties = {
    width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
    borderRadius: 10, padding: "12px 14px", color: "#fff",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = { color: "#64748b", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".5px" };
  const card: React.CSSProperties = { background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, padding: "22px", marginBottom: 16 };

  function Msg({ fb }: { fb: Feedback }) {
    if (!fb) return null;
    return (
      <div style={{ background: fb.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${fb.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 8, padding: "10px 14px", marginTop: 12, color: fb.ok ? "#22c55e" : "#ef4444", fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}>
        {fb.ok ? <CheckCircle size={14} /> : <XCircle size={14} />} {fb.text}
      </div>
    );
  }

  if (loading || status === "loading") return (
    <div style={{ minHeight: "100vh", background: "#070d1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #1e2d50", borderTopColor: "#f5a623", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#070d1a", fontFamily: "system-ui, -apple-system, sans-serif", paddingBottom: 40 }}>

      {/* Banner KYC redirect */}
      <Suspense fallback={null}>
        <KycRedirectBanner />
      </Suspense>

      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, color: "#94a3b8" }}>
          <ChevronLeft size={20} />
        </button>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, flex: 1 }}>Meu Perfil</span>

        {/* Toggle ocultar valores */}
        <button onClick={() => setShowValues(v => !v)}
          title={showValues ? "Ocultar valores" : "Mostrar valores"}
          style={{ background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, color: "#94a3b8", marginRight: 4 }}>
          {showValues ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 6, background: kyc.bg, border: `1px solid ${kyc.border}`, borderRadius: 20, padding: "4px 12px" }}>
          <kyc.Icon size={12} color={kyc.color} />
          <span style={{ color: kyc.color, fontSize: 12, fontWeight: 700 }}>KYC {kyc.label}</span>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>

        {/* Hero */}
        <div style={{ ...card, padding: "28px 24px", textAlign: "center", background: "linear-gradient(135deg, #111827 0%, #0f1e38 100%)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, background: "radial-gradient(circle, rgba(245,166,35,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

          {/* Avatar */}
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
          <div
            onClick={() => !avatarLoading && avatarInputRef.current?.click()}
            title="Clica para alterar a foto"
            style={{ position: "relative", width: 84, height: 84, borderRadius: "50%", margin: "0 auto 14px", cursor: avatarLoading ? "default" : "pointer" }}>
            {/* Photo or initials */}
            {avatar
              ? <img src={avatar} alt="avatar" style={{ width: 84, height: 84, borderRadius: "50%", objectFit: "cover", boxShadow: "0 0 0 4px rgba(245,166,35,0.3)" }} />
              : <div style={{ width: 84, height: 84, borderRadius: "50%", background: "linear-gradient(135deg,#f5a623,#e8950f)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#000", boxShadow: "0 0 0 4px rgba(245,166,35,0.2)" }}>
                  {initials(name) || "?"}
                </div>
            }
            {/* Camera overlay */}
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: avatarLoading ? "#1e2d50" : "#f5a623", border: "2px solid #070d1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {avatarLoading
                ? <Loader2 size={12} color="#94a3b8" style={{ animation: "spin .8s linear infinite" }} />
                : <Camera size={13} color="#0a0f1e" strokeWidth={2.5} />
              }
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>

          {/* Nome + badge verificado */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
            <h2 style={{ color: "#fff", margin: 0, fontSize: 20, fontWeight: 800 }}>{name}</h2>
            {kycStatus === "approved" && (
              <span title="Identidade verificada"><BadgeCheck size={22} color="#22c55e" /></span>
            )}
          </div>

          {/* Email mascarado */}
          <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 18px", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <Mail size={13} /> {maskEmail(email)}
          </p>

          {/* Saldo */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 12, padding: "10px 24px" }}>
            <div>
              <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>Saldo Real</div>
              <div style={{ color: "#f5a623", fontSize: 22, fontWeight: 800 }}>
                {maskValue(formatKz(Math.floor(balance)), !showValues)}
              </div>
            </div>
          </div>

          {createdAt && (
            <p style={{ color: "#374151", fontSize: 11, margin: "14px 0 0" }}>Membro desde {formatDate(createdAt)}</p>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Operações",   value: maskValue(String(totalTrades), !showValues),          icon: <BarChart2 size={16} color="#94a3b8" />,    color: "#fff"    },
            { label: "Taxa vitória",value: maskValue(`${winRate}%`, !showValues),                 icon: <TrendingUp size={16} color="#22c55e" />,   color: "#22c55e" },
            { label: "Lucro total", value: maskValue(formatKz(Math.floor(totalProfit)), !showValues), icon: totalProfit >= 0 ? <TrendingUp size={16} color="#22c55e" /> : <TrendingDown size={16} color="#ef4444" />, color: totalProfit >= 0 ? "#22c55e" : "#ef4444" },
          ].map(s => (
            <div key={s.label} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px" }}>{s.label}</span>
                {s.icon}
              </div>
              <div style={{ color: s.color, fontWeight: 800, fontSize: 16 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* KYC */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
              <ScanFace size={17} color="#f5a623" /> Verificação KYC
            </p>
            {kycAttempts > 0 && kycStatus !== "approved" && (
              <span style={{ color: kycAttempts >= 2 ? "#ef4444" : "#f5a623", fontSize: 12, fontWeight: 600 }}>{kycAttempts}/2 tentativas</span>
            )}
          </div>
          <div style={{ background: kyc.bg, border: `1px solid ${kyc.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: kycStatus !== "approved" ? 14 : 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${kyc.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <kyc.Icon size={20} color={kyc.color} />
            </div>
            <div>
              <div style={{ color: kyc.color, fontWeight: 700, fontSize: 14 }}>{kyc.label}</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{kyc.desc}</div>
              {blockedUntil && <div style={{ color: "#ef4444", fontSize: 11, marginTop: 4, fontWeight: 600 }}>Bloqueado até {blockedUntil.toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })}</div>}
            </div>
          </div>
          {kycStatus !== "approved" && !blockedUntil && (
            <button onClick={() => router.push("/kyc")} style={{ width: "100%", background: "#f5a623", color: "#000", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <ScanFace size={17} />
              {kycStatus === "unsubmitted" ? "Iniciar Verificação" : kycStatus === "rejected" ? "Submeter Novamente" : "Ver estado da verificação"}
            </button>
          )}
        </div>

        {/* Dados pessoais */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <p style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
              <User size={17} color="#f5a623" /> Dados pessoais
            </p>
            {!editMode && (
              <button onClick={() => setEditMode(true)} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 8, padding: "6px 12px", color: "#f5a623", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Edit3 size={13} /> Editar
              </button>
            )}
          </div>

          {!editMode ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[
                { label: "Nome completo", value: name || "—" },
                { label: "Email", value: maskEmail(email) },
                { label: "Telefone", value: phone || "—" },
                { label: "Província", value: province || "—" },
              ].map((row, i, arr) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < arr.length - 1 ? "1px solid rgba(30,45,80,0.5)" : "none" }}>
                  <span style={{ color: "#64748b", fontSize: 13 }}>{row.label}</span>
                  <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={lbl}>Nome completo</label>
                <input value={name} onChange={e => setName(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Email</label>
                <input value={email} readOnly style={{ ...inp, color: "#64748b", cursor: "not-allowed" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={lbl}>Telefone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+244 9XX XXX XXX" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Província</label>
                  <select value={province} onChange={e => setProvince(e.target.value)} style={{ ...inp, cursor: "pointer", colorScheme: "dark" }}>
                    <option value="">Selecionar...</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <Msg fb={profileMsg} />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={saveProfile} disabled={profileBusy} style={{ flex: 1, background: "#f5a623", color: "#000", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 800, cursor: profileBusy ? "not-allowed" : "pointer", opacity: profileBusy ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  <Save size={15} /> {profileBusy ? "A guardar..." : "Guardar"}
                </button>
                <button onClick={() => { setEditMode(false); setProfileMsg(null); }} style={{ padding: "12px 18px", background: "transparent", border: "1px solid #1e2d50", borderRadius: 10, color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Segurança — Alterar senha via OTP */}
        <div style={card}>
          <p style={{ margin: "0 0 18px", color: "#fff", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
            <Lock size={17} color="#f5a623" /> Alterar senha
          </p>

          {pwdStep === "idle" && (
            <div>
              <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>
                Por segurança, vamos enviar um código de verificação para <strong style={{ color: "#fff" }}>{maskEmail(email)}</strong> antes de alterar a senha.
              </p>
              <button onClick={sendOtp} disabled={sendingOtp}
                style={{ width: "100%", background: "#1e2d50", color: "#fff", border: "1px solid #2d3f6b", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: sendingOtp ? "not-allowed" : "pointer", opacity: sendingOtp ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Send size={16} /> {sendingOtp ? "A enviar código..." : "Enviar código por email"}
              </button>
              <Msg fb={passwordMsg} />
            </div>
          )}

          {pwdStep === "verify" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={15} color="#22c55e" />
                <span style={{ color: "#94a3b8", fontSize: 13 }}>
                  Código enviado para <strong style={{ color: "#fff" }}>{maskEmail(email)}</strong>
                  {otpTimer > 0 && <span style={{ color: "#64748b" }}> · expira em {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, "0")}</span>}
                </span>
              </div>

              <div>
                <label style={lbl}>Código recebido no email</label>
                <input
                  value={otpInput} onChange={e => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" maxLength={6}
                  style={{ ...inp, fontSize: 24, letterSpacing: 8, textAlign: "center", fontWeight: 800, color: "#f5a623" }}
                />
              </div>

              <div>
                <label style={lbl}>Nova senha</label>
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Mínimo 8 caracteres" style={inp} />
              </div>

              <div>
                <label style={lbl}>Confirmar nova senha</label>
                <input type="password" value={confPwd} onChange={e => setConfPwd(e.target.value)} style={inp} />
              </div>

              <Msg fb={passwordMsg} />

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={confirmPassword} disabled={passwordBusy}
                  style={{ flex: 1, background: "#f5a623", color: "#000", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 800, cursor: passwordBusy ? "not-allowed" : "pointer", opacity: passwordBusy ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <KeyRound size={16} /> {passwordBusy ? "A confirmar..." : "Confirmar nova senha"}
                </button>
                <button onClick={() => { setPwdStep("idle"); setPasswordMsg(null); setOtpInput(""); setNewPwd(""); setConfPwd(""); }}
                  style={{ padding: "13px 16px", background: "transparent", border: "1px solid #1e2d50", borderRadius: 10, color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>

              {otpTimer === 0 && (
                <button onClick={sendOtp} disabled={sendingOtp} style={{ background: "none", border: "none", color: "#f5a623", fontSize: 13, cursor: "pointer", padding: "4px 0", textDecoration: "underline" }}>
                  Reenviar código
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
