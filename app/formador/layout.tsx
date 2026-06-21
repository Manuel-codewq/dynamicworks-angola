import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Área da Equipa | Dynamic Works",
  description: "Painel exclusivo para formadores, traders e equipa de marketing da Dynamic Works. Envio de relatórios diários e acompanhamento de actividades.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Área da Equipa | Dynamic Works",
    description: "Painel interno da equipa Digikap — Dynamic Works Angola.",
    siteName: "Dynamic Works",
    locale: "pt_AO",
    type: "website",
  },
};

export default function FormadorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
