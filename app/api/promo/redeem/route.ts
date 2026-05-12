import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { code } = await req.json();
  if (!code?.trim()) return NextResponse.json({ error: "Código inválido" }, { status: 400 });

  const promo = await prisma.promoCode.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { _count: { select: { redemptions: true } } },
  });

  if (!promo || !promo.active)
    return NextResponse.json({ error: "Código inválido ou inativo" }, { status: 404 });

  if (promo.expiresAt && promo.expiresAt < new Date())
    return NextResponse.json({ error: "Este código já expirou" }, { status: 410 });

  if (promo._count.redemptions >= promo.maxUses)
    return NextResponse.json({ error: "Este código já atingiu o limite de utilizações" }, { status: 409 });

  const alreadyUsed = await prisma.promoRedemption.findFirst({
    where: { promoCodeId: promo.id, userId: session.user.id },
  });
  if (alreadyUsed)
    return NextResponse.json({ error: "Já utilizaste este código" }, { status: 409 });

  await prisma.$transaction([
    prisma.promoRedemption.create({
      data: { promoCodeId: promo.id, userId: session.user.id },
    }),
    prisma.promoCode.update({
      where: { id: promo.id },
      data: { usedCount: { increment: 1 } },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { balance: { increment: promo.value } },
    }),
  ]);

  return NextResponse.json({ ok: true, value: promo.value });
}
