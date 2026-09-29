import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appointmentsPcCookieName, appointmentsPcWorkerCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { appointmentSessionRemainingSeconds } from "@/lib/appointment-idle-session";
import { isAppointmentPinOnlyRole } from "@/lib/appointment-pin-entry";
import { isAlwaysActiveAppointmentStaff } from "@/lib/appointment-staff-access";
import { deriveAttendanceState } from "@/lib/attendance-state";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.nextUrl.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || request.nextUrl.protocol.replace(":", "");
  if (!origin || origin !== `${protocol}://${host}`) return NextResponse.json({ error: "Origine non valida." }, { status: 403 });
  const pc = await checkPCAuthorization(request.cookies.get(appointmentsPcCookieName)?.value);
  const workerId = request.cookies.get(appointmentsPcWorkerCookieName)?.value;
  if (!pc || !workerId) return NextResponse.json({ error: "Sessione scaduta." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const maxAge = appointmentSessionRemainingSeconds(body?.activityAgeMs);
  if (!maxAge) return NextResponse.json({ error: "Sessione scaduta." }, { status: 401 });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const today = new Date(`${day}T00:00:00.000Z`);
  const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const worker = await prisma.user.findFirst({
    where: { id: workerId, active: true },
    select: { id: true, name: true, role: true, sede_id: true,
      attendance_logs: { where: { date: { gte: today, lt: tomorrow } }, select: { type: true, timestamp: true }, orderBy: { timestamp: "asc" } },
    },
  });
  const privileged = worker && (isAppointmentPinOnlyRole(worker.role) || isAlwaysActiveAppointmentStaff(worker.name, worker.id));
  if (!worker || (!privileged && (
    (worker.sede_id !== null && worker.sede_id !== pc.locationId) ||
    !["IN", "BREAK"].includes(deriveAttendanceState(worker.attendance_logs).status)
  ))) return NextResponse.json({ error: "Profilo non disponibile." }, { status: 401 });
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set({ name: appointmentsPcWorkerCookieName, value: worker.id, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  return response;
}
