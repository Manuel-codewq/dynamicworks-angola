import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Verificar Email",
  description: "Confirma o teu endereço de email para activar a conta na Dynamics Works.",
  robots:      { index: false, follow: false },
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
