import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const [traderProfile, follows] = await Promise.all([
    prisma.copyTrader.findUnique({ where: { userId: session.user.id } }),
    prisma.copyFollow.findMany({
      where: { followerId: session.user.id, active: true },
      include: {
        trader: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
      },
    }),
  ]);

  return NextResponse.json({ traderProfile, follows });
}
