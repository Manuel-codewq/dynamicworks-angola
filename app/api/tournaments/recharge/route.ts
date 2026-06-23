import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tournamentId } = await req.json();
  if (!tournamentId) return NextResponse.json({ error: "tournamentId obrigatório" }, { status: 400 });

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return NextResponse.json({ error: "Torneio não encontrado" }, { status: 404 });
  if (tournament.status !== "active") return NextResponse.json({ error: "Torneio não está activo" }, { status: 400 });
  if (!tournament.rechargeAmount || tournament.rechargeAmount <= 0)
    return NextResponse.json({ error: "Este torneio não permite recarga" }, { status: 400 });

  const participant = await prisma.tournamentParticipant.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: session.user.id } },
  });
  if (!participant) return NextResponse.json({ error: "Não estás inscrito neste torneio" }, { status: 400 });
  if (participant.tournamentBalance > 0)
    return NextResponse.json({ error: "Ainda tens saldo no torneio. A recarga só está disponível quando a banca chegar a 0." }, { status: 400 });

  // Debitar taxa de recarga do saldo real do utilizador
  const balanceField = tournament.isDemo ? "demoBalance" : "balance";
  const deducted = await prisma.user.updateMany({
    where: { id: session.user.id, [balanceField]: { gte: tournament.rechargeAmount } },
    data:  { [balanceField]: { decrement: tournament.rechargeAmount } },
  });
  if (deducted.count === 0) {
    const label = tournament.isDemo ? "saldo demo" : "saldo real";
    return NextResponse.json({
      error: `${label.charAt(0).toUpperCase() + label.slice(1)} insuficiente. São necessários ${tournament.rechargeAmount.toLocaleString("pt-PT")} Kz para recarregar.`,
      insufficientFunds: true,
    }, { status: 400 });
  }

  // Repor banca do torneio
  const updated = await prisma.tournamentParticipant.update({
    where: { tournamentId_userId: { tournamentId, userId: session.user.id } },
    data:  { tournamentBalance: tournament.startingBalance },
  });

  // Registo da transacção
  await prisma.transaction.create({
    data: {
      userId:    session.user.id,
      type:      "tournament_recharge",
      amount:    tournament.rechargeAmount,
      status:    "completed",
      method:    tournament.isDemo ? "Saldo demo" : "Saldo real",
      reference: `Recarga de banca — ${tournament.name}`,
    },
  });

  return NextResponse.json({ ok: true, tournamentBalance: updated.tournamentBalance });
}
