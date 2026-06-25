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

  const userId         = session.user.id as string;
  const otpTrimmed     = otp.trim();
  const addressTrimmed = address.trim();

  // Tudo numa única transação atómica:
  // 1. Valida KYC e saldo
  // 2. Invalida OTP via updateMany com WHERE — previne race condition
  //    (dois requests concorrentes com o mesmo OTP: só um consegue o updateMany)
  // 3. Cria a transação de levantamento
  let tx;
  try {
    tx = await prisma.$transaction(async (dbTx) => {
      const user = await dbTx.user.findUnique({ where: { id: userId } });
      if (!user) throw Object.assign(new Error("USER_NOT_FOUND"), { code: "USER_NOT_FOUND" });

      if (user.kycStatus !== "approved") {
        throw Object.assign(new Error("KYC_REQUIRED"), { code: "KYC_REQUIRED" });
      }
      if (user.balance < amountAoa) {
        throw Object.assign(new Error("INSUFFICIENT_BALANCE"), { code: "INSUFFICIENT_BALANCE" });
      }

      // Bloquear levantamento duplicado
      const existing = await dbTx.transaction.findFirst({
        where: { userId, type: "withdrawal", status: "pending" },
        select: { id: true },
      });
      if (existing) throw Object.assign(new Error("PENDING_EXISTS"), { code: "PENDING_EXISTS" });

      // Invalidar OTP atomicamente — se dois pedidos chegarem em simultâneo,
      // só o primeiro consegue fazer este updateMany (o segundo recebe count=0)
      const invalidated = await dbTx.user.updateMany({
        where: {
          id:         userId,
          otpCode:    otpTrimmed,
          otpExpires: { gte: new Date() },
        },
        data: { otpCode: null, otpExpires: null },
      });
      if (invalidated.count === 0) {
        throw Object.assign(new Error("OTP_INVALID"), { code: "OTP_INVALID" });
      }

      return dbTx.transaction.create({
        data: {
          userId,
          type:        "withdrawal",
          amount:      amountAoa,
          method:      USDT_WITHDRAW_METHOD,
          status:      "pending",
          reference:   addressTrimmed,
          usdtAmount,
          usdtAddress: addressTrimmed,
          usdtRate:    cfg.usdtRateAoa,
        },
      });
    });
  } catch (err: any) {
    if (err?.code === "USER_NOT_FOUND")       return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
    if (err?.code === "KYC_REQUIRED")         return NextResponse.json({ error: "Verificação KYC obrigatória para levantamentos.", kycRequired: true }, { status: 403 });
    if (err?.code === "INSUFFICIENT_BALANCE") return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
    if (err?.code === "PENDING_EXISTS")       return NextResponse.json({ error: "Já tens um levantamento pendente." }, { status: 409 });
    if (err?.code === "OTP_INVALID")          return NextResponse.json({ error: "Código OTP inválido ou expirado" }, { status: 400 });
    console.error("[usdt-withdraw]", err);
    return NextResponse.json({ error: "Erro interno ao processar levantamento" }, { status: 500 });
  }

  return NextResponse.json(tx, { status: 201 });
}
