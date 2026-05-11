import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Negociar — Plataforma de Trading",
  description: "Negocia Forex, Cripto e Commodities em tempo real na Dynamics Works. Preços ao vivo, gráficos avançados e execução instantânea em Kwanza.",
  robots:      { index: false, follow: false },
  openGraph: {
    title:       "Negociar — Dynamics Works",
    description: "Plataforma de trading de opções binárias em tempo real. Forex, BTC, XAU em Kwanza.",
  },
};

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
