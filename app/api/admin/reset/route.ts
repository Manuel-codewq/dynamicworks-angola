import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CONFIRM_PHRASE = "RESET_SERVIDOR";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  let body: { confirm?: string };
  try { body = await req.json(); } catch { body = {}; }

  if (body.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json({ error: "Frase de confirmação incorreta" }, { status: 400 });
  }

  // Preservar todos os admins
  const admins = await prisma.user.findMany({
    where:  { role: "admin" },
    select: { id: true, name: true, email: true },
  });
  const adminIds = admins.map(a => a.id);

  // Apagar pela ordem certa (filhos antes dos pais) para evitar violações FK
  // ─── Tabelas dependentes de outras ───────────────────────────────────────
  await prisma.supportMessage.deleteMany({});
  await prisma.copyFollow.deleteMany({});
  await prisma.promoRedemption.deleteMany({});
  await prisma.tournamentParticipant.deleteMany({});

  // ─── Tabelas pai que dependem de User ────────────────────────────────────
  await prisma.supportTicket.deleteMany({ where: { userId: { notIn: adminIds } } });
  await prisma.tournament.deleteMany({});
  await prisma.copyTrader.deleteMany({ where: { userId: { notIn: adminIds } } });
  await prisma.priceAlert.deleteMany({ where: { userId: { notIn: adminIds } } });
  await prisma.kycSubmission.deleteMany({ where: { userId: { notIn: adminIds } } });
  await prisma.trade.deleteMany({ where: { userId: { notIn: adminIds } } });
  await prisma.transaction.deleteMany({ where: { userId: { notIn: adminIds } } });
  await prisma.notification.deleteMany({ where: { userId: { notIn: adminIds } } });
  await prisma.pushSubscription.deleteMany({ where: { userId: { notIn: adminIds } } });
  await prisma.userSession.deleteMany({ where: { userId: { notIn: adminIds } } });
  await prisma.accessLog.deleteMany({});

  // ─── Utilizadores (exceto admins) ────────────────────────────────────────
  const { count: usersDeleted } = await prisma.user.deleteMany({
    where: { id: { notIn: adminIds } },
  });

  // ─── Tabelas globais (sem ligação a utilizadores) ─────────────────────────
  await prisma.rateLimit.deleteMany({});

  // Registar o reset na auditoria (depois de limpar auditLogs antigos)
  await prisma.auditLog.deleteMany({});
  await prisma.auditLog.create({
    data: {
      adminId:   session.user.id,
      adminName: session.user.name ?? "Admin",
      action:    "SERVER_RESET",
      target:    "all",
      detail:    `Reset completo do servidor. ${usersDeleted} utilizador(es) apagado(s). ${adminIds.length} admin(s) preservado(s): ${admins.map(a => a.email).join(", ")}.`,
    },
  });

  return NextResponse.json({
    ok:           true,
    usersDeleted,
    adminsKept:   adminIds.length,
    message:      `Servidor reiniciado. ${usersDeleted} utilizador(es) removido(s). Admins preservados.`,
  });
}
