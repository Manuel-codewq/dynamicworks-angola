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

// Join tournament
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) return NextResponse.json({ error: "Torneio não encontrado" }, { status: 404 });
  if (tournament.status === "finished") return NextResponse.json({ error: "Torneio já terminou" }, { status: 400 });

  const existing = await prisma.tournamentParticipant.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId: session.user.id } },
  });
  if (existing) return NextResponse.json({ error: "Já participas neste torneio" }, { status: 400 });

  const participant = await prisma.tournamentParticipant.create({
    data: { tournamentId: id, userId: session.user.id },
  });

  return NextResponse.json(participant, { status: 201 });
}

// Admin: update tournament
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if ((session.user as any).role !== "admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, description, startDate, endDate, prizePool, prizes, status } = body;

  const tournament = await prisma.tournament.update({
    where: { id },
    data: {
      ...(name        && { name: String(name).slice(0, 100) }),
      ...(description !== undefined && { description: description ? String(description).slice(0, 500) : null }),
      ...(startDate   && { startDate: new Date(startDate) }),
      ...(endDate     && { endDate: new Date(endDate) }),
      ...(prizePool   !== undefined && { prizePool: Number(prizePool) }),
      ...(prizes      !== undefined && { prizes }),
      ...(status      && { status }),
    },
  });

  return NextResponse.json(tournament);
}

// Admin: delete tournament
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if ((session.user as any).role !== "admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  await prisma.tournament.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
