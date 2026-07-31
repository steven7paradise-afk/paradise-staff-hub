import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { authorizedTablet, requestIp, tabletCookieName } from "@/lib/tablet-auth";

export async function GET(request: NextRequest) {
  const employeeId = request.nextUrl.searchParams.get("employeeId");
  const deviceId = request.headers.get("x-device-id");

  if (!employeeId || !deviceId) {
    return NextResponse.json({ error: "Dipendente o dispositivo mancante" }, { status: 400 });
  }

  const device = await authorizedTablet(deviceId, request.cookies.get(tabletCookieName)?.value, requestIp(request.headers));
  if (!device) {
    return NextResponse.json({ error: "Dispositivo non autorizzato" }, { status: 403 });
  }

  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const today = new Date(`${day}T00:00:00.000Z`);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const logs = await prisma.attendanceLog.findMany({
    where: { user_id: employeeId, date: { gte: today, lt: tomorrow } },
    orderBy: { timestamp: "asc" },
    select: { type: true, timestamp: true, time: true },
  });

  if (logs.length === 0) {
    return NextResponse.json({ status: "OUT" });
  }

  const state = deriveAttendanceState(logs);
  const lastLog = state.lastValidLog;

  return NextResponse.json({
    status: state.status,
    lastType: lastLog?.type,
    lastTimestamp: lastLog?.timestamp,
    lastTime: lastLog?.time,
    invalidLogs: state.invalidLogs.length,
  });
}
