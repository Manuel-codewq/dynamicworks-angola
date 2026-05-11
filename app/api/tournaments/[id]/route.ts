import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      _count: { select: { participants: true } },
      participants: {
        orderBy: { profit: "desc" },
        take: 50,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!tournament) return NextResponse.json({ error: "Torneio não encontrado" }, { status: 404 });
  return NextResponse.json(tournament);
}

// ── Join tournament ────────────────────────────────────────────────────────────
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) return NextResponse.json({ error: "Torneio não encontrado" }, { status: 404 });
  if (tournament.status === "finished") return NextResponse.json({ error: "Torneio já terminou" }, { status: 400 });

  if (tournament.maxParticipants) {
    const count = await prisma.tournamentParticipant.count({ where: { tournamentId: id } });
    if (count >= tournament.maxParticipants) return NextResponse.json({ error: "Torneio sem vagas disponíveis" }, { status: 400 });
  }

  const existing = await prisma.tournamentParticipant.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId: session.user.id } },
  });
  if (existing) return NextResponse.json({ error: "Já participas neste torneio" }, { status: 400 });

  // Paid tournament: debit entry fee + create transaction record
  if (!tournament.isFree && tournament.entryFee > 0) {
    const deducted = await prisma.user.updateMany({
      where: { id: session.user.id, balance: { gte: tournament.entryFee } },
      data:  { balance: { decrement: tournament.entryFee } },
    });
    if (deducted.count === 0) {
      return NextResponse.json({ error: `Saldo insuficiente. É necessário ${tournament.entryFee.toLocaleString("pt-AO")} Kz para participar.`, insufficientFunds: true }, { status: 400 });
    }
    // Register the payment as a transaction
    await prisma.transaction.create({
      data: {
        userId:    session.user.id,
        type:      "tournament_entry",
        amount:    tournament.entryFee,
        status:    "completed",
        method:    "Saldo real",
        reference: `Inscrição — ${tournament.name}`,
      },
    });
  }

  const participant = await prisma.tournamentParticipant.create({
    data: { tournamentId: id, userId: session.user.id },
  });

  return NextResponse.json(participant, { status: 201 });
}

// ── Admin: update tournament (with auto prize distribution on finish) ──────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if ((session.user as any).role !== "admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, description, rules, startDate, endDate, prizePool, prizes, status,
          isFree, entryFee, maxParticipants, bannerColor } = body;

  // Fetch current tournament to check if we're transitioning to "finished"
  const current = await prisma.tournament.findUnique({
    where: { id },
    include: {
      participants: {
        orderBy: { profit: "desc" },
      },
    },
  });
  if (!current) return NextResponse.json({ error: "Torneio não encontrado" }, { status: 404 });

  const tournament = await prisma.tournament.update({
    where: { id },
    data: {
      ...(name            && { name: String(name).slice(0, 100) }),
      ...(description     !== undefined && { description: description ? String(description).slice(0, 1000) : null }),
      ...(rules           !== undefined && { rules: rules ? String(rules).slice(0, 2000) : null }),
      ...(startDate       && { startDate: new Date(startDate) }),
      ...(endDate         && { endDate: new Date(endDate) }),
      ...(prizePool       !== undefined && { prizePool: Number(prizePool) }),
      ...(prizes          !== undefined && { prizes }),
      ...(status          && { status }),
      ...(isFree          !== undefined && { isFree }),
      ...(entryFee        !== undefined && { entryFee: Number(entryFee) }),
      ...(maxParticipants !== undefined && { maxParticipants: maxParticipants ? Number(maxParticipants) : null }),
      ...(bannerColor     && { bannerColor }),
    },
  });

  // ── Auto-distribute prizes when tournament finishes ────────────────────────
  if (status === "finished" && current.status !== "finished") {
    const prizeList: any[] = Array.isArray(prizes ?? current.prizes)
      ? (prizes ?? current.prizes) : [];

    const participants = current.participants; // already ordered by profit desc

    for (let i = 0; i < prizeList.length; i++) {
      const winner = participants[i];
      if (!winner) break;

      const prizeAmount = Number(prizeList[i].amount);
      if (!prizeAmount || prizeAmount <= 0) continue;

      const position = i + 1;
      const posLabel = position === 1 ? "Campeão" : position === 2 ? "Vice-Campeão" : `${position}º Classificado`;

      try {
        // Credit winner's real balance
        await prisma.user.update({
          where: { id: winner.userId },
          data:  { balance: { increment: prizeAmount } },
        });

        // Transaction record for the prize
        await prisma.transaction.create({
          data: {
            userId:    winner.userId,
            type:      "tournament_prize",
            amount:    prizeAmount,
            status:    "completed",
            method:    "Torneio",
            reference: `${position}º lugar (${posLabel}) — ${tournament.name}`,
          },
        });

        // Notification to the winner
        await prisma.notification.create({
          data: {
            userId:  winner.userId,
            type:    "info",
            title:   `🏆 Prémio recebido — ${position}º lugar!`,
            message: `Parabéns! Ficaste em ${position}º lugar no torneio "${tournament.name}" e recebeste ${prizeAmount.toLocaleString("pt-AO")} Kz no teu saldo real.`,
          },
        });
      } catch (err) {
        console.error(`[tournaments/prize] position ${position} userId ${winner.userId}`, err);
      }
    }
  }

  return NextResponse.json(tournament);
}

// ── Admin: delete tournament ───────────────────────────────────────────────────
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if ((session.user as any).role !== "admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  await prisma.tournament.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
