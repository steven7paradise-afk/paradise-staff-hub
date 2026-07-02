import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateClockHours } from "@/lib/work-hours";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function categoryDuration(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  const [startHours, startMinutes] = start.split(":").map(Number);
  const [endHours, endMinutes] = end.split(":").map(Number);
  return Math.max(0, (endHours * 60 + endMinutes - startHours * 60 - startMinutes) / 60);
}

function isWorkCategory(category: { code: string; name: string }) {
  const code = category.code.toUpperCase();
  const name = category.name.toLowerCase();
  if (
    code === "R" || code === "RI" || code === "R3" ||
    code === "F" || code === "FE" ||
    code === "P" || code === "PE" ||
    code === "M" || code === "MA" || code === "ML" ||
    code === "A" || code === "AI" || code === "NL" || code === "ND" ||
    name.includes("riposo") ||
    name.includes("ferie") ||
    name.includes("permesso") ||
    name.includes("malattia") ||
    name.includes("assenza") ||
    name.includes("non lavora")
  ) {
    return false;
  }
  return true;
}

const managementRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403, headers: noStoreHeaders });
  }

  const year = Number(request.nextUrl.searchParams.get("year"));
  const month = Number(request.nextUrl.searchParams.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
    return NextResponse.json({ error: "Mese non valido." }, { status: 400, headers: noStoreHeaders });
  }

  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  const [records, logs, scheduleEntries] = await Promise.all([
    prisma.workHourRecord.findMany({ where: { date: { gte: start, lt: end } } }),
    prisma.attendanceLog.findMany({
      where: { date: { gte: start, lt: end }, user: { role: { not: "SUPER_ADMIN" } } },
      select: { user_id: true, date: true, type: true, timestamp: true },
      orderBy: { timestamp: "asc" },
    }),
    prisma.scheduleEntry.findMany({
      where: { date: { gte: start, lt: end }, user: { role: { not: "SUPER_ADMIN" } } },
      include: { category: true },
    }),
  ]);

  const clockGroups = new Map<string, typeof logs>();
  logs.forEach((log) => {
    const key = `${log.user_id}-${log.date.toISOString().slice(0, 10)}`;
    clockGroups.set(key, [...(clockGroups.get(key) ?? []), log]);
  });

  const scheduleGroups = new Map<string, typeof scheduleEntries[0]>();
  scheduleEntries.forEach((entry) => {
    const key = `${entry.user_id}-${entry.date.toISOString().slice(0, 10)}`;
    scheduleGroups.set(key, entry);
  });

  const stored = new Map(records.map((record) => [`${record.user_id}-${record.date.toISOString().slice(0, 10)}`, record]));
  const keys = new Set([...clockGroups.keys(), ...stored.keys(), ...scheduleGroups.keys()]);
  const rows = Array.from(keys).map((key) => {
    const record = stored.get(key);
    const clock = calculateClockHours(clockGroups.get(key) ?? []);
    const paidBreak = record?.paid_break ?? false;
    const automaticHours = paidBreak ? clock.grossHours : clock.netHours;

    const schedule = scheduleGroups.get(key);
    let scheduledHours = 0;
    let plannedStart: string | null = null;
    let plannedEnd: string | null = null;
    if (schedule) {
      plannedStart = schedule.start_time ?? schedule.category.start_time;
      plannedEnd = schedule.end_time ?? schedule.category.end_time;
      if (isWorkCategory(schedule.category)) {
        scheduledHours = schedule.category.paid_hours ?? categoryDuration(plannedStart, plannedEnd);
      }
    }

    return {
      key,
      userId: key.split("-").slice(0, -3).join("-"),
      date: key.slice(-10),
      hours: record?.manual_override ? record.hours : automaticHours,
      note: record?.note ?? "",
      paidBreak,
      manualOverride: record?.manual_override ?? false,
      scheduledHours,
      plannedStart,
      plannedEnd,
      ...clock,
    };
  });

  return NextResponse.json(rows, { headers: noStoreHeaders });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json();
  const userId = String(payload.userId ?? "");
  const date = new Date(String(payload.date ?? ""));
  const hours = Number(payload.hours ?? 0);
  const note = String(payload.note ?? "").trim();
  const paidBreak = Boolean(payload.paidBreak);
  const manualOverride = Boolean(payload.manualOverride);

  if (!userId || Number.isNaN(date.valueOf()) || Number.isNaN(hours) || hours < 0 || hours > 24) {
    return NextResponse.json({ error: "Dati ore non validi." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Lavoratore non valido." }, { status: 404 });
  }

  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  const logs = await prisma.attendanceLog.findMany({
    where: { user_id: userId, date: { gte: dayStart, lt: dayEnd } },
    select: { type: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });
  const clock = calculateClockHours(logs);
  const computedHours = paidBreak ? clock.grossHours : clock.netHours;

  const record = await prisma.workHourRecord.upsert({
    where: { user_id_date: { user_id: userId, date } },
    update: { hours: manualOverride ? hours : computedHours, note: note || null, paid_break: paidBreak, manual_override: manualOverride, updated_by: session.user.id },
    create: { user_id: userId, date, hours: manualOverride ? hours : computedHours, note: note || null, paid_break: paidBreak, manual_override: manualOverride, updated_by: session.user.id },
  });

  return NextResponse.json({
    id: record.id,
    userId: record.user_id,
    date: record.date,
    hours: record.hours,
    note: record.note ?? "",
    paidBreak: record.paid_break,
    manualOverride: record.manual_override,
    ...clock,
  });
}
