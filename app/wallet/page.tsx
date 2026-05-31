"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Wallet, ArrowDownCircle, ArrowUpCircle,
  Clock, CheckCircle, XCircle, Filter, RefreshCw,
  Send, AlertCircle, Eye, EyeOff, Copy, Check,
} from "lucide-react";
import { formatKz } from "@/lib/format";
import PageGuide from "@/app/components/PageGuide";
import { Skeleton, SkeletonTable } from "@/app/components/Skeleton";
import { Wallet as WalletIcon, ArrowDownCircle as DepositIcon, ArrowUpCircle as WithdrawIcon, Clock as HistoryIcon, ShieldAlert, Gift } from "lucide-react";

const WALLET_GUIDE = [
  { icon: <WalletIcon   size={26} color="#f5a623" />, iconColor: "#f5a623", title: "A tua Carteira",        description: "Aqui podes ver o teu saldo real e demo, fazer depósitos, pedir levantamentos e consultar todo o histórico de transacções.", tip: "O saldo demo serve para praticar — não é dinheiro real." },
  { icon: <DepositIcon  size={26} color="#22c55e" />, iconColor: "#22c55e", title: "Como fazer Depósito",   description: "Escolhe o valor, o método de pagamento e a referência. Depois confirmas com um código OTP enviado para o teu email. O admin aprova o depósito manualmente.", tip: "Guarda sempre o comprovativo de pagamento até o depósito ser aprovado." },
  { icon: <WithdrawIcon size={26} color="#ef4444" />, iconColor: "#ef4444", title: "Como fazer Levantamento", description: "Para levantar precisas de ter KYC aprovado. Indica o valor e a conta de destino, confirma com OTP. O processamento demora 1 a 3 dias úteis.", tip: "O KYC garante a segurança dos levantamentos. Faz a verificação em Perfil." },
  { icon: <HistoryIcon  size={26} color="#38bdf8" />, iconColor: "#38bdf8", title: "Histórico de Transacções", description: "Usa os filtros para ver só depósitos, só levantamentos, ou filtrar por estado: Pendente (a aguardar aprovação), Aprovado ou Rejeitado.", tip: "Pendente = em análise. Aprovado = creditado. Rejeitado = não processado." },
];

type Tx = {
  id: string; type: string; amount: number; method: string | null;
  status: string; reference: string | null; createdAt: string;
};

type Filter = "all" | "deposit" | "withdrawal";
type StatusFilter = "all" | "pending" | "completed" | "rejected";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  pending:   { label: "Pendente",  color: "#f5a623", bg: "rgba(245,166,35,0.1)",  Icon: Clock        },
  approved:  { label: "Aprovado",  color: "#22c55e", bg: "rgba(34,197,94,0.1)",   Icon: CheckCircle  },
  completed: { label: "Aprovado",  color: "#22c55e", bg: "rgba(34,197,94,0.1)",   Icon: CheckCircle  },
  rejected:  { label: "Rejeitado", color: "#ef4444", bg: "rgba(239,68,68,0.1)",   Icon: XCircle      },
};

function formatDate(s: string) {
  return new Date(s).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: cfg.bg, color: cfg.color, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
      <cfg.Icon size={11} /> {cfg.label}
    </span>
  );
}

export default function WalletPage() {
  const { status } = useSession();
  const router = useRouter();

  const [balance,     setBalance]     = useState(0);
  const [demoBalance, setDemoBalance] = useState(0);
  const [showBalance, setShowBalance] = useState(true);
  const [kycStatus,   setKycStatus]   = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<"deposit" | "withdraw" | "history">("history");
  const [typeFilter,  setTypeFilter]  = useState<Filter>("all");
  const [statusFilter,setStatusFilter]= useState<StatusFilter>("all");

  // Form state
  const [amount,    setAmount]    = useState("");
  const [method,    setMethod]    = useState("");
  const [reference, setReference] = useState("");
  const [otpSent,   setOtpSent]   = useState(false);
  const [otp,       setOtp]       = useState("");
  const [formMsg,   setFormMsg]   = useState<{ text: string; ok: boolean } | null>(null);
  const [busy,        setBusy]        = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [copiedRef,   setCopiedRef]   = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{ amount: number } | null>(null);
  // Campos levantamento
  const [withdrawMethod, setWithdrawMethod] = useState<"multicaixa_express" | "transferencia" | "">("");
  const [wPhone,   setWPhone]   = useState("");
  const [wBank,    setWBank]    = useState("");
  const [wAccount, setWAccount] = useState("");
  const [wHolder,  setWHolder]  = useState("");
  const MULTICAIXA_ENTITY = "10116";
  const MULTICAIXA_REF    = "946621503";

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const load = useCallback(async () => {
    const [bal, txs, prof] = await Promise.all([
      fetch("/api/balance").then(r => r.json()),
      fetch("/api/transactions").then(r => r.json()),
      fetch("/api/profile").then(r => r.ok ? r.json() : null),
    ]);
    setBalance(bal.balance ?? 0);
    setDemoBalance(bal.demoBalance ?? 0);
    setTransactions(Array.isArray(txs) ? txs : []);
    if (prof?.kycStatus) setKycStatus(prof.kycStatus);
    setLoading(false);
  }, []);

  useEffect(() => { if (status === "authenticated") load(); }, [status, load]);

  // Auto-refresh a cada 10 segundos para actualizar estados de transacções
  useEffect(() => {
    if (status !== "authenticated") return;
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [status, load]);

  async function sendOtp() {
    const minVal = tab === "withdraw" ? 10000 : 5000;
    if (!amount || Number(amount) < minVal) { setFormMsg({ text: `Valor mínimo: ${minVal.toLocaleString("pt-PT")} Kz`, ok: false }); return; }
    if (tab === "withdraw") {
      if (!withdrawMethod) { setFormMsg({ text: "Selecciona um método de levantamento.", ok: false }); return; }
      if (withdrawMethod === "multicaixa_express" && !wPhone.trim()) { setFormMsg({ text: "Introduz o número de telefone.", ok: false }); return; }
      if (withdrawMethod === "transferencia" && (!wBank.trim() || !wAccount.trim() || !wHolder.trim())) { setFormMsg({ text: "Preenche todos os campos bancários.", ok: false }); return; }
    }
    setBusy(true); setFormMsg(null);
    const r = await fetch("/api/otp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: tab === "deposit" ? "deposit" : "withdrawal", amount: Number(amount) }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) { setOtpSent(true); setFormMsg({ text: "Código enviado para o teu email.", ok: true }); }
    else setFormMsg({ text: d.error ?? "Erro ao enviar código.", ok: false });
  }

  async function submitTx() {
    if (!otp || otp.length !== 6) { setFormMsg({ text: "Introduz o código de 6 dígitos.", ok: false }); return; }
    setBusy(true); setFormMsg(null);
    let txMethod = method;
    let txReference = reference;
    if (tab === "withdraw") {
      if (withdrawMethod === "multicaixa_express") {
        txMethod    = "multicaixa_express";
        txReference = wPhone.trim();
      } else if (withdrawMethod === "transferencia") {
        txMethod    = "transferencia_bancaria";
        txReference = `Banco: ${wBank.trim()} | Conta: ${wAccount.trim()} | Titular: ${wHolder.trim()}`;
      }
    }
    const r = await fetch("/api/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: tab === "deposit" ? "deposit" : "withdrawal", amount: Number(amount), method: txMethod, reference: txReference, otp }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) {
      if (tab === "deposit") {
        setPaymentInfo({ amount: Number(amount) });
        setAmount(""); setMethod(""); setReference(""); setOtp(""); setOtpSent(false);
        setFormMsg(null);
        load();
      } else {
        setFormMsg({ text: "Pedido de levantamento submetido!", ok: true });
        setAmount(""); setMethod(""); setReference(""); setOtp(""); setOtpSent(false);
        setTab("history"); load();
      }
    } else {
      setFormMsg({ text: d.error ?? "Erro ao submeter.", ok: false });
    }
  }

  function resetForm() {
    setAmount(""); setMethod(""); setReference(""); setOtp(""); setOtpSent(false); setFormMsg(null); setPaymentInfo(null);
    setWithdrawMethod(""); setWPhone(""); setWBank(""); setWAccount(""); setWHolder("");
  }

  const filtered = transactions.filter(t => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  const card: React.CSSProperties = { background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 22, marginBottom: 14 };
  const inp: React.CSSProperties  = { width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" };
  const tabBtn = (t: string): React.CSSProperties => ({ flex: 1, padding: "10px 0", background: tab === t ? "#f5a623" : "none", color: tab === t ? "#0a0f1e" : "#94a3b8", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" });
  const filterBtn = (active: boolean): React.CSSProperties => ({ padding: "6px 12px", background: active ? "rgba(245,166,35,0.15)" : "rgba(255,255,255,0.04)", color: active ? "#f5a623" : "#64748b", border: `1px solid ${active ? "rgba(245,166,35,0.3)" : "#1e2d50"}`, borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer" });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#070d1a", padding: "24px 16px", maxWidth: 600, margin: "0 auto" }}>
      <Skeleton height={22} width={140} radius={8} style={{ marginBottom: 20 }} />
      <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 20, marginBottom: 14 }}>
        <Skeleton height={12} width="40%" radius={5} style={{ marginBottom: 10 }} />
        <Skeleton height={32} width="55%" radius={8} style={{ marginBottom: 6 }} />
        <Skeleton height={10} width="30%" radius={5} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Skeleton height={38} radius={10} style={{ flex: 1 }} />
        <Skeleton height={38} radius={10} style={{ flex: 1 }} />
      </div>
      <SkeletonTable rows={6} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#070d1a", fontFamily: "system-ui, -apple-system, sans-serif", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, color: "#94a3b8" }}>
          <ChevronLeft size={20} />
        </button>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, flex: 1 }}>Carteira</span>
        <button onClick={() => setShowBalance(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
          {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
        <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
          <RefreshCw size={16} />
        </button>
      </div>

      <PageGuide storageKey="dw_guide_wallet" steps={WALLET_GUIDE} />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>

        {/* Saldo cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ ...card, marginBottom: 0, background: "linear-gradient(135deg,#111827,#0f1e38)" }}>
            <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Saldo Real</div>
            <div style={{ color: "#f5a623", fontSize: 22, fontWeight: 900 }}>
              {showBalance ? formatKz(Math.floor(balance)) : "••••••"}
            </div>
          </div>
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Saldo Demo</div>
            <div style={{ color: "#94a3b8", fontSize: 22, fontWeight: 900 }}>
              {showBalance ? formatKz(Math.floor(demoBalance)) : "••••••"}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "#111827", border: "1px solid #1e2d50", borderRadius: 10, padding: 4, marginBottom: 20 }}>
          <button style={tabBtn("deposit")}   onClick={() => { setTab("deposit");  resetForm(); }}>
            <ArrowDownCircle size={14} style={{ verticalAlign: "middle", marginRight: 4 }} /> Depósito
          </button>
          <button style={tabBtn("withdraw")}  onClick={() => { setTab("withdraw"); resetForm(); }}>
            <ArrowUpCircle  size={14} style={{ verticalAlign: "middle", marginRight: 4 }} /> Levantamento
          </button>
          <button style={tabBtn("history")}   onClick={() => setTab("history")}>
            <Clock size={14} style={{ verticalAlign: "middle", marginRight: 4 }} /> Histórico
          </button>
        </div>

        {/* ── Depósito ─────────────────────────────────────────────────────────── */}
        {tab === "deposit" && (
          <div style={card}>
            {/* Bloqueio KYC */}
            {kycStatus !== "approved" && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 14, padding: "24px 20px", textAlign: "center", marginBottom: 20 }}>
                <ShieldAlert size={40} color="#ef4444" style={{ marginBottom: 12 }} />
                <div style={{ color: "#ef4444", fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Verificação de Identidade Necessária</div>
                <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
                  Para efectuar depósitos precisas de completar a verificação de identidade (KYC).<br />
                  {kycStatus === "pending"
                    ? "O teu KYC está a ser analisado. Aguarda a aprovação."
                    : "Submete os teus documentos no teu Perfil."}
                </div>
                {kycStatus !== "pending" && (
                  <a href="/profile" style={{ display: "inline-block", background: "#ef4444", color: "#fff", borderRadius: 10, padding: "10px 24px", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
                    Verificar Identidade
                  </a>
                )}
              </div>
            )}
            {/* Banner bónus */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg,rgba(245,166,35,0.1),rgba(249,115,22,0.07))", border: "1px solid rgba(245,166,35,0.35)", borderRadius: 12, padding: "12px 14px", marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, background: "rgba(245,166,35,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Gift size={18} color="#f5a623" />
              </div>
              <div>
                <div style={{ color: "#f5a623", fontWeight: 800, fontSize: 13 }}>Bónus de boas-vindas +10%</div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>No primeiro depósito de <strong style={{ color: "#fff" }}>50.000 Kz ou mais</strong>, recbes +10% directo no saldo.</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ArrowDownCircle size={20} color="#22c55e" />
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: 700 }}>Pedido de Depósito</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>Mínimo: 5.000 Kz · Máximo: 5.000.000 Kz</div>
              </div>
            </div>

            {/* Formulário só disponível com KYC aprovado */}
            {kycStatus !== "approved" ? null : paymentInfo ? (
              <div>
                <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 14, padding: "20px", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                    <CheckCircle size={18} color="#22c55e" />
                    <span style={{ color: "#22c55e", fontWeight: 800, fontSize: 15 }}>Pedido criado! Efectua o pagamento</span>
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
                    Vai ao <strong style={{ color: "#fff" }}>ATM Multicaixa</strong> ou <strong style={{ color: "#fff" }}>banca online</strong> e usa os dados abaixo para pagar:
                  </div>
                  {[
                    { label: "Entidade",   value: MULTICAIXA_ENTITY, copy: false },
                    { label: "Referência", value: MULTICAIXA_REF,    copy: true  },
                    { label: "Valor",      value: `${paymentInfo.amount.toLocaleString("pt-PT")} Kz`, copy: false },
                  ].map(item => (
                    <div key={item.label} style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 10, padding: "12px 16px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: 0.8, marginBottom: 2 }}>{item.label.toUpperCase()}</div>
                        <div style={{ color: "#fff", fontWeight: 900, fontSize: item.label === "Referência" ? 22 : 18, letterSpacing: item.label === "Referência" ? 3 : 0 }}>{item.value}</div>
                      </div>
                      {item.copy && (
                        <button onClick={() => { navigator.clipboard.writeText(item.value); setCopiedRef(true); setTimeout(() => setCopiedRef(false), 2000); }}
                          style={{ background: copiedRef ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${copiedRef ? "rgba(34,197,94,0.4)" : "#1e2d50"}`, borderRadius: 8, padding: "8px 12px", color: copiedRef ? "#22c55e" : "#64748b", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}>
                          {copiedRef ? <Check size={13} /> : <Copy size={13} />} {copiedRef ? "Copiado" : "Copiar"}
                        </button>
                      )}
                    </div>
                  ))}
                  <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 10, padding: "10px 14px", marginTop: 6, color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>
                    Após o pagamento o teu depósito será aprovado em breve. Guarda a referência caso precises de confirmação.
                  </div>
                </div>
                <button onClick={() => { setPaymentInfo(null); setTab("history"); }}
                  style={{ width: "100%", background: "#f5a623", color: "#0a0f1e", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                  Ver histórico
                </button>
              </div>
            ) : (
              <>
                {formMsg && (
                  <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertCircle size={14} color="#ef4444" />
                    <span style={{ color: "#ef4444", fontSize: 13 }}>{formMsg.text}</span>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Valor (Kz)</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="ex: 50000" style={inp} disabled={otpSent} />
                  </div>
                  {!otpSent ? (
                    <button onClick={sendOtp} disabled={busy} style={{ background: "#f5a623", color: "#0a0f1e", border: "none", borderRadius: 10, padding: "13px 16px", fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}>
                      {busy ? "A enviar código..." : "Gerar referência de pagamento"}
                    </button>
                  ) : (
                    <>
                      <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "10px 14px", color: "#22c55e", fontSize: 13, fontWeight: 600 }}>
                        Código enviado para o teu email. Introduz abaixo para confirmar.
                      </div>
                      <div>
                        <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Código OTP (6 dígitos)</label>
                        <input type="text" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" autoFocus
                          style={{ ...inp, fontSize: 24, textAlign: "center", letterSpacing: 10, fontWeight: 700 }} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={submitTx} disabled={busy || otp.length < 6} style={{ flex: 1, background: "#f5a623", color: "#0a0f1e", border: "none", borderRadius: 10, padding: "13px 16px", fontSize: 14, fontWeight: 700, cursor: (busy || otp.length < 6) ? "not-allowed" : "pointer", opacity: (busy || otp.length < 6) ? 0.7 : 1 }}>
                          {busy ? "A gerar referência..." : "Confirmar e gerar referência"}
                        </button>
                        <button onClick={resetForm} style={{ padding: "13px 16px", background: "transparent", border: "1px solid #1e2d50", borderRadius: 10, color: "#64748b", cursor: "pointer" }}>Cancelar</button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Levantamento ──────────────────────────────────────────────────────── */}
        {tab === "withdraw" && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ArrowUpCircle size={20} color="#ef4444" />
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: 700 }}>Pedido de Levantamento</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>Saldo disponível: {formatKz(Math.floor(balance))}</div>
              </div>
            </div>

            {balance <= 0 ? (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "20px", textAlign: "center" }}>
                <XCircle size={36} color="#ef4444" style={{ marginBottom: 12 }} />
                <div style={{ color: "#ef4444", fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Saldo insuficiente</div>
                <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
                  Precisas de ter saldo real para efectuar um levantamento.<br />
                  Faz um depósito primeiro.
                </div>
                <button onClick={() => setTab("deposit")} style={{ marginTop: 16, background: "#f5a623", color: "#0a0f1e", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                  Fazer Depósito
                </button>
              </div>
            ) : (
            <>
            <div style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: "#94a3b8", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={15} color="#f5a623" style={{ flexShrink: 0 }} />
              KYC obrigatório para levantamentos. O processamento demora 1-3 dias úteis.
            </div>

            {formMsg && (
              <div style={{ background: formMsg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${formMsg.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                {formMsg.ok ? <CheckCircle size={14} color="#22c55e" /> : <AlertCircle size={14} color="#ef4444" />}
                <span style={{ color: formMsg.ok ? "#22c55e" : "#ef4444", fontSize: 13 }}>{formMsg.text}</span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Valor */}
              <div>
                <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Valor (Kz)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="ex: 25000" style={inp} disabled={otpSent} />
              </div>

              {/* Taxa de levantamento */}
              {Number(amount) >= 10000 && (
                <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: 13 }}>
                    <span>Taxa de levantamento (5%)</span>
                    <span style={{ color: "#ef4444", fontWeight: 700 }}>− {Math.round(Number(amount) * 0.05).toLocaleString("pt-PT")} Kz</span>
                  </div>
                  <div style={{ borderTop: "1px solid rgba(239,68,68,0.15)", paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Valor que recebes</span>
                    <span style={{ color: "#22c55e", fontWeight: 800, fontSize: 14 }}>{Math.round(Number(amount) * 0.95).toLocaleString("pt-PT")} Kz</span>
                  </div>
                </div>
              )}

              {/* Método */}
              <div>
                <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Método de levantamento</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { value: "multicaixa_express", label: "Multicaixa Express", icon: "MXE" },
                    { value: "transferencia",      label: "Transferência Bancária", icon: "TRF" },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => !otpSent && setWithdrawMethod(opt.value as any)}
                      style={{ flex: 1, padding: "12px 8px", border: `2px solid ${withdrawMethod === opt.value ? "#ef4444" : "#1e2d50"}`, borderRadius: 10, background: withdrawMethod === opt.value ? "rgba(239,68,68,0.08)" : "#0a0f1e", color: withdrawMethod === opt.value ? "#ef4444" : "#64748b", fontWeight: 700, fontSize: 13, cursor: otpSent ? "not-allowed" : "pointer", textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 900, color: withdrawMethod === opt.value ? "#ef4444" : "#475569", marginBottom: 4, letterSpacing: 1 }}>{opt.icon}</div>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Campos Multicaixa Express */}
              {withdrawMethod === "multicaixa_express" && (
                <div>
                  <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Número de telefone</label>
                  <input value={wPhone} onChange={e => setWPhone(e.target.value)} placeholder="9XX XXX XXX" style={inp} disabled={otpSent} />
                </div>
              )}

              {/* Campos Transferência Bancária */}
              {withdrawMethod === "transferencia" && (
                <>
                  <div>
                    <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Banco</label>
                    <input value={wBank} onChange={e => setWBank(e.target.value)} placeholder="ex: BFA, BIC, BAI, BDA..." style={inp} disabled={otpSent} />
                  </div>
                  <div>
                    <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Número de conta</label>
                    <input value={wAccount} onChange={e => setWAccount(e.target.value)} placeholder="ex: 00000000000000000" style={inp} disabled={otpSent} />
                  </div>
                  <div>
                    <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Nome do titular</label>
                    <input value={wHolder} onChange={e => setWHolder(e.target.value)} placeholder="Nome completo" style={inp} disabled={otpSent} />
                  </div>
                </>
              )}

              {!otpSent ? (
                <button onClick={sendOtp} disabled={busy || !withdrawMethod} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, padding: "13px 16px", fontSize: 14, fontWeight: 700, cursor: (busy || !withdrawMethod) ? "not-allowed" : "pointer", opacity: (busy || !withdrawMethod) ? 0.6 : 1 }}>
                  {busy ? "A enviar código..." : "Continuar → Confirmar com código"}
                </button>
              ) : (
                <>
                  <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "10px 14px", color: "#22c55e", fontSize: 13, fontWeight: 600 }}>
                    Código enviado para o teu email. Introduz abaixo para confirmar.
                  </div>
                  <div>
                    <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Código OTP (6 dígitos)</label>
                    <input type="text" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" autoFocus
                      style={{ ...inp, fontSize: 24, textAlign: "center", letterSpacing: 10, fontWeight: 700 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={submitTx} disabled={busy || otp.length < 6} style={{ flex: 1, background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, padding: "13px 16px", fontSize: 14, fontWeight: 700, cursor: (busy || otp.length < 6) ? "not-allowed" : "pointer", opacity: (busy || otp.length < 6) ? 0.7 : 1 }}>
                      {busy ? "A submeter..." : "Confirmar Levantamento"}
                    </button>
                    <button onClick={resetForm} style={{ padding: "13px 16px", background: "transparent", border: "1px solid #1e2d50", borderRadius: 10, color: "#64748b", cursor: "pointer" }}>Cancelar</button>
                  </div>
                </>
              )}
            </div>
            </>
            )}
          </div>
        )}

        {/* ── Histórico ─────────────────────────────────────────────────────────── */}
        {tab === "history" && (
          <>
            {/* Filtros */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <Filter size={14} color="#64748b" style={{ alignSelf: "center" }} />
              {(["all","deposit","withdrawal"] as Filter[]).map(f => (
                <button key={f} onClick={() => setTypeFilter(f)} style={filterBtn(typeFilter === f)}>
                  {f === "all" ? "Todos" : f === "deposit" ? "Depósitos" : "Levantamentos"}
                </button>
              ))}
              <div style={{ width: 1, background: "#1e2d50", margin: "0 4px" }} />
              {(["all","pending","completed","rejected"] as StatusFilter[]).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} style={filterBtn(statusFilter === s)}>
                  {s === "all" ? "Todos" : STATUS_CFG[s]?.label ?? s}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", color: "#475569", padding: "48px 0" }}>
                <Wallet size={40} color="#1e2d50" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 14 }}>Nenhuma transacção encontrada.</div>
              </div>
            ) : (
              filtered.map(tx => {
                const isCredit = tx.type === "deposit" || tx.type === "bonus" || tx.type === "tournament_prize" || (tx.type === "adjustment" && tx.amount >= 0);
                const color    = isCredit ? "#22c55e" : "#ef4444";
                const bgColor  = isCredit ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)";
                const icon     = isCredit ? <ArrowDownCircle size={20} color="#22c55e" /> : <ArrowUpCircle size={20} color="#ef4444" />;
                const label    = tx.type === "deposit"          ? "Depósito"
                               : tx.type === "withdrawal"       ? "Levantamento"
                               : tx.type === "adjustment"       ? "Ajuste de Saldo"
                               : tx.type === "bonus"            ? "Bónus"
                               : tx.type === "tournament_prize" ? "Prémio de Torneio"
                               : tx.type === "tournament_entry" ? "Inscrição em Torneio"
                               : tx.type;
                return (
                  <div key={tx.id} style={{ ...card, padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{label}</span>
                          <span style={{ color, fontWeight: 800, fontSize: 15 }}>
                            {isCredit ? "+" : "−"}{formatKz(Math.abs(Math.floor(tx.amount)))}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 5 }}>
                          <div>
                            {tx.method && <span style={{ color: "#64748b", fontSize: 12 }}>{{
                              multicaixa_ref:      "Multicaixa (Ent/Ref)",
                              multicaixa_express:  "Multicaixa Express",
                              transferencia_bancaria: "Transferência Bancária",
                              usdt_trc20:          "USDT TRC-20",
                              crypto_nowpayments:  "USDT TRC-20",
                            }[tx.method] ?? tx.method}</span>}
                            <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>{formatDate(tx.createdAt)}</div>
                          </div>
                          <StatusBadge status={tx.status} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}
