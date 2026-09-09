import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { NextRequest, NextResponse } from "next/server";
import {
  createPasskeyGrant,
  credentialIdFromString,
  isAdminRole,
  takeChallenge,
} from "@/lib/passkey";
import { prisma } from "@/lib/prisma";
import { authorizedTablet, requestIp, tabletCookieName } from "@/lib/tablet-auth";
import { expectedShiftEndTime, romeMinutesForInstant } from "@/lib/scheduled-attendance";

const statusByLastClock = {
  ENTRATA: "IN",
  PAUSA: "BREAK",
  RIENTRO: "IN",
  USCITA: "OUT",
} as const;

export async function POST(request: NextRequest) {
  const deviceId = request.headers.get("x-device-id") ?? "";
  const device = await authorizedTablet(
    deviceId,
    request.cookies.get(tabletCookieName)?.value,
    requestIp(request.headers),
  );
  if (!device) {
    return NextResponse.json({ error: "Tablet non autorizzato." }, { status: 403 });
  }

  const challenge = await takeChallenge({ purpose: "AUTHENTICATE", deviceId: device.id });
  if (!challenge) {
    return NextResponse.json({ error: "Scansione scaduta. Tocca nuovamente il logo." }, { status: 400 });
  }

  const payload = (await request.json()) as { response?: AuthenticationResponseJSON };
  if (!payload.response?.id) {
    return NextResponse.json({ error: "Risposta Face ID mancante." }, { status: 400 });
  }

  const credential = await prisma.webAuthnCredential.findUnique({
    where: { credential_id: payload.response.id },
    include: { user: true },
  });
  if (!credential || !credential.user.active || !isAdminRole(credential.user.role)) {
    return NextResponse.json({ error: "Volto non abilitato per l’accesso Admin." }, { status: 401 });
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: payload.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.origin,
      expectedRPID: challenge.rp_id,
      requireUserVerification: true,
      authenticator: {
        credentialID: credentialIdFromString(credential.credential_id),
        credentialPublicKey: new Uint8Array(credential.public_key),
        counter: Number(credential.counter),
        transports: credential.transports as AuthenticatorTransport[],
      },
    });
    if (!verification.verified || !verification.authenticationInfo.userVerified) {
      return NextResponse.json({ error: "Face ID non verificato." }, { status: 401 });
    }

    await prisma.webAuthnCredential.update({
      where: { id: credential.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        last_used_at: new Date(),
      },
    });

    const [attendanceToken, loginToken, latestLog] = await Promise.all([
      createPasskeyGrant(credential.user.id, "ATTENDANCE"),
      createPasskeyGrant(credential.user.id, "LOGIN"),
      prisma.attendanceLog.findFirst({
        where: { user_id: credential.user.id },
        orderBy: { timestamp: "desc" },
        select: { type: true },
      }),
    ]);

    const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
    const today = new Date(`${localDay}T00:00:00.000Z`);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const [todayLogs, todayShift] = await Promise.all([
      prisma.attendanceLog.findMany({
        where: { user_id: credential.user.id, date: { gte: today, lt: tomorrow } },
        select: { id: true, type: true, timestamp: true, time: true },
        orderBy: { timestamp: "asc" },
      }),
      prisma.scheduleEntry.findFirst({
        where: { user_id: credential.user.id, date: { gte: today, lt: tomorrow } },
        select: {
          start_time: true,
          end_time: true,
          location: { select: { name: true } },
          category: { select: { start_time: true, end_time: true, paid_hours: true } },
        },
      }),
    ]);

    const startTime = todayShift?.start_time ?? todayShift?.category.start_time ?? null;
    const endTime = todayShift?.end_time ?? todayShift?.category.end_time ?? null;
    const firstEntry = todayLogs.find((log) => log.type === "ENTRATA");
    const effectiveEndTime = expectedShiftEndTime({
      plannedStart: startTime,
      plannedEnd: endTime,
      locationName: todayShift?.location?.name ?? device.location.name,
      actualEntryMinutes: firstEntry ? romeMinutesForInstant(firstEntry.timestamp) : null,
    });

    return NextResponse.json({
      employeeId: credential.user.id,
      employeeName: credential.user.name,
      employeePhotoUrl: credential.user.photo_url,
      employeeRole: credential.user.role,
      employeeMansione: credential.user.mansione,
      status: latestLog ? statusByLastClock[latestLog.type] : "OUT",
      todayShift: todayShift ? {
        startTime,
        endTime: effectiveEndTime ?? endTime,
        locationName: todayShift.location?.name ?? null,
      } : null,
      todayLogs: todayLogs.map((log) => ({ ...log, timestamp: log.timestamp.toISOString() })),
      attendanceToken,
      loginToken,
    });
  } catch {
    return NextResponse.json({ error: "Face ID non riconosciuto." }, { status: 401 });
  }
}
