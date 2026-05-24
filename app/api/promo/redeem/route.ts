import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const userId = session.user.id;

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

  // Verificações de maxUses e dupla utilização dentro de uma transacção interativa
  // para eliminar a race condition (TOCTOU) entre o check e o create
  try {
    await prisma.$transaction(async (db) => {
      const fresh = await db.promoCode.findUnique({
        where:  { id: promo.id },
        select: { usedCount: true, maxUses: true },
      });
      if (!fresh || fresh.usedCount >= fresh.maxUses)
        throw Object.assign(new Error("MAXUSES"), { code: "MAXUSES" });

      const alreadyUsed = await db.promoRedemption.findFirst({
        where: { promoCodeId: promo.id, userId: userId },
      });
      if (alreadyUsed)
        throw Object.assign(new Error("ALREADY_USED"), { code: "ALREADY_USED" });

      await db.promoRedemption.create({ data: { promoCodeId: promo.id, userId: userId } });
      await db.promoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } });
      await db.user.update({ where: { id: userId }, data: { balance: { increment: promo.value } } });
    });
  } catch (err: any) {
    if (err?.code === "MAXUSES")
      return NextResponse.json({ error: "Este código já atingiu o limite de utilizações" }, { status: 409 });
    if (err?.code === "ALREADY_USED")
      return NextResponse.json({ error: "Já utilizaste este código" }, { status: 409 });
    console.error("[promo/redeem]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, value: promo.value });
}
