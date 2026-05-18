import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TYPE_LABEL: Record<string, string> = {
  deposit:          "Depósito",
  withdrawal:       "Levantamento",
  adjustment:       "Ajuste manual (admin)",
  tournament_entry: "Inscrição em torneio",
  tournament_prize: "Prémio de torneio",
  referral_commission: "Comissão de referido",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;

  const [user, transactions, trades, auditLogs] = await Promise.all([
    prisma.user.findUnique({
      where:  { id },
      select: { name: true, email: true, balance: true, demoBalance: true },
    }),
    prisma.transaction.findMany({
      where:   { userId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.trade.findMany({
      where:   { userId: id, isDemo: false, status: "closed" },
      orderBy: { closedAt: "desc" },
      select:  { id: true, asset: true, direction: true, amount: true, profit: true, result: true, payout: true, createdAt: true, closedAt: true },
    }),
    prisma.auditLog.findMany({
      where:   { target: { contains: id } },
      orderBy: { createdAt: "desc" },
      select:  { id: true, action: true, adminName: true, detail: true, createdAt: true },
    }),
  ]);

  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  // Montar linha do tempo unificada
  const events: any[] = [];

  // Transações
  for (const tx of transactions) {
    const isCredit = ["deposit", "tournament_prize", "referral_commission"].includes(tx.type)
      || (tx.type === "adjustment" && tx.amount > 0);
    const isDebit  = ["withdrawal", "tournament_entry"].includes(tx.type)
      || (tx.type === "adjustment" && tx.amount < 0);

    if (tx.status !== "completed" && tx.type !== "adjustment") {
      // Mostrar pendentes e rejeitados também, mas marcados
      events.push({
        id:       tx.id,
        date:     tx.createdAt,
        type:     "transaction",
        category: tx.type,
        label:    TYPE_LABEL[tx.type] ?? tx.type,
        detail:   tx.reference ?? tx.method ?? "",
        amount:   tx.amount,
        sign:     isCredit ? "+" : "-",
        color:    tx.status === "pending" ? "#f5a623" : "#ef4444",
        status:   tx.status,
        affectsBalance: false,
      });
      continue;
    }

    events.push({
      id:       tx.id,
      date:     tx.createdAt,
      type:     "transaction",
      category: tx.type,
      label:    TYPE_LABEL[tx.type] ?? tx.type,
      detail:   tx.reference ?? tx.method ?? "",
      amount:   Math.abs(tx.amount),
      sign:     isCredit ? "+" : "-",
      color:    isCredit ? "#22c55e" : "#ef4444",
      status:   tx.status,
      affectsBalance: true,
    });
  }

  // Trades reais fechados
  for (const t of trades) {
    const isWin = t.result === "win";
    const returnAmount = isWin ? t.amount + (t.profit ?? 0) : 0;
    const net = isWin ? (t.profit ?? 0) : -t.amount;

    events.push({
      id:       t.id,
      date:     t.closedAt ?? t.createdAt,
      type:     "trade",
      category: "trade",
      label:    `Trade ${t.direction === "call" ? "ALTA" : "BAIXA"} — ${t.asset}`,
      detail:   isWin ? `Ganhou — retorno ${Math.floor(returnAmount).toLocaleString("pt-PT")} Kz` : "Perdeu — investimento perdido",
      amount:   Math.abs(net),
      sign:     isWin ? "+" : "-",
      color:    isWin ? "#22c55e" : "#ef4444",
      status:   t.result ?? "",
      affectsBalance: true,
    });
  }

  // Logs de auditoria (edições manuais)
  for (const log of auditLogs) {
    if (log.action !== "EDIT_BALANCE") continue;
    events.push({
      id:       log.id,
      date:     log.createdAt,
      type:     "audit",
      category: "audit",
      label:    "Edição manual de saldo",
      detail:   `Por: ${log.adminName} — ${log.detail ?? ""}`,
      amount:   null,
      sign:     "~",
      color:    "#f5a623",
      status:   "info",
      affectsBalance: true,
    });
  }

  // Ordenar por data decrescente
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calcular saldo de origem (reconstrução simples)
  const totalCredits = transactions
    .filter(tx => tx.status === "completed" && ["deposit", "tournament_prize", "referral_commission"].includes(tx.type))
    .reduce((s, tx) => s + tx.amount, 0);
  const totalDebits = transactions
    .filter(tx => tx.status === "completed" && ["withdrawal", "tournament_entry"].includes(tx.type))
    .reduce((s, tx) => s + tx.amount, 0);
  const adjustments = transactions
    .filter(tx => tx.type === "adjustment")
    .reduce((s, tx) => s + tx.amount, 0);
  const tradeNet = trades.reduce((s, t) => s + (t.profit ?? (t.result === "loss" ? -t.amount : 0)), 0);

  return NextResponse.json({
    user,
    events,
    summary: {
      currentBalance: user.balance,
      totalDeposited:  Math.round(totalCredits),
      totalWithdrawn:  Math.round(totalDebits),
      totalAdjusted:   Math.round(adjustments),
      tradeNet:        Math.round(tradeNet),
    },
  });
}
