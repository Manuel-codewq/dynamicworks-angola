import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Verificação KYC",
  description: "Completa a verificação de identidade (KYC) para desbloquear depósitos e levantamentos na Dynamics Works.",
  robots:      { index: false, follow: false },
};

export default function KycLayout({ children }: { children: React.ReactNode }) {
  return children;
}
