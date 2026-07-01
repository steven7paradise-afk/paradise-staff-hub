import { AttendanceType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { identifyWorkerByPin } from "@/lib/pin";
import { prisma } from "@/lib/prisma";
import { authorizedTablet, requestIp, tabletCookieName } from "@/lib/tablet-auth";

const statusByLastClock: Record<AttendanceType, "OUT" | "IN" | "BREAK"> = {
  ENTRATA: "IN",
  PAUSA: "BREAK",
  RIENTRO: "IN",
  USCITA: "OUT",
};

function durationHours(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  if (![startHour, startMinute, endHour, endMinute].every((value) => Number.isFinite(value))) return 0;
  return Math.max(0, (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 60);
}

function plannedHours(start: string | null, end: string | null, paidHours: number | null) {
  const rawHours = paidHours ?? durationHours(start, end);
  if (!rawHours) return 0;
  return rawHours >= 6 ? Math.round((rawHours - 1) * 100) / 100 : Math.round(rawHours * 100) / 100;
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const deviceId = String(payload.deviceId ?? request.headers.get("x-device-id") ?? "");
  const pin = String(payload.pin ?? "");
  if (!deviceId || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "Inserisci il codice personale." }, { status: 400 });
  }
  const device = await authorizedTablet(deviceId, request.cookies.get(tabletCookieName)?.value, requestIp(request.headers));
  if (!device) {
    return NextResponse.json({ error: "Dispositivo non autorizzato alla timbratura" }, { status: 403 });
  }
  const isOffice = device.location.name.toLowerCase().includes("ufficio");
  const worker = await identifyWorkerByPin(pin, device.location_id, isOffice);
  if (!worker) {
    return NextResponse.json({ error: isOffice ? "Codice personale non riconosciuto." : "Codice personale non riconosciuto in questo salone." }, { status: 401 });
  }
  const latestLog = await prisma.attendanceLog.findFirst({
    where: { user_id: worker.id },
    orderBy: { timestamp: "desc" },
    select: { type: true },
  });
  const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const today = new Date(`${localDay}T00:00:00.000Z`);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const todayLogs = await prisma.attendanceLog.findMany({
    where: { user_id: worker.id, date: { gte: today, lt: tomorrow } },
    select: { id: true, type: true, timestamp: true, time: true },
    orderBy: { timestamp: "asc" },
  });
  const todayShift = await prisma.scheduleEntry.findFirst({
    where: { user_id: worker.id, date: { gte: today, lt: tomorrow } },
    select: {
      start_time: true,
      end_time: true,
      location: { select: { name: true } },
      category: { select: { start_time: true, end_time: true, paid_hours: true } },
    },
  });
  const startTime = todayShift?.start_time ?? todayShift?.category.start_time ?? null;
  const endTime = todayShift?.end_time ?? todayShift?.category.end_time ?? null;

  return NextResponse.json({
    employeeId: worker.id,
    employeeName: worker.name,
    employeePhotoUrl: (worker as any).photo_url || null,
    employeeRole: (worker as any).role || "DIPENDENTE",
    employeeMansione: (worker as any).mansione || null,
    status: latestLog ? statusByLastClock[latestLog.type] : "OUT",
    todayShift: todayShift ? {
      startTime,
      endTime,
      plannedHours: plannedHours(startTime, endTime, todayShift.category.paid_hours),
      locationName: todayShift.location?.name ?? null,
    } : null,
    todayLogs: todayLogs.map((log) => ({ ...log, timestamp: log.timestamp.toISOString() })),
  });
}
