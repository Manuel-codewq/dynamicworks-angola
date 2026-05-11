import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Histórico de Operações",
  description: "Consulta todas as tuas operações passadas, resultados e estatísticas completas na Dynamics Works.",
  robots:      { index: false, follow: false },
};

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
