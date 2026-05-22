import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) return NextResponse.json({ error: "Torneio não encontrado" }, { status: 404 });

  await prisma.tournamentParticipant.updateMany({
    where: { tournamentId: id },
    data:  { tournamentBalance: tournament.startingBalance },
  });

  return NextResponse.json({ ok: true, resetTo: tournament.startingBalance });
}
