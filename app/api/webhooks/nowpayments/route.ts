import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyNowPaymentsSignature } from "@/lib/nowpayments";
import { sendDepositApprovedEmail } from "@/lib/email";
import { createNotification } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-nowpayments-sig") || "";
  const body = await req.json();

  console.log("[nowpayments-webhook] IPN recebido:", body.payment_id, body.payment_status);

  // 1. Verificar assinatura — rejeita requests não autorizados
  if (!verifyNowPaymentsSignature(body, signature)) {
    console.error("[nowpayments-webhook] Assinatura inválida para:", body.payment_id);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { payment_id, payment_status, order_id } = body;

  // 2. Encontrar transação pelo order_id (ID da nossa DB) ou pelo payment_id (reference)
  const tx = await prisma.transaction.findFirst({
    where: {
      OR: [
        { id: order_id },
        { reference: String(payment_id) },
      ],
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!tx) {
    console.error("[nowpayments-webhook] Transação não encontrada:", order_id, payment_id);
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Ignorar duplicados
  if (tx.status === "completed") {
    return NextResponse.json({ ok: true, message: "Already processed" });
  }

  // 3. Pagamento confirmado
  if (payment_status === "finished" || payment_status === "partially_paid") {
    try {
      await prisma.$transaction(async (db) => {
        await db.transaction.update({
          where: { id: tx.id },
          data: {
            status: "completed",
            usdtAmount: body.actually_paid ?? tx.usdtAmount,
          },
        });

        await db.user.update({
          where: { id: tx.userId },
          data: { balance: { increment: tx.amount } },
        });
      });

      console.log("[nowpayments-webhook] Saldo creditado — user:", tx.userId, "valor:", tx.amount);

      // Notificações — falha silenciosa para não bloquear a resposta ao NOWPayments
      try {
        const amtFormatted = tx.amount.toLocaleString("pt-PT");
        await Promise.all([
          createNotification(
            tx.userId,
            "deposit_completed",
            "Depósito Crypto confirmado",
            `O teu depósito de ${amtFormatted} Kz via USDT foi confirmado e adicionado ao teu saldo.`
          ),
          sendDepositApprovedEmail(tx.user.email, tx.user.name, tx.amount),
        ]);
      } catch (notifErr) {
        console.error("[nowpayments-webhook] Notificação falhou:", notifErr);
      }
    } catch (err) {
      console.error("[nowpayments-webhook] Erro na DB:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  } else if (payment_status === "failed" || payment_status === "expired") {
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { status: "rejected" },
    });
    console.log("[nowpayments-webhook] Pagamento falhado/expirado:", tx.id);
  }

  return NextResponse.json({ ok: true });
}
