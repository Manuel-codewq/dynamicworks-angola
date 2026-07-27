"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle, ChevronRight, X, Mail, User, Wallet, TrendingUp, ArrowRight } from "lucide-react";
import { useTwoFactorBanner } from "@/lib/useTwoFactorBanner";

const ALLOWED_PATHS = ["/dashboard"];
const STORAGE_KEY  = "dw_onboarding_dismissed";

const STEPS = [
  { key: "emailVerified",   label: "Email",     fullLabel: "Verificar email",   icon: Mail,       href: "/verify-email", desc: "Confirma o teu endereço de email"  },
  { key: "profileComplete", label: "Perfil",    fullLabel: "Completar perfil",  icon: User,       href: "/profile",      desc: "Completa os teus dados pessoais"   },
  { key: "depositMade",     label: "Depósito",  fullLabel: "Primeiro depósito", icon: Wallet,     href: "/wallet",       desc: "Deposita Kz para começar a operar" },
  { key: "tradeMade",       label: "Operação",  fullLabel: "Primeira operação", icon: TrendingUp, href: "/trade",        desc: "Faz o teu primeiro trade real"     },
];

export default function OnboardingBar() {
  const { status } = useSession();
  const pathname   = usePathname();
  const router     = useRouter();
  const { heightPx: twoFactorBannerHeight } = useTwoFactorBanner();
  const [data,      setData]      = useState<{ steps: Record<string, boolean>; completed: number; total: number } | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [visible,   setVisible]   = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || dismissed) return;
    fetch("/api/onboarding").then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setData(d); setTimeout(() => setVisible(true), 80); }
    });
  }, [status, dismissed]);

  if (status !== "authenticated") return null;
  if (!ALLOWED_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) return null;
  if (dismissed) return null;
  if (!data) return null;
  if (data.completed === data.total) return null;

  const nextStep = STEPS.find(s => !data.steps[s.key]);
  const NextIcon = nextStep?.icon ?? TrendingUp;

  function dismiss() {
    setVisible(false);
    setTimeout(() => { localStorage.setItem(STORAGE_KEY, "1"); setDismissed(true); }, 350);
  }

  return (
    <>
      <style>{`
        @keyframes ob-slide { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }
        .ob-cta:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .ob-cta { transition: all 0.18s ease; }
      `}</style>

      <div style={{
        background: "linear-gradient(135deg, #0a0f1e 0%, #0d1526 100%)",
        borderBottom: "1px solid #1a2540",
        position: "sticky", top: twoFactorBannerHeight, zIndex: 50,
        opacity: visible ? 1 : 0,
        maxHeight: visible ? "160px" : "0px",
        overflow: "hidden",
        transition: "opacity 0.35s ease, max-height 0.4s ease",
        animation: visible ? "ob-slide 0.35s ease both" : "none",
      }}>
        {/* Linha de progresso animada */}
        <div style={{ height: 2, background: "#111827" }}>
          <div style={{
            height: "100%",
            width: `${Math.round((data.completed / data.total) * 100)}%`,
            background: "linear-gradient(90deg, #ffffff, #fb923c)",
            transition: "width 0.6s ease",
            borderRadius: "0 2px 2px 0",
          }} />
        </div>

        <div style={{ padding: "10px 16px 12px" }}>
          {/* Linha superior: stepper + fechar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            {/* Stepper */}
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              {STEPS.map((step, i) => {
                const done   = data.steps[step.key];
                const active = !done && nextStep?.key === step.key;
                const isLast = i === STEPS.length - 1;
                return (
                  <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
                    {/* Dot */}
                    <div style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    }}>
                      <div style={{
                        width: active ? 28 : 22, height: active ? 28 : 22,
                        borderRadius: "50%",
                        background: done   ? "#22c55e"
                                  : active ? "linear-gradient(135deg,#ffffff,#cbd5e1)"
                                           : "#141c2e",
                        border: `2px solid ${done ? "#22c55e" : active ? "#ffffff" : "#1e2d50"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.3s ease",
                        flexShrink: 0,
                        boxShadow: active ? "0 0 12px rgba(255,255,255,0.4)" : "none",
                      }}>
                        {done
                          ? <CheckCircle size={13} color="#fff" />
                          : <span style={{ fontSize: active ? 11 : 10, fontWeight: 800, color: active ? "#0a0f1e" : "#334155" }}>{i + 1}</span>
                        }
                      </div>
                      <span style={{
                        fontSize: 9, fontWeight: active ? 800 : 600,
                        color: done ? "#22c55e" : active ? "#ffffff" : "#334155",
                        whiteSpace: "nowrap",
                      }}>{step.label}</span>
                    </div>
                    {/* Connector */}
                    {!isLast && (
                      <div style={{
                        width: 32, height: 2, margin: "0 4px",
                        marginBottom: 16,
                        background: done ? "#22c55e" : "#1e2d50",
                        transition: "background 0.4s ease",
                        flexShrink: 0,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Fechar */}
            <button onClick={dismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "#334155", padding: 4, flexShrink: 0, marginBottom: 14 }}>
              <X size={15} />
            </button>
          </div>

          {/* CTA do próximo passo */}
          {nextStep && (
            <button
              className="ob-cta"
              onClick={() => router.push(nextStep.href)}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 10, padding: "8px 12px",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <NextIcon size={15} color="#ffffff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#ffffff", marginBottom: 1 }}>
                  {nextStep.fullLabel}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {nextStep.desc}
                </div>
              </div>
              <ArrowRight size={14} color="#ffffff" style={{ flexShrink: 0 }} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
