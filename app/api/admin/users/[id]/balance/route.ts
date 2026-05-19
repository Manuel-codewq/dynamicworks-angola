import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/auditLog";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendPushToUser } from "@/lib/webPush";
import { getClientIp } from "@/lib/getClientIp";

const MAX_BALANCE      = 100_000_000; // 100M Kz
const MAX_DAILY_ADJUST = 5_000_000;   // 5M Kz por dia por admin

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Rate limit: máximo 20 edições de saldo por admin por hora
  if (!await checkRateLimit("admin_balance_edit", session.user.id, 20, 60 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas edições de saldo. Aguarda 1 hora." }, { status: 429 });
  }

  const { id } = await params;
  const { balance, type = "real", reason } = await req.json();

  // Motivo obrigatório
  if (!reason || String(reason).trim().length < 5) {
    return NextResponse.json({ error: "Motivo obrigatório (mínimo 5 caracteres)." }, { status: 400 });
  }

  const n = parseFloat(balance);
  if (!isFinite(n) || n < 0) return NextResponse.json({ error: "Saldo inválido" }, { status: 400 });
  if (n > MAX_BALANCE) return NextResponse.json({ error: `Máximo: ${MAX_BALANCE.toLocaleString("pt-PT")} Kz` }, { status: 400 });

  const isDemo  = type === "demo";
  const field   = isDemo ? "demoBalance" : "balance";
  const ip      = getClientIp(req);

  const before = await prisma.user.findUnique({
    where:  { id },
    select: { balance: true, demoBalance: true, name: true, email: true },
  });
  if (!before) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  const prev = isDemo ? (before.demoBalance ?? 0) : (before.balance ?? 0);
  const diff = n - prev;

  // Limite diário de ajuste por admin (5M Kz)
  if (!isDemo) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayAdjustments = await prisma.transaction.aggregate({
      where: {
        type:      "adjustment",
        status:    "completed",
        reference: { contains: session.user.name ?? "" },
        createdAt: { gte: todayStart },
      },
      _sum: { amount: true },
    });
    const todayTotal = Math.abs(todayAdjustments._sum.amount ?? 0);
    if (todayTotal + Math.abs(diff) > MAX_DAILY_ADJUST) {
      return NextResponse.json({
        error: `Limite diário de ajuste atingido (${MAX_DAILY_ADJUST.toLocaleString("pt-PT")} Kz/dia). Total hoje: ${Math.floor(todayTotal).toLocaleString("pt-PT")} Kz.`,
      }, { status: 400 });
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data:  { [field]: n },
    select: { id: true, balance: true, demoBalance: true },
  });

  const label = isDemo ? "SALDO DEMO" : "SALDO REAL";
  const sign  = diff >= 0 ? "+" : "";

  // Audit log com motivo e IP
  await logAction(
    session.user.id,
    session.user.name ?? "Admin",
    "EDIT_BALANCE",
    id,
    `${before.name} [${label}]: ${Math.floor(prev).toLocaleString("pt-PT")} Kz → ${Math.floor(n).toLocaleString("pt-PT")} Kz (${sign}${Math.floor(diff).toLocaleString("pt-PT")} Kz) | Motivo: ${reason} | IP: ${ip}`,
  );

  // Transação de registo (só saldo real)
  if (!isDemo) {
    await prisma.transaction.create({
      data: {
        userId:    id,
        type:      "adjustment",
        amount:    diff,
        status:    "completed",
        reference: `Admin: ${session.user.name} — ${reason}`,
      },
    });
  }

  // Alertar todos os outros admins por push
  if (Math.abs(diff) > 0) {
    const admins = await prisma.user.findMany({
      where:  { role: "admin", id: { not: session.user.id } },
      select: { id: true },
    });
    const msg = `${session.user.name} editou ${label} de ${before.name}: ${sign}${Math.floor(diff).toLocaleString("pt-PT")} Kz. Motivo: ${reason}`;
    for (const admin of admins) {
      sendPushToUser(admin.id, {
        title: "Edição de saldo efectuada",
        body:  msg,
        url:   "/ao/admin/audit",
        tag:   "balance-edit",
      }).catch(() => {});
    }
  }

  return NextResponse.json(user);
}
