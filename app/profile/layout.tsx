import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Perfil — A Minha Conta",
  description: "Gere o teu perfil, segurança e verificação KYC na Dynamics Works.",
  robots:      { index: false, follow: false },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
