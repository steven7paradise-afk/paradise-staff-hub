import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { normalizeAppointmentSalonSlug, appointmentSalonUrl } from "@/lib/appointment-salon-url";
import {
  appointmentsPcCookieName,
  appointmentsPcWorkerCookieMaxAgeSeconds,
  appointmentsPcWorkerCookieName,
  checkPCAuthorization,
} from "@/lib/appointments-pc-auth";
import { prisma } from "@/lib/prisma";
import { isPinPrefixValidForUser } from "@/lib/pin";
import { mobileLoginAllowed, clearMobileLoginAttempts } from "@/lib/mobile-login-limit";
import { isAppointmentPinOnlyRole } from "@/lib/appointment-pin-entry";
import {
  appointmentStaffDisplayName,
  isAlwaysActiveAppointmentStaff,
} from "@/lib/appointment-staff-access";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const pcToken = cookieStore.get(appointmentsPcCookieName)?.value;
  const pcAuth = await checkPCAuthorization(pcToken);

  if (!pcAuth) {
    return NextResponse.json({ error: "PC non autorizzato." }, { status: 401 });
  }
  const limitKey = `appointment-pin:${pcAuth.code}`;
  if (!mobileLoginAllowed(limitKey)) return NextResponse.json({ error: "Troppi tentativi. Attendi 15 minuti prima di riprovare." }, { status: 429 });

  const body = await request.json().catch(() => null);
  const workerId = typeof body?.workerId === "string" ? body.workerId.trim() : "";
  const pinPrefix = typeof body?.pinPrefix === "string" ? body.pinPrefix : "";
  const salone = normalizeAppointmentSalonSlug(body?.salone);

  if (!workerId) {
    return NextResponse.json({ error: "Profilo non valido." }, { status: 400 });
  }
  if (!/^\d{2}$/.test(pinPrefix)) {
    return NextResponse.json({ error: "Inserisci le prime 2 cifre del PIN." }, { status: 400 });
  }

  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const today = new Date(`${day}T00:00:00.000Z`);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const worker = await prisma.user.findFirst({
    where: {
      id: workerId,
      active: true,
    },
    select: {
      id: true,
      name: true,
      role: true,
      sede_id: true,
      pin_prefix_lookup: true,
      attendance_logs: {
        where: { date: { gte: today, lt: tomorrow } },
        select: { type: true, timestamp: true },
        orderBy: { timestamp: "asc" },
      },
    },
  });

  if (!worker) {
    return NextResponse.json({ error: "Profilo non disponibile per questo PC." }, { status: 403 });
  }
  if (isAppointmentPinOnlyRole(worker.role)) return NextResponse.json({ error: "Per questo profilo usa il PIN completo di 4 cifre." }, { status: 403 });

  const alwaysActive = isAlwaysActiveAppointmentStaff(worker.name, worker.id);
  if (!alwaysActive && worker.sede_id !== null && worker.sede_id !== pcAuth.locationId) {
    return NextResponse.json({ error: "Profilo non disponibile per questo PC." }, { status: 403 });
  }

  const isPinValid = isPinPrefixValidForUser(pinPrefix, worker.pin_prefix_lookup);

  if (!isPinValid) {
    return NextResponse.json({ error: "Le prime 2 cifre non corrispondono a questo profilo." }, { status: 403 });
  }

  const state = deriveAttendanceState(worker.attendance_logs);
  if (!alwaysActive && state.status !== "IN" && state.status !== "BREAK") {
    return NextResponse.json({ error: "Questo profilo non risulta timbrato adesso." }, { status: 403 });
  }

  const workerName = appointmentStaffDisplayName(worker.name, worker.id);
  clearMobileLoginAttempts(limitKey);
  const response = NextResponse.json({
    success: true,
    appointmentUrl: `${appointmentSalonUrl(salone)}?worker=${encodeURIComponent(workerName)}`,
    workerName,
  });

  response.cookies.set({
    name: appointmentsPcWorkerCookieName,
    value: worker.id,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: appointmentsPcWorkerCookieMaxAgeSeconds,
  });

  return response;
}
