import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveExpiredTrade } from "@/lib/resolveExpiredTrade";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  const trade = await prisma.trade.findUnique({
    where:   { id },
    select:  {
      id: true, userId: true, asset: true, symbol: true, direction: true, amount: true,
      entryPrice: true, payout: true, expirySecs: true, expiresAt: true,
      status: true, isDemo: true, tournamentParticipantId: true, result: true, createdAt: true,
      user: { select: { id: true, isDemo: true, email: true, name: true } },
    },
  });

  if (!trade || trade.userId !== session.user.id) {
    return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  }

  if (trade.status !== "active") {
    return NextResponse.json({ result: trade.result, trade });
  }

  // O preço de fecho é determinado exclusivamente pelo servidor (DB/Deriv WS).
  // O valor enviado pelo browser é ignorado — confiar nele permitiria forjar o
  // resultado da operação.
  const outcome = await resolveExpiredTrade(trade);

  if (outcome === "pending") {
    return NextResponse.json({ error: "A operação ainda não expirou" }, { status: 400 });
  }

  const updated = await prisma.trade.findUnique({ where: { id } });
  return NextResponse.json({ result: outcome === "already_closed" ? updated?.result : outcome, trade: updated });
}
