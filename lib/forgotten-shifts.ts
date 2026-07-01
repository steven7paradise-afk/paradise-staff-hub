import { emailTemplates, sendEmail } from "@/lib/email";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

function localDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(date);
}

function localHour(date: Date) {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Rome" }).format(date));
}

function romeDateAt(day: string, hour: number) {
  const noonUtc = new Date(`${day}T12:00:00.000Z`);
  const offsetName = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", timeZoneName: "shortOffset" })
    .formatToParts(noonUtc)
    .find((part) => part.type === "timeZoneName")?.value ?? "GMT+1";
  const offset = offsetName.replace("GMT", "") || "+1";
  const match = offset.match(/^([+-])(\d{1,2})(?::(\d{2}))?$/);
  const padded = match ? `${match[1]}${match[2].padStart(2, "0")}:${match[3] ?? "00"}` : "+01:00";
  return new Date(`${day}T${String(hour).padStart(2, "0")}:00:00${padded}`);
}

export async function closeForgottenShifts(now = new Date()) {
  if (localHour(now) < 22) return { closed: 0 };

  const day = localDay(now);
  const dateOnly = new Date(`${day}T00:00:00.000Z`);
  const cutoff = romeDateAt(day, 22);
  const logs = await prisma.attendanceLog.findMany({
    where: { date: dateOnly },
    include: { user: true, location: true, device: true },
    orderBy: { timestamp: "desc" },
  });
  const latestByUser = new Map<string, (typeof logs)[number]>();
  logs.forEach((log) => {
    if (!latestByUser.has(log.user_id)) latestByUser.set(log.user_id, log);
  });
  const openLogs = Array.from(latestByUser.values()).filter((log) => log.type !== "USCITA");

  for (const log of openLogs) {
    const entryTime = new Date(log.timestamp);
    const exitTime = new Date(entryTime.getTime() + 8 * 60 * 60 * 1000);
    const timeString = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Europe/Rome"
    }).format(exitTime);
    const formattedExitTime = timeString.slice(0, 5);

    await prisma.attendanceLog.create({
      data: {
        user_id: log.user_id,
        location_id: log.location_id,
        device_id: log.device_id,
        type: "USCITA",
        timestamp: exitTime,
        date: dateOnly,
        time: timeString,
        note: "Uscita automatica: timbratura di uscita dimenticata (default 8 ore).",
      },
    });

    const admins = await prisma.user.findMany({
      where: { active: true, role: { in: ["SUPER_ADMIN", "ADMIN"] } },
      select: { id: true, email: true },
    });
    await createNotifications([
        { user_id: log.user_id, title: "Timbratura uscita automatica", message: `Il turno del ${day} è stato chiuso automaticamente alle ${formattedExitTime} (default 8 ore) per uscita mancante.`, type: "TIMBRATURA", action_url: "/dashboard" },
        ...admins.map((admin) => ({ user_id: admin.id, title: "Uscita dimenticata", message: `${log.user.name} non ha timbrato l'uscita: turno chiuso alle ${formattedExitTime} (default 8 ore).`, type: "TIMBRATURA", action_url: "/attendance" })),
    ]);
    const template = emailTemplates.missingClock(day);
    await Promise.allSettled([sendEmail({ to: log.user.email, ...template }), ...admins.map((admin) => sendEmail({ to: admin.email, ...template }))]);
  }

  return { closed: openLogs.length };
}
