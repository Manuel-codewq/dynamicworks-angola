"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, Wallet, ArrowDownCircle, ArrowUpCircle,
  CheckCircle, Clock, XCircle, ChevronLeft, ShieldCheck, Mail,
  CreditCard, RefreshCw, Copy, Bitcoin,
} from "lucide-react";

const DEPOSIT_METHODS = [
  { id: "multicaixa", name: "Multicaixa Express", color: "#e74c3c" },
];

function formatKz(n: number) {
  return n.toLocaleString("pt-PT") + " Kz";
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    pending: { color: "#f5a623", bg: "rgba(245,166,35,0.1)", icon: <Clock size={12} />, label: "Pendente" },
    completed: { color: "#22c55e", bg: "rgba(34,197,94,0.1)", icon: <CheckCircle size={12} />, label: "Concluído" },
    rejected: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", icon: <XCircle size={12} />, label: "Rejeitado" },
  };
  const c = config[status] ?? config.pending;
  return (
    <span style={{
      background: c.bg, color: c.color, borderRadius: 20,
      padding: "2px 8px", fontSize: 11, fontWeight: 600,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {c.icon} {c.label}
    </span>
  );
}

export default function WalletPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [demoBalance, setDemoBalance] = useState(0);
  const [isDemo, setIsDemo] = useState(true);
  const [tab, setTab] = useState<"deposit" | "withdraw" | "history">("deposit");
  const [method, setMethod] = useState(DEPOSIT_METHODS[0].id);
  const [amount, setAmount] = useState(5000);
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [msg,           setMsg]           = useState<{ text: string; ok: boolean } | null>(null);
  const [demoReloading, setDemoReloading] = useState(false);
  // OTP flow
  const [otpStep,       setOtpStep]       = useState(false);
  const [otpCode,       setOtpCode]       = useState("");
  const [otpLoading,    setOtpLoading]    = useState(false);
  const [pendingType,   setPendingType]   = useState<"deposit" | "withdrawal" | null>(null);
  const [kycStatus,     setKycStatus]     = useState<string>("pending");
  const [promoCode,     setPromoCode]     = useState("");
  const [promoLoading,  setPromoLoading]  = useState(false);
  const [promoMsg,      setPromoMsg]      = useState<{ text: string; ok: boolean } | null>(null);
  // USDT flow
  const [payMethod,     setPayMethod]     = useState<"multicaixa" | "usdt">("usdt");
  const [usdtAddress,   setUsdtAddress]   = useState("");
  const [usdtDeposit,   setUsdtDeposit]   = useState<{ usdtAmount: number; usdtAddress: string; usdtRate: number; expiresAt: string } | null>(null);
  const [usdtLoading,   setUsdtLoading]   = useState(false);
  const [copied,        setCopied]        = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/balance").then(r => r.json()).then(d => {
      setBalance(d.balance); setDemoBalance(d.demoBalance); setIsDemo(d.isDemo);
    });
    fetch("/api/transactions").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setTransactions(d);
    });
    fetch("/api/profile/kyc").then(r => r.json()).then(d => {
      if (d?.kycStatus) setKycStatus(d.kycStatus);
    });
  }, [status]);

  async function resetDemo() {
    setDemoReloading(true);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (res.ok) { const d = await res.json(); setDemoBalance(d.demoBalance); }
    } catch { /* silent */ }
    setDemoReloading(false);
  }

  // Passo 1: pedir OTP
  async function requestOtp(type: "deposit" | "withdrawal") {
    setLoading(true); setMsg(null);
    const res = await fetch("/api/otp", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ type, amount }),
    });
    setLoading(false);
    if (res.ok) {
      setPendingType(type);
      setOtpCode("");
      setOtpStep(true);
    } else {
      const d = await res.json();
      setMsg({ text: d.error ?? "Erro ao enviar código OTP", ok: false });
    }
  }

  // Passo 2: confirmar OTP e criar transação
  async function confirmOtp() {
    if (!pendingType) return;
    setOtpLoading(true); setMsg(null);

    let res: Response;
    if (pendingType === "withdrawal" && payMethod === "usdt") {
      res = await fetch("/api/transactions/usdt/withdraw", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amount, address: usdtAddress, otp: otpCode }),
      });
    } else {
      const body: any = { type: pendingType, amount, method, otp: otpCode };
      if (pendingType === "withdrawal") { body.reference = bankAccount; body.method = bankName || method; }
      res = await fetch("/api/transactions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
    }
    const d = await res.json();
    setOtpLoading(false);
    if (res.ok) {
      setOtpStep(false);
      setMsg({ text: pendingType === "deposit" ? "Pedido de depósito enviado! Aguarde confirmação." : "Pedido de levantamento enviado!", ok: true });
      fetch("/api/transactions").then(r => r.json()).then(d => { if (Array.isArray(d)) setTransactions(d); });
    } else {
      setMsg({ text: d.error, ok: false });
    }
  }

  async function requestUsdtDeposit() {
    setUsdtLoading(true); setMsg(null); setUsdtDeposit(null);
    const res = await fetch("/api/transactions/usdt/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const d = await res.json();
    setUsdtLoading(false);
    if (res.ok) {
      setUsdtDeposit({
        usdtAmount: d.usdtAmount,
        usdtAddress: d.usdtAddress,
        usdtRate: d.usdtRate,
        expiresAt: d.expiresAt,
      });
      fetch("/api/transactions").then(r => r.json()).then(d => { if (Array.isArray(d)) setTransactions(d); });
    } else {
      setMsg({ text: d.error ?? "Erro ao criar pedido USDT", ok: false });
    }
  }

  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* silent */ }
  }

  async function redeemPromo() {
    if (!promoCode.trim()) return;
    setPromoLoading(true); setPromoMsg(null);
    const res = await fetch("/api/promo/redeem", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: promoCode }),
    });
    const d = await res.json();
    setPromoLoading(false);
    if (res.ok) {
      setPromoMsg({ text: `🎉 Código aplicado! + ${formatKz(d.value)} adicionados à tua conta real.`, ok: true });
      setPromoCode("");
      fetch("/api/balance").then(r => r.json()).then(b => { setBalance(b.balance); });
    } else {
      setPromoMsg({ text: d.error ?? "Código inválido", ok: false });
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
    borderRadius: 8, padding: "11px 14px", color: "#ffffff",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/trade")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#94a3b8" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ width: 32, height: 32, background: "#f5a623", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TrendingUp size={18} color="#0a0f1e" strokeWidth={2.5} />
        </div>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Carteira</span>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
        {/* Balance cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: 20 }}>
            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Saldo Real</div>
            <div style={{ color: "#22c55e", fontSize: 22, fontWeight: 800 }}>{formatKz(Math.floor(balance))}</div>
          </div>
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: 20 }}>
            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Saldo Demo</div>
            <div style={{ color: "#f5a623", fontSize: 22, fontWeight: 800 }}>{formatKz(Math.floor(demoBalance))}</div>
            {demoBalance < 5000 && (
              <button onClick={resetDemo} disabled={demoReloading}
                style={{ marginTop: 10, background: "transparent", border: "1px solid #f5a623", color: "#f5a623", borderRadius: 6, fontSize: 12, padding: "4px 10px", cursor: demoReloading ? "not-allowed" : "pointer", opacity: demoReloading ? 0.6 : 1 }}>
                <RefreshCw size={12} style={{ display:"inline", marginRight:5, verticalAlign:"middle" }} />{demoReloading ? "A recarregar..." : "Recarregar demo"}
              </button>
            )}
          </div>
        </div>


        {/* Tabs */}
        <div style={{ display: "flex", background: "#111827", border: "1px solid #1e2d50", borderRadius: 10, padding: 4, marginBottom: 20, gap: 4 }}>
          {([["deposit", "Depositar", ArrowDownCircle], ["withdraw", "Levantar", ArrowUpCircle], ["history", "Histórico", Clock]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{
                flex: 1, background: tab === id ? "#f5a623" : "transparent",
                color: tab === id ? "#0a0f1e" : "#94a3b8",
                border: "none", borderRadius: 7, padding: "9px 0", fontSize: 13, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {msg && (
          <div style={{
            background: msg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${msg.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: msg.ok ? "#22c55e" : "#ef4444", fontSize: 14,
          }}>{msg.text}</div>
        )}

        {/* Deposit tab */}
        {tab === "deposit" && (
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 20 }}>
            {/* Method selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {/* Multicaixa Express removido temporariamente */}
              {/* <button onClick={() => { setPayMethod("multicaixa"); setUsdtDeposit(null); }}
                style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                  background: payMethod === "multicaixa" ? "rgba(231,76,60,0.12)" : "#0a0f1e",
                  border: `1px solid ${payMethod === "multicaixa" ? "rgba(231,76,60,0.5)" : "#1e2d50"}`,
                  borderRadius: 10, cursor: "pointer",
                }}>
                <CreditCard size={22} color="#e74c3c" />
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Multicaixa</div>
                  <div style={{ color: "#94a3b8", fontSize: 11 }}>Express</div>
                </div>
              </button> */}
              <button onClick={() => setPayMethod("usdt")}
                style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                  background: payMethod === "usdt" ? "rgba(38,161,123,0.12)" : "#0a0f1e",
                  border: `1px solid ${payMethod === "usdt" ? "rgba(38,161,123,0.5)" : "#1e2d50"}`,
                  borderRadius: 10, cursor: "pointer",
                }}>
                <Bitcoin size={22} color="#26a17b" />
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>USDT</div>
                  <div style={{ color: "#94a3b8", fontSize: 11 }}>TRC-20</div>
                </div>
              </button>
            </div>

            {payMethod === "multicaixa" && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>Valor (Kz)</label>
                  <input type="number" value={amount} onChange={e => setAmount(parseInt(e.target.value) || 0)}
                    placeholder="5000" style={inputStyle} />
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  {[5000, 10000, 25000, 50000].map(v => (
                    <button key={v} onClick={() => setAmount(v)}
                      style={{
                        flex: 1, background: amount === v ? "#f5a623" : "#1e2d50",
                        color: amount === v ? "#0a0f1e" : "#94a3b8", border: "none", borderRadius: 6,
                        padding: "7px 0", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>{(v / 1000)}k</button>
                  ))}
                </div>

                <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#94a3b8" }}>
                  <strong style={{ color: "#f5a623" }}>Instruções:</strong> Após clicar em &quot;Enviar pedido&quot;, um agente entrará em contacto via WhatsApp para confirmar o depósito via Multicaixa Express.
                </div>

                <button onClick={() => requestOtp("deposit")} disabled={loading}
                  style={{
                    width: "100%", background: "#f5a623", color: "#0a0f1e", border: "none",
                    borderRadius: 8, padding: 14, fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                  {loading ? "A enviar código..." : <><ShieldCheck size={16} /> {`Depositar ${formatKz(amount)}`}</>}
                </button>
              </>
            )}

            {payMethod === "usdt" && (
              <>
                {kycStatus !== "approved" && (
                  <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 14px", marginBottom: 16, color: "#94a3b8", fontSize: 13 }}>
                    <strong style={{ color: "#ef4444" }}>KYC obrigatório</strong> — para depositar via USDT precisas de ter a verificação de identidade aprovada. <a href="/kyc" style={{ color: "#f5a623" }}>Verificar →</a>
                  </div>
                )}

                {!usdtDeposit && (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>Valor (Kz)</label>
                      <input type="number" value={amount} onChange={e => setAmount(parseInt(e.target.value) || 0)}
                        placeholder="5000" style={inputStyle} />
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                      {[5000, 10000, 25000, 50000].map(v => (
                        <button key={v} onClick={() => setAmount(v)}
                          style={{
                            flex: 1, background: amount === v ? "#26a17b" : "#1e2d50",
                            color: amount === v ? "#0a0f1e" : "#94a3b8", border: "none", borderRadius: 6,
                            padding: "7px 0", fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}>{(v / 1000)}k</button>
                      ))}
                    </div>

                    <div style={{ background: "rgba(38,161,123,0.08)", border: "1px solid rgba(38,161,123,0.2)", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#94a3b8" }}>
                      <strong style={{ color: "#26a17b" }}>Como funciona:</strong> Vamos gerar um endereço TRC-20 e um valor exato em USDT. Envias para esse endereço e o sistema credita automaticamente o teu saldo assim que a transferência confirmar.
                    </div>

                    <button onClick={requestUsdtDeposit} disabled={usdtLoading || kycStatus !== "approved"}
                      style={{
                        width: "100%", background: "#26a17b", color: "#fff", border: "none",
                        borderRadius: 8, padding: 14, fontWeight: 700, fontSize: 15,
                        cursor: usdtLoading || kycStatus !== "approved" ? "not-allowed" : "pointer",
                        opacity: kycStatus !== "approved" ? 0.5 : 1,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}>
                      {usdtLoading ? "A criar pedido..." : <><Bitcoin size={16} /> Gerar endereço USDT</>}
                    </button>
                  </>
                )}

                {usdtDeposit && (
                  <div>
                    <div style={{ background: "rgba(38,161,123,0.08)", border: "1px solid rgba(38,161,123,0.3)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                      <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>Envia EXATAMENTE este valor</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div style={{ color: "#26a17b", fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                          {usdtDeposit.usdtAmount.toFixed(4)} USDT
                        </div>
                        <button onClick={() => copyToClipboard(usdtDeposit.usdtAmount.toFixed(4), "amount")}
                          style={{ background: "#1e2d50", border: "none", borderRadius: 6, padding: "6px 10px", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                          <Copy size={12} /> {copied === "amount" ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>
                        Equivalente a {formatKz(amount)} · taxa {usdtDeposit.usdtRate.toLocaleString("pt-PT")} Kz/USDT
                      </div>
                    </div>

                    <div style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                      <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>Endereço TRC-20</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div style={{ color: "#fff", fontFamily: "monospace", fontSize: 13, wordBreak: "break-all" }}>
                          {usdtDeposit.usdtAddress}
                        </div>
                        <button onClick={() => copyToClipboard(usdtDeposit.usdtAddress, "addr")}
                          style={{ background: "#1e2d50", border: "none", borderRadius: 6, padding: "6px 10px", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, flexShrink: 0 }}>
                          <Copy size={12} /> {copied === "addr" ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                    </div>

                    <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12, color: "#94a3b8" }}>
                      ⚠️ Envia <strong style={{ color: "#fff" }}>exatamente</strong> {usdtDeposit.usdtAmount.toFixed(4)} USDT pela rede <strong style={{ color: "#fff" }}>TRC-20 (Tron)</strong>. Valores diferentes ou outra rede ficam por confirmar manualmente.
                    </div>

                    <div style={{ background: "rgba(245,166,35,0.05)", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: "#64748b", textAlign: "center" }}>
                      Janela válida: {new Date(usdtDeposit.expiresAt).toLocaleString("pt-AO", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                    </div>

                    <button onClick={() => setUsdtDeposit(null)}
                      style={{ width: "100%", background: "#1e2d50", color: "#94a3b8", border: "none", borderRadius: 8, padding: 12, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                      Criar novo pedido
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Withdraw tab */}
        {tab === "withdraw" && (
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 20 }}>
            {/* KYC banner — bloqueia se não aprovado */}
            {kycStatus !== "approved" && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 12, padding: "16px 18px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 14 }}>
                <ShieldCheck size={28} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Verificação de identidade obrigatória</div>
                  <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>
                    Para efectuar levantamentos precisas de completar o processo de verificação KYC.{" "}
                    {kycStatus === "pending" && "O teu pedido está a aguardar aprovação."}
                    {kycStatus === "rejected" && "O teu pedido foi rejeitado. Submete novamente."}
                    {kycStatus === "not_submitted" && ""}
                  </div>
                  {kycStatus !== "pending" && (
                    <a href="/kyc" style={{ display: "inline-block", marginTop: 10, background: "#ef4444", color: "#fff", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                      Verificar identidade →
                    </a>
                  )}
                </div>
              </div>
            )}
            {/* Method selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={() => {}} 
                style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                  background: "#0a0f1e",
                  border: "1px solid #1e2d50",
                  borderRadius: 10, cursor: "not-allowed", opacity: 0.6
                }}>
                <CreditCard size={22} color="#94a3b8" />
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: "#94a3b8", fontWeight: 700, fontSize: 13 }}>Multicaixa</div>
                  <div style={{ color: "#f5a623", fontSize: 10, fontWeight: 600 }}>Brevemente</div>
                </div>
              </button>
              <button onClick={() => setPayMethod("usdt")}
                style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                  background: payMethod === "usdt" ? "rgba(38,161,123,0.12)" : "#0a0f1e",
                  border: `1px solid ${payMethod === "usdt" ? "rgba(38,161,123,0.5)" : "#1e2d50"}`,
                  borderRadius: 10, cursor: "pointer",
                }}>
                <Bitcoin size={22} color="#26a17b" />
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>USDT</div>
                  <div style={{ color: "#94a3b8", fontSize: 11 }}>TRC-20</div>
                </div>
              </button>
            </div>

            {payMethod === "multicaixa" && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>Número de telefone (Multicaixa Express)</label>
              <input type="tel" value={bankAccount} onChange={e => setBankAccount(e.target.value)}
                placeholder="9XX XXX XXX" style={inputStyle} />
            </div>
            )}

            {payMethod === "usdt" && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>Endereço TRC-20 (Tron)</label>
              <input type="text" value={usdtAddress} onChange={e => setUsdtAddress(e.target.value.trim())}
                placeholder="TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13 }} />
              <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>
                Verifica bem o endereço — envios USDT são irreversíveis.
              </div>
            </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>Valor (Kz)</label>
              <input type="number" value={amount} onChange={e => setAmount(parseInt(e.target.value) || 0)}
                placeholder="5000" style={inputStyle} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {[5000, 10000, 25000, 50000].map(v => (
                  <button key={v} onClick={() => setAmount(v)}
                    style={{ flex: 1, background: amount === v ? "#ef4444" : "#1e2d50", color: amount === v ? "#fff" : "#94a3b8", border: "none", borderRadius: 6, padding: "7px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {(v / 1000)}k
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#94a3b8" }}>
              {payMethod === "usdt"
                ? "Processamento manual em 24h úteis. Mínimo 5.000 Kz. O envio USDT é feito pela equipa após validação."
                : "Processamento em 1-3 dias úteis. Valor mínimo: 5.000 Kz."}
            </div>
            <button
              onClick={() => requestOtp("withdrawal")}
              disabled={
                loading ||
                (payMethod === "usdt" && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(usdtAddress))
              }
              style={{
                width: "100%", background: "#ef4444", color: "#fff", border: "none",
                borderRadius: 8, padding: 14, fontWeight: 700, fontSize: 15,
                cursor: loading ? "not-allowed" : "pointer",
                opacity:
                  (payMethod === "usdt" && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(usdtAddress)) ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              {loading ? "A enviar código..." : <><ShieldCheck size={16} /> {`Solicitar levantamento de ${formatKz(amount)}`}</>}
            </button>
          </div>
        )}

        {/* History tab */}
        {tab === "history" && (
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 20 }}>
            <h3 style={{ color: "#fff", margin: "0 0 16px", fontSize: 16 }}>Histórico de transações</h3>
            {transactions.length === 0 ? (
              <p style={{ color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>Nenhuma transação ainda</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {transactions.map(tx => (
                  <div key={tx.id} style={{ background: "#0a0f1e", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {tx.type === "deposit"
                        ? <ArrowDownCircle size={20} color="#22c55e" />
                        : <ArrowUpCircle size={20} color="#ef4444" />}
                      <div>
                        <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
                          {tx.type === "deposit" ? "Depósito" : "Levantamento"}
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: 11 }}>
                          {tx.method} · {new Date(tx.createdAt).toLocaleDateString("pt-AO")}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: tx.type === "deposit" ? "#22c55e" : "#ef4444", fontWeight: 700, fontSize: 14 }}>
                        {tx.type === "deposit" ? "+" : "-"}{formatKz(tx.amount)}
                      </div>
                      <StatusBadge status={tx.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Código Promocional ── */}
        <div style={{ background: "#111827", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 14, padding: 20, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 16 }}>🎁</span>
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Código Promocional</div>
              <div style={{ color: "#64748b", fontSize: 12 }}>Introduz um código para receber bónus</div>
            </div>
          </div>

          {promoMsg && (
            <div style={{
              background: promoMsg.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${promoMsg.ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
              borderRadius: 8, padding: "10px 14px", marginBottom: 14,
              color: promoMsg.ok ? "#22c55e" : "#ef4444", fontSize: 13,
            }}>{promoMsg.text}</div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={promoCode}
              onChange={e => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Ex: BONUS2025"
              style={{ ...inputStyle, flex: 1, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}
            />
            <button
              onClick={redeemPromo}
              disabled={promoLoading || !promoCode.trim()}
              style={{
                background: "linear-gradient(135deg,#f5a623,#e8940f)", color: "#000",
                border: "none", borderRadius: 8, padding: "0 18px", fontWeight: 800,
                fontSize: 13, cursor: promoLoading || !promoCode.trim() ? "not-allowed" : "pointer",
                opacity: promoLoading || !promoCode.trim() ? 0.5 : 1, whiteSpace: "nowrap",
              }}>
              {promoLoading ? "..." : "Aplicar"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal OTP ── */}
      {otpStep && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, padding: 32, width: "100%", maxWidth: 400, boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
            {/* Ícone */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Mail size={26} color="#f5a623" />
              </div>
            </div>

            <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 800, textAlign: "center", margin: "0 0 8px" }}>
              Verificação OTP
            </h2>
            <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", margin: "0 0 24px", lineHeight: 1.5 }}>
              Enviámos um código de 6 dígitos para o teu email.<br />
              Válido durante <strong style={{ color: "#fff" }}>10 minutos</strong>.
            </p>

            {/* Input OTP */}
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              style={{
                width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
                borderRadius: 10, padding: "14px 0", color: "#f5a623",
                fontSize: 32, fontWeight: 900, textAlign: "center", letterSpacing: 12,
                outline: "none", boxSizing: "border-box", marginBottom: 20,
                fontVariantNumeric: "tabular-nums",
              }}
            />

            {msg && !msg.ok && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#ef4444", fontSize: 13 }}>
                {msg.text}
              </div>
            )}

            {/* Botões */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setOtpStep(false); setOtpCode(""); setMsg(null); }}
                style={{ flex: 1, background: "#1e2d50", color: "#94a3b8", border: "none", borderRadius: 8, padding: 13, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Cancelar
              </button>
              <button
                onClick={confirmOtp}
                disabled={otpCode.length !== 6 || otpLoading}
                style={{
                  flex: 2, background: pendingType === "deposit" ? "#f5a623" : "#ef4444",
                  color: pendingType === "deposit" ? "#0a0f1e" : "#fff",
                  border: "none", borderRadius: 8, padding: 13, fontWeight: 800, fontSize: 14,
                  cursor: otpCode.length !== 6 || otpLoading ? "not-allowed" : "pointer",
                  opacity: otpCode.length !== 6 || otpLoading ? 0.6 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                {otpLoading ? "A verificar..." : <><ShieldCheck size={15} /> Confirmar</>}
              </button>
            </div>

            {/* Reenviar */}
            <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#4b5563" }}>
              Não recebeste?{" "}
              <button
                onClick={() => pendingType && requestOtp(pendingType)}
                style={{ background: "none", border: "none", color: "#f5a623", cursor: "pointer", fontSize: 13, fontWeight: 600, textDecoration: "underline", padding: 0 }}>
                Reenviar código
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
