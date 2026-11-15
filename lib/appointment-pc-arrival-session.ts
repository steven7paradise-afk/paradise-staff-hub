import { createHmac, timingSafeEqual } from "node:crypto";
import { APPOINTMENT_IDLE_TIMEOUT_MS } from "./appointment-idle-session";

export const appointmentPcArrivalCookieName = "appointments_pc_arrival_operator";

export function signAppointmentPcArrival(userId: string, deviceToken: string, arrivalOnly: boolean, secret: string, expiresAt: number) {
  const payload = `${userId}.${expiresAt}.${arrivalOnly ? "limited" : "standard"}`;
  return `${payload}.${pcArrivalSignature(payload, deviceToken, secret).toString("base64url")}`;
}

export function verifyAppointmentPcArrival(token: string | undefined, deviceToken: string | undefined, secret: string | undefined, now = Date.now()) {
  if (!token || token.length > 512 || !deviceToken || !secret) return null;
  const match = /^([\w-]+)\.(\d+)\.(limited|standard)\.([\w-]{43})$/.exec(token);
  if (!match) return null;
  const [, userId, expiry, mode, signature] = match;
  const expiresAt = Number(expiry);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt - now > APPOINTMENT_IDLE_TIMEOUT_MS) return null;
  const expected = pcArrivalSignature(`${userId}.${expiry}.${mode}`, deviceToken, secret);
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return { userId, arrivalOnly: mode === "limited" };
}

function pcArrivalSignature(payload: string, deviceToken: string, secret: string) {
  return createHmac("sha256", secret).update(`paradise-pc-arrival-v1:${deviceToken}:${payload}`).digest();
}
