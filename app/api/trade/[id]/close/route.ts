import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveExpiredTrade } from "@/lib/resolveExpiredTrade";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  const trade = await prisma.trade.findUnique({
    where:   { id },
    include: { user: { select: { id: true, isDemo: true } } },
  });

  if (!trade || trade.userId !== session.user.id) {
    return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  }

  // Já foi resolvida (race com o worker) — devolver o resultado existente
  if (trade.status !== "active") {
    return NextResponse.json({ result: trade.result, trade });
  }

  const outcome = await resolveExpiredTrade(trade);

  if (outcome === "pending") {
    return NextResponse.json({ error: "A operação ainda não expirou" }, { status: 400 });
  }

  const updated = await prisma.trade.findUnique({ where: { id } });
  return NextResponse.json({ result: outcome === "already_closed" ? updated?.result : outcome, trade: updated });
}
