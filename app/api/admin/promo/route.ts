import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
  return NextResponse.json(codes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { code, type, value, maxUses, expiresAt } = await req.json();
  if (!code?.trim() || !value || value <= 0)
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const promo = await prisma.promoCode.create({
    data: {
      code: code.trim().toUpperCase(),
      type: type ?? "balance",
      value: Number(value),
      maxUses: Number(maxUses ?? 1),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });
  await prisma.auditLog.create({
    data: { adminId: session.user.id, adminName: session.user.name ?? "Admin", action: "CREATE_PROMO", target: promo.code, detail: `Valor: ${value} Kz` },
  });
  return NextResponse.json(promo, { status: 201 });
}
