import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { claimPromo } from "@/lib/promoClaim";
import { checkRateLimit } from "@/lib/rateLimit";

// Estado da promoção da conta autenticada — usado por /promo (link genérico,
// sem token na URL) para decidir o que mostrar antes do utilizador clicar.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessão necessária" }, { status: 401 });
  }

  const claim = await prisma.promoClaim.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!claim) {
    return NextResponse.json({ state: "none" });
  }

  if (claim.status === "claimed") {
    return NextResponse.json({ state: "claimed", amount: claim.amount, claimedAt: claim.claimedAt });
  }

  if (claim.status === "expired" || claim.expiresAt < new Date()) {
    if (claim.status !== "expired") {
      await prisma.promoClaim.update({ where: { id: claim.id }, data: { status: "expired" } }).catch(() => {});
    }
    return NextResponse.json({ state: "expired" });
  }

  return NextResponse.json({ state: "available", amount: claim.amount, expiresAt: claim.expiresAt });
}

// Resgate pela conta autenticada — encontra o PromoClaim pendente pelo
// userId da sessão, em vez de por token na URL.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessão necessária" }, { status: 401 });
  }

  // O resgate credita saldo e passa por claimPromo() (transacção + escritas);
  // martelar em paralelo é a forma óbvia de tentar resgatar duas vezes.
  if (!await checkRateLimit("promo-claim", session.user.id, 10, 60 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas tentativas. Aguarda um pouco." }, { status: 429 });
  }

  const claim = await prisma.promoClaim.findFirst({
    where: { userId: session.user.id, status: "pending" },
  });

  if (!claim) {
    return NextResponse.json({ error: "Não tens nenhuma promoção disponível" }, { status: 404 });
  }

  if (claim.expiresAt < new Date()) {
    await prisma.promoClaim.update({ where: { id: claim.id }, data: { status: "expired" } }).catch(() => {});
    return NextResponse.json({ error: "Esta promoção expirou" }, { status: 410 });
  }

  try {
    await claimPromo(claim);
  } catch (err: any) {
    if (err.message === "ALREADY_CLAIMED") {
      return NextResponse.json({ error: "Já resgataste esta promoção" }, { status: 409 });
    }
    console.error("[promo/claim] erro ao processar resgate:", err);
    return NextResponse.json({ error: "Erro interno ao processar o resgate" }, { status: 500 });
  }

  return NextResponse.json({ amount: claim.amount });
}
