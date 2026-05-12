import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Utilizadores que enviaram heartbeat nos últimos 5 minutos = online agora
const ONLINE_WINDOW_MS = 5 * 60_000;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);

  const users = await prisma.user.findMany({
    where: {
      lastSeenAt: { gte: cutoff },
      status:     "active",
    },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true, name: true, email: true, phone: true,
      province: true, balance: true, kycStatus: true,
      lastSeenAt: true, isDemo: true,
      _count: { select: { trades: true } },
    },
  });

  return NextResponse.json({ users, total: users.length });
}
