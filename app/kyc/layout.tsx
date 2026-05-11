import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title:       "Verificação KYC",
  description: "Completa a verificação de identidade (KYC) para desbloquear depósitos e levantamentos na Dynamics Works.",
  robots:      { index: false, follow: false },
};

export default async function KycLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Middleware já garante autenticação, mas por segurança extra:
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { kycStatus: true, kycAttempts: true },
  });

  if (!user) redirect("/login");

  // KYC aprovado — não há nada a fazer
  if (user.kycStatus === "approved") {
    redirect("/profile?kyc=done");
  }

  // Já submeteu pelo menos uma vez e está em análise — não pode resubmeter
  if (user.kycStatus === "pending" && user.kycAttempts > 0) {
    redirect("/profile?kyc=pending");
  }

  return <>{children}</>;
}
