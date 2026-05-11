import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Carteira — Depósitos e Levantamentos",
  description: "Gere o teu saldo, faz depósitos via Multicaixa Express e solicita levantamentos em Kwanza na Dynamics Works.",
  robots:      { index: false, follow: false },
};

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return children;
}
