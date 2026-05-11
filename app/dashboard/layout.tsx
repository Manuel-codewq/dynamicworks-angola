import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Dashboard — As Minhas Estatísticas",
  description: "Acompanha o teu desempenho, taxa de vitória, lucro líquido e histórico de operações na Dynamics Works.",
  robots:      { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
