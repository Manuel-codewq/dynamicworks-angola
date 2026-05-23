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

  const MULTICAIXA_ENTITY = "10116";
  const MULTICAIXA_REF    = "946621503";

  if (!["deposit", "withdrawal"].includes(type)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }
  const amountNum = Number(amount);
  const minAmount = type === "deposit" ? 5000 : 10000;
  if (!Number.isFinite(amountNum) || amountNum < minAmount) {
    return NextResponse.json({ error: `Valor mínimo: ${minAmount.toLocaleString("pt-PT")} Kz` }, { status: 400 });
  }
  if (amountNum > 5_000_000) {
    return NextResponse.json({ error: "Valor máximo por transação: 5.000.000 Kz" }, { status: 400 });
  }
  if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp.trim())) {
    return NextResponse.json({ error: "Código OTP inválido" }, { status: 400 });
  }

  const userId = session.user.id;

  // Validação e criação atómica — previne race condition em levantamentos concorrentes
  let tx;
  try {
    tx = await prisma.$transaction(async (dbTx) => {
      const user = await dbTx.user.findUnique({ where: { id: userId } });
      if (!user) throw Object.assign(new Error("USER_NOT_FOUND"), { code: "USER_NOT_FOUND" });

      // KYC obrigatório para depósitos e levantamentos
      if ((type === "deposit" || type === "withdrawal") && user.kycStatus !== "approved") {
        throw Object.assign(new Error("KYC_REQUIRED"), { code: "KYC_REQUIRED" });
      }

      // Validar saldo dentro da transacção — elimina TOCTOU
      if (type === "withdrawal" && user.balance < amountNum) {
        throw Object.assign(new Error("INSUFFICIENT_BALANCE"), { code: "INSUFFICIENT_BALANCE" });
      }

      // Bloquear levantamento duplicado: só 1 pedido pendente por utilizador de cada vez
      if (type === "withdrawal") {
        const existing = await dbTx.transaction.findFirst({
          where: { userId: userId, type: "withdrawal", status: "pending" },
          select: { id: true },
        });
        if (existing) throw Object.assign(new Error("PENDING_EXISTS"), { code: "PENDING_EXISTS" });
      }

      // Validar OTP (constant-time) — separado do verifyCode de email
      const { timingSafeEqual } = await import("crypto");
      const otpTrimmed = otp.trim();
      const storedOtp  = user.otpCode ?? "";
      const len        = Math.max(otpTrimmed.length, storedOtp.length, 1);
      const otpMatch   =
        storedOtp.length === otpTrimmed.length &&
        timingSafeEqual(
          Buffer.from(otpTrimmed.padEnd(len, "\0")),
          Buffer.from(storedOtp.padEnd(len, "\0")),
        );

      if (!otpMatch || !user.otpExpires || user.otpExpires < new Date()) {
        throw Object.assign(new Error("OTP_INVALID"), { code: "OTP_INVALID" });
      }

      // Invalidar OTP imediatamente após verificação
      await dbTx.user.update({
        where: { id: user.id },
        data:  { otpCode: null, otpExpires: null },
      });

      const txRef    = type === "deposit" ? MULTICAIXA_REF : (reference ? String(reference).slice(0, 200) : null);
      const txMethod = type === "deposit" ? "multicaixa_ref" : (method ? String(method).slice(0, 100) : null);

      return dbTx.transaction.create({
        data: {
          userId:    userId,
          type,
          amount:    amountNum,
          method:    txMethod,
          reference: txRef,
          status:    "pending",
        },
      });
    });
  } catch (err: any) {
    if (err?.code === "USER_NOT_FOUND")       return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
    if (err?.code === "KYC_REQUIRED")         return NextResponse.json({ error: "Verificação de identidade (KYC) obrigatória para efectuar depósitos e levantamentos.", kycRequired: true }, { status: 403 });
    if (err?.code === "INSUFFICIENT_BALANCE") return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
    if (err?.code === "PENDING_EXISTS")       return NextResponse.json({ error: "Já tens um levantamento pendente. Aguarda a sua aprovação antes de fazer um novo pedido." }, { status: 409 });
    if (err?.code === "OTP_INVALID")          return NextResponse.json({ error: "Código OTP inválido ou expirado" }, { status: 400 });
    console.error("[transactions] erro:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  // Detecção de fraude em depósitos (assíncrono)
  if (type === "deposit") {
    checkSuspiciousDeposit(session.user.id, amountNum).catch(() => {});
  }

  return NextResponse.json(tx, { status: 201 });
}
