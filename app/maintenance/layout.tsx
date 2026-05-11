import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Em Manutenção",
  description: "A Dynamics Works está temporariamente em manutenção. Voltamos em breve.",
  robots:      { index: false, follow: false },
};

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
