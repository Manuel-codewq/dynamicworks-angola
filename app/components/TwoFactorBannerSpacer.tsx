"use client";
import { usePathname } from "next/navigation";
import { useTwoFactorBanner } from "@/lib/useTwoFactorBanner";

// Páginas com layout position:fixed próprio (ex: /trade) já lêem heightPx
// directamente e deslocam os seus painéis — não precisam deste espaçador de
// flow normal, que serve as restantes páginas (layout normal em bloco).
const SELF_MANAGED = ["/trade"];

export default function TwoFactorBannerSpacer() {
  const pathname = usePathname();
  const { heightPx } = useTwoFactorBanner();

  if (SELF_MANAGED.some(p => pathname === p || pathname.startsWith(p + "/"))) return null;
  if (heightPx === 0) return null;

  return <div style={{ height: heightPx, flexShrink: 0 }} />;
}
