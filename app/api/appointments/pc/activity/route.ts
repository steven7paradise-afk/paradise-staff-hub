import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appointmentSalonForPC, appointmentStaffLocationsForPC, appointmentsPcCookieName, appointmentsPcWorkerCookieName, checkPCAuthorization, isAppointmentStaffLocationForPC } from "@/lib/appointments-pc-auth";
import { appointmentSessionRemainingSeconds } from "@/lib/appointment-idle-session";
import { isAppointmentPinOnlyRole } from "@/lib/appointment-pin-entry";
import { hasCurrentAttendanceAtAppointmentSalon, isAlwaysActiveAppointmentStaff } from "@/lib/appointment-staff-access";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { appointmentPcArrivalCookieName, signAppointmentPcArrival } from "@/lib/appointment-pc-arrival-session";
import { findAppointmentPcArrivalOperator } from "@/lib/appointment-pc-arrival-operator";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.nextUrl.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || request.nextUrl.protocol.replace(":", "");
  if (!origin || origin !== `${protocol}://${host}`) return NextResponse.json({ error: "Origine non valida." }, { status: 403 });
  const deviceToken = request.cookies.get(appointmentsPcCookieName)?.value;
  const pc = await checkPCAuthorization(deviceToken);
  const workerId = request.cookies.get(appointmentsPcWorkerCookieName)?.value;
  if (!pc || !deviceToken) return NextResponse.json({ error: "Sessione scaduta." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const maxAge = appointmentSessionRemainingSeconds(body?.activityAgeMs);
  if (!maxAge) return NextResponse.json({ error: "Sessione scaduta." }, { status: 401 });
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const arrivalOperator = await findAppointmentPcArrivalOperator(
    pc.locationId, deviceToken, request.cookies.get(appointmentPcArrivalCookieName)?.value,
  );
  const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge };
  const success = () => NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  if (arrivalOperator?.arrivalOnly && secret) {
    const response = success();
    response.cookies.set(appointmentPcArrivalCookieName, signAppointmentPcArrival(
      arrivalOperator.id, deviceToken, true, secret, Date.now() + maxAge * 1000,
    ), cookieOptions);
    return response;
  }
  if (!workerId) return NextResponse.json({ error: "Sessione scaduta." }, { status: 401 });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const today = new Date(`${day}T00:00:00.000Z`);
  const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const worker = await prisma.user.findFirst({
    where: { id: workerId, active: true },
    select: { id: true, name: true, role: true, sede_id: true,
      attendance_logs: { where: { date: { gte: today, lt: tomorrow } }, select: { type: true, timestamp: true, location_id: true }, orderBy: { timestamp: "asc" } },
    },
  });
  const privileged = worker && (isAppointmentPinOnlyRole(worker.role) || isAlwaysActiveAppointmentStaff(worker.name, worker.id));
  if (!worker) return NextResponse.json({ error: "Profilo non disponibile." }, { status: 401 });
  if (!privileged) {
    const attendance = deriveAttendanceState(worker.attendance_logs);
    const allowedLocation = worker.sede_id !== null
      ? await isAppointmentStaffLocationForPC(pc.locationId, worker.sede_id)
      : await appointmentSalonForPC(pc.locationId) !== "repubblica" ||
        hasCurrentAttendanceAtAppointmentSalon(
          attendance.status,
          attendance.lastValidLog?.location_id,
          await appointmentStaffLocationsForPC(pc.locationId, "repubblica"),
        );
    if (!allowedLocation || !["IN", "BREAK"].includes(attendance.status)) {
      return NextResponse.json({ error: "Profilo non disponibile." }, { status: 401 });
    }
  }
  const response = success();
  response.cookies.set(appointmentsPcWorkerCookieName, worker.id, cookieOptions);
  if (arrivalOperator?.id === worker.id && secret) response.cookies.set(
    appointmentPcArrivalCookieName,
    signAppointmentPcArrival(worker.id, deviceToken, false, secret, Date.now() + maxAge * 1000),
    cookieOptions,
  );
  return response;
}
