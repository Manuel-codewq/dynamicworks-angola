"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle, Circle, ChevronRight, X, Mail, User, Wallet, TrendingUp } from "lucide-react";

const HIDDEN_PATHS = ["/login", "/register", "/kyc", "/verify-email", "/terms", "/maintenance", "/"];
const STORAGE_KEY  = "dw_onboarding_dismissed";

const STEPS = [
  { key: "emailVerified",   label: "Verificar email",   icon: Mail,        href: "/verify-email", desc: "Confirma o teu endereço de email" },
  { key: "profileComplete", label: "Completar perfil",  icon: User,        href: "/profile",      desc: "Adiciona o teu nome completo"     },
  { key: "depositMade",     label: "Primeiro depósito", icon: Wallet,      href: "/wallet",       desc: "Deposita para começar a operar"   },
  { key: "tradeMade",       label: "Primeira operação", icon: TrendingUp,  href: "/trade",        desc: "Faz o teu primeiro trade real"    },
];

export default function OnboardingBar() {
  const { status }   = useSession();
  const pathname     = usePathname();
  const router       = useRouter();
  const [data,       setData]       = useState<{ steps: Record<string, boolean>; completed: number; total: number } | null>(null);
  const [dismissed,  setDismissed]  = useState(true);
  const [minimised,  setMinimised]  = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || dismissed) return;
    fetch("/api/onboarding").then(r => r.ok ? r.json() : null).then(d => {
      if (d) setData(d);
    });
  }, [status, dismissed]);

  if (status !== "authenticated") return null;
  if (HIDDEN_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) return null;
  if (dismissed) return null;
  if (!data) return null;
  if (data.completed === data.total) return null;

  const pct = Math.round((data.completed / data.total) * 100);
  const nextStep = STEPS.find(s => !data.steps[s.key]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  return (
    <>
      <style>{`
        @keyframes shimmer-ob { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        .ob-progress { background: linear-gradient(90deg, #f5a623 ${pct}%, #1e2d50 ${pct}%); transition: background 0.6s ease; }
      `}</style>

      <div style={{
        background: "#070d1a", borderBottom: "1px solid #1e2d50",
        padding: minimised ? "8px 16px" : "12px 16px",
        position: "sticky", top: 0, zIndex: 50,
        transition: "all .3s ease",
      }}>
        {/* Barra de progresso */}
        <div className="ob-progress" style={{ height: 3, borderRadius: 2, marginBottom: minimised ? 0 : 10, transition: "margin .3s" }} />

        {minimised ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setMinimised(false)}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              Configuração da conta — <strong style={{ color: "#f5a623" }}>{data.completed}/{data.total} passos</strong>
            </span>
            <ChevronRight size={14} color="#64748b" style={{ transform: "rotate(90deg)" }} />
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Configura a tua conta</span>
                <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>{data.completed} de {data.total} passos completos</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setMinimised(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}>
                  <ChevronRight size={16} style={{ transform: "rotate(-90deg)" }} />
                </button>
                <button onClick={dismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Passos */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              {STEPS.map((step, i) => {
                const done   = data.steps[step.key];
                const active = !done && nextStep?.key === step.key;
                const Icon   = step.icon;
                return (
                  <button
                    key={step.key}
                    onClick={() => done ? null : router.push(step.href)}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      background: done ? "rgba(34,197,94,0.08)" : active ? "rgba(245,166,35,0.1)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${done ? "rgba(34,197,94,0.25)" : active ? "rgba(245,166,35,0.3)" : "#1e2d50"}`,
                      borderRadius: 10, padding: "7px 12px", cursor: done ? "default" : "pointer",
                      flexShrink: 0, transition: "all .2s",
                      opacity: !done && !active ? 0.6 : 1,
                    }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                      background: done ? "rgba(34,197,94,0.15)" : active ? "rgba(245,166,35,0.15)" : "#1e2d50",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {done
                        ? <CheckCircle size={13} color="#22c55e" />
                        : <Icon size={13} color={active ? "#f5a623" : "#64748b"} />
                      }
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: done ? "#22c55e" : active ? "#f5a623" : "#94a3b8", whiteSpace: "nowrap" }}>
                        {i + 1}. {step.label}
                      </div>
                      {active && <div style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap" }}>{step.desc}</div>}
                    </div>
                    {active && <ChevronRight size={12} color="#f5a623" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
