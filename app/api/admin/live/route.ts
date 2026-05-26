import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const now    = Date.now();
  const trades = await prisma.trade.findMany({
    where:   { status: "active" },
    orderBy: { expiresAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });

  const enriched = trades.map(t => {
    const expiresAt     = t.expiresAt ? t.expiresAt.getTime() : t.createdAt.getTime() + t.expirySecs * 1000;
    const remainingSecs = Math.max(0, Math.floor((expiresAt - now) / 1000));
    const brokerPays    = parseFloat((t.amount * t.payout).toFixed(2)); // broker paga se user ganhar
    return { ...t, expiresAt, remainingSecs, brokerPays };
  });

  const real = enriched.filter(t => !t.isDemo);
  const demo = enriched.filter(t => t.isDemo);

  const stats = {
    total:          enriched.length,
    realCount:      real.length,
    demoCount:      demo.length,
    totalAmount:    real.reduce((s, t) => s + t.amount, 0),
    totalExposure:  real.reduce((s, t) => s + t.brokerPays, 0),
  };

  return NextResponse.json({ trades: enriched, stats, serverTime: now });
}
