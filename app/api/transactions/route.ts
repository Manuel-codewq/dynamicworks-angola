import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkSuspiciousDeposit } from "@/lib/fraudDetection";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // 5 pedidos de transação por utilizador a cada 10 minutos — trava spam de pendentes
  if (!await checkRateLimit("transaction", session.user.id, 5, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Aguarde alguns minutos." },
      { status: 429 },
    );
  }

  const { type, amount, method, reference, otp } = await req.json();

  if (!["deposit", "withdrawal"].includes(type)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }
  const amountNum = Number(amount);
  const minAmount = type === "deposit" ? 5000 : 1000;
  if (!Number.isFinite(amountNum) || amountNum < minAmount) {
    return NextResponse.json({ error: `Valor mínimo: ${minAmount.toLocaleString("pt-PT")} Kz` }, { status: 400 });
  }
  if (amountNum > 5_000_000) {
    return NextResponse.json({ error: "Valor máximo por transação: 5.000.000 Kz" }, { status: 400 });
  }
  if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp.trim())) {
    return NextResponse.json({ error: "Código OTP inválido" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  // KYC obrigatório para levantamentos
  if (type === "withdrawal" && user.kycStatus !== "approved") {
    return NextResponse.json(
      { error: "Verificação de identidade (KYC) obrigatória para efectuar levantamentos.", kycRequired: true },
      { status: 403 }
    );
  }

  // Levantamento: validar saldo na origem para não permitir pedidos abusivos.
  // O débito atómico real acontece na aprovação admin — esta verificação evita
  // que utilizadores encham a fila com pedidos impossíveis.
  if (type === "withdrawal" && user.balance < amountNum) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  // Validar OTP no campo dedicado (otpCode) — separado do verifyCode de email
  if (
    !user.otpCode ||
    user.otpCode !== otp.trim() ||
    !user.otpExpires ||
    user.otpExpires < new Date()
  ) {
    return NextResponse.json({ error: "Código OTP inválido ou expirado" }, { status: 400 });
  }

  // Invalidar OTP imediatamente após verificação
  await prisma.user.update({
    where: { id: user.id },
    data:  { otpCode: null, otpExpires: null },
  });

  const tx = await prisma.transaction.create({
    data: {
      userId: session.user.id,
      type,
      amount: amountNum,
      method:    method ? String(method).slice(0, 100) : null,
      reference: reference ? String(reference).slice(0, 200) : null,
      status: "pending",
    },
  });

  // Detecção de fraude em depósitos (assíncrono)
  if (type === "deposit") {
    checkSuspiciousDeposit(session.user.id, amountNum).catch(() => {});
  }

  return NextResponse.json(tx, { status: 201 });
}
