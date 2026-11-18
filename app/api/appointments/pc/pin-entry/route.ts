import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { appointmentSalonForPC, appointmentStaffLocationsForPC, appointmentsPcCookieName, appointmentsPcWorkerCookieName, appointmentsPcWorkerCookieMaxAgeSeconds, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { appointmentSalonUrl, normalizeAppointmentSalonSlug } from "@/lib/appointment-salon-url";
import { appointmentStaffDisplayName, isAlwaysActiveAppointmentStaff } from "@/lib/appointment-staff-access";
import { mobileLoginAllowed, clearMobileLoginAttempts } from "@/lib/mobile-login-limit";
import { isAppointmentEntryPin, isAppointmentPinOnlyRole, uniquelyMatchAppointmentPin } from "@/lib/appointment-pin-entry";
import { isAppointmentReceptionist } from "@/lib/appointment-arrival-access";
import { appointmentPcArrivalCookieName, signAppointmentPcArrival } from "@/lib/appointment-pc-arrival-session";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";
import { pinLookup } from "@/lib/pin";
import { appointmentPcReceptionCookieName, signAppointmentPcReception } from "@/lib/appointment-pc-reception-session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const jar = request.cookies;
  const deviceToken = jar.get(appointmentsPcCookieName)?.value;
  const pc = await checkPCAuthorization(deviceToken);
  if (!pc || !deviceToken) return NextResponse.json({ error: "PC non autorizzato." }, { status: 401 });
  const limitKey = `appointment-pin:${pc.code}`;
  if (!mobileLoginAllowed(limitKey)) return NextResponse.json({ error: "Troppi tentativi. Attendi 15 minuti prima di riprovare." }, { status: 429 });
  const body = await request.json().catch(() => null);
  if (!isAppointmentEntryPin(body?.pin)) return NextResponse.json({ error: "Inserisci il PIN completo di 4 cifre." }, { status: 400 });
  const salon = await appointmentSalonForPC(pc.locationId);
  if (!salon || (body?.salone !== "tutti" && normalizeAppointmentSalonSlug(body?.salone) !== salon)) return NextResponse.json({ error: "Apri la pagina del salone associato a questo computer." }, { status: 403 });

  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const today = new Date(`${day}T00:00:00.000Z`);
  const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const candidates = await prisma.user.findMany({
    where: { active: true, employee_status: { not: FORMER_EMPLOYEE_STATUS }, pin_hash: { not: null }, OR: [{ pin_lookup: pinLookup(body.pin) }, { pin_lookup: null }] },
    select: { id: true, name: true, role: true, mansione: true, sede_id: true, pin_hash: true, photo_url: true,
      location: { select: { name: true } },
      attendance_logs: { where: { date: { gte: today, lt: tomorrow } }, select: { type: true, timestamp: true }, orderBy: { timestamp: "asc" } },
    },
  });
  // Check the full hash and reject duplicate matches; never authenticate a prefix.
  const worker = await uniquelyMatchAppointmentPin(candidates, async candidate => bcrypt.compare(body.pin, candidate.pin_hash!));
  const alwaysActive = worker && isAlwaysActiveAppointmentStaff(worker.name, worker.id);
  const pinOnlyAdmin = worker && isAppointmentPinOnlyRole(worker.role);
  const state = worker ? deriveAttendanceState(worker.attendance_logs) : null;
  if (!worker) return NextResponse.json({ error: "PIN non riconosciuto. Inserisci il PIN personale completo di 4 cifre; se continua, chiedi alla reception di verificare il profilo." }, { status: 403 });
  if (!alwaysActive && !pinOnlyAdmin && worker.sede_id !== null && worker.sede_id !== pc.locationId &&
    !(await appointmentStaffLocationsForPC(pc.locationId, salon)).includes(worker.sede_id)) {
    return NextResponse.json({ error: "PIN corretto, ma il profilo è associato a un'altra sede. Chiedi alla reception di verificare la sede del profilo e di questo PC." }, { status: 403 });
  }
  const isReceptionAtDevice = salon === "repubblica" && worker.sede_id !== null && isAppointmentReceptionist(worker);
  const receptionMode = pc.accessMode === "reception";
  if (receptionMode && (!isReceptionAtDevice && !pinOnlyAdmin)) {
    return NextResponse.json({ error: "Questo link è riservato alla Reception. Per lavorare usa il link Lavoratori." }, { status: 403 });
  }
  const arrivalOnly = isReceptionAtDevice && !alwaysActive && !pinOnlyAdmin && state?.status === "OUT";
  if (!alwaysActive && !pinOnlyAdmin && !arrivalOnly && (!state || !["IN", "BREAK"].includes(state.status))) return NextResponse.json({ error: "PIN corretto, ma non risulti timbrato adesso. Registra l'ingresso e riprova." }, { status: 403 });
  const needsArrivalGrant = salon === "repubblica" && (isReceptionAtDevice || pinOnlyAdmin);
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (needsArrivalGrant && !secret) return NextResponse.json({ error: "Accesso non disponibile. Riprova più tardi." }, { status: 503 });
  clearMobileLoginAttempts(limitKey);
  const name = appointmentStaffDisplayName(worker.name, worker.id);
  const response = NextResponse.json({
    appointmentUrl: `${appointmentSalonUrl(salon)}?worker=${encodeURIComponent(name)}`,
    worker: { id: worker.id, name, photo_url: worker.photo_url, locationName: worker.location?.name ?? "", status: alwaysActive ? "IN" : state!.status, arrivalOnly },
  }, { headers: { "Cache-Control": "private, no-store" } });
  const receptionGrant = receptionMode && secret
    ? signAppointmentPcReception(worker.id, pc.locationId, deviceToken, secret)
    : null;
  const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: receptionGrant?.maxAge ?? appointmentsPcWorkerCookieMaxAgeSeconds };
  response.cookies.set(appointmentsPcWorkerCookieName, arrivalOnly && !receptionGrant ? "" : worker.id, { ...cookieOptions, maxAge: arrivalOnly && !receptionGrant ? 0 : cookieOptions.maxAge });
  response.cookies.set(appointmentPcReceptionCookieName, receptionGrant?.token ?? "", {
    ...cookieOptions, maxAge: receptionGrant?.maxAge ?? 0,
  });
  if (!receptionMode && needsArrivalGrant && secret) {
    const expiresAt = Date.now() + cookieOptions.maxAge * 1000;
    response.cookies.set(appointmentPcArrivalCookieName, signAppointmentPcArrival(worker.id, deviceToken, arrivalOnly, secret, expiresAt), cookieOptions);
  } else {
    response.cookies.set(appointmentPcArrivalCookieName, "", { ...cookieOptions, maxAge: 0 });
  }
  return response;
}
