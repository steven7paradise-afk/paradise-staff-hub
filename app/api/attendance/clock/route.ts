import { NextRequest, NextResponse } from "next/server";
import { AttendanceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendAttendanceToGoogleSheet } from "@/lib/google-sheet";
import { applyEntranceRounding, applyExitRounding, clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import { authorizedTablet, requestIp, tabletCookieName } from "@/lib/tablet-auth";
import { isPinValidForUser } from "@/lib/pin";
import { createNotifications } from "@/lib/notifications";

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

  const isOffice = device.location.name.toLowerCase().includes("ufficio");
  if (!isOffice && user.sede_id && user.sede_id !== device.location_id) {
    return NextResponse.json({ error: "Dipendente non associato alla sede del tablet" }, { status: 403 });
  }

  const logLocationId = (isOffice && user.sede_id) ? user.sede_id : device.location_id;
  const logLocationName = (isOffice && user.location) ? user.location.name : device.location.name;

  const latestLog = await prisma.attendanceLog.findFirst({
    where: { user_id: user.id },
    orderBy: { timestamp: "desc" },
    select: { type: true, timestamp: true },
  });
  if (!permittedNextAction[latestLog?.type ?? "NONE"].includes(type)) {
    return NextResponse.json({ error: "Azione non valida per lo stato attuale del turno" }, { status: 409 });
  }

  const actualTimestamp = new Date();
  const savedRule = await prisma.setting.findUnique({ where: { key: clockRuleKey(logLocationId) } });
  const rule = parseClockRule(savedRule?.value);

  let timestamp = actualTimestamp;
  if (type === "ENTRATA" && rule.entranceRoundingMinutes > 0) {
    timestamp = applyEntranceRounding(actualTimestamp, rule.entranceRoundingMinutes);
  } else if (type === "USCITA" && rule.entranceRoundingMinutes > 0) {
    timestamp = applyExitRounding(actualTimestamp, rule.entranceRoundingMinutes);
  }

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
    : type === "USCITA" && rule.entranceRoundingMinutes > 0 && actualTime !== time
    ? `Ora rilevata ${actualTime}; arrotondamento uscita ${rule.entranceRoundingMinutes} min.`
    : null;
  const storedNote = [note, roundedNote].filter(Boolean).join(" - ") || null;

  const log = await prisma.attendanceLog.create({
    data: {
      user_id: user.id,
      location_id: logLocationId,
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

  // Check break limit on RIENTRO and notify admins/superadmins
  if (type === "RIENTRO" && latestLog?.timestamp) {
    const breakDurationMs = actualTimestamp.getTime() - latestLog.timestamp.getTime();
    const breakDurationMins = breakDurationMs / (1000 * 60);
    const breakLimit = rule.breakDurationMinutes;
    if (breakDurationMins > breakLimit) {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, active: true },
        select: { id: true },
      });
      await createNotifications(
        admins.map((admin) => ({
          user_id: admin.id,
          title: "Superamento Limite Pausa",
          message: `Il dipendente ${user.name} ha superato il limite di pausa di ${breakLimit} minuti (pausa effettuata: ${Math.round(breakDurationMins)} minuti).`,
          type: "TIMBRATURA",
          action_url: "/attendance",
        }))
      ).catch((err) => console.error("Failed to send break limit notifications:", err));
    }
  }

  await appendAttendanceToGoogleSheet({
    date: new Intl.DateTimeFormat("it-IT").format(timestamp),
    time,
    employeeName: user.name,
    employeeEmail: user.email,
    locationName: logLocationName,
    type,
    deviceName: device.device_name,
    note: storedNote,
  });

  return NextResponse.json({ id: log.id, type, time, adjusted: Boolean(roundedNote), actualTime });
}
