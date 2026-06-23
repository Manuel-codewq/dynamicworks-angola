import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true, demoBalance: true, isDemo: true },
  });

  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  // Incluir saldo do torneio se inscrito num torneio activo (demo ou real)
  let tournamentBalance: number | null = null;
  let tournamentName: string | null    = null;
  // Busca qualquer torneio activo do utilizador (independente do modo demo/real)
  const tp = await prisma.tournamentParticipant.findFirst({
    where: {
      userId: session.user.id,
      tournament: { status: "active" },
    },
    select: { tournamentBalance: true, tournamentId: true, tournament: { select: { name: true, isDemo: true, rechargeAmount: true, startingBalance: true } } },
  });
  let tournamentIsDemo:       boolean | null = null;
  let tournamentId:           string  | null = null;
  let tournamentRecharge:     number  | null = null;
  let tournamentStartBalance: number  | null = null;
  if (tp) {
    tournamentBalance       = tp.tournamentBalance;
    tournamentName          = tp.tournament.name;
    tournamentIsDemo        = tp.tournament.isDemo;
    tournamentId            = tp.tournamentId;
    tournamentRecharge      = tp.tournament.rechargeAmount;
    tournamentStartBalance  = tp.tournament.startingBalance;
  }

  return NextResponse.json({ ...user, tournamentBalance, tournamentName, tournamentIsDemo, tournamentId, tournamentRecharge, tournamentStartBalance });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { isDemo } = await req.json();

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { isDemo: Boolean(isDemo) },
    select: { balance: true, demoBalance: true, isDemo: true },
  });

  return NextResponse.json(user);
}

