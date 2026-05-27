import { AttendanceType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendAttendanceToGoogleSheet } from "@/lib/google-sheet";
import { prisma } from "@/lib/prisma";

const allowedRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await params;
  const data = await request.json();
  const userId = String(data.userId ?? "");
  const type = String(data.type ?? "") as AttendanceType;
  const timestamp = new Date(String(data.timestamp ?? ""));
  const note = String(data.note ?? "").trim();
  if (!userId || !Object.values(AttendanceType).includes(type) || Number.isNaN(timestamp.valueOf())) {
    return NextResponse.json({ error: "Inserisci lavoratore, tipo, data e ora." }, { status: 400 });
  }

  const [existing, user] = await Promise.all([
    prisma.attendanceLog.findUnique({ where: { id } }),
    prisma.user.findUnique({ where: { id: userId }, include: { location: true } }),
  ]);
  if (!existing) return NextResponse.json({ error: "Timbratura non trovata." }, { status: 404 });
  if (!user || !user.sede_id || !user.location || user.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Il lavoratore deve essere assegnato a un salone." }, { status: 400 });
  }

  const device = await prisma.device.upsert({
    where: { device_id: `ADMIN-MANUAL-${user.sede_id}` },
    update: { device_name: "Correzione manuale Admin", location_id: user.sede_id },
    create: { device_id: `ADMIN-MANUAL-${user.sede_id}`, device_name: "Correzione manuale Admin", location_id: user.sede_id, status: "BLOCKED" },
  });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(timestamp);
  const date = new Date(`${day}T00:00:00.000Z`);
  const time = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Rome" }).format(timestamp);
  const storedNote = `Modificata manualmente da Admin${note ? ` - ${note}` : ""}`;
  const log = await prisma.attendanceLog.update({
    where: { id },
    data: { user_id: user.id, location_id: user.sede_id, device_id: device.id, type, timestamp, date, time, note: storedNote },
  });

  await appendAttendanceToGoogleSheet({
    date: new Intl.DateTimeFormat("it-IT").format(timestamp),
    time,
    employeeName: user.name,
    employeeEmail: user.email,
    locationName: user.location.name,
    type,
    deviceName: device.device_name,
    note: `[CORREZIONE ${id}] ${storedNote}`,
  });
  return NextResponse.json(log);
}
