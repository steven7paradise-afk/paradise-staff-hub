import { createHmac, timingSafeEqual } from "node:crypto";
import { addAppointmentDays, appointmentDateKey, appointmentDayBoundaryIso } from "./appointment-date";

export const appointmentPcReceptionCookieName = "appointments_pc_reception_operator";

const PURPOSE = "paradise-pc-reception-v1";
const ID = /^[\w-]{1,160}$/;

function validTime(value: number) {
  return Number.isSafeInteger(value) && value >= 0 && Number.isFinite(new Date(value).getTime());
}

function dayExpiry(day: string) {
  return Date.parse(appointmentDayBoundaryIso(addAppointmentDays(day, 1)));
}

function signature(payload: string, deviceToken: string, secret: string) {
  return createHmac("sha256", secret).update(`${PURPOSE}:${deviceToken}:${payload}`).digest();
}

export function signAppointmentPcReception(
  userId: string,
  locationId: string,
  deviceToken: string,
  secret: string,
  now = Date.now(),
) {
  if (typeof userId !== "string" || !ID.test(userId) ||
      typeof locationId !== "string" || !ID.test(locationId) ||
      typeof deviceToken !== "string" || !deviceToken ||
      typeof secret !== "string" || !secret || !validTime(now)) {
    throw new Error("Dati sessione Reception non validi.");
  }
  const day = appointmentDateKey(new Date(now));
  const expiresAt = dayExpiry(day);
  const payload = `${userId}.${locationId}.${day}.${now}.${expiresAt}`;
  return {
    token: `${payload}.${signature(payload, deviceToken, secret).toString("base64url")}`,
    expiresAt,
    maxAge: Math.ceil((expiresAt - now) / 1000),
  };
}

export function verifyAppointmentPcReception(
  token: string | undefined,
  deviceToken: string | undefined,
  locationId: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): { userId: string; expiresAt: number } | null {
  if (!token || token.length > 512 || !deviceToken || !locationId || !secret || !validTime(now)) return null;
  const match = /^([\w-]{1,160})\.([\w-]{1,160})\.(\d{4}-\d{2}-\d{2})\.(\d{1,16})\.(\d{1,16})\.([\w-]{43})$/.exec(token);
  if (!match) return null;
  const [, userId, signedLocationId, day, issued, expiry, suppliedSignature] = match;
  const issuedAt = Number(issued);
  const expiresAt = Number(expiry);
  if (signedLocationId !== locationId || !validTime(issuedAt) || !validTime(expiresAt) ||
      String(issuedAt) !== issued || String(expiresAt) !== expiry ||
      issuedAt > now || expiresAt <= now || issuedAt >= expiresAt ||
      day !== appointmentDateKey(new Date(now)) ||
      day !== appointmentDateKey(new Date(issuedAt)) || expiresAt !== dayExpiry(day)) return null;
  const payload = `${userId}.${signedLocationId}.${day}.${issued}.${expiry}`;
  const expected = signature(payload, deviceToken, secret);
  const supplied = Buffer.from(suppliedSignature, "base64url");
  if (supplied.length !== expected.length || supplied.toString("base64url") !== suppliedSignature ||
      !timingSafeEqual(supplied, expected)) return null;
  return { userId, expiresAt };
}
