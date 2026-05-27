import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateClockHours } from "@/lib/work-hours";

const managementRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const year = Number(request.nextUrl.searchParams.get("year"));
  const month = Number(request.nextUrl.searchParams.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
    return NextResponse.json({ error: "Mese non valido." }, { status: 400 });
  }

  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  const [records, logs] = await Promise.all([
    prisma.workHourRecord.findMany({ where: { date: { gte: start, lt: end } } }),
    prisma.attendanceLog.findMany({
      where: { date: { gte: start, lt: end }, user: { role: { not: "SUPER_ADMIN" } } },
      select: { user_id: true, date: true, type: true, timestamp: true },
      orderBy: { timestamp: "asc" },
    }),
  ]);

  const clockGroups = new Map<string, typeof logs>();
  logs.forEach((log) => {
    const key = `${log.user_id}-${log.date.toISOString().slice(0, 10)}`;
    clockGroups.set(key, [...(clockGroups.get(key) ?? []), log]);
  });

  const stored = new Map(records.map((record) => [`${record.user_id}-${record.date.toISOString().slice(0, 10)}`, record]));
  const keys = new Set([...clockGroups.keys(), ...stored.keys()]);
  const rows = Array.from(keys).map((key) => {
    const record = stored.get(key);
    const clock = calculateClockHours(clockGroups.get(key) ?? []);
    const paidBreak = record?.paid_break ?? false;
    const automaticHours = paidBreak ? clock.grossHours : clock.netHours;
    return {
      key,
      userId: key.split("-").slice(0, -3).join("-"),
      date: key.slice(-10),
      hours: record?.manual_override ? record.hours : automaticHours,
      note: record?.note ?? "",
      paidBreak,
      manualOverride: record?.manual_override ?? false,
      ...clock,
    };
  });

  return NextResponse.json(rows);
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

  return NextResponse.json({ ...record, ...clock, hours: record.hours });
}
