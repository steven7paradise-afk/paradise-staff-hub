import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import {
  ABSENCE_GRACE_MINUTES,
  currentRomeMinutes,
  isRestSchedule,
  romeMinutesForInstant,
  scheduleTimeToMinutes,
} from "@/lib/scheduled-attendance";

export const AUTOMATIC_LATE_REASON_PREFIX = "RITARDO AUTOMATICO — ";

export function isAutomaticLateReason(reason: string | null | undefined) {
  return String(reason || "").startsWith(AUTOMATIC_LATE_REASON_PREFIX);
}

function minutesToClock(value: number) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, value));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export async function ensureAutomaticLateRequests(day: Date, now = new Date()) {
  const tomorrow = new Date(day);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const [schedules, logs, approvedLeaves] = await Promise.all([
    prisma.scheduleEntry.findMany({
      where: {
        date: { gte: day, lt: tomorrow },
        user: { active: true, role: { notIn: ["ZERO", "SUPER_ADMIN"] } },
      },
      include: { category: true, user: { select: { id: true, name: true } } },
    }),
    prisma.attendanceLog.findMany({
      where: { date: { gte: day, lt: tomorrow }, type: "ENTRATA" },
      orderBy: { timestamp: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        type: { in: ["FERIE", "MALATTIA", "RIPOSO", "PERMESSO"] },
        start_date: { lt: tomorrow },
        end_date: { gte: day },
      },
      select: { user_id: true },
    }),
  ]);

  const firstEntryByUser = new Map<string, (typeof logs)[number]>();
  for (const log of logs) {
    if (!firstEntryByUser.has(log.user_id)) firstEntryByUser.set(log.user_id, log);
  }
  const approvedLeaveUserIds = new Set(approvedLeaves.map((request) => request.user_id));
  const dateKey = day.toISOString().slice(0, 10);
  const candidates = schedules.flatMap((schedule) => {
    const plannedStart = schedule.start_time || schedule.category.start_time || null;
    const plannedMinutes = scheduleTimeToMinutes(plannedStart);
    if (
      plannedMinutes === null
      || isRestSchedule(schedule.category.name, schedule.category.code)
      || approvedLeaveUserIds.has(schedule.user_id)
    ) return [];

    const firstEntry = firstEntryByUser.get(schedule.user_id);
    const observedMinutes = firstEntry ? romeMinutesForInstant(firstEntry.timestamp) : currentRomeMinutes(now);
    const delayMinutes = Math.max(0, observedMinutes - plannedMinutes);
    if (delayMinutes <= ABSENCE_GRACE_MINUTES) return [];

    const endTime = minutesToClock(observedMinutes);
    const reason = firstEntry
      ? `${AUTOMATIC_LATE_REASON_PREFIX}turno previsto ${plannedStart}, ingresso registrato ${endTime} (+${delayMinutes} minuti).`
      : `${AUTOMATIC_LATE_REASON_PREFIX}turno previsto ${plannedStart}, nessuna timbratura dopo ${delayMinutes} minuti.`;
    return [{
      id: `auto-late:${schedule.user_id}:${dateKey}`,
      userId: schedule.user_id,
      userName: schedule.user.name,
      plannedStart,
      endTime,
      reason,
    }];
  });

  if (candidates.length === 0) return { created: 0, updated: 0 };
  const existing = await prisma.leaveRequest.findMany({
    where: { id: { in: candidates.map((candidate) => candidate.id) } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((request) => request.id));
  const newCandidates = candidates.filter((candidate) => !existingIds.has(candidate.id));

  const created = await prisma.leaveRequest.createMany({
    data: newCandidates.map((candidate) => ({
      id: candidate.id,
      user_id: candidate.userId,
      type: "PERMESSO",
      start_date: day,
      end_date: day,
      start_time: candidate.plannedStart,
      end_time: candidate.endTime,
      reason: candidate.reason,
      admin_note: "Generato automaticamente dal confronto tra turno pianificato e timbratura.",
      status: "PENDING",
    })),
    skipDuplicates: true,
  });

  await Promise.all(candidates.map((candidate) => prisma.leaveRequest.updateMany({
    where: { id: candidate.id, status: "PENDING" },
    data: { end_time: candidate.endTime, reason: candidate.reason },
  })));

  if (created.count > 0) {
    const admins = await prisma.user.findMany({
      where: { active: true, role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] } },
      select: { id: true },
    });
    const names = newCandidates.map((candidate) => candidate.userName).join(", ");
    await createNotifications(admins.map((admin) => ({
      id: randomUUID(),
      user_id: admin.id,
      title: created.count === 1 ? "Ritardo da approvare" : `${created.count} ritardi da approvare`,
      message: `Il confronto tra planning e timbrature ha rilevato: ${names}. Apri Richieste per approvare o rifiutare.`,
      type: "RICHIESTA",
      action_url: "/requests",
      read: false,
    })));
  }

  return { created: created.count, updated: candidates.length };
}
