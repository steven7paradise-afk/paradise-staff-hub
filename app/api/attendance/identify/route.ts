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
  return NextResponse.json({
    employeeId: worker.id,
    employeeName: worker.name,
    employeePhotoUrl: (worker as any).photo_url || null,
    status: latestLog ? statusByLastClock[latestLog.type] : "OUT",
  });
}
