import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const experts = await prisma.copyTrader.findMany({
    where: { status: "approved" },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { totalCopied: "desc" },
  });

  // Verificar quais o utilizador já segue
  const follows = await prisma.copyFollow.findMany({
    where: { followerId: session.user.id },
    select: { traderId: true, active: true, amount: true },
  });
  const followMap = new Map(follows.map(f => [f.traderId, f]));

  const data = experts.map(e => ({
    id: e.id,
    userId: e.userId,
    name: e.user.name,
    avatar: e.user.avatar,
    bio: e.bio,
    commission: e.commission,
    totalFollowers: e.totalFollowers,
    totalCopied: e.totalCopied,
    following: followMap.get(e.id) ?? null,
  }));

  return NextResponse.json({ experts: data });
}
