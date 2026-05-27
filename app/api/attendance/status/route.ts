import { NextRequest, NextResponse } from "next/server";
import { AttendanceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorizedTablet, requestIp, tabletCookieName } from "@/lib/tablet-auth";

const statusByLastClock: Record<AttendanceType, "OUT" | "IN" | "BREAK"> = {
  ENTRATA: "IN",
  PAUSA: "BREAK",
  RIENTRO: "IN",
  USCITA: "OUT",
};

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

  const latestLog = await prisma.attendanceLog.findFirst({
    where: { user_id: employeeId },
    orderBy: { timestamp: "desc" },
    select: { type: true, timestamp: true, time: true },
  });

  if (!latestLog) {
    return NextResponse.json({ status: "OUT" });
  }

  return NextResponse.json({
    status: statusByLastClock[latestLog.type],
    lastType: latestLog.type,
    lastTimestamp: latestLog.timestamp,
    lastTime: latestLog.time,
  });
}
