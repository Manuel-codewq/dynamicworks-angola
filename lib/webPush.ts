import webpush from "web-push";
import { prisma } from "./prisma";

export interface PushPayload {
  title:  string;
  body:   string;
  url?:   string;
  tag?:   string;
}

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const email  = process.env.VAPID_EMAIL;
  const pubKey = process.env.VAPID_PUBLIC_KEY;
  const prvKey = process.env.VAPID_PRIVATE_KEY;
  if (!email || !pubKey || !prvKey) return;
  webpush.setVapidDetails(email, pubKey, prvKey);
  vapidConfigured = true;
}

export async function sendPushToAdmins(payload: PushPayload): Promise<void> {
  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  await Promise.allSettled(admins.map(a => sendPushToUser(a.id, payload)));
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  ensureVapid();
  if (!vapidConfigured) return; // VAPID não configurado — ignorar silenciosamente

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: payload.title,
            body:  payload.body,
            url:   payload.url ?? "/trade",
            tag:   payload.tag ?? "default",
            icon:  "/icon-192",
            badge: "/icon-192",
          }),
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } }).catch(() => {});
        }
      }
    }),
  );
}
