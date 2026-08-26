import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAutomaticLateReason } from "@/lib/automatic-late-requests";
import { prisma } from "@/lib/prisma";
import {
  ABSENCE_GRACE_MINUTES,
  currentRomeMinutes,
  expectedShiftEndTime,
  isClosedSchedule,
  isRestSchedule,
  romeMinutesForInstant,
  scheduledEntryPolicy,
} from "@/lib/scheduled-attendance";

const authorizedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

type HistoryEvent = {
  id: string;
  occurredAt: string;
  type: string;
  status: string;
  note: string;
  timeKnown?: boolean;
};

function requestStatusLabel(status: string) {
  if (status === "APPROVED") return "APPROVATA";
  if (status === "REJECTED") return "RIFIUTATA";
  if (status === "FLAGGED") return "SEGNALATA";
  return "IN ATTESA";
}

function requestTypeLabel(type: string, reason: string | null) {
  if (isAutomaticLateReason(reason)) return "Ritardo rilevato automaticamente";
  if (type === "FERIE") return "Richiesta ferie";
  if (type === "MALATTIA") return "Richiesta malattia";
  if (type === "PERMESSO") return "Richiesta permesso";
  if (type === "RIPOSO") return "Richiesta riposo";
  return "Richiesta personale";
}

function calendarDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function romeInstantForDayMinutes(dayKey: string, totalMinutes: number) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(noon);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value || 0);
  const representedAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  const offset = representedAsUtc - noon.getTime();
  return new Date(Date.UTC(year, month - 1, day, Math.floor(totalMinutes / 60), totalMinutes % 60) - offset);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !authorizedRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await context.params;
  const employee = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      sede_id: true,
      contract_start: true,
      contract_end: true,
      contract_history: true,
      location: { select: { name: true } },
    },
  });
  if (!employee) return NextResponse.json({ error: "Lavoratore non trovato" }, { status: 404 });
  if (session.user.role === "RESPONSABILE" && employee.sede_id !== session.user.sedeId) {
    return NextResponse.json({ error: "Lavoratore fuori dalla propria sede" }, { status: 403 });
  }

  const [requests, schedules, entryLogs] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { user_id: id },
      include: { approver: { select: { name: true } } },
      orderBy: { created_at: "desc" },
    }),
    prisma.scheduleEntry.findMany({
      where: { user_id: id, date: { gte: new Date("2026-08-01T00:00:00.000Z") } },
      include: { category: true, location: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 500,
    }),
    prisma.attendanceLog.findMany({
      where: { user_id: id, type: "ENTRATA", date: { gte: new Date("2026-08-01T00:00:00.000Z") } },
      orderBy: { timestamp: "asc" },
      take: 1000,
    }),
  ]);

  const events: HistoryEvent[] = [];
  if (employee.contract_start) {
    events.push({
      id: `contract-start-${employee.id}`,
      occurredAt: employee.contract_start.toISOString(),
      type: "Inizio contratto",
      status: employee.contract_end && employee.contract_end < new Date() ? "CONCLUSO" : "ATTIVO",
      note: employee.contract_end ? `Scadenza prevista ${employee.contract_end.toLocaleDateString("it-IT")}.` : "Contratto senza scadenza configurata.",
      timeKnown: false,
    });
  }

  const contractHistory = Array.isArray(employee.contract_history) ? employee.contract_history : [];
  contractHistory.forEach((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const item = raw as Record<string, unknown>;
    const start = calendarDate(String(item.startDate || item.inizio || ""));
    if (!start) return;
    events.push({
      id: `contract-renewal-${index}`,
      occurredAt: start.toISOString(),
      type: "Rinnovo contratto",
      status: String(item.status || "PIANIFICATO").toUpperCase(),
      note: String(item.note || item.notes || "Rinnovo registrato."),
      timeKnown: false,
    });
  });

  for (const request of requests) {
    const range = request.start_date.toISOString().slice(0, 10) === request.end_date.toISOString().slice(0, 10)
      ? request.start_date.toLocaleDateString("it-IT")
      : `${request.start_date.toLocaleDateString("it-IT")} – ${request.end_date.toLocaleDateString("it-IT")}`;
    events.push({
      id: `request-${request.id}`,
      occurredAt: request.created_at.toISOString(),
      type: requestTypeLabel(request.type, request.reason),
      status: requestStatusLabel(request.status),
      note: `${range}${request.start_time && request.end_time ? ` · ${request.start_time}–${request.end_time}` : ""}${request.reason ? ` · ${request.reason}` : ""}`,
    });
    if (request.status === "APPROVED" && request.approved_at) {
      events.push({
        id: `request-approved-${request.id}`,
        occurredAt: request.approved_at.toISOString(),
        type: request.type === "MALATTIA" && request.medical_code ? "Malattia giustificata" : `${requestTypeLabel(request.type, request.reason)} approvata`,
        status: "APPROVATA",
        note: `${request.approver?.name ? `Approvata da ${request.approver.name}. ` : ""}${request.medical_code ? `Protocollo medico: ${request.medical_code}.` : request.admin_note || ""}`.trim(),
      });
    } else if (request.type === "MALATTIA" && request.medical_code) {
      events.push({
        id: `sickness-justified-${request.id}`,
        occurredAt: request.created_at.toISOString(),
        type: "Malattia giustificata",
        status: "GIUSTIFICATA",
        note: `Protocollo medico: ${request.medical_code}.`,
      });
    }
  }

  const firstEntryByDay = new Map<string, (typeof entryLogs)[number]>();
  for (const log of entryLogs) {
    const key = log.date.toISOString().slice(0, 10);
    if (!firstEntryByDay.has(key)) firstEntryByDay.set(key, log);
  }
  const now = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
  for (const schedule of schedules) {
    if (isRestSchedule(schedule.category.name, schedule.category.code)) continue;
    if (isClosedSchedule(schedule.category.name, schedule.category.code)) continue;
    const plannedStart = schedule.start_time || schedule.category.start_time || null;
    const plannedEnd = schedule.end_time || schedule.category.end_time || null;
    const entryPolicy = scheduledEntryPolicy({
      plannedStart,
      plannedEnd,
      locationName: schedule.location?.name || employee.location?.name,
    });
    if (entryPolicy.plannedMinutes === null || entryPolicy.deadlineMinutes === null) continue;
    const dayKey = schedule.date.toISOString().slice(0, 10);
    const approvedAbsence = requests.some((request) =>
      request.status === "APPROVED"
      && ["FERIE", "MALATTIA", "RIPOSO"].includes(request.type)
      && request.start_date <= schedule.date
      && request.end_date >= schedule.date
    );
    if (approvedAbsence) continue;
    const entry = firstEntryByDay.get(dayKey);
    if (entry) {
      const actualMinutes = romeMinutesForInstant(entry.timestamp);
      const delay = Math.max(0, actualMinutes - entryPolicy.deadlineMinutes);
      if (delay > 0) {
        const expectedEnd = expectedShiftEndTime({
          plannedStart,
          plannedEnd,
          locationName: schedule.location?.name || employee.location?.name,
          actualEntryMinutes: actualMinutes,
        });
        events.push({
          id: `late-entry-${entry.id}`,
          occurredAt: entry.timestamp.toISOString(),
          type: "Entrata in ritardo",
          status: "RITARDO",
          note: `Turno previsto ${plannedStart}–${plannedEnd || "--:--"}${entryPolicy.officeFlexible ? "; ingresso flessibile consentito fino alle 10:00" : `; tolleranza ${ABSENCE_GRACE_MINUTES} minuti`}. Entrata ${entry.time || `${String(Math.floor(actualMinutes / 60)).padStart(2, "0")}:${String(actualMinutes % 60).padStart(2, "0")}`} · +${delay} minuti oltre il limite${entryPolicy.officeFlexible && expectedEnd ? ` · uscita prevista ${expectedEnd}` : ""}.`,
        });
      }
      continue;
    }

    const overdue = dayKey < todayKey || (dayKey === todayKey && currentRomeMinutes(now) > entryPolicy.deadlineMinutes);
    if (overdue) {
      events.push({
        id: `missing-entry-${schedule.id}`,
        occurredAt: romeInstantForDayMinutes(dayKey, entryPolicy.deadlineMinutes).toISOString(),
        type: "Mancata timbratura",
        status: "ASSENTE",
        note: `Turno previsto ${plannedStart}–${plannedEnd || "--:--"}${entryPolicy.officeFlexible ? "; ingresso consentito fino alle 10:00" : `; tolleranza ${ABSENCE_GRACE_MINUTES} minuti`}. Nessuna entrata registrata.`,
      });
    }
  }

  events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return NextResponse.json({ events });
}
