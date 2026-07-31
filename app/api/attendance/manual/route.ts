import { AttendanceType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendAttendanceToGoogleSheet } from "@/lib/google-sheet";
import { prisma } from "@/lib/prisma";
import { unlockWorkHourRecord } from "@/lib/work-hour-sync";

const allowedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }
  const data = await request.json();
  const userId = String(data.userId ?? "");
  const type = String(data.type ?? "") as AttendanceType;
  const timestamp = new Date(String(data.timestamp ?? ""));
  const note = String(data.note ?? "").trim();
  if (!userId || !Object.values(AttendanceType).includes(type) || Number.isNaN(timestamp.valueOf())) {
    return NextResponse.json({ error: "Inserisci lavoratore, tipo, data e ora." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { location: true } });
  if (!user || !user.sede_id || !user.location || ["ZERO", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Il lavoratore deve essere assegnato a un salone." }, { status: 400 });
  }

  const device = await prisma.device.upsert({
    where: { device_id: `ADMIN-MANUAL-${user.sede_id}` },
    update: { device_name: "Inserimento manuale Admin", location_id: user.sede_id },
    create: { device_id: `ADMIN-MANUAL-${user.sede_id}`, device_name: "Inserimento manuale Admin", location_id: user.sede_id, status: "BLOCKED" },
  });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(timestamp);
  const date = new Date(`${day}T00:00:00.000Z`);
  const time = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Rome" }).format(timestamp);
  const storedNote = `Inserita manualmente da Admin${note ? ` - ${note}` : ""}`;
  const log = await prisma.attendanceLog.create({
    data: { user_id: user.id, location_id: user.sede_id, device_id: device.id, type, timestamp, date, time, note: storedNote },
  });
  await unlockWorkHourRecord(user.id, timestamp);

  if (type !== "PAUSA") {
    let finalNote = storedNote;
    if (type === "RIENTRO") {
      const previousPause = await prisma.attendanceLog.findFirst({
        where: {
          user_id: user.id,
          type: "PAUSA",
          timestamp: { lt: timestamp },
        },
        orderBy: { timestamp: "desc" },
      });
      if (previousPause) {
        const breakDurationMs = timestamp.getTime() - previousPause.timestamp.getTime();
        const breakDurationMins = Math.round(breakDurationMs / (1000 * 60));
        const breakInfo = `Pausa durata: ${breakDurationMins} min`;
        finalNote = finalNote ? `${finalNote} - ${breakInfo}` : breakInfo;
      }
    }
    await appendAttendanceToGoogleSheet({
      date: new Intl.DateTimeFormat("it-IT").format(timestamp),
      time,
      employeeName: user.name,
      employeeEmail: user.email,
      locationName: user.location.name,
      type,
      deviceName: device.device_name,
      note: finalNote,
    });
  }

  return NextResponse.json({ ...log, recalculated: true }, { status: 201 });
}
