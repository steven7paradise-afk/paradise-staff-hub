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
import { isPinLookupMatchingPrefix } from "@/lib/pin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const pcToken = cookieStore.get(appointmentsPcCookieName)?.value;
  const pcAuth = await checkPCAuthorization(pcToken);

  if (!pcAuth) {
    return NextResponse.json({ error: "PC non autorizzato." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const workerId = typeof body?.workerId === "string" ? body.workerId.trim() : "";
  const pinPrefix = typeof body?.pinPrefix === "string" ? body.pinPrefix.replace(/\D/g, "").slice(0, 2) : "";
  const salone = normalizeAppointmentSalonSlug(body?.salone);

  if (!workerId) {
    return NextResponse.json({ error: "Profilo non valido." }, { status: 400 });
  }
  if (!/^\d{2}$/.test(pinPrefix)) {
    return NextResponse.json({ error: "Inserisci le prime 2 cifre del tuo PIN." }, { status: 400 });
  }

  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const today = new Date(`${day}T00:00:00.000Z`);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const worker = await prisma.user.findFirst({
    where: {
      id: workerId,
      active: true,
      sede_id: pcAuth.locationId,
    },
    select: {
      id: true,
      name: true,
      pin_lookup: true,
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

  if (!isPinLookupMatchingPrefix(worker.pin_lookup, pinPrefix)) {
    return NextResponse.json({ error: "Le prime 2 cifre del PIN non corrispondono a questo profilo." }, { status: 403 });
  }

  const state = deriveAttendanceState(worker.attendance_logs);
  if (state.status !== "IN" && state.status !== "BREAK") {
    return NextResponse.json({ error: "Questo profilo non risulta timbrato adesso." }, { status: 403 });
  }

  const response = NextResponse.json({
    success: true,
    appointmentUrl: appointmentSalonUrl(salone),
    workerName: worker.name,
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
