"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, Wallet, ArrowDownCircle, ArrowUpCircle,
  CheckCircle, Clock, XCircle, ChevronLeft,
} from "lucide-react";

const DEPOSIT_METHODS = [
  { id: "multicaixa", name: "Multicaixa Express", icon: "💳", color: "#e74c3c" },
];

function formatKz(n: number) {
  return n.toLocaleString("pt-AO") + " Kz";
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
  const [bnaRate,       setBnaRate]       = useState<number | null>(null);

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
    fetch("/api/bna-rate").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.usdToKz) setBnaRate(d.usdToKz);
    }).catch(() => {});
  }, [status]);

  async function resetDemo() {
    setDemoReloading(true);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (res.ok) { const d = await res.json(); setDemoBalance(d.demoBalance); }
    } catch { /* silent */ }
    setDemoReloading(false);
  }

  async function submit(type: "deposit" | "withdrawal") {
    setLoading(true); setMsg(null);
    const body: any = { type, amount, method };
    if (type === "withdrawal") { body.reference = bankAccount; body.method = bankName || method; }

    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) {
      setMsg({ text: type === "deposit" ? "Pedido de depósito enviado! Aguarde confirmação." : "Pedido de levantamento enviado!", ok: true });
      fetch("/api/transactions").then(r => r.json()).then(d => { if (Array.isArray(d)) setTransactions(d); });
    } else {
      setMsg({ text: d.error, ok: false });
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
                {demoReloading ? "A recarregar..." : "↺ Recarregar demo"}
              </button>
            )}
          </div>
        </div>

        {/* BNA rate bar */}
        {bnaRate && (
          <div style={{ textAlign: "center", color: "#4b5563", fontSize: 12, marginBottom: 16 }}>
            Taxa de câmbio: 1 USD = {bnaRate.toLocaleString("pt-AO")} Kz&nbsp;&nbsp;·&nbsp;&nbsp;Fonte: BNA
          </div>
        )}

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
            {/* Multicaixa Express badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
              <span style={{ fontSize: 26 }}>💳</span>
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Multicaixa Express</div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>Pagamento instantâneo</div>
              </div>
            </div>

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

            <button onClick={() => submit("deposit")} disabled={loading}
              style={{
                width: "100%", background: "#f5a623", color: "#0a0f1e", border: "none",
                borderRadius: 8, padding: 14, fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
              }}>
              {loading ? "A processar..." : `Depositar ${formatKz(amount)}`}
            </button>
          </div>
        )}

        {/* Withdraw tab */}
        {tab === "withdraw" && (
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 20 }}>
            {/* Multicaixa Express badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
              <span style={{ fontSize: 26 }}>💳</span>
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Multicaixa Express</div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>Levantamento para o teu número</div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 6 }}>Número de telefone (Multicaixa Express)</label>
              <input type="tel" value={bankAccount} onChange={e => setBankAccount(e.target.value)}
                placeholder="9XX XXX XXX" style={inputStyle} />
            </div>
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
              Processamento em 1-3 dias úteis. Valor mínimo: 5.000 Kz.
            </div>
            <button onClick={() => submit("withdrawal")} disabled={loading}
              style={{
                width: "100%", background: "#ef4444", color: "#fff", border: "none",
                borderRadius: 8, padding: 14, fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
              }}>
              {loading ? "A processar..." : `Solicitar levantamento de ${formatKz(amount)}`}
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
      </div>
    </div>
  );
}
