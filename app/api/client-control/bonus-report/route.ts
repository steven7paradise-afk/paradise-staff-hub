import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { resolveCanonicalStaffName } from "@/lib/client-control-normalize";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";
import { isClosedSchedule } from "@/lib/scheduled-attendance";
import { scoreTeamBonusWorkers, type TeamBonusWorker } from "@/lib/team-bonus-report";
import { calculateClockHours } from "@/lib/work-hours";

export const dynamic = "force-dynamic";

const PAUSE_LATENESS_START_KEY = "2026-08-26";

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function truthy(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["true", "si", "sì", "yes", "1", "on", "fatto"].includes(String(value ?? "").trim().toLowerCase());
}

function names(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(names);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return names(record.name ?? record.label ?? record.value ?? "");
  }
  return String(value ?? "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
}

function minutes(value?: string | null) {
  if (!value) return null;
  const [hours, mins] = value.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(mins) ? hours * 60 + mins : null;
}

function romeMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return value("hour") * 60 + value("minute");
}

function isWorkCategory(category: { code: string; name: string }) {
  const code = category.code.toUpperCase();
  const name = category.name.toLowerCase();
  const excludedCodes = ["R", "RI", "R3", "F", "FE", "P", "PE", "M", "MA", "ML", "A", "AI", "NL", "ND", "NLA", "C", "CH", "C3"];
  const excludedNames = ["riposo", "ferie", "permesso", "malattia", "assenza", "chiuso", "non lavora", "no lavoro"];
  return !excludedCodes.includes(code) && !excludedNames.some((word) => name.includes(word));
}

function pauseDelayMinutes(logs: { type: string; timestamp: Date }[], limit: number) {
  const ordered = [...logs].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
  let pausedAt: Date | null = null;
  let delay = 0;
  for (const log of ordered) {
    if (log.type === "PAUSA") pausedAt = log.timestamp;
    if (log.type === "RIENTRO" && pausedAt) {
      delay += Math.max(0, Math.round((log.timestamp.getTime() - pausedAt.getTime()) / 60_000) - limit);
      pausedAt = null;
    }
    if ((log.type === "ENTRATA" || log.type === "USCITA") && pausedAt) pausedAt = null;
  }
  return delay;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true },
  });
  if (!accessUser || !await canAccessForUser(prisma, "/client-control", accessUser)) {
    return NextResponse.json({ error: "Non hai accesso a questo report." }, { status: 403 });
  }

  const month = Number(request.nextUrl.searchParams.get("month"));
  const year = Number(request.nextUrl.searchParams.get("year"));
  const requestedSalon = request.nextUrl.searchParams.get("salon")?.trim() || "Tutti";
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2024 || year > 2100) {
    return NextResponse.json({ error: "Mese o anno non valido." }, { status: 400 });
  }

  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const locationWhere = requestedSalon === "Tutti"
    ? { name: { startsWith: "Salone" } }
    : { name: requestedSalon };

  const workers = await prisma.user.findMany({
    where: {
      role: { notIn: ["ZERO", "SUPER_ADMIN"] },
      location: locationWhere,
      contract_start: { lt: periodEnd },
      OR: [{ contract_end: null }, { contract_end: { gte: periodStart } }],
    },
    select: { id: true, name: true, mansione: true, sede_id: true, location: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const workerIds = workers.map((worker) => worker.id);
  const workerNames = workers.map((worker) => worker.name);

  const [logs, schedules, responses, tasks, leaves, records, clockSettings] = await Promise.all([
    prisma.attendanceLog.findMany({ where: { user_id: { in: workerIds }, date: { gte: periodStart, lt: periodEnd } }, orderBy: { timestamp: "asc" } }),
    prisma.scheduleEntry.findMany({ where: { user_id: { in: workerIds }, date: { gte: periodStart, lt: periodEnd } }, include: { category: true } }),
    prisma.serviceFormResponse.findMany({ where: { created_at: { gte: periodStart, lt: periodEnd } }, include: { form: true } }),
    prisma.staffTask.findMany({
      where: { assignees: { some: { id: { in: workerIds } } }, completed_at: { gte: periodStart, lt: periodEnd } },
      select: { status: true, completed_at: true, assignees: { select: { id: true } } },
    }),
    prisma.leaveRequest.findMany({ where: { user_id: { in: workerIds }, status: "APPROVED", start_date: { lt: periodEnd }, end_date: { gte: periodStart } } }),
    prisma.workHourRecord.findMany({ where: { user_id: { in: workerIds }, date: { gte: periodStart, lt: periodEnd } } }),
    prisma.setting.findMany({ where: { key: { startsWith: "clock_rule:" } } }),
  ]);
  const validResponses = responses
    .filter((response) => isClientControlFormName(response.form.name, response.form.category))
    .filter((response) => String((response.answers as Record<string, unknown>)[CLIENT_CONTROL_FIELD_IDS.correctness] ?? "").trim().toLowerCase() !== "errore");

  const baseWorkers: TeamBonusWorker[] = workers.map((worker) => {
    const workerLogs = logs.filter((log) => log.user_id === worker.id);
    const logsByDay = new Map<string, typeof workerLogs>();
    workerLogs.forEach((log) => logsByDay.set(dayKey(log.date), [...(logsByDay.get(dayKey(log.date)) ?? []), log]));
    const workerLeaves = leaves.filter((leave) => leave.user_id === worker.id);
    const workerSchedules = schedules.filter((entry) => entry.user_id === worker.id && isWorkCategory(entry.category));
    const recordsByDay = new Map(records.filter((record) => record.user_id === worker.id).map((record) => [dayKey(record.date), record]));
    const attendance = workerSchedules.reduce((summary, entry) => {
      const key = dayKey(entry.date);
      const dayLogs = logsByDay.get(key) ?? [];
      const firstEntry = dayLogs.find((log) => log.type === "ENTRATA");
      const plannedStart = minutes(entry.start_time ?? entry.category.start_time);
      const lateMinutes = firstEntry && plannedStart !== null ? Math.max(0, romeMinutes(firstEntry.timestamp) - plannedStart) : 0;
      const breakLimit = parseClockRule(clockSettings.find((setting) => setting.key === clockRuleKey(entry.location_id ?? worker.sede_id ?? ""))?.value).breakDurationMinutes;
      const pauseDelay = key >= PAUSE_LATENESS_START_KEY ? pauseDelayMinutes(dayLogs, breakLimit) : 0;
      const hasLeave = workerLeaves.some((leave) => key >= dayKey(leave.start_date) && key <= dayKey(leave.end_date));
      const noShow = key < todayKey && !firstEntry && !hasLeave;
      const clock = calculateClockHours(dayLogs);
      const record = recordsByDay.get(key);
      const scheduledHours = entry.category.paid_hours ?? Math.max(0, ((minutes(entry.end_time ?? entry.category.end_time) ?? 0) - (plannedStart ?? 0)) / 60);
      const automaticHours = record?.paid_break ? clock.grossHours : clock.netHours;
      const closedHours = isClosedSchedule(entry.category.name, entry.category.code) ? scheduledHours : 0;
      summary.hours += record?.manual_override ? record.hours : Math.max(automaticHours, closedHours);
      if (firstEntry) summary.days += 1;
      if (lateMinutes > 10) { summary.lateDays += 1; summary.lateMinutes += lateMinutes; }
      if (pauseDelay > 0) { summary.lateReturns += 1; summary.lateReturnMinutes += pauseDelay; }
      if (noShow) summary.unjustifiedAbsences += 1;
      return summary;
    }, { days: 0, hours: 0, lateDays: 0, lateMinutes: 0, lateReturns: 0, lateReturnMinutes: 0, unjustifiedAbsences: 0 });

    const clientRows = validResponses.filter((response) => {
      const answers = response.answers as Record<string, unknown>;
      const selectedStaff = names(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
      const fallbackOwner = names(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
      const attributedNames = (selectedStaff.length ? selectedStaff : fallbackOwner).map((name) => resolveCanonicalStaffName(name, workerNames));
      const responseLocation = String(answers[CLIENT_CONTROL_FIELD_IDS.location] || response.user_location_name || "");
      return attributedNames.includes(worker.name) && (requestedSalon === "Tutti" || responseLocation === requestedSalon);
    });
    const client = clientRows.reduce((summary, response) => {
      const answers = response.answers as Record<string, unknown>;
      const before = truthy(answers[CLIENT_CONTROL_FIELD_IDS.beforeMedia]);
      const after = truthy(answers[CLIENT_CONTROL_FIELD_IDS.afterMedia]);
      if (before && after) summary.photos += 1;
      if (truthy(answers[CLIENT_CONTROL_FIELD_IDS.products])) summary.products += 1;
      if (truthy(answers[CLIENT_CONTROL_FIELD_IDS.review])) summary.reviews += 1;
      return summary;
    }, { photos: 0, products: 0, reviews: 0 });

    return {
      name: worker.name,
      role: worker.mansione || "Collaboratore",
      location: worker.location?.name || "Salone",
      days: attendance.days,
      scheduledDays: workerSchedules.length,
      hours: Math.round(attendance.hours * 10) / 10,
      clients: clientRows.length,
      photos: client.photos,
      products: client.products,
      reviews: client.reviews,
      lateDays: attendance.lateDays,
      lateMinutes: attendance.lateMinutes,
      lateReturns: attendance.lateReturns,
      lateReturnMinutes: attendance.lateReturnMinutes,
      unjustifiedAbsences: attendance.unjustifiedAbsences,
      completedTasks: tasks.filter((task) => task.status === "COMPLETED" && task.assignees.some((assignee) => assignee.id === worker.id)).length,
    };
  });

  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(periodStart);
  return NextResponse.json({
    month,
    year,
    monthLabel,
    salon: requestedSalon === "Tutti" ? "Tutti i saloni" : requestedSalon,
    generatedAt: new Date().toISOString(),
    workers: scoreTeamBonusWorkers(baseWorkers),
  });
}
