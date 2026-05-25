import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TYPE_LABEL: Record<string, string> = {
  deposit:    "Depósito",
  withdrawal: "Levantamento",
  bonus:      "Bónus",
  commission: "Comissão Referido",
};

const METHOD_LABEL: Record<string, string> = {
  multicaixa:            "Multicaixa Express",
  multicaixa_express:    "Multicaixa Express",
  multicaixa_ref:        "Multicaixa Ref.",
  transferencia_bancaria:"Transf. Bancária",
  usdt_trc20:            "USDT TRC-20",
  crypto_nowpayments:    "USDT TRC-20",
};

const STATUS_LABEL: Record<string, string> = {
  pending:   "Pendente",
  completed: "Aprovado",
  rejected:  "Rejeitado",
};

function escape(v: string | number) {
  return `"${String(v).replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from   = searchParams.get("from");
  const to     = searchParams.get("to");
  const status = searchParams.get("status");
  const type   = searchParams.get("type");

  const where: any = {};

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = toDate;
    }
  }
  if (status && ["pending", "completed", "rejected"].includes(status)) {
    where.status = status;
  }
  if (type && ["deposit", "withdrawal", "bonus", "commission"].includes(type)) {
    where.type = type;
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const headers = [
    "Data",
    "Hora",
    "Utilizador",
    "Email",
    "Tipo",
    "Entrada (Kz)",
    "Saída (Kz)",
    "Valor (Kz)",
    "Estado",
    "Método",
    "Referência / TXID",
    "ID Transação",
  ];

  const rows = transactions.map(tx => {
    const isEntry = ["deposit", "bonus", "commission"].includes(tx.type);
    const isExit  = tx.type === "withdrawal";
    const approved = tx.status === "completed";
    const dt = new Date(tx.createdAt);

    return [
      dt.toLocaleDateString("pt-AO"),
      dt.toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" }),
      tx.user.name,
      tx.user.email,
      TYPE_LABEL[tx.type]   ?? tx.type,
      isEntry && approved ? Math.floor(tx.amount) : "",
      isExit  && approved ? Math.floor(tx.amount) : "",
      Math.floor(tx.amount),
      STATUS_LABEL[tx.status] ?? tx.status,
      METHOD_LABEL[tx.method ?? ""] ?? (tx.method ?? ""),
      tx.usdtTxid ?? tx.reference ?? "",
      tx.id,
    ];
  });

  // Linha de totais
  const totalIn  = transactions.filter(t => ["deposit","bonus","commission"].includes(t.type) && t.status === "completed").reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.type === "withdrawal" && t.status === "completed").reduce((s, t) => s + t.amount, 0);
  rows.push(["", "", "", "", "TOTAL", Math.floor(totalIn), Math.floor(totalOut), "", "", "", "", ""]);

  const bom = "﻿";
  const csv = bom + [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\r\n");

  const dateStr = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dynamic-works-extrato-${dateStr}.csv"`,
    },
  });
}
