import { NextRequest, NextResponse } from "next/server";
import { LeaveType } from "@prisma/client";
import { emailTemplates, sendEmail } from "@/lib/email";
import { identifyWorkerByPin } from "@/lib/pin";
import { prisma } from "@/lib/prisma";
import { authorizedTablet, requestIp, tabletCookieName } from "@/lib/tablet-auth";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const deviceId = String(payload.deviceId ?? request.headers.get("x-device-id") ?? "");
  const pin = String(payload.pin ?? "");
  const type = String(payload.type ?? "FERIE") as LeaveType;
  const startDate = new Date(String(payload.startDate));
  const endDate = new Date(String(payload.endDate));
  const reason = payload.reason ? String(payload.reason) : null;

  if (!deviceId || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "Dispositivo o codice personale mancanti" }, { status: 400 });
  }

  if (!Object.values(LeaveType).includes(type) || Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || endDate < startDate) {
    return NextResponse.json({ error: "Periodo o tipo richiesta non valido" }, { status: 400 });
  }

  const device = await authorizedTablet(deviceId, request.cookies.get(tabletCookieName)?.value, requestIp(request.headers));
  if (!device) {
    return NextResponse.json({ error: "Dispositivo non autorizzato alla richiesta" }, { status: 403 });
  }

  const recognized = await identifyWorkerByPin(pin, device.location_id);
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
      reason,
    },
  });

  const admins = await prisma.user.findMany({
    where: { active: true, role: { in: ["SUPER_ADMIN", "ADMIN"] } },
    select: { email: true },
  });

  const template = emailTemplates.leaveRequestReceived(user.name);
  await Promise.allSettled(admins.map((admin) => sendEmail({ to: admin.email, ...template })));

  return NextResponse.json({ id: leaveRequest.id, status: leaveRequest.status });
}
