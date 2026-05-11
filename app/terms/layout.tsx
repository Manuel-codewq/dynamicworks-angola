import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Termos e Condições",
  description: "Lê os Termos e Condições da Dynamics Works — plataforma de opções binárias em Angola. Regras de utilização, política de depósitos, levantamentos e responsabilidade.",
  alternates:  { canonical: "https://dynamicworks.ao/terms" },
  robots:      { index: true, follow: true },
  openGraph: {
    title:       "Termos e Condições — Dynamics Works",
    description: "Termos e Condições da plataforma de trading Dynamics Works, a corretora angolana de opções binárias.",
    url:         "https://dynamicworks.ao/terms",
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
