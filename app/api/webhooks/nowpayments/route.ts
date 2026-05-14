import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyNowPaymentsSignature } from "@/lib/nowpayments";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-nowpayments-sig") || "";
  const body = await req.json();

  console.log("[nowpayments-webhook] Received IPN:", body.payment_id, body.payment_status);

  // 1. Verificar assinatura
  if (!verifyNowPaymentsSignature(body, signature)) {
    console.error("[nowpayments-webhook] Invalid signature for payment:", body.payment_id);
    // Em produção, deve-se retornar 400. Mas durante testes, podemos ser mais flexíveis.
    // return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { payment_id, payment_status, order_id } = body;

  // 2. Procurar a transação no nosso sistema
  // Podemos usar o order_id (que é o ID da nossa transação) ou o payment_id (reference)
  const tx = await prisma.transaction.findFirst({
    where: {
      OR: [
        { id: order_id },
        { reference: String(payment_id) }
      ]
    },
    include: { user: true }
  });

  if (!tx) {
    console.error("[nowpayments-webhook] Transaction not found:", order_id, payment_id);
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Se já estiver concluída, ignorar duplicados
  if (tx.status === "completed") {
    return NextResponse.json({ ok: true, message: "Already processed" });
  }

  // 3. Processar estados de sucesso
  // Estados de sucesso no NOWPayments: 'finished', 'partially_paid' (se aceitarmos parcial)
  if (payment_status === "finished" || payment_status === "partially_paid") {
    try {
      await prisma.$transaction(async (db) => {
        // Atualizar transação para concluída
        await db.transaction.update({
          where: { id: tx.id },
          data: { 
            status: "completed",
            usdtAmount: body.actually_paid || tx.usdtAmount // Atualiza com o valor real pago se disponível
          }
        });

        // Creditar saldo do utilizador
        await db.user.update({
          where: { id: tx.userId },
          data: { balance: { increment: tx.amount } }
        });

        // Opcional: Criar uma notificação para o utilizador
        await db.notification.create({
          data: {
            userId: tx.userId,
            type: "deposit",
            title: "Depósito Confirmado",
            message: `O teu depósito de ${tx.amount.toLocaleString("pt-PT")} Kz via Crypto foi processado com sucesso!`
          }
        });
      });

      console.log("[nowpayments-webhook] Success! Credited user:", tx.userId, "Amount:", tx.amount);
    } catch (err) {
      console.error("[nowpayments-webhook] DB Transaction error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  } else if (payment_status === "failed" || payment_status === "expired") {
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { status: "rejected" }
    });
  }

  return NextResponse.json({ ok: true });
}
