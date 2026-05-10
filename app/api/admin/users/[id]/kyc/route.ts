import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";

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

  const data: Record<string, unknown> = { kycStatus: status };
  if (status === "approved") {
    // Aprovação limpa o histórico de tentativas e desbloqueio
    data.kycAttempts = 0;
    data.kycBlockedUntil = null;
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, kycStatus: true },
  });

  if (status === "approved") {
    await createNotification(id, "kyc_approved", "KYC aprovado", "A sua identidade foi verificada com sucesso. Pode agora negociar sem restrições.");
  } else {
    await createNotification(id, "kyc_rejected", "KYC rejeitado", "A verificação de identidade foi rejeitada. Por favor, submeta novos documentos válidos. Tem mais 1 tentativa disponível.");
  }

  return NextResponse.json(updated);
}
