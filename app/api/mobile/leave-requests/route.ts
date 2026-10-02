import { NextResponse } from "next/server";
import { Prisma, type LeaveRequest } from "@prisma/client";
import { mobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { personalLeavePayload, medicalCodePayload } from "@/lib/mobile-leave-request";
import { syncLeaveRequestToGoogleCalendar } from "@/lib/google-calendar";
import { emailTemplates, sendEmail } from "@/lib/email";

import { syncApprovedLeaveToSchedule } from "@/lib/schedule-sync";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function personalUser(request: Request) {
  const auth = await mobileUser(request);
  if (!auth || auth.user.must_change_password || !auth.user.active || auth.user.employee_status === "Ex dipendente" || auth.session.device_name?.startsWith("ios-salon:")) return null;
  return auth.user;
}
const item = (r: LeaveRequest) => ({ id: r.id, type: r.type === "PERMESSO" && /^RITARDO (AUTOMATICO|SEGNALATO) — /.test(r.reason ?? "") ? "RITARDO" : r.type, startDate: r.start_date.toISOString(), endDate: r.end_date.toISOString(),
  startTime: r.start_time, endTime: r.end_time, reason: r.reason, status: r.status, adminNote: r.admin_note, medicalCode: r.medical_code });

export async function GET(request: Request) {
  const user = await personalUser(request);
  if (!user) return reply({ error: "Accedi con il tuo account personale." }, 401);
  const requests = await prisma.leaveRequest.findMany({ where: { user_id: user.id, type: { in: ["FERIE", "PERMESSO", "MALATTIA"] } }, orderBy: { created_at: "desc" } });
  return reply({ items: requests.map(item) });
}

export async function POST(request: Request) {
  const user = await personalUser(request);
  if (!user) return reply({ error: "Accedi con il tuo account personale." }, 401);
  const payload = personalLeavePayload(await request.json().catch(() => null));
  if (!payload) return reply({ error: "Controlla le date, gli orari e il motivo della richiesta." }, 400);
  let created: LeaveRequest;
  try {
    // A client UUID makes retries safe. Identity and approval state cannot be set by the client.
    created = await prisma.leaveRequest.create({ data: { ...payload, user_id: user.id, status: "PENDING" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.leaveRequest.findFirst({ where: { id: payload.id, user_id: user.id } });
      if (existing && existing.type === payload.type && existing.start_date.getTime() === payload.start_date.getTime()
        && existing.end_date.getTime() === payload.end_date.getTime() && existing.start_time === payload.start_time
        && existing.end_time === payload.end_time && (existing.reason ?? "") === payload.reason && existing.medical_code === payload.medical_code) return reply({ item: item(existing) });
      return reply({ error: "Richiesta già utilizzata. Chiudi il modulo e crea una nuova richiesta." }, 409);
    }
    return reply({ error: "Non è stato possibile salvare la richiesta. Riprova." }, 500);
  }
  // Keep the existing administrative workflow; approval remains on the server.
  await Promise.allSettled([
    syncLeaveRequestToGoogleCalendar(created.id),
    (async () => {
      const admins = await prisma.user.findMany({ where: { active: true, role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] } }, select: { email: true } });
      const template = emailTemplates.leaveRequestReceived(user.name, created.type, created.start_date, created.end_date, created.reason);
      await Promise.allSettled(admins.map(admin => sendEmail({ to: admin.email, ...template })));
    })(),
  ]);
  return reply({ item: item(created) }, 201);
}

export async function PATCH(request: Request) {
  const user = await personalUser(request);
  if (!user) return reply({ error: "Accedi con il tuo account personale." }, 401);
  const payload = medicalCodePayload(await request.json().catch(() => null));
  if (!payload) return reply({ error: "Inserisci un numero di protocollo valido." }, 400);
  try {
    const result = await prisma.$transaction(async tx => {
      // Scope both the read and atomic write to the authenticated employee.
      const existing = await tx.leaveRequest.findFirst({ where: { id: payload.id, user_id: user.id, type: "MALATTIA" } });
      if (!existing) return { error: "Malattia non trovata.", status: 404 };
      if (existing.medical_code === payload.medicalCode) return { saved: existing };
      if (existing.status === "REJECTED" || existing.medical_code?.trim())
        return { error: "La pratica è stata aggiornata. Ricarica lo storico prima di continuare.", status: 409 };
      const changed = await tx.leaveRequest.updateMany({
        where: { id: existing.id, user_id: user.id, type: "MALATTIA", status: existing.status, medical_code: existing.medical_code },
        data: { medical_code: payload.medicalCode, sickness_unjustified: false },
      });
      if (changed.count !== 1) return { error: "La pratica è cambiata. Ricarica lo storico.", status: 409 };
      if (existing.status === "APPROVED") await syncApprovedLeaveToSchedule(tx, existing.id, user.id);
      const saved = await tx.leaveRequest.findUniqueOrThrow({ where: { id: existing.id } });
      return { saved };
    });
    if ("error" in result) return reply({ error: result.error }, result.status);
    await syncLeaveRequestToGoogleCalendar(result.saved.id).catch(() => undefined);
    return reply({ item: item(result.saved) });
  } catch {
    return reply({ error: "Salvataggio non confermato. Puoi riprovare con lo stesso codice." }, 500);
  }
}
