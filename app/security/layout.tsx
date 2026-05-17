import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Segurança — Dynamics Works",
  description: "Gere a segurança da tua conta: 2FA, sessões activas e log de acessos.",
  robots: { index: false, follow: false },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
