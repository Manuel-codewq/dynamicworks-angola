import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const [user, depositCount, tradeCount] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { emailVerified: true, name: true, avatar: true, phone: true },
    }),
    prisma.transaction.count({
      where: { userId: session.user.id, type: "deposit", status: { in: ["approved", "completed"] } },
    }),
    prisma.trade.count({
      where: { userId: session.user.id, isDemo: false },
    }),
  ]);

  if (!user) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const steps = {
    emailVerified:   !!user.emailVerified,
    profileComplete: !!(user.name && user.name.trim().length > 1),
    depositMade:     depositCount > 0,
    tradeMade:       tradeCount > 0,
  };

  const completed = Object.values(steps).filter(Boolean).length;

  return NextResponse.json({ steps, completed, total: 4 });
}
