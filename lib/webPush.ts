import webpush from "web-push";
import { prisma } from "./prisma";

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL   = process.env.VAPID_EMAIL       ?? "mailto:suporte@dynamicworks.ao";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

export interface PushPayload {
  title: string;
  body:  string;
  icon?: string;
  badge?: string;
  url?:  string;
  tag?:  string;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const data = JSON.stringify({
    title: payload.title,
    body:  payload.body,
    icon:  payload.icon  ?? "/icon-192",
    badge: payload.badge ?? "/icon-192",
    url:   payload.url   ?? "/trade",
    tag:   payload.tag,
  });

  await Promise.allSettled(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        data,
      );
    } catch (err: any) {
      // 410 Gone = subscription expired — remove it
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }));
}
