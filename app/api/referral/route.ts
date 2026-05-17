import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "DW-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { referralCode: true, referralEarnings: true },
  });

  // Gerar código para utilizadores existentes que ainda não têm
  if (!user?.referralCode) {
    let code: string | null = null;
    for (let i = 0; i < 5; i++) {
      const candidate = genCode();
      const exists = await prisma.user.findUnique({ where: { referralCode: candidate }, select: { id: true } });
      if (!exists) { code = candidate; break; }
    }
    if (code) {
      user = await prisma.user.update({
        where:  { id: session.user.id },
        data:   { referralCode: code },
        select: { referralCode: true, referralEarnings: true },
      });
    }
  }

  const referredUsers = await prisma.user.findMany({
    where:   { referredBy: session.user.id },
    select:  { id: true, name: true, createdAt: true, kycStatus: true,
               _count: { select: { transactions: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    code:      user?.referralCode ?? null,
    earnings:  user?.referralEarnings ?? 0,
    referred:  referredUsers.length,
    referredUsers: referredUsers.map(u => ({
      name:      u.name,
      joinedAt:  u.createdAt,
      kycStatus: u.kycStatus,
      deposits:  u._count.transactions,
    })),
  });
}
