import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import {
  ABSENCE_GRACE_MINUTES,
  currentRomeMinutes,
  isClosedSchedule,
  isRestSchedule,
  romeMinutesForInstant,
  scheduledEntryPolicy,
} from "@/lib/scheduled-attendance";

export const AUTOMATIC_LATE_REASON_PREFIX = "RITARDO AUTOMATICO — ";

export function isAutomaticLateReason(reason: string | null | undefined) {
  return String(reason || "").startsWith(AUTOMATIC_LATE_REASON_PREFIX);
}

type AutomaticLateRequestOptions = {
  userId?: string;
  actualEntryTimestamp?: Date;
  notifyOnDetectedEntry?: boolean;
};

function minutesToClock(value: number) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, value));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export async function ensureAutomaticLateRequests(
  day: Date,
  now = new Date(),
  options: AutomaticLateRequestOptions = {},
) {
  const tomorrow = new Date(day);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const [schedules, logs, approvedLeaves] = await Promise.all([
    prisma.scheduleEntry.findMany({
      where: {
        date: { gte: day, lt: tomorrow },
        ...(options.userId ? { user_id: options.userId } : {}),
        user: { active: true, role: { notIn: ["ZERO", "SUPER_ADMIN"] } },
      },
      include: {
        category: { include: { location: { select: { name: true } } } },
        location: { select: { name: true } },
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.attendanceLog.findMany({
      where: {
        date: { gte: day, lt: tomorrow },
        type: "ENTRATA",
        ...(options.userId ? { user_id: options.userId } : {}),
      },
      orderBy: { timestamp: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: {
        ...(options.userId ? { user_id: options.userId } : {}),
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
    const plannedEnd = schedule.end_time || schedule.category.end_time || null;
    const locationName = schedule.location?.name || schedule.category.location?.name || "";
    const { plannedMinutes, deadlineMinutes, officeFlexible } = scheduledEntryPolicy({ plannedStart, plannedEnd, locationName });
    if (
      plannedMinutes === null
      || deadlineMinutes === null
      || isRestSchedule(schedule.category.name, schedule.category.code)
      || isClosedSchedule(schedule.category.name, schedule.category.code)
      || approvedLeaveUserIds.has(schedule.user_id)
    ) return [];

    const firstEntry = firstEntryByUser.get(schedule.user_id);
    const observedInstant = firstEntry && options.userId === schedule.user_id && options.actualEntryTimestamp
      ? options.actualEntryTimestamp
      : firstEntry?.timestamp;
    const observedMinutes = observedInstant ? romeMinutesForInstant(observedInstant) : currentRomeMinutes(now);
    const delayMinutes = Math.max(0, observedMinutes - plannedMinutes);
    const minutesPastDeadline = Math.max(0, observedMinutes - deadlineMinutes);
    if (observedMinutes <= deadlineMinutes) return [];

    const endTime = minutesToClock(observedMinutes);
    const policyLabel = officeFlexible
      ? `ingresso flessibile fino alle 10:00 con ${ABSENCE_GRACE_MINUTES} minuti di tolleranza`
      : `tolleranza di ${ABSENCE_GRACE_MINUTES} minuti`;
    const reason = firstEntry
      ? `${AUTOMATIC_LATE_REASON_PREFIX}turno previsto ${plannedStart}–${plannedEnd || "--:--"}, ${policyLabel}; ingresso registrato ${endTime} (+${minutesPastDeadline} minuti oltre il limite, ${delayMinutes} dal turno previsto).`
      : `${AUTOMATIC_LATE_REASON_PREFIX}turno previsto ${plannedStart}–${plannedEnd || "--:--"}, ${policyLabel}; nessuna timbratura (+${minutesPastDeadline} minuti oltre il limite).`;
    return [{
      id: `auto-late:${schedule.user_id}:${dateKey}`,
      userId: schedule.user_id,
      userName: schedule.user.name,
      plannedStart: minutesToClock(deadlineMinutes),
      endTime,
      reason,
      delayMinutes,
      minutesPastDeadline,
    }];
  });

  if (candidates.length === 0) return { created: 0, updated: 0, lateRequests: [] };
  const existing = await prisma.leaveRequest.findMany({
    where: { id: { in: candidates.map((candidate) => candidate.id) } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((request) => request.id));
  const newCandidates = candidates.filter((candidate) => !existingIds.has(candidate.id));
  const detectedEntryCandidate = options.notifyOnDetectedEntry && options.userId
    ? candidates.find((candidate) => candidate.userId === options.userId)
    : null;

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

  // Se l'assenza automatica era già stata rifiutata prima dell'arrivo, la
  // timbratura reale la riapre come ritardo misurato e nuovamente approvabile.
  if (detectedEntryCandidate) {
    await prisma.leaveRequest.updateMany({
      where: { id: detectedEntryCandidate.id, status: { not: "APPROVED" } },
      data: {
        status: "PENDING",
        approved_by: null,
        approved_at: null,
        end_time: detectedEntryCandidate.endTime,
        reason: detectedEntryCandidate.reason,
        admin_note: "Ritardo aggiornato automaticamente al momento della timbratura reale.",
      },
    });
  }
  if (created.count > 0 || detectedEntryCandidate) {
    const admins = await prisma.user.findMany({
      where: { active: true, role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] } },
      select: { id: true },
    });
    const names = detectedEntryCandidate?.userName || newCandidates.map((candidate) => candidate.userName).join(", ");
    const title = detectedEntryCandidate
      ? `Ritardo di ${detectedEntryCandidate.minutesPastDeadline} min da approvare`
      : created.count === 1 ? "Ritardo da approvare" : `${created.count} ritardi da approvare`;
    const message = detectedEntryCandidate
      ? `${detectedEntryCandidate.userName} ha timbrato con ${detectedEntryCandidate.minutesPastDeadline} minuti oltre il limite. Il ritardo è stato registrato: apri Richieste per approvarlo o rifiutarlo.`
      : `Il confronto tra planning e timbrature ha rilevato: ${names}. Apri Richieste per approvare o rifiutare.`;
    await createNotifications(admins.map((admin) => ({
      id: randomUUID(),
      user_id: admin.id,
      title,
      message,
      type: "RICHIESTA",
      action_url: "/requests",
      read: false,
    })));
  }

  return {
    created: created.count,
    updated: candidates.length,
    lateRequests: candidates.map((candidate) => ({
      id: candidate.id,
      userId: candidate.userId,
      minutesPastDeadline: candidate.minutesPastDeadline,
      delayMinutes: candidate.delayMinutes,
      plannedStart: candidate.plannedStart,
      entryTime: candidate.endTime,
    })),
  };
}
