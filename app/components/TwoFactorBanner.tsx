"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { useTwoFactorBanner, TWO_FACTOR_BANNER_HEIGHT } from "@/lib/useTwoFactorBanner";

export default function TwoFactorBanner() {
  const router = useRouter();
  const { visible, data } = useTwoFactorBanner();
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!visible || !data) return null;

  const daysLeft = data.daysLeft ?? 0;
  const urgent   = daysLeft <= 2;
  const deadlineLabel = data.deadline
    ? new Date(data.deadline).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";
  const daysLabel = daysLeft === 0 ? "termina hoje" : daysLeft === 1 ? "falta 1 dia" : `faltam ${daysLeft} dias`;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      height: TWO_FACTOR_BANNER_HEIGHT,
      background: urgent ? "linear-gradient(135deg, #2a0f0f 0%, #1a0a0a 100%)" : "linear-gradient(135deg, #2a1f0a 0%, #1a1406 100%)",
      borderBottom: `1px solid ${urgent ? "#5c1a1a" : "#4a3a10"}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 12px", gap: 10, boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, overflow: "hidden" }}>
        <ShieldAlert size={16} color={urgent ? "#ef4444" : "#f5a623"} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: 12.5, color: "#fff", fontWeight: 600,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {narrow ? "Activa o 2FA" : `Activa a autenticação de dois factores até ${deadlineLabel}`}
          {" — "}
          <span style={{ color: urgent ? "#ef4444" : "#f5a623", fontWeight: 800 }}>{daysLabel}</span>
        </span>
      </div>

      <button
        onClick={() => router.push("/security")}
        style={{
          display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
          background: urgent ? "#ef4444" : "#f5a623",
          color: "#0a0f1e", border: "none", borderRadius: 7,
          padding: narrow ? "6px 10px" : "6px 12px", fontSize: 12.5, fontWeight: 800, cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {narrow ? "Activar" : "Activar agora"}
        {!narrow && <ArrowRight size={13} />}
      </button>
    </div>
  );
}
