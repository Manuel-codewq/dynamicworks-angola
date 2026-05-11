import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Ranking de Traders",
  description: "Vê o ranking dos melhores traders da Dynamics Works em Angola. Compara os teus resultados e sobe na tabela de classificação.",
  alternates:  { canonical: "https://dynamicworks.ao/ranking" },
  robots:      { index: true, follow: true },
  openGraph: {
    title:       "Ranking de Traders — Dynamics Works",
    description: "Os melhores traders da plataforma de opções binárias angolana. Vê quem está no topo.",
    url:         "https://dynamicworks.ao/ranking",
  },
};

export default function RankingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
