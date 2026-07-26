import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const claims = await prisma.promoClaim.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  const now = new Date();
  const rows = claims.map(c => ({
    id: c.id,
    userName: c.user.name,
    userEmail: c.user.email,
    amount: c.amount,
    status: c.status === "pending" && c.expiresAt < now ? "expired" : c.status,
    expiresAt: c.expiresAt,
    claimedAt: c.claimedAt,
    createdAt: c.createdAt,
  }));

  const totalPaid = rows.filter(r => r.status === "claimed").reduce((s, r) => s + r.amount, 0);
  const totalPotential = rows.reduce((s, r) => s + r.amount, 0);

  return NextResponse.json({
    rows,
    summary: {
      total: rows.length,
      claimed: rows.filter(r => r.status === "claimed").length,
      pending: rows.filter(r => r.status === "pending").length,
      expired: rows.filter(r => r.status === "expired").length,
      totalPaid,
      totalPotential,
    },
  });
}
