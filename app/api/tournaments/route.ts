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

  const { name, description, rules, startDate, endDate, prizePool, prizes, isFree, entryFee, maxParticipants, bannerColor } = await req.json();

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
      description: description ? String(description).slice(0, 1000) : null,
      rules: rules ? String(rules).slice(0, 2000) : null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      prizePool: Number(prizePool) || 0,
      prizes: prizes ?? [],
      status,
      isFree: isFree !== false,
      entryFee: isFree !== false ? 0 : Number(entryFee) || 0,
      maxParticipants: maxParticipants ? Number(maxParticipants) : null,
      bannerColor: bannerColor ?? "#f5a623",
    },
  });

  return NextResponse.json(tournament, { status: 201 });
}
