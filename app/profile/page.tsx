"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, ChevronLeft, User, Shield, BarChart2, Lock,
  CheckCircle, Clock, XCircle, Save,
} from "lucide-react";

const PROVINCES = [
  "Bengo","Benguela","Bié","Cabinda","Cuando Cubango","Cuanza Norte",
  "Cuanza Sul","Cunene","Huambo","Huíla","Luanda","Lunda Norte",
  "Lunda Sul","Malanje","Moxico","Namibe","Uíge","Zaire",
];

function formatKz(n: number) { return n.toLocaleString("pt-AO") + " Kz"; }
function formatDate(s: string) {
  return new Date(s).toLocaleDateString("pt-AO", { year: "numeric", month: "long", day: "numeric" });
}

type Feedback = { text: string; ok: boolean } | null;

export default function ProfilePage() {
  const { status } = useSession();
  const router = useRouter();

  // Profile fields
  const [name,       setName]       = useState("");
  const [email,      setEmail]      = useState("");
  const [phone,      setPhone]      = useState("");
  const [province,   setProvince]   = useState("");
  const [kycStatus,  setKycStatus]  = useState("pending");
  const [biNumber,   setBiNumber]   = useState("");
  const [biInput,    setBiInput]    = useState("");
  const [createdAt,  setCreatedAt]  = useState("");

  // Password fields
  const [curPwd,  setCurPwd]  = useState("");
  const [newPwd,  setNewPwd]  = useState("");
  const [confPwd, setConfPwd] = useState("");

  // Stats
  const [totalTrades, setTotalTrades] = useState(0);
  const [winRate,     setWinRate]     = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);

  // UI state
  const [profileBusy,  setProfileBusy]  = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [kycBusy,      setKycBusy]      = useState(false);
  const [profileMsg,   setProfileMsg]   = useState<Feedback>(null);
  const [passwordMsg,  setPasswordMsg]  = useState<Feedback>(null);
  const [kycMsg,       setKycMsg]       = useState<Feedback>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    fetch("/api/profile").then(r => r.json()).then(d => {
      setName(d.name ?? "");
      setEmail(d.email ?? "");
      setPhone(d.phone ?? "");
      setProvince(d.province ?? "");
      setKycStatus(d.kycStatus ?? "pending");
      setBiNumber(d.biNumber ?? "");
      setCreatedAt(d.createdAt ?? "");
    });

    fetch("/api/trade").then(r => r.json()).then((trades: any[]) => {
      if (!Array.isArray(trades)) return;
      const closed  = trades.filter(t => t.status === "closed");
      const wins    = closed.filter(t => t.result === "win");
      const profit  = closed.reduce((s, t) => s + (t.profit ?? 0), 0);
      setTotalTrades(trades.length);
      setWinRate(closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0);
      setTotalProfit(profit);
    });
  }, [status]);

  async function saveProfile() {
    setProfileBusy(true); setProfileMsg(null);
    const res = await fetch("/api/profile", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, phone, province }),
    });
    const d = await res.json();
    setProfileMsg(res.ok ? { text: "Perfil atualizado com sucesso!", ok: true } : { text: d.error, ok: false });
    setProfileBusy(false);
  }

  async function savePassword() {
    setPasswordMsg(null);
    if (newPwd.length < 6) { setPasswordMsg({ text: "A nova senha deve ter pelo menos 6 caracteres", ok: false }); return; }
    if (newPwd !== confPwd) { setPasswordMsg({ text: "As senhas não coincidem", ok: false }); return; }
    setPasswordBusy(true);
    const res = await fetch("/api/profile/password", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
    });
    const d = await res.json();
    if (res.ok) { setPasswordMsg({ text: "Senha alterada com sucesso!", ok: true }); setCurPwd(""); setNewPwd(""); setConfPwd(""); }
    else setPasswordMsg({ text: d.error, ok: false });
    setPasswordBusy(false);
  }

  async function submitKyc() {
    setKycMsg(null); setKycBusy(true);
    const res = await fetch("/api/profile/kyc", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ biNumber: biInput }),
    });
    const d = await res.json();
    if (res.ok) { setKycMsg({ text: "BI submetido! A verificação pode demorar 1-2 dias úteis.", ok: true }); setKycStatus("pending"); setBiNumber(biInput); }
    else setKycMsg({ text: d.error, ok: false });
    setKycBusy(false);
  }

  const input: React.CSSProperties = {
    width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
    borderRadius: 8, padding: "11px 14px", color: "#fff",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const label: React.CSSProperties = { color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 };
  const card: React.CSSProperties = { background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: "22px 24px", marginBottom: 20 };
  const sectionTitle: React.CSSProperties = { color: "#fff", fontSize: 16, fontWeight: 700, margin: "0 0 18px", display: "flex", alignItems: "center", gap: 8 };

  function Msg({ fb }: { fb: Feedback }) {
    if (!fb) return null;
    return (
      <div style={{ background: fb.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${fb.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 8, padding: "9px 14px", marginTop: 14, color: fb.ok ? "#22c55e" : "#ef4444", fontSize: 13 }}>
        {fb.text}
      </div>
    );
  }

  const kycConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
    pending:  { color: "#f5a623", bg: "rgba(245,166,35,0.1)",  border: "rgba(245,166,35,0.25)",  icon: <Clock size={14} />,        label: "Verificação pendente"       },
    approved: { color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.25)",   icon: <CheckCircle size={14} />,  label: "Conta verificada ✓"         },
    rejected: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)",   icon: <XCircle size={14} />,      label: "Verificação rejeitada"      },
  };
  const kyc = kycConfig[kycStatus] ?? kycConfig.pending;

  if (status === "loading") return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "#f5a623", fontFamily: "system-ui", fontSize: 16 }}>A carregar...</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => router.push("/trade")}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#94a3b8" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ width: 32, height: 32, background: "#f5a623", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TrendingUp size={18} color="#0a0f1e" strokeWidth={2.5} />
        </div>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Perfil</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: kyc.bg, color: kyc.color, border: `1px solid ${kyc.border}`, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
            {kyc.icon} {kyc.label}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 660, margin: "0 auto", padding: "24px 16px" }}>

        {/* A — Estatísticas rápidas */}
        <div style={{ ...card, padding: "18px 24px" }}>
          <p style={{ ...sectionTitle, fontSize: 13 }}><BarChart2 size={15} color="#94a3b8" /> <span style={{ color: "#94a3b8" }}>Resumo da conta</span></p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Operações", value: totalTrades.toString(), color: "#94a3b8" },
              { label: "Taxa vitória", value: `${winRate}%`, color: totalProfit >= 0 ? "#22c55e" : "#ef4444" },
              { label: "Lucro total", value: formatKz(Math.floor(totalProfit)), color: totalProfit >= 0 ? "#22c55e" : "#ef4444" },
              { label: "Membro desde", value: createdAt ? formatDate(createdAt) : "—", color: "#94a3b8" },
            ].map(s => (
              <div key={s.label} style={{ background: "#0a0f1e", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>{s.label}</div>
                <div style={{ color: s.color, fontWeight: 700, fontSize: 14 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* B — Informações pessoais */}
        <div style={card}>
          <p style={sectionTitle}><User size={16} color="#f5a623" /> Informações pessoais</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={label}>Nome completo</label>
              <input value={name} onChange={e => setName(e.target.value)} style={input} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={label}>Email</label>
              <input value={email} readOnly style={{ ...input, color: "#64748b", cursor: "not-allowed" }} />
            </div>
            <div>
              <label style={label}>Telefone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+244 9XX XXX XXX" style={input} />
            </div>
            <div>
              <label style={label}>Província</label>
              <select value={province} onChange={e => setProvince(e.target.value)}
                style={{ ...input, cursor: "pointer", colorScheme: "dark" }}>
                <option value="">Selecionar...</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <button onClick={saveProfile} disabled={profileBusy}
            style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 7, background: "#f5a623", color: "#0a0f1e", border: "none", borderRadius: 8, padding: "11px 22px", fontSize: 14, fontWeight: 700, cursor: profileBusy ? "not-allowed" : "pointer", opacity: profileBusy ? 0.7 : 1 }}>
            <Save size={15} /> {profileBusy ? "A guardar..." : "Guardar alterações"}
          </button>
          <Msg fb={profileMsg} />
        </div>

        {/* C — Segurança */}
        <div style={card}>
          <p style={sectionTitle}><Lock size={16} color="#f5a623" /> Segurança — alterar senha</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={label}>Senha atual</label>
              <input type="password" value={curPwd} onChange={e => setCurPwd(e.target.value)} style={input} />
            </div>
            <div>
              <label style={label}>Nova senha</label>
              <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Mínimo 6 caracteres" style={input} />
            </div>
            <div>
              <label style={label}>Confirmar nova senha</label>
              <input type="password" value={confPwd} onChange={e => setConfPwd(e.target.value)} style={input} />
            </div>
          </div>

          <button onClick={savePassword} disabled={passwordBusy}
            style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 7, background: "#1e2d50", color: "#fff", border: "1px solid #2d3f6b", borderRadius: 8, padding: "11px 22px", fontSize: 14, fontWeight: 700, cursor: passwordBusy ? "not-allowed" : "pointer", opacity: passwordBusy ? 0.7 : 1 }}>
            <Shield size={15} /> {passwordBusy ? "A alterar..." : "Alterar senha"}
          </button>
          <Msg fb={passwordMsg} />
        </div>

        {/* D — KYC */}
        <div style={card}>
          <p style={sectionTitle}><Shield size={16} color="#f5a623" /> Verificação de identidade (KYC)</p>

          <div style={{ background: kyc.bg, border: `1px solid ${kyc.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: kyc.color }}>{kyc.icon}</span>
            <div>
              <div style={{ color: kyc.color, fontWeight: 700, fontSize: 14 }}>{kyc.label}</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                {kycStatus === "pending"  && (biNumber ? `BI submetido: ${biNumber}` : "Envie o seu BI para verificar a conta")}
                {kycStatus === "approved" && "A sua identidade foi verificada com sucesso."}
                {kycStatus === "rejected" && "A verificação foi rejeitada. Contacte o suporte para mais informações."}
              </div>
            </div>
          </div>

          {kycStatus !== "approved" && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={label}>Número do Bilhete de Identidade</label>
                <input
                  value={biInput}
                  onChange={e => setBiInput(e.target.value)}
                  placeholder="Ex: 006123456LA042"
                  maxLength={14}
                  style={input}
                />
                <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>{biInput.length}/14 caracteres</div>
              </div>
              <button onClick={submitKyc} disabled={kycBusy || biInput.length < 8}
                style={{ display: "flex", alignItems: "center", gap: 7, background: biInput.length >= 8 ? "#f5a623" : "#1e2d50", color: biInput.length >= 8 ? "#0a0f1e" : "#64748b", border: "none", borderRadius: 8, padding: "11px 22px", fontSize: 14, fontWeight: 700, cursor: kycBusy || biInput.length < 8 ? "not-allowed" : "pointer" }}>
                <CheckCircle size={15} /> {kycBusy ? "A submeter..." : "Submeter para verificação"}
              </button>
              <Msg fb={kycMsg} />
            </>
          )}
        </div>

      </div>
    </div>
  );
}
