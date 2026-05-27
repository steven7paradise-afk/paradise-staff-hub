import { NextRequest, NextResponse } from "next/server";
import { AttendanceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendAttendanceToGoogleSheet } from "@/lib/google-sheet";
import { applyEntranceRounding, clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import { authorizedTablet, requestIp, tabletCookieName } from "@/lib/tablet-auth";
import { isPinValidForUser } from "@/lib/pin";

const permittedNextAction: Record<AttendanceType | "NONE", AttendanceType[]> = {
  NONE: ["ENTRATA"],
  ENTRATA: ["PAUSA", "USCITA"],
  PAUSA: ["RIENTRO", "USCITA"],
  RIENTRO: ["PAUSA", "USCITA"],
  USCITA: ["ENTRATA"],
};

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const deviceHeader = request.headers.get("x-device-id");
  const deviceId = String(payload.deviceId ?? deviceHeader ?? "");
  const employeeId = String(payload.employeeId ?? "");
  const pin = String(payload.pin ?? "");
  const type = String(payload.type ?? "") as AttendanceType;
  const note = payload.note ? String(payload.note) : null;
  const ip = requestIp(request.headers);

  if (!deviceId || !employeeId || !/^\d{4,6}$/.test(pin) || !Object.values(AttendanceType).includes(type)) {
    return NextResponse.json({ error: "Dati timbratura incompleti" }, { status: 400 });
  }

  const device = await authorizedTablet(deviceId, request.cookies.get(tabletCookieName)?.value, ip);
  if (!device) {
    return NextResponse.json({ error: "Dispositivo non autorizzato alla timbratura" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { id: employeeId }, include: { location: true } });
  if (!user?.active || !user.pin_hash) {
    return NextResponse.json({ error: "Dipendente non abilitato alla timbratura" }, { status: 403 });
  }

  const pinValid = await isPinValidForUser(user.id, pin, user.pin_hash, user.pin_lookup);
  if (!pinValid) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }

  if (user.sede_id && user.sede_id !== device.location_id) {
    return NextResponse.json({ error: "Dipendente non associato alla sede del tablet" }, { status: 403 });
  }

  const latestLog = await prisma.attendanceLog.findFirst({
    where: { user_id: user.id },
    orderBy: { timestamp: "desc" },
    select: { type: true },
  });
  if (!permittedNextAction[latestLog?.type ?? "NONE"].includes(type)) {
    return NextResponse.json({ error: "Azione non valida per lo stato attuale del turno" }, { status: 409 });
  }

  const actualTimestamp = new Date();
  const savedRule = type === "ENTRATA" ? await prisma.setting.findUnique({ where: { key: clockRuleKey(device.location_id) } }) : null;
  const rule = parseClockRule(savedRule?.value);
  const timestamp = type === "ENTRATA" ? applyEntranceRounding(actualTimestamp, rule.entranceRoundingMinutes) : actualTimestamp;
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(timestamp);
  const dateOnly = new Date(`${localDate}T00:00:00.000Z`);
  const time = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Rome",
  }).format(timestamp);
  const actualTime = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Rome",
  }).format(actualTimestamp);
  const roundedNote = type === "ENTRATA" && rule.entranceRoundingMinutes > 0 && actualTime !== time
    ? `Ora rilevata ${actualTime}; arrotondamento entrata ${rule.entranceRoundingMinutes} min.`
    : null;
  const storedNote = [note, roundedNote].filter(Boolean).join(" - ") || null;

  const log = await prisma.attendanceLog.create({
    data: {
      user_id: user.id,
      location_id: device.location_id,
      device_id: device.id,
      type,
      timestamp,
      date: dateOnly,
      time,
      ip_address: ip,
      note: storedNote,
    },
  });

  await prisma.device.update({
    where: { id: device.id },
    data: { last_used_at: actualTimestamp },
  });

  await appendAttendanceToGoogleSheet({
    date: new Intl.DateTimeFormat("it-IT").format(timestamp),
    time,
    employeeName: user.name,
    employeeEmail: user.email,
    locationName: device.location.name,
    type,
    deviceName: device.device_name,
    note: storedNote,
  });

  return NextResponse.json({ id: log.id, type, time, adjusted: Boolean(roundedNote), actualTime });
}
