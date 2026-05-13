import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { getSettings } from "@/lib/settings";
import {
  generateUniqueUsdtAmount,
  aoaToUsdt,
  usdtToAoa,
  USDT_DEPOSIT_METHOD,
  DEPOSIT_MATCH_WINDOW_MS,
} from "@/lib/usdt";

// Cria um depósito USDT TRC-20 pendente.
// Retorna o endereço da carteira, o montante exato a enviar e a taxa usada.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!(await checkRateLimit("usdt-deposit", session.user.id, 5, 10 * 60_000))) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Aguarda alguns minutos." },
      { status: 429 }
    );
  }

  const { amount } = await req.json();
  const amountAoa = Number(amount);
  if (!Number.isFinite(amountAoa) || amountAoa < 1000) {
    return NextResponse.json({ error: "Valor mínimo: 1.000 Kz" }, { status: 400 });
  }
  if (amountAoa > 5_000_000) {
    return NextResponse.json({ error: "Valor máximo por depósito: 5.000.000 Kz" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { kycStatus: true },
  });
  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  if (user.kycStatus !== "approved") {
    return NextResponse.json(
      {
        error: "Para depositar via USDT precisas de ter o KYC aprovado.",
        kycRequired: true,
      },
      { status: 403 }
    );
  }

  const cfg = await getSettings();
  if (!cfg.usdtWallet || cfg.usdtRateAoa <= 0) {
    return NextResponse.json(
      { error: "Depósitos USDT temporariamente indisponíveis. Tenta mais tarde." },
      { status: 503 }
    );
  }

  const baseUsdt = aoaToUsdt(amountAoa, cfg.usdtRateAoa);
  if (baseUsdt < cfg.usdtMinDeposit) {
    const minAoa = Math.ceil(usdtToAoa(cfg.usdtMinDeposit, cfg.usdtRateAoa));
    return NextResponse.json(
      { error: `Valor mínimo para USDT: ${minAoa.toLocaleString("pt-PT")} Kz (${cfg.usdtMinDeposit} USDT).` },
      { status: 400 }
    );
  }

  // Garante unicidade do usdtAmount dentro da janela ativa.
  let usdtAmount = generateUniqueUsdtAmount(baseUsdt);
  for (let tries = 0; tries < 5; tries++) {
    const conflict = await prisma.transaction.findFirst({
      where: {
        method: USDT_DEPOSIT_METHOD,
        usdtAmount,
        createdAt: { gte: new Date(Date.now() - DEPOSIT_MATCH_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (!conflict) break;
    usdtAmount = generateUniqueUsdtAmount(baseUsdt);
  }

  const tx = await prisma.transaction.create({
    data: {
      userId: session.user.id,
      type: "deposit",
      amount: amountAoa,
      method: USDT_DEPOSIT_METHOD,
      status: "pending",
      usdtAmount,
      usdtAddress: cfg.usdtWallet,
      usdtRate: cfg.usdtRateAoa,
    },
    select: {
      id: true,
      amount: true,
      usdtAmount: true,
      usdtAddress: true,
      usdtRate: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      ...tx,
      expiresAt: new Date(tx.createdAt.getTime() + DEPOSIT_MATCH_WINDOW_MS).toISOString(),
    },
    { status: 201 }
  );
}
