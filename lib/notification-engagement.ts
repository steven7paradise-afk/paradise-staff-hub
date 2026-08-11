import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

const SETTING_PREFIX = "notification_engagement:";

export type NotificationComment = {
  id: string;
  userId: string;
  userName: string;
  photoUrl: string | null;
  message: string;
  createdAt: string;
};

type EngagementValue = {
  comments?: NotificationComment[];
};

export function notificationThreadKey(notification: {
  title: string;
  message: string;
  type: string;
  action_url: string | null;
  created_at: Date;
}) {
  const minute = notification.created_at.toISOString().slice(0, 16);
  const signature = [notification.title, notification.message, notification.type, notification.action_url ?? "", minute].join("\u001f");
  return createHash("sha256").update(signature).digest("hex").slice(0, 32);
}

export function notificationCohortWhere(notification: {
  title: string;
  message: string;
  type: string;
  action_url: string | null;
  created_at: Date;
}) {
  const minuteStart = new Date(notification.created_at);
  minuteStart.setSeconds(0, 0);
  const minuteEnd = new Date(minuteStart.getTime() + 60_000);

  return {
    title: notification.title,
    message: notification.message,
    type: notification.type,
    action_url: notification.action_url,
    created_at: { gte: minuteStart, lt: minuteEnd },
  };
}

export async function getNotificationComments(threadKey: string) {
  const setting = await prisma.setting.findUnique({
    where: { key: `${SETTING_PREFIX}${threadKey}` },
  });
  const value = (setting?.value ?? {}) as EngagementValue;
  return Array.isArray(value.comments) ? value.comments : [];
}

export async function addNotificationComment(threadKey: string, comment: NotificationComment) {
  const key = `${SETTING_PREFIX}${threadKey}`;
  const existing = await prisma.setting.findUnique({ where: { key } });
  const value = (existing?.value ?? {}) as EngagementValue;
  const comments = [...(Array.isArray(value.comments) ? value.comments : []), comment].slice(-250);

  await prisma.setting.upsert({
    where: { key },
    create: { key, value: { comments } },
    update: { value: { comments } },
  });

  return comments;
}
