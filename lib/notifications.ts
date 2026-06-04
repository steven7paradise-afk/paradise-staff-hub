import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendPushNotification } from "@/lib/push-sender";

type NotificationData = Prisma.NotificationCreateManyInput;

async function sendPushAndWhatsApp(data: NotificationData) {
  const user = await prisma.user.findUnique({
    where: { id: String(data.user_id) },
    select: { whatsapp_phone: true },
  });

  await Promise.allSettled([
    sendWhatsAppMessage({
      to: user?.whatsapp_phone,
      title: String(data.title),
      message: String(data.message),
      actionUrl: data.action_url ? String(data.action_url) : null,
    }).catch((err) => console.error("WhatsApp notification error:", err)),
    sendPushNotification(
      String(data.user_id),
      String(data.title),
      String(data.message),
      data.action_url ? String(data.action_url) : undefined,
    ).catch((err) => console.error("Chrome Web Push notification error:", err)),
  ]);
}

export async function createNotification(data: NotificationData) {
  const notification = await prisma.notification.create({ data });
  await sendPushAndWhatsApp(data);
  return notification;
}

export async function createNotifications(data: NotificationData[]) {
  if (data.length === 0) return { count: 0 };
  const result = await prisma.notification.createMany({ data });
  await Promise.allSettled(data.map(sendPushAndWhatsApp));
  return result;
}
