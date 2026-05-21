import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json(null);

  const now = new Date();

  // Buscar torneios activos onde o utilizador está inscrito
  const participations = await prisma.tournamentParticipant.findMany({
    where: {
      userId,
      tournament: {
        status:  "active",
        endDate: { gte: now },
      },
    },
    include: {
      tournament: {
        select: { id: true, name: true, isDemo: true, prizePool: true, prizes: true, endDate: true },
      },
    },
  });

  if (participations.length === 0) return NextResponse.json(null);

  const results = await Promise.all(
    participations.map(async (tp) => {
      // Ranking do torneio
      const allParticipants = await prisma.tournamentParticipant.findMany({
        where: { tournamentId: tp.tournamentId },
        orderBy: { profit: "desc" },
        select: { userId: true, profit: true, trades: true, wins: true },
      });

      const position = allParticipants.findIndex(p => p.userId === userId) + 1;
      const total    = allParticipants.length;
      const me       = allParticipants.find(p => p.userId === userId);
      const prizes: any[] = Array.isArray(tp.tournament.prizes) ? tp.tournament.prizes : [];
      const myPrize  = prizes.find((p: any) => p.position === position);

      return {
        tournamentId:   tp.tournamentId,
        tournamentName: tp.tournament.name,
        isDemo:         tp.tournament.isDemo,
        position,
        total,
        profit:         me?.profit ?? 0,
        trades:         me?.trades ?? 0,
        wins:           me?.wins   ?? 0,
        prize:          myPrize?.amount ?? null,
        endDate:        tp.tournament.endDate,
      };
    })
  );

  return NextResponse.json(results);
}
