"use client";
import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, CheckCircle, Zap, HelpCircle } from "lucide-react";

export interface GuideStep {
  icon:        React.ReactNode;
  iconColor:   string;
  title:       string;
  description: string;
  tip?:        string;
}

interface Props {
  storageKey: string;
  steps:      GuideStep[];
  autoDelay?: number; // ms antes de aparecer automaticamente (0 = não aparece auto)
}

export default function PageGuide({ storageKey, steps, autoDelay = 800 }: Props) {
  const [visible, setVisible] = useState(false);
  const [step,    setStep]    = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (autoDelay > 0 && !localStorage.getItem(storageKey)) {
      const t = setTimeout(() => setVisible(true), autoDelay);
      return () => clearTimeout(t);
    }
  }, [storageKey, autoDelay]);

  function finish() {
    localStorage.setItem(storageKey, "1");
    setVisible(false);
    setStep(0);
  }

  function open() { setStep(0); setVisible(true); }

  if (!mounted) return null;

  const s      = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <>
      {/* Botão flutuante de ajuda */}
      <button
        onClick={open}
        title="Ajuda desta página"
        style={{
          position: "fixed", bottom: 80, right: 16, zIndex: 500,
          width: 42, height: 42, borderRadius: "50%",
          background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", backdropFilter: "blur(4px)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}
      >
        <HelpCircle size={20} color="#f5a623" />
      </button>

      {/* Modal */}
      {visible && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 20, width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.7)", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ background: "#0a0f1e", borderBottom: "1px solid #1e2d50", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#f5a623,#e8940f)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <HelpCircle size={13} color="#0a0f1e" />
                </div>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>Guia da página</span>
              </div>
              <button onClick={finish} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={18} />
              </button>
            </div>

            {/* Progress dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 5, padding: "12px 20px 0" }}>
              {steps.map((_, i) => (
                <div key={i} onClick={() => setStep(i)}
                  style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, background: i <= step ? "#f5a623" : "#1e2d50", transition: "all 0.3s", cursor: "pointer" }} />
              ))}
            </div>

            {/* Content */}
            <div style={{ padding: "18px 22px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${s.iconColor}18`, border: `1px solid ${s.iconColor}35`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  {s.icon}
                </div>
                <h2 style={{ color: "#fff", fontWeight: 800, fontSize: 16, margin: "0 0 8px" }}>{s.title}</h2>
                <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.65, margin: 0 }}>{s.description}</p>
              </div>

              {s.tip && (
                <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 10, padding: "9px 13px", display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <Zap size={13} color="#f5a623" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ color: "#f5a623", fontSize: 12, lineHeight: 1.5 }}>{s.tip}</span>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div style={{ padding: "0 22px 16px", display: "flex", gap: 8 }}>
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 0", background: "#1e2d50", border: "none", borderRadius: 10, color: "#94a3b8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  <ChevronLeft size={15} /> Anterior
                </button>
              )}
              <button onClick={() => isLast ? finish() : setStep(s => s + 1)}
                style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 0", background: isLast ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#f5a623,#e8940f)", border: "none", borderRadius: 10, color: "#0a0f1e", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                {isLast ? <><CheckCircle size={15} /> Entendido!</> : <>Próximo <ChevronRight size={15} /></>}
              </button>
            </div>

            <div style={{ textAlign: "center", paddingBottom: 14 }}>
              <button onClick={finish} style={{ background: "none", border: "none", color: "#334155", fontSize: 11, cursor: "pointer" }}>
                Fechar guia
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
