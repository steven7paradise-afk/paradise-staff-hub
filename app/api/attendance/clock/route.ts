import { NextRequest, NextResponse } from "next/server";
import { AttendanceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendAttendanceToGoogleSheet } from "@/lib/google-sheet";
import { deriveAttendanceState, permittedAttendanceActions } from "@/lib/attendance-state";
import { applyExitRounding, applyParadiseEntranceRounding, clockRuleKey, localWeekRange, parseClockRule } from "@/lib/clock-rules";
import { authorizedTablet, requestIp, tabletCookieName } from "@/lib/tablet-auth";
import { isPinValidForUser } from "@/lib/pin";
import { createNotifications } from "@/lib/notifications";

const PAUSE_LATENESS_START_KEY = "2026-08-26";

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

  const logLocationId = (isOffice && user.sede_id) ? user.sede_id : device.location_id;
  const logLocationName = (isOffice && user.location) ? user.location.name : device.location.name;
  const actualTimestamp = new Date();
  const actualLocalDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(actualTimestamp);
  const actualDateOnly = new Date(`${actualLocalDate}T00:00:00.000Z`);
  const actualTomorrow = new Date(actualDateOnly);
  actualTomorrow.setUTCDate(actualTomorrow.getUTCDate() + 1);

  const latestLog = await prisma.attendanceLog.findFirst({
    where: { user_id: user.id },
    orderBy: { timestamp: "desc" },
    select: { type: true, timestamp: true },
  });
  const currentRomeHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: "Europe/Rome",
    }).format(actualTimestamp)
  );

  const yesterdayDateOnly = new Date(actualDateOnly);
  yesterdayDateOnly.setUTCDate(yesterdayDateOnly.getUTCDate() - 1);

  let shiftDateOnly = actualDateOnly;
  let shiftLogs = await prisma.attendanceLog.findMany({
    where: { user_id: user.id, date: { gte: actualDateOnly, lt: actualTomorrow } },
    orderBy: { timestamp: "asc" },
    select: { type: true, timestamp: true },
  });

  // Early morning (00:00 - 06:00): exits/breaks belong to yesterday if that shift is still open.
  if (currentRomeHour < 6 && (type === "USCITA" || type === "PAUSA")) {
    const yesterdayLogs = await prisma.attendanceLog.findMany({
      where: { user_id: user.id, date: { gte: yesterdayDateOnly, lt: actualDateOnly } },
      orderBy: { timestamp: "asc" },
      select: { type: true, timestamp: true },
    });
    const yesterdayState = deriveAttendanceState(yesterdayLogs);
    if (yesterdayState.status === "IN" || yesterdayState.status === "BREAK") {
      shiftDateOnly = yesterdayDateOnly;
      shiftLogs = [...yesterdayLogs, ...shiftLogs];
    }
  }

  const currentState = deriveAttendanceState(shiftLogs);
  const allowedActions = permittedAttendanceActions(currentState.status) as AttendanceType[];
  if (!allowedActions.includes(type)) {
    return NextResponse.json({ error: "Azione non valida per lo stato attuale del turno" }, { status: 409 });
  }

  // Cooldown check (5 seconds)
  if (latestLog) {
    const secondsSinceLastLog = (actualTimestamp.getTime() - new Date(latestLog.timestamp).getTime()) / 1000;
    if (secondsSinceLastLog < 5) {
      return NextResponse.json(
        { error: "Attendi qualche secondo prima di effettuare un'altra timbratura." },
        { status: 429 }
      );
    }
  }

  const savedRule = await prisma.setting.findUnique({ where: { key: clockRuleKey(logLocationId) } });
  const rule = parseClockRule(savedRule?.value);

  let timestamp = actualTimestamp;
  let usedEntranceGrace = false;
  if (type === "ENTRATA") {
    const rounded = applyParadiseEntranceRounding(actualTimestamp);
    timestamp = rounded.timestamp;
    usedEntranceGrace = rounded.usedGrace;
  } else if (type === "USCITA" && rule.entranceRoundingMinutes > 0) {
    timestamp = applyExitRounding(actualTimestamp, rule.entranceRoundingMinutes);
  }

  const dateOnly = shiftDateOnly;

  // Same day ENTRATA after USCITA check
  if (type === "ENTRATA") {
    const hasUscitaToday = await prisma.attendanceLog.findFirst({
      where: {
        user_id: user.id,
        type: "USCITA",
        date: dateOnly,
      },
    });

    if (hasUscitaToday) {
      return NextResponse.json(
        { error: "Hai già registrato un'uscita oggi. Non puoi effettuare un'altra entrata nello stesso giorno." },
        { status: 400 }
      );
    }
  }
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
  let breakDurationMins: number | null = null;
  let breakDelayMins = 0;
  if (type === "RIENTRO" && currentState.activePause?.timestamp) {
    const rawDurationMins = (actualTimestamp.getTime() - currentState.activePause.timestamp.getTime()) / (1000 * 60);
    breakDurationMins = Math.ceil(rawDurationMins);
    if (actualLocalDate >= PAUSE_LATENESS_START_KEY && rawDurationMins > rule.breakDurationMinutes) {
      breakDelayMins = Math.ceil(rawDurationMins - rule.breakDurationMinutes);
    }
  }
  const roundedNote = type === "ENTRATA" && actualTime !== time
    ? `Ora rilevata ${actualTime}; arrotondamento entrata Paradise a ${time}${usedEntranceGrace ? "; tolleranza entrata usata" : ""}.`
    : type === "USCITA" && rule.entranceRoundingMinutes > 0 && actualTime !== time
    ? `Ora rilevata ${actualTime}; arrotondamento uscita ${rule.entranceRoundingMinutes} min.`
    : null;
  const nightNote = shiftDateOnly !== actualDateOnly ? `Timbratura notturna associata al turno del ${new Intl.DateTimeFormat("it-IT").format(shiftDateOnly)}.` : null;
  const tabletNote = `Timbrato su: ${device.device_name} (${device.location.name})`;
  const lateBreakNote = breakDelayMins > 0 && breakDurationMins !== null
    ? `Rientro pausa in ritardo: durata ${breakDurationMins} min; limite ${rule.breakDurationMinutes} min; ritardo ${breakDelayMins} min.`
    : null;
  const storedNote = [note, roundedNote, nightNote, tabletNote, lateBreakNote].filter(Boolean).join(" - ") || null;

  const log = await prisma.attendanceLog.create({
    data: {
      user_id: user.id,
      location_id: logLocationId,
      device_id: device.id,
      type,
      timestamp,
      date: shiftDateOnly,
      time,
      ip_address: ip,
      note: storedNote,
    },
  });

  await prisma.device.update({
    where: { id: device.id },
    data: { last_used_at: actualTimestamp },
  });

  if (type === "ENTRATA" && usedEntranceGrace) {
    const { start, end } = localWeekRange(actualTimestamp);
    const weeklyGraceCount = await prisma.attendanceLog.count({
      where: {
        user_id: user.id,
        type: "ENTRATA",
        date: { gte: start, lt: end },
        note: { contains: "tolleranza entrata usata" },
      },
    });

    if (weeklyGraceCount > 5) {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, active: true },
        select: { id: true },
      });
      await createNotifications(
        admins.map((admin) => ({
          user_id: admin.id,
          title: "Tolleranze entrata superate",
          message: `${user.name} ha usato ${weeklyGraceCount} tolleranze di entrata questa settimana. Ora rilevata ${actualTime}, registrata ${time}.`,
          type: "TIMBRATURA",
          action_url: "/attendance",
        })),
      ).catch((err) => console.error("Failed to send entrance grace notifications:", err));
    }
  }

  // Check break limit on RIENTRO and notify admins/superadmins
  if (type === "RIENTRO" && breakDelayMins > 0 && breakDurationMins !== null) {
    const breakLimit = rule.breakDurationMinutes;
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, active: true },
      select: { id: true },
    });
    await createNotifications(
      admins.map((admin) => ({
        user_id: admin.id,
        title: "Rientro pausa in ritardo",
        message: `${user.name} è rientrato con ${breakDelayMins} minuti di ritardo. Pausa: ${breakDurationMins} minuti, limite: ${breakLimit} minuti.`,
        type: "TIMBRATURA",
        action_url: `/staff?employee=${encodeURIComponent(user.id)}`,
      }))
    ).catch((err) => console.error("Failed to send break limit notifications:", err));
  }

  if (type !== "PAUSA") {
    let finalNote = storedNote;
    if (type === "RIENTRO" && breakDurationMins !== null) {
      const breakInfo = `Pausa durata: ${breakDurationMins} min`;
      finalNote = finalNote ? `${finalNote} - ${breakInfo}` : breakInfo;
    }
    appendAttendanceToGoogleSheet({
      date: new Intl.DateTimeFormat("it-IT").format(timestamp),
      time,
      employeeName: user.name,
      employeeEmail: user.email,
      locationName: logLocationName,
      type,
      deviceName: device.device_name,
      note: finalNote,
    }).catch((err) => {
      console.error("Failed to append to Google Sheet asynchronously:", err);
    });
  }

  return NextResponse.json({ id: log.id, type, time, timestamp: log.timestamp.toISOString(), adjusted: Boolean(roundedNote), actualTime });
}
