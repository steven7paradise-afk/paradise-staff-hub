import { NextRequest, NextResponse } from "next/server";
import { LeaveType } from "@prisma/client";
import { emailTemplates, sendEmail } from "@/lib/email";
import { identifyWorkerByPin } from "@/lib/pin";
import { prisma } from "@/lib/prisma";
import { syncLeaveRequestToGoogleCalendar } from "@/lib/google-calendar";
import { authorizedTablet, requestIp, tabletCookieName } from "@/lib/tablet-auth";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const deviceId = String(payload.deviceId ?? request.headers.get("x-device-id") ?? "");
  const pin = String(payload.pin ?? "");
  const type = String(payload.type ?? "FERIE") as LeaveType;
  const startDate = new Date(String(payload.startDate));
  const endDate = new Date(String(payload.endDate));
  const reason = payload.reason ? String(payload.reason) : null;
  const startTime = payload.startTime ? String(payload.startTime) : null;
  const endTime = payload.endTime ? String(payload.endTime) : null;

  if (!deviceId || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "Dispositivo o codice personale mancanti" }, { status: 400 });
  }

  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if ((startTime || endTime) && (!startTime || !endTime || !timePattern.test(startTime) || !timePattern.test(endTime))) {
    return NextResponse.json({ error: "Inserisci ora e minuti nel formato corretto." }, { status: 400 });
  }
  if (startDate.getTime() === endDate.getTime() && startTime && endTime && endTime <= startTime) {
    return NextResponse.json({ error: "L'orario finale deve essere dopo l'orario iniziale." }, { status: 400 });
  }

  if (!Object.values(LeaveType).includes(type) || Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || endDate < startDate) {
    return NextResponse.json({ error: "Periodo o tipo richiesta non valido" }, { status: 400 });
  }

  const device = await authorizedTablet(deviceId, request.cookies.get(tabletCookieName)?.value, requestIp(request.headers));
  if (!device) {
    return NextResponse.json({ error: "Dispositivo non autorizzato alla richiesta" }, { status: 403 });
  }

  const isOffice = device.location.name.toLowerCase().includes("ufficio");
  const recognized = await identifyWorkerByPin(pin, device.location_id, isOffice);
  if (!recognized) {
    return NextResponse.json({ error: "Codice personale non valido" }, { status: 401 });
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: recognized.id } });

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      user_id: user.id,
      type,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      reason,
    },
  });

  const admins = await prisma.user.findMany({
    where: { active: true, role: { in: ["SUPER_ADMIN", "ADMIN"] } },
    select: { email: true },
  });

  const template = emailTemplates.leaveRequestReceived(
    user.name,
    type,
    startDate,
    endDate,
    reason
  );
  await Promise.allSettled(admins.map((admin) => sendEmail({ to: admin.email, ...template })));

  try {
    await syncLeaveRequestToGoogleCalendar(leaveRequest.id);
  } catch (error) {
    console.error("Failed to sync tablet request to Google Calendar:", error);
  }

  return NextResponse.json({ id: leaveRequest.id, status: leaveRequest.status });
}
