import { prisma } from "./prisma";
import { sendPushToUser } from "./webPush";

async function alertAdmins(title: string, body: string) {
  const admins = await prisma.user.findMany({
    where:  { role: "admin" },
    select: { id: true },
  });
  for (const admin of admins) {
    sendPushToUser(admin.id, { title, body, url: "/ao/admin/audit", tag: "fraud-alert" }).catch(() => {});
  }
  // Guardar no AuditLog para o painel admin
  await prisma.auditLog.create({
    data: {
      adminId:   "system",
      adminName: "Sistema",
      action:    "fraud_alert",
      target:    title,
      detail:    body,
    },
  }).catch(() => {});
}

/**
 * Verifica se o IP já está associado a outras contas diferentes.
 * Chamado no login bem-sucedido.
 */
export async function checkIpCollision(ip: string, userId: string): Promise<void> {
  if (!ip || ip === "unknown") return;
  try {
    const sessions = await prisma.userSession.findMany({
      where:  { ip, userId: { not: userId }, createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600_000) } },
      select: { userId: true },
      distinct: ["userId"],
    });
    if (sessions.length >= 2) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      await alertAdmins(
        "⚠️ IP partilhado por múltiplas contas",
        `IP ${ip} detectado em ${sessions.length + 1} contas diferentes. Último login: ${user?.email ?? userId}`,
      );
    }
  } catch { /* non-critical */ }
}

/**
 * Verifica padrões suspeitos num depósito:
 * - Depósito nas primeiras 2h após registo
 * - Valor muito alto sem histórico
 */
export async function checkSuspiciousDeposit(userId: string, amount: number): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { email: true, name: true, createdAt: true, kycStatus: true },
    });
    if (!user) return;

    const accountAgeHours = (Date.now() - new Date(user.createdAt).getTime()) / 3600_000;
    const prevDeposits    = await prisma.transaction.count({
      where: { userId, type: "deposit", status: "completed" },
    });

    // Depósito nas primeiras 2h — conta muito nova
    if (accountAgeHours < 2) {
      await alertAdmins(
        "⚠️ Depósito em conta muito recente",
        `${user.email} depositou ${amount.toLocaleString("pt-PT")} Kz apenas ${Math.round(accountAgeHours * 60)}min após o registo. KYC: ${user.kycStatus}`,
      );
    }

    // Depósito alto sem histórico (> 500k Kz no primeiro depósito)
    if (prevDeposits === 0 && amount >= 500_000) {
      await alertAdmins(
        "⚠️ Primeiro depósito de valor elevado",
        `${user.email} — primeiro depósito de ${amount.toLocaleString("pt-PT")} Kz. KYC: ${user.kycStatus}`,
      );
    }

    // Depósito sem KYC aprovado acima de 200k Kz
    if (user.kycStatus !== "approved" && amount >= 200_000) {
      await alertAdmins(
        "⚠️ Depósito alto sem KYC aprovado",
        `${user.email} tentou depositar ${amount.toLocaleString("pt-PT")} Kz sem KYC aprovado (status: ${user.kycStatus})`,
      );
    }
  } catch { /* non-critical */ }
}

/**
 * Verifica padrões suspeitos nos trades.
 * Chamado ao abrir uma operação.
 */
export async function checkSuspiciousTrade(userId: string, amount: number, asset: string): Promise<void> {
  try {
    // Trade > 100k Kz em conta sem depósito aprovado
    const hasDeposit = await prisma.transaction.count({
      where: { userId, type: "deposit", status: "completed" },
    });
    if (hasDeposit === 0 && amount >= 100_000) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      await alertAdmins(
        "⚠️ Trade elevado sem depósito real",
        `${user?.email ?? userId} abriu trade de ${amount.toLocaleString("pt-PT")} Kz em ${asset} sem depósito aprovado`,
      );
    }
  } catch { /* non-critical */ }
}
