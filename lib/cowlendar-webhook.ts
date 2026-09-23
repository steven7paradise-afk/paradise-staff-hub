import { createHmac, timingSafeEqual } from "node:crypto";

export const BOOKING_EVENTS = new Set([
  "booking.created", "booking.confirmed", "booking.declined",
  "booking.canceled", "booking.rescheduled", "booking.attendance_changed",
]);

// Cowlendar's documented scheme: HMAC(secret, timestamp + '.' + raw body).
export function verifyCowlendarSignature(body: Buffer, timestamp: string, signature: string, secret: string, now = Date.now()) {
  if (!secret || !/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const parts = signature.split(",").map((part) => part.trim());
  if (parts.filter((part) => part.startsWith("t=")).length !== 1 || !parts.includes(`t=${timestamp}`)) return false;
  const received = parts.find((part) => part.startsWith("v1="))?.slice(3) || "";
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(received, "hex"));
}

export const APPOINTMENT_EVENTS_CHANNEL = "paradise_appointment_changes";
export const APPOINTMENT_REVISION_KEY = "appointments_realtime_revision";
