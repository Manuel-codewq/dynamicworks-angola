import { prisma } from "@/lib/prisma";

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string
): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, type, title, message } });
  } catch (err) {
    console.error("[notify] Falha ao criar notificação:", err);
  }
}
