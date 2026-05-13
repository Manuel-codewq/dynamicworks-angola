import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { getSettings } from "@/lib/settings";
import { aoaToUsdt, usdtToAoa } from "@/lib/usdt";

const USDT_WITHDRAW_METHOD = "usdt_trc20";

// Endereço TRC-20: começa por "T", base58, 34 chars
function isValidTronAddress(addr: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!(await checkRateLimit("usdt-withdraw", session.user.id, 3, 10 * 60_000))) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Aguarda alguns minutos." },
      { status: 429 }
    );
  }

  const { amount, address, otp } = await req.json();
  const amountAoa = Number(amount);
  if (!Number.isFinite(amountAoa) || amountAoa < 5000) {
    return NextResponse.json({ error: "Valor mínimo: 5.000 Kz" }, { status: 400 });
  }
  if (amountAoa > 5_000_000) {
    return NextResponse.json({ error: "Valor máximo por levantamento: 5.000.000 Kz" }, { status: 400 });
  }
  if (typeof address !== "string" || !isValidTronAddress(address.trim())) {
    return NextResponse.json({ error: "Endereço TRC-20 inválido." }, { status: 400 });
  }
  if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp.trim())) {
    return NextResponse.json({ error: "Código OTP inválido" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  if (user.kycStatus !== "approved") {
    return NextResponse.json(
      { error: "Verificação KYC obrigatória para levantamentos.", kycRequired: true },
      { status: 403 }
    );
  }
  if (user.balance < amountAoa) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  if (
    !user.otpCode ||
    user.otpCode !== otp.trim() ||
    !user.otpExpires ||
    user.otpExpires < new Date()
  ) {
    return NextResponse.json({ error: "Código OTP inválido ou expirado" }, { status: 400 });
  }

  const cfg = await getSettings();
  if (cfg.usdtRateAoa <= 0) {
    return NextResponse.json(
      { error: "Levantamentos USDT temporariamente indisponíveis." },
      { status: 503 }
    );
  }

  const usdtAmount = Math.round(aoaToUsdt(amountAoa, cfg.usdtRateAoa) * 10000) / 10000;
  if (usdtAmount < cfg.usdtMinDeposit) {
    const minAoa = Math.ceil(usdtToAoa(cfg.usdtMinDeposit, cfg.usdtRateAoa));
    return NextResponse.json(
      { error: `Valor mínimo para USDT: ${minAoa.toLocaleString("pt-PT")} Kz.` },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { otpCode: null, otpExpires: null },
  });

  const tx = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: "withdrawal",
      amount: amountAoa,
      method: USDT_WITHDRAW_METHOD,
      status: "pending",
      reference: address.trim(),
      usdtAmount,
      usdtAddress: address.trim(),
      usdtRate: cfg.usdtRateAoa,
    },
  });

  return NextResponse.json(tx, { status: 201 });
}
