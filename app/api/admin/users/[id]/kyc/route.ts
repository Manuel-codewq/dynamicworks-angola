import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
import { sendKycApprovedEmail, sendKycRejectedEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await req.json();

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  // Buscar dados do utilizador
  const userInfo = await prisma.user.findUnique({
    where:  { id },
    select: { email: true, name: true, kycAttempts: true },
  });

  const data: Record<string, unknown> = { kycStatus: status };
  let attemptsLeft = 4;

  if (status === "approved") {
    data.kycAttempts    = 0;
    data.kycBlockedUntil = null;
  } else {
    const newAttempts = (userInfo?.kycAttempts ?? 0) + 1;
    data.kycAttempts  = newAttempts;
    attemptsLeft      = Math.max(0, 4 - newAttempts);
    if (newAttempts >= 4) {
      data.kycBlockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, kycStatus: true },
  });

  if (status === "approved") {
    await createNotification(id, "kyc_approved", "KYC aprovado", "A sua identidade foi verificada com sucesso. Pode agora negociar sem restrições.");
    if (userInfo) sendKycApprovedEmail(userInfo.email, userInfo.name).catch(() => {});
  } else {
    await createNotification(id, "kyc_rejected", "KYC rejeitado", `A verificação foi rejeitada. ${attemptsLeft > 0 ? `Tens ${attemptsLeft} tentativa(s) restante(s).` : "Contacta o suporte."}`);
    if (userInfo) sendKycRejectedEmail(userInfo.email, userInfo.name, attemptsLeft).catch(() => {});
  }

  return NextResponse.json(updated);
}
