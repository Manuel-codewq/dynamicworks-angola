import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, phone: true, province: true,
      balance: true, demoBalance: true, role: true, status: true,
      kycStatus: true, createdAt: true,
      _count: { select: { trades: true, transactions: true } },
    },
  });

  return NextResponse.json(users);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { userId, action, value } = await req.json();

  if (action === "block") {
    await prisma.user.update({ where: { id: userId }, data: { status: "blocked" } });
  } else if (action === "unblock") {
    await prisma.user.update({ where: { id: userId }, data: { status: "active" } });
  } else if (action === "adjustBalance") {
    await prisma.user.update({ where: { id: userId }, data: { balance: parseFloat(value) } });
  } else if (action === "setRole") {
    await prisma.user.update({ where: { id: userId }, data: { role: value } });
  }

  return NextResponse.json({ success: true });
}
