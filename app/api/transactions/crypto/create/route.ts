import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { createNowPayment } from "@/lib/nowpayments";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { amount: amountAoa } = await req.json();
  if (!amountAoa || amountAoa < 5000) {
    return NextResponse.json({ error: "Valor mínimo: 5.000 Kz" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { kycStatus: true, email: true },
  });

  if (user?.kycStatus !== "approved") {
    return NextResponse.json({ error: "KYC aprovado necessário." }, { status: 403 });
  }

  const cfg = await getSettings();
  if (!cfg.usdtRateAoa || cfg.usdtRateAoa <= 0) {
    return NextResponse.json({ error: "Configuração de taxa inválida." }, { status: 500 });
  }

  // Converter AOA para USD (usando a taxa USDT do sistema)
  const amountUsd = amountAoa / cfg.usdtRateAoa;

  try {
    // 1. Criar transação pendente no nosso DB
    const tx = await prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: "deposit",
        amount: amountAoa,
        method: "crypto_nowpayments",
        status: "pending",
        usdtRate: cfg.usdtRateAoa,
      },
    });

    // 2. Criar pagamento no NOWPayments
    const baseUrl = process.env.NEXTAUTH_URL || "https://dynamicworks.ao";
    const payment = await createNowPayment({
      price_amount: Number(amountUsd.toFixed(2)),
      price_currency: "usd",
      pay_currency: "usdttrc20", // Padrão usdt trc20, mas o user pode mudar no widget deles
      order_id: tx.id,
      order_description: `Depósito Dynamics Works - ${user.email}`,
      ipn_callback_url: `${baseUrl}/api/webhooks/nowpayments`,
      success_url: `${baseUrl}/wallet?status=success`,
      cancel_url: `${baseUrl}/wallet?status=cancel`,
    });

    // 3. Atualizar transação com o ID do NOWPayments
    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        reference: payment.payment_id,
        usdtAmount: payment.pay_amount,
        usdtAddress: payment.pay_address,
      },
    });

    return NextResponse.json({
      payment_id: payment.payment_id,
      pay_address: payment.pay_address,
      pay_amount: payment.pay_amount,
      pay_currency: payment.pay_currency,
      invoice_url: `https://nowpayments.io/payment/?iid=${payment.payment_id}`, // Exemplo de link direto se necessário
    });

  } catch (error: any) {
    console.error("[crypto-create] Error:", error);
    return NextResponse.json({ error: error.message || "Erro ao processar pagamento" }, { status: 500 });
  }
}
