"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Gift, Copy, Check, Users, TrendingUp,
  CheckCircle, Clock, XCircle, RefreshCw,
} from "lucide-react";
import { formatKz } from "@/lib/format";

type ReferredUser = { name: string; joinedAt: string; kycStatus: string; deposits: number };
type Data = { code: string | null; earnings: number; referred: number; referredUsers: ReferredUser[] };

const KYC_STYLE: Record<string, { label: string; color: string; Icon: any }> = {
  approved: { label: "Verificado",   color: "#22c55e", Icon: CheckCircle },
  pending:  { label: "Em análise",   color: "#f5a623", Icon: Clock       },
  rejected: { label: "Rejeitado",    color: "#ef4444", Icon: XCircle     },
  none:     { label: "Não iniciado", color: "#64748b", Icon: Clock       },
};

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReferralPage() {
  const { status } = useSession();
  const router     = useRouter();
  const [data,    setData]    = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/referral").then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, [status]);

  function copyLink() {
    if (!data?.code) return;
    const link = `${window.location.origin}/register?ref=${data.code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function copyCode() {
    if (!data?.code) return;
    navigator.clipboard.writeText(data.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const card: React.CSSProperties = { background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 22, marginBottom: 14 };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#070d1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #1e2d50", borderTopColor: "#f5a623", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const link = data?.code ? `${typeof window !== "undefined" ? window.location.origin : "https://dynamicworks.ao"}/register?ref=${data.code}` : "";

  return (
    <div style={{ minHeight: "100vh", background: "#070d1a", fontFamily: "system-ui,-apple-system,sans-serif", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, color: "#94a3b8" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ width: 34, height: 34, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Gift size={18} color="#f5a623" />
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Programa de Referidos</div>
          <div style={{ color: "#64748b", fontSize: 12 }}>Convida amigos e ganha comissões</div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>

        {/* Como funciona */}
        <div style={{ ...card, background: "linear-gradient(135deg,#111827,#0f1e38)", marginBottom: 20 }}>
          <div style={{ color: "#f5a623", fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Como funciona</div>
          {[
            { n: "1", text: "Partilha o teu link ou código único com amigos" },
            { n: "2", text: "O amigo regista-se e faz o primeiro depósito" },
            { n: "3", text: "Recebes automaticamente 2% do valor depositado no teu saldo real" },
          ].map(s => (
            <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#f5a623", color: "#0a0f1e", fontWeight: 900, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.n}</div>
              <span style={{ color: "#94a3b8", fontSize: 14 }}>{s.text}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div style={{ ...card, marginBottom: 0, textAlign: "center" }}>
            <Users size={22} color="#38bdf8" style={{ marginBottom: 6 }} />
            <div style={{ color: "#38bdf8", fontSize: 26, fontWeight: 900 }}>{data?.referred ?? 0}</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>Utilizadores convidados</div>
          </div>
          <div style={{ ...card, marginBottom: 0, textAlign: "center" }}>
            <TrendingUp size={22} color="#22c55e" style={{ marginBottom: 6 }} />
            <div style={{ color: "#22c55e", fontSize: 22, fontWeight: 900 }}>{formatKz(Math.floor(data?.earnings ?? 0))}</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>Total ganho em comissões</div>
          </div>
        </div>

        {/* Código */}
        <div style={card}>
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>O teu código</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 10, padding: "14px 18px", textAlign: "center" }}>
              <span style={{ color: "#f5a623", fontSize: 28, fontWeight: 900, letterSpacing: 6 }}>{data?.code ?? "—"}</span>
            </div>
            <button onClick={copyCode}
              style={{ width: 48, height: 52, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              {copied ? <Check size={18} color="#22c55e" /> : <Copy size={18} color="#f5a623" />}
            </button>
          </div>

          <div style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>Ou partilha este link directamente:</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 8, padding: "10px 12px", color: "#64748b", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {link}
            </div>
            <button onClick={copyLink}
              style={{ background: "#f5a623", color: "#0a0f1e", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
            </button>
          </div>
        </div>

        {/* Lista de convidados */}
        {(data?.referredUsers?.length ?? 0) > 0 && (
          <div style={card}>
            <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>Utilizadores convidados</div>
            {data!.referredUsers.map((u, i) => {
              const kyc = KYC_STYLE[u.kycStatus] ?? KYC_STYLE.none;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < data!.referredUsers.length - 1 ? "1px solid rgba(30,45,80,0.4)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#1e2d50", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#f5a623", fontSize: 14 }}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                      <div style={{ color: "#475569", fontSize: 11 }}>Registado em {formatDate(u.joinedAt)}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: kyc.color, fontSize: 11, fontWeight: 700 }}>
                      <kyc.Icon size={11} /> {kyc.label}
                    </span>
                    <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>{u.deposits} depósito{u.deposits !== 1 ? "s" : ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(data?.referred ?? 0) === 0 && (
          <div style={{ textAlign: "center", color: "#475569", padding: "32px 0" }}>
            <Gift size={40} color="#1e2d50" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14 }}>Ainda não convidaste ninguém.</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Partilha o teu código e começa a ganhar!</div>
          </div>
        )}
      </div>
    </div>
  );
}
