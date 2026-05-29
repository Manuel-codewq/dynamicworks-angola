import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Conquistas — Dynamic Works",
  description: "Vê as tuas conquistas e progresso na plataforma Dynamic Works Angola.",
  robots:      { index: false, follow: false },
};

export default function AchievementsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
