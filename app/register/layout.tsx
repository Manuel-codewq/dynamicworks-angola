import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Criar Conta Grátis",
  description: "Regista-te na Dynamics Works e recebe 10.000 Kz virtual para começar a negociar Forex, Cripto e Ouro em Angola sem risco.",
  alternates:  { canonical: "https://dynamicworks.ao/register" },
  openGraph: {
    title:       "Criar Conta Grátis — Dynamics Works",
    description: "Regista-te e recebe 10.000 Kz virtual. A corretora angolana de opções binárias.",
    url:         "https://dynamicworks.ao/register",
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
