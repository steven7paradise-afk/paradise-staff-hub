import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/push-sender";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

function isRestCategory(category: { name: string; code: string }) {
  const name = category.name.toLowerCase();
  const code = category.code.toUpperCase();
  return name.includes("riposo") || ["R", "RI", "R3", "RIPOSO"].includes(code);
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function formatNextShift(date: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

export async function ensureTomorrowRestNotifications(today: Date) {
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
  const searchEnd = new Date(tomorrow);
  searchEnd.setUTCDate(searchEnd.getUTCDate() + 21);
  const reminderType = `REST_REMINDER_${tomorrow.toISOString().slice(0, 10)}`;

  const [tomorrowEntries, futureEntries, existing] = await Promise.all([
    prisma.scheduleEntry.findMany({
      where: { date: { gte: tomorrow, lt: dayAfter }, user: { active: true } },
      include: { category: true, user: true },
    }),
    prisma.scheduleEntry.findMany({
      where: { date: { gte: dayAfter, lt: searchEnd }, user: { active: true } },
      include: { category: true },
      orderBy: { date: "asc" },
    }),
    prisma.notification.findMany({
      where: { type: reminderType },
      select: { user_id: true },
    }),
  ]);

  const alreadySent = new Set(existing.map((notification) => notification.user_id));
  const notifications = tomorrowEntries
    .filter((entry) => isRestCategory(entry.category) && !alreadySent.has(entry.user_id))
    .map((entry) => {
      const nextShift = futureEntries.find(
        (candidate) => candidate.user_id === entry.user_id && !isRestCategory(candidate.category),
      );
      const nextLabel = nextShift ? formatNextShift(nextShift.date) : "al prossimo turno";
      return {
        user_id: entry.user_id,
        title: `Buon riposo, ${firstName(entry.user.name)}`,
        message: `Domani sei di riposo. Ci vediamo ${nextLabel}.`,
        type: reminderType,
        action_url: "/my-shifts",
        read: false,
      };
    });

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });

    // External delivery must never delay or break the dashboard response.
    void Promise.allSettled(notifications.flatMap((notification) => {
      const entry = tomorrowEntries.find((item) => item.user_id === notification.user_id);
      return [
        sendPushNotification(
          notification.user_id,
          notification.title,
          notification.message,
          notification.action_url,
        ),
        sendWhatsAppMessage({
          to: entry?.user.whatsapp_phone,
          title: notification.title,
          message: notification.message,
          actionUrl: notification.action_url,
        }),
      ];
    })).catch((error) => console.error("Rest reminder delivery error:", error));
  }
  return { created: notifications.length };
}
