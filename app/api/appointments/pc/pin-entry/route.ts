import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { appointmentsPcCookieName, appointmentsPcWorkerCookieName, appointmentsPcWorkerCookieMaxAgeSeconds, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { appointmentSalonSlugFromName, appointmentSalonUrl, normalizeAppointmentSalonSlug } from "@/lib/appointment-salon-url";
import { appointmentStaffDisplayName, isAlwaysActiveAppointmentStaff } from "@/lib/appointment-staff-access";
import { mobileLoginAllowed, clearMobileLoginAttempts } from "@/lib/mobile-login-limit";
import { isAppointmentEntryPin, isAppointmentPinOnlyRole, uniquelyMatchAppointmentPin } from "@/lib/appointment-pin-entry";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";
import { pinLookup } from "@/lib/pin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const jar = await cookies();
  const pc = await checkPCAuthorization(jar.get(appointmentsPcCookieName)?.value);
  if (!pc) return NextResponse.json({ error: "PC non autorizzato." }, { status: 401 });
  const limitKey = `appointment-pin:${pc.code}`;
  if (!mobileLoginAllowed(limitKey)) return NextResponse.json({ error: "Troppi tentativi. Attendi 15 minuti prima di riprovare." }, { status: 429 });
  const body = await request.json().catch(() => null);
  if (!isAppointmentEntryPin(body?.pin)) return NextResponse.json({ error: "Inserisci il PIN completo di 4 cifre." }, { status: 400 });
  const location = await prisma.location.findUnique({ where: { id: pc.locationId }, select: { name: true } });
  const salon = appointmentSalonSlugFromName(location?.name ?? "");
  if (!salon || (body?.salone !== "tutti" && normalizeAppointmentSalonSlug(body?.salone) !== salon)) return NextResponse.json({ error: "Apri la pagina del salone associato a questo computer." }, { status: 403 });

  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const today = new Date(`${day}T00:00:00.000Z`);
  const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const candidates = await prisma.user.findMany({
    where: { active: true, employee_status: { not: FORMER_EMPLOYEE_STATUS }, pin_hash: { not: null }, OR: [{ pin_lookup: pinLookup(body.pin) }, { pin_lookup: null }] },
    select: { id: true, name: true, role: true, sede_id: true, pin_hash: true, photo_url: true,
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
  if (!alwaysActive && !pinOnlyAdmin && worker.sede_id !== null && worker.sede_id !== pc.locationId) return NextResponse.json({ error: "PIN corretto, ma il profilo è associato a un'altra sede. Chiedi alla reception di verificare la sede del profilo e di questo PC." }, { status: 403 });
  if (!alwaysActive && !pinOnlyAdmin && (!state || !["IN", "BREAK"].includes(state.status))) return NextResponse.json({ error: "PIN corretto, ma non risulti timbrato adesso. Registra l'ingresso e riprova." }, { status: 403 });
  clearMobileLoginAttempts(limitKey);
  const name = appointmentStaffDisplayName(worker.name, worker.id);
  const response = NextResponse.json({
    appointmentUrl: `${appointmentSalonUrl(salon)}?worker=${encodeURIComponent(name)}`,
    worker: { id: worker.id, name, photo_url: worker.photo_url, locationName: worker.location?.name ?? "", status: alwaysActive ? "IN" : state!.status },
  }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set({ name: appointmentsPcWorkerCookieName, value: worker.id, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: appointmentsPcWorkerCookieMaxAgeSeconds });
  return response;
}
