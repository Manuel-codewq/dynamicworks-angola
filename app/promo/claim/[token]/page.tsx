"use client";
import { useState, useEffect, useRef, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Gift, CheckCircle, AlertCircle } from "lucide-react";

type Result = { ok: true; amount: number } | { ok: false; error: string } | null;

export default function PromoClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { status } = useSession();
  const router = useRouter();
  const [result, setResult] = useState<Result>(null);
  const claiming = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/promo/claim/${token}`)}`);
    }
  }, [status, router, token]);

  useEffect(() => {
    if (status !== "authenticated" || claiming.current) return;
    claiming.current = true;
    fetch(`/api/promo/claim/${token}`, { method: "POST" })
      .then(async r => {
        const data = await r.json();
        if (r.ok) setResult({ ok: true, amount: data.amount });
        else setResult({ ok: false, error: data.error || "Erro ao processar o resgate" });
      })
      .catch(() => setResult({ ok: false, error: "Erro de ligação. Tenta novamente." }));
  }, [status, token]);

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
        {result === null ? (
          <>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <div style={{ width: 24, height: 24, border: "3px solid rgba(255,255,255,0.25)", borderTopColor: "#ffffff", borderRadius: "50%", animation: "promo-spin .8s linear infinite" }} />
            </div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>A validar o teu link...</div>
          </>
        ) : result.ok ? (
          <>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <Gift size={30} color="#22c55e" />
            </div>
            <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              Recebeste {result.amount.toLocaleString("pt-PT")} Kz!
            </div>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
              O saldo já foi adicionado à tua conta real.
            </p>
            <button onClick={() => router.push("/wallet")}
              style={{ width: "100%", background: "#ffffff", color: "#0a0f1e", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
              Ver saldo
            </button>
          </>
        ) : (
          <>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <AlertCircle size={30} color="#ef4444" />
            </div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Não foi possível resgatar</div>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>{result.error}</p>
            <button onClick={() => router.push("/trade")}
              style={{ width: "100%", background: "#1e2d50", color: "#fff", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Ir para a plataforma
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes promo-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
