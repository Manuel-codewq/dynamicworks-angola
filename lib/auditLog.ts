import { prisma } from "@/lib/prisma";

export async function logAction(
  adminId: string,
  adminName: string,
  action: string,
  target: string,
  detail?: string,
) {
  await prisma.auditLog.create({ data: { adminId, adminName, action, target, detail } });
}
