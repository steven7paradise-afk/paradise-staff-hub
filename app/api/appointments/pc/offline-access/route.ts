import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appointmentsPcCookieName, appointmentsPcWorkerCookieName, appointmentsPcWorkerCookieMaxAgeSeconds, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { appointmentStaffDisplayName, isAlwaysActiveAppointmentStaff } from "@/lib/appointment-staff-access";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";
import { issueOfflineGrant, verifyOfflineGrant, offlineFingerprint } from "@/lib/appointments-offline-grant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  // Native clients send no Origin; browser requests must be same-origin.
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return fail("Origine non autorizzata.", 403);
  const deviceToken = request.cookies.get(appointmentsPcCookieName)?.value;
  const pc = await checkPCAuthorization(deviceToken);
  if (!pc || !deviceToken) return fail("PC non autorizzato.", 401);
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return fail("Accesso offline non configurato sul server.", 503);
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return fail("Richiesta troppo grande.", 413);
  const raw = await request.text();
  if (raw.length > 4096) return fail("Richiesta troppo grande.", 413);
  let body;
  try { body = JSON.parse(raw); } catch { return fail("Richiesta non valida.", 400); }
  const resuming = typeof body?.token === "string";
  const grant = resuming ? verifyOfflineGrant(body.token, deviceToken, secret) : null;
  if (resuming && !grant) return fail("Autorizzazione offline scaduta. Inserisci il PIN online.", 401);
  const workerId = grant?.workerId ?? (typeof body?.workerId === "string" ? body.workerId : "");
  const pin = typeof body?.pin === "string" ? body.pin : "";
  if (!workerId || workerId.length > 128 || (!resuming && !/^\d{4,6}$/.test(pin))) return fail("Inserisci il PIN completo di 4–6 cifre.", 400);

  if (!resuming) {
    // Durable, per-device/per-worker limit. Reserve before bcrypt, including concurrent requests.
    const key = `offline-pin-attempts:${offlineFingerprint(`${deviceToken}:${workerId}`)}`;
    const allowed = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const saved = await tx.setting.findUnique({ where: { key } });
      const value = saved?.value as { count?: number; until?: number } | undefined;
      const current = value && Number(value.until) > Date.now() ? { count: Number(value.count) || 0, until: Number(value.until) } : { count: 0, until: Date.now() + 15 * 60_000 };
      if (current.count >= 5) return false;
      const next = { count: current.count + 1, until: current.until };
      await tx.setting.upsert({ where: { key }, create: { key, value: next }, update: { value: next } });
      return true;
    });
    if (!allowed) return fail("Troppi tentativi. Riprova tra 15 minuti.", 429);
  }

  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const today = new Date(`${day}T00:00:00.000Z`);
  const tomorrow = new Date(today.getTime() + 86400_000);
  const worker = await prisma.user.findUnique({ where: { id: workerId }, select: {
    id: true, name: true, active: true, employee_status: true, role: true, sede_id: true, pin_hash: true,
    attendance_logs: { where: { date: { gte: today, lt: tomorrow } }, select: { type: true, timestamp: true }, orderBy: { timestamp: "asc" } },
  } });
  if (!worker?.active || !worker.pin_hash || worker.employee_status === FORMER_EMPLOYEE_STATUS
    || ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(worker.role)) return fail("Profilo non abilitato all’accesso offline.", 403);
  const alwaysActive = isAlwaysActiveAppointmentStaff(worker.name, worker.id);
  if (!alwaysActive && worker.sede_id !== null && worker.sede_id !== pc.locationId) return fail("Profilo non disponibile per questo salone.", 403);
  if (grant ? grant.credential !== offlineFingerprint(worker.pin_hash) || grant.role !== worker.role : !(await bcrypt.compare(pin, worker.pin_hash))) {
    return fail("Credenziali non valide. Verifica il PIN online.", 403);
  }
  const state = deriveAttendanceState(worker.attendance_logs);
  if (!alwaysActive && state.status !== "IN" && state.status !== "BREAK") return fail("Il profilo non risulta timbrato. I dati offline rimangono sul Mac.", 403);

  const workerName = appointmentStaffDisplayName(worker.name, worker.id);
  // Resume never extends the offline grant: only a fresh full PIN can renew it.
  const response = NextResponse.json(resuming ? { success: true, workerId, workerName } : { workerId, workerName, ...issueOfflineGrant(workerId, deviceToken, worker.pin_hash, worker.role, secret) }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set({ name: appointmentsPcWorkerCookieName, value: workerId, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: appointmentsPcWorkerCookieMaxAgeSeconds });
  return response;
}
