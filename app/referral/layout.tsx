import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Programa de Referidos — Dynamics Works",
  robots: { index: false, follow: false },
};

export default function ReferralLayout({ children }: { children: React.ReactNode }) {
  return children;
}
