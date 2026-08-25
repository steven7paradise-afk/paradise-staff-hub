import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendPushNotification } from "@/lib/push-sender";

type NotificationData = Prisma.NotificationCreateManyInput;

async function sendPushAndWhatsApp(data: NotificationData, actionUrlOverride?: string) {
  const deliveryActionUrl = String(data.type) === "TIMBRATURA"
    ? "/notifications?section=attendance"
    : actionUrlOverride ?? (data.action_url ? String(data.action_url) : null);
  const user = await prisma.user.findUnique({
    where: { id: String(data.user_id) },
    select: { whatsapp_phone: true },
  });

  await Promise.allSettled([
    sendWhatsAppMessage({
      to: user?.whatsapp_phone,
      title: String(data.title),
      message: String(data.message),
      actionUrl: deliveryActionUrl,
    }).catch((err) => console.error("WhatsApp notification error:", err)),
    sendPushNotification(
      String(data.user_id),
      String(data.title),
      String(data.message),
      deliveryActionUrl ?? undefined,
    ).catch((err) => console.error("Chrome Web Push notification error:", err)),
  ]);
}

export async function createNotification(data: NotificationData) {
  const notification = await prisma.notification.create({ data });
  await sendPushAndWhatsApp(data);
  return notification;
}

export async function createNotifications(
  data: NotificationData[],
  options?: { deliveryActionUrl?: (notification: NotificationData) => string | undefined },
) {
  if (data.length === 0) return { count: 0 };
  const result = await prisma.notification.createMany({ data });
  await Promise.allSettled(
    data.map((notification) => sendPushAndWhatsApp(notification, options?.deliveryActionUrl?.(notification))),
  );
  return result;
}
