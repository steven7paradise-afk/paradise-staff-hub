import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { mobileUser } from "@/lib/mobile-auth";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";
import { assignmentSnapshot, currentWorkerAttendance, sameSalon, type AssignmentRequest } from "@/lib/client-assignment";
import { canRequestClient, isWaitingClient } from "@/lib/client-assignment-policy";
import { isAssignedWorker } from "@/lib/mobile-client-control-policy";
import { liveChanged, liveKey } from "@/lib/salon-live";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
async function context(request: Request) {
  const auth = await mobileUser(request);
  if (!auth || auth.user.must_change_password || auth.user.employee_status === FORMER_EMPLOYEE_STATUS || auth.session.device_name?.startsWith("ios-salon:") || !auth.user.sede_id) return null;
  const attendance = await currentWorkerAttendance(auth.user.id);
  if (!attendance || attendance.location_id !== auth.user.sede_id || !["ENTRATA", "RIENTRO", "PAUSA"].includes(attendance.type)) return null;
  return { user: auth.user, attendance };
}
export async function GET(request: NextRequest) {
  const ctx = await context(request);
  if (!ctx) return reply({ error: "Accedi con il tuo profilo e timbra l’ingresso nella tua sede." }, 403);
  const snapshot = await assignmentSnapshot();
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: `salon_live:${ctx.user.sede_id}:` }, value: { path: ["workerId"], equals: ctx.user.id } } });
  const requests = rows.map(r => r.value as unknown as AssignmentRequest).filter(r => r.kind === "assignment" && r.date === snapshot.date);
  const busy = snapshot.items.some(b => b.status === "INIZIATO" && isAssignedWorker(ctx.user.id, b.team, snapshot.aliases));
  return reply({ canRequest: canRequestClient(ctx.attendance.type, busy), items: snapshot.items.filter(b => isWaitingClient(b.status) && sameSalon(b.serviceTitle, ctx.user.location?.name ?? "")).map(b => ({
    id: b.id, customerName: b.customerName, serviceTitle: b.serviceTitle, startDate: b.startDate,
    assignedNames: b.team.map(t => t.name),
    requestState: requests.filter(r => r.bookingId === b.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.state ?? "",
  })) });
}
export async function POST(request: NextRequest) {
  const ctx = await context(request);
  if (!ctx) return reply({ error: "Devi essere timbrata nella tua sede." }, 403);
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.id) || typeof body.bookingId !== "string") return reply({ error: "Richiesta non valida." }, 400);
  const snapshot = await assignmentSnapshot();
  const b = snapshot.items.find(b => b.id === body.bookingId);
  const busy = snapshot.items.some(b => b.status === "INIZIATO" && isAssignedWorker(ctx.user.id, b.team, snapshot.aliases));
  if (!canRequestClient(ctx.attendance.type, busy) || !b || !isWaitingClient(b.status) || !sameSalon(b.serviceTitle, ctx.user.location?.name ?? "")) return reply({ error: "Devi essere libera e la cliente deve essere arrivata nella tua sede." }, 409);
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`assignment-request:${ctx.user.id}:${b.id}`}))`;
      const key = liveKey(ctx.user.sede_id!, body.id);
      const existing = await tx.setting.findUnique({ where: { key } });
      if (existing) {
        const old = existing.value as unknown as AssignmentRequest;
        if (old.kind !== "assignment" || old.workerId !== ctx.user.id || old.bookingId !== b.id) throw new Error("Identificativo già utilizzato.");
        return;
      }
      const pending = await tx.setting.findFirst({ where: { key: { startsWith: `salon_live:${ctx.user.sede_id}:` }, AND: [
        { value: { path: ["kind"], equals: "assignment" } }, { value: { path: ["workerId"], equals: ctx.user.id } },
        { value: { path: ["bookingId"], equals: b.id } }, { value: { path: ["state"], equals: "open" } },
      ] } });
      if (pending) return;
      const item: AssignmentRequest = { id: body.id, kind: "assignment", state: "open", locationId: ctx.user.sede_id!, bookingId: b.id, customerName: b.customerName, workerId: ctx.user.id, workerName: ctx.user.name, date: snapshot.date, createdAt: new Date().toISOString(), text: "Chiede di seguire la cliente. L’approvazione sostituisce l’assegnazione attuale e avvia il servizio.", teamRevision: b.teamRevision, statusRevision: b.statusRevision };
      await tx.setting.create({ data: { key, value: item as unknown as Prisma.InputJsonValue } });
      await liveChanged(tx);
    });
    return reply({ success: true });
  } catch { return reply({ error: "Invio non riuscito. Riprova: la richiesta non verrà duplicata." }, 409); }
}
