import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, name: true } });
  if (!target) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  if (target.role === "admin") return NextResponse.json({ error: "Não é possível eliminar um administrador" }, { status: 403 });

  // Eliminar dados relacionados manualmente antes do utilizador
  await prisma.$transaction([
    prisma.pushSubscription.deleteMany({ where: { userId: id } }),
    prisma.promoRedemption.deleteMany({ where: { userId: id } }),
    prisma.tournamentParticipant.deleteMany({ where: { userId: id } }),
    prisma.notification.deleteMany({ where: { userId: id } }),
    prisma.supportMessage.deleteMany({ where: { ticket: { userId: id } } }),
    prisma.supportTicket.deleteMany({ where: { userId: id } }),
    prisma.kycSubmission.deleteMany({ where: { userId: id } }),
    prisma.trade.deleteMany({ where: { userId: id } }),
    prisma.transaction.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  await prisma.auditLog.create({
    data: {
      adminId:   session.user.id,
      adminName: session.user.name ?? "Admin",
      action:    "DELETE_USER",
      target:    id,
      detail:    `Utilizador ${target.name} eliminado permanentemente`,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
