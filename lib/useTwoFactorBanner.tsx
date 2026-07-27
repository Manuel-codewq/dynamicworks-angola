"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

// Altura fixa e única do banner — usada tanto para o renderizar (TwoFactorBanner)
// como para empurrar para baixo qualquer layout de página com painéis
// position:fixed ancorados a top:0 (ex: /trade). Texto é sempre uma linha
// (sem wrap) para a altura nunca variar.
export const TWO_FACTOR_BANNER_HEIGHT = 44;

const EXCLUDED_PATHS = ["/login", "/register", "/security", "/maintenance", "/verify-email"];

type Status = { enabled: boolean; deadline: string | null; daysLeft: number | null; expired: boolean };
type Ctx = { visible: boolean; heightPx: number; data: Status | null };

const TwoFactorBannerContext = createContext<Ctx>({ visible: false, heightPx: 0, data: null });

/**
 * Busca o estado do 2FA UMA ÚNICA VEZ para toda a árvore (montado no layout
 * raiz) — evita que cada consumidor (banner, espaçador, OnboardingBar,
 * /trade) faça o seu próprio fetch em paralelo e fique dessincronizado do
 * banner enquanto o seu pedido ainda não resolveu.
 */
export function TwoFactorBannerProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname    = usePathname();
  const [data, setData] = useState<Status | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetch("/api/auth/2fa-deadline").then(r => r.ok ? r.json() : null).then(d => {
      if (!cancelled && d) setData(d);
    });
    return () => { cancelled = true; };
  }, [status]);

  const excluded = EXCLUDED_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"));
  const visible =
    status === "authenticated" &&
    !excluded &&
    !!data &&
    !data.enabled &&
    !!data.deadline &&
    !data.expired;

  const value: Ctx = { visible, heightPx: visible ? TWO_FACTOR_BANNER_HEIGHT : 0, data };

  return (
    <TwoFactorBannerContext.Provider value={value}>
      {children}
    </TwoFactorBannerContext.Provider>
  );
}

/** Fonte única de verdade para "o banner de 2FA está visível nesta página". */
export function useTwoFactorBanner() {
  return useContext(TwoFactorBannerContext);
}
