import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startDate: "asc" },
    include: { _count: { select: { participants: true } } },
  });
  return NextResponse.json(tournaments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if ((session.user as any).role !== "admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { name, description, startDate, endDate, prizePool, prizes } = await req.json();

  if (!name || !startDate || !endDate) {
    return NextResponse.json({ error: "Nome, data de início e data de fim são obrigatórios" }, { status: 400 });
  }
  if (new Date(startDate) >= new Date(endDate)) {
    return NextResponse.json({ error: "Data de início deve ser anterior à data de fim" }, { status: 400 });
  }

  const now = new Date();
  const status = new Date(startDate) > now ? "upcoming" : new Date(endDate) < now ? "finished" : "active";

  const tournament = await prisma.tournament.create({
    data: {
      name: String(name).slice(0, 100),
      description: description ? String(description).slice(0, 500) : null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      prizePool: Number(prizePool) || 0,
      prizes: prizes ?? [],
      status,
    },
  });

  return NextResponse.json(tournament, { status: 201 });
}
