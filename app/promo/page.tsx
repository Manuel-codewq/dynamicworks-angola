"use client";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Gift, CheckCircle, AlertCircle, Clock, Info } from "lucide-react";

type State =
  | { kind: "loading" }
  | { kind: "available"; amount: number }
  | { kind: "claimed_now"; amount: number }
  | { kind: "already_claimed" }
  | { kind: "expired" }
  | { kind: "none" }
  | { kind: "error"; error: string };

export default function PromoPage() {
  const { status } = useSession();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [claiming, setClaiming] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent("/promo")}`);
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated" || checked.current) return;
    checked.current = true;
    fetch("/api/promo/claim")
      .then(async r => {
        const data = await r.json();
        if (!r.ok) { setState({ kind: "error", error: data.error || "Erro ao verificar a promoção" }); return; }
        if (data.state === "available") setState({ kind: "available", amount: data.amount });
        else if (data.state === "claimed") setState({ kind: "already_claimed" });
        else if (data.state === "expired") setState({ kind: "expired" });
        else setState({ kind: "none" });
      })
      .catch(() => setState({ kind: "error", error: "Erro de ligação. Tenta novamente." }));
  }, [status]);

  async function handleClaim() {
    setClaiming(true);
    try {
      const r = await fetch("/api/promo/claim", { method: "POST" });
      const data = await r.json();
      if (r.ok) setState({ kind: "claimed_now", amount: data.amount });
      else setState({ kind: "error", error: data.error || "Erro ao processar o resgate" });
    } catch {
      setState({ kind: "error", error: "Erro de ligação. Tenta novamente." });
    }
    setClaiming(false);
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1e", display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif", padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 420, background: "#111827",
        border: "1px solid #1e2d50", borderRadius: 20, padding: "40px 32px",
        textAlign: "center",
      }}>
        {state.kind === "loading" ? (
          <>
            <Spinner />
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>A verificar a tua conta...</div>
          </>
        ) : state.kind === "available" ? (
          <>
            <Icon bg="rgba(255,255,255,0.08)" border="rgba(255,255,255,0.2)"><Gift size={30} color="#ffffff" /></Icon>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              Tens {state.amount.toLocaleString("pt-PT")} Kz à tua espera!
            </div>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
              Clica no botão para resgatar o saldo da promoção.
            </p>
            <button onClick={handleClaim} disabled={claiming}
              style={{ width: "100%", background: claiming ? "#7a5118" : "#ffffff", color: "#0a0f1e", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontWeight: 800, cursor: claiming ? "not-allowed" : "pointer" }}>
              {claiming ? "A resgatar..." : `Resgatar ${state.amount.toLocaleString("pt-PT")} Kz`}
            </button>
          </>
        ) : state.kind === "claimed_now" ? (
          <>
            <Icon bg="rgba(34,197,94,0.12)" border="rgba(34,197,94,0.3)"><Gift size={30} color="#22c55e" /></Icon>
            <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              Recebeste {state.amount.toLocaleString("pt-PT")} Kz!
            </div>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
              O saldo já foi adicionado à tua conta real.
            </p>
            <button onClick={() => router.push("/wallet")}
              style={{ width: "100%", background: "#ffffff", color: "#0a0f1e", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
              Ver saldo
            </button>
          </>
        ) : state.kind === "already_claimed" ? (
          <Message icon={<CheckCircle size={30} color="#22c55e" />} bg="rgba(34,197,94,0.12)" border="rgba(34,197,94,0.3)"
            title="Já resgataste esta promoção." router={router} />
        ) : state.kind === "expired" ? (
          <Message icon={<Clock size={30} color="#f59e0b" />} bg="rgba(245,158,11,0.1)" border="rgba(245,158,11,0.3)"
            title="Esta promoção expirou." router={router} />
        ) : state.kind === "none" ? (
          <Message icon={<Info size={30} color="#64748b" />} bg="rgba(100,116,139,0.1)" border="rgba(100,116,139,0.3)"
            title="Não tens nenhuma promoção disponível no momento." router={router} />
        ) : (
          <Message icon={<AlertCircle size={30} color="#ef4444" />} bg="rgba(239,68,68,0.1)" border="rgba(239,68,68,0.3)"
            title={state.error} router={router} />
        )}
      </div>
      <style>{`@keyframes promo-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Spinner() {
  return (
    <Icon bg="rgba(255,255,255,0.08)" border="rgba(255,255,255,0.2)">
      <div style={{ width: 24, height: 24, border: "3px solid rgba(255,255,255,0.25)", borderTopColor: "#ffffff", borderRadius: "50%", animation: "promo-spin .8s linear infinite" }} />
    </Icon>
  );
}

function Icon({ bg, border, children }: { bg: string; border: string; children: React.ReactNode }) {
  return (
    <div style={{ width: 64, height: 64, borderRadius: 18, background: bg, border: `1px solid ${border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
      {children}
    </div>
  );
}

function Message({ icon, bg, border, title, router }: { icon: React.ReactNode; bg: string; border: string; title: string; router: ReturnType<typeof useRouter> }) {
  return (
    <>
      <Icon bg={bg} border={border}>{icon}</Icon>
      <div style={{ color: "#fff", fontSize: 18, fontWeight: 700, marginBottom: 28 }}>{title}</div>
      <button onClick={() => router.push("/trade")}
        style={{ width: "100%", background: "#1e2d50", color: "#fff", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        Ir para a plataforma
      </button>
    </>
  );
}
