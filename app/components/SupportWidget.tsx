"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { MessageCircle, X, HeadphonesIcon } from "lucide-react";

// Substitui pelo número WhatsApp da corretora (formato internacional sem +)
const WA_NUMBER = "244921825299";
const WA_MSG    = encodeURIComponent("Olá! Preciso de ajuda com a minha conta na Dynamics Works.");

// Páginas onde o widget NÃO aparece (login, registo, kyc, suporte)
const HIDDEN_PATHS = ["/login", "/register", "/kyc", "/support", "/verify-email", "/terms", "/maintenance"];

export default function SupportWidget() {
  const { status }  = useSession();
  const router      = useRouter();
  const pathname    = usePathname();
  const [open, setOpen] = useState(false);

  // Só mostra para utilizadores autenticados e fora das páginas excluídas
  if (status !== "authenticated") return null;
  if (HIDDEN_PATHS.some(p => pathname.startsWith(p))) return null;

  return (
    <div style={{ position: "fixed", bottom: 24, right: 20, zIndex: 999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>

      {/* Menu expandido */}
      {open && (
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 16, padding: "6px", display: "flex", flexDirection: "column", gap: 4, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", animation: "fadeUp .2s ease" }}>
          <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

          {/* Suporte interno */}
          <button
            onClick={() => { setOpen(false); router.push("/support"); }}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 12, padding: "11px 16px", cursor: "pointer", color: "#fff", whiteSpace: "nowrap" }}>
            <div style={{ width: 32, height: 32, background: "#f5a623", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <HeadphonesIcon size={16} color="#0a0f1e" />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>Suporte</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Abrir ticket de suporte</div>
            </div>
          </button>

          {/* WhatsApp */}
          <a
            href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG}`}
            target="_blank" rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: 12, padding: "11px 16px", textDecoration: "none", whiteSpace: "nowrap" }}>
            <div style={{ width: 32, height: 32, background: "#25D366", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>WhatsApp</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Resposta rápida</div>
            </div>
          </a>
        </div>
      )}

      {/* Botão principal */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: 52, height: 52, borderRadius: "50%",
          background: open ? "#1e2d50" : "linear-gradient(135deg,#f5a623,#e8940f)",
          border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(245,166,35,0.4)",
          transition: "all .2s",
        }}>
        {open
          ? <X size={22} color="#94a3b8" />
          : <MessageCircle size={24} color="#0a0f1e" strokeWidth={2.5} />
        }
      </button>
    </div>
  );
}
