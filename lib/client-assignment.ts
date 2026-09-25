import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getCowlendarBookingsForRange } from "./cowlendar";
import { appointmentDateKey, appointmentDayBoundaryIso } from "./appointment-date";
import { appointmentSalonSlugFromName } from "./appointment-salon-url";
import { isAssignedWorker, type AssignedMate } from "./mobile-client-control-policy";
import { canRequestClient, isWaitingClient } from "./client-assignment-policy";
import { liveChanged, liveKey } from "./salon-live";
import { FORMER_EMPLOYEE_STATUS } from "./former-employee";

const keys = ["appointment_team_overrides", "appointment_status_overrides", "appointment_staff_aliases"];
type Team = { teammates: AssignedMate[]; updatedAt?: string };
type Status = { status: string; updatedAt?: string };
export type AssignmentRequest = {
  id: string; kind: "assignment"; state: "open" | "done" | "cancelled";
  locationId: string; bookingId: string; customerName: string; workerId: string; workerName: string;
  createdAt: string; date: string; text: string; teamRevision: string; statusRevision: string;
  decision?: "approved" | "rejected"; handledBy?: string; handledByName?: string;
};
export async function assignmentSnapshot() {
  const date = appointmentDateKey();
  const [bookings, settings] = await Promise.all([
    getCowlendarBookingsForRange({ startDate: appointmentDayBoundaryIso(date), endDate: appointmentDayBoundaryIso(date, true), limit: 400 }),
    prisma.setting.findMany({ where: { key: { in: keys } } }),
  ]);
  const values = new Map(settings.map(row => [row.key, row.value]));
  const teams = (values.get(keys[0]) ?? {}) as Record<string, Team>;
  const statuses = (values.get(keys[1]) ?? {}) as Record<string, Status>;
  const aliases = (values.get(keys[2]) ?? {}) as Record<string, { userId?: string }>;
  const items = [...new Map(bookings.map(b => [b.id, b])).values()].filter(b => !b.is_canceled).map(b => ({
    id: b.id, customerName: b.customer?.name || [b.form_data?.firstname, b.form_data?.lastname].filter(Boolean).join(" ") || "Cliente",
    serviceTitle: b.service?.title ?? "Servizio", startDate: b.start_date,
    status: statuses[b.id]?.status ?? b.attendance ?? b.confirmation_status ?? "PRENOTATO",
    team: teams[b.id]?.teammates ?? (b.teammates ?? []).map(t => ({ id: t.id, name: [t.firstname, t.lastname].filter(Boolean).join(" ") })),
    teamRevision: JSON.stringify(teams[b.id] ?? null), statusRevision: JSON.stringify(statuses[b.id] ?? null),
  }));
  return { date, items, aliases, settings };
}
export async function currentWorkerAttendance(userId: string, db: Pick<Prisma.TransactionClient, "attendanceLog"> = prisma) {
  return db.attendanceLog.findFirst({ where: { user_id: userId, timestamp: { gte: new Date(appointmentDayBoundaryIso(appointmentDateKey())), lte: new Date() } }, orderBy: { timestamp: "desc" }, select: { type: true, location_id: true } });
}
export function sameSalon(service: string, location: string) {
  const slug = appointmentSalonSlugFromName(location);
  return !!slug && appointmentSalonSlugFromName(service) === slug;
}
export async function decideAssignment(locationId: string, id: string, decision: string, actor: { id: string; name: string | null; role: string }) {
  const snapshot = await assignmentSnapshot();
  await prisma.$transaction(async tx => {
    const key = liveKey(locationId, id);
    const row = await tx.setting.findUnique({ where: { key } });
    const item = row?.value as unknown as AssignmentRequest | undefined;
    if (!row || item?.kind !== "assignment" || item.locationId !== locationId) throw new Error("Richiesta non trovata.");
    if (item.decision === decision) return;
    if (item.state !== "open") throw new Error("Richiesta già gestita. Aggiorna.");
    if (decision === "approved") {
      const worker = await tx.user.findUnique({ where: { id: item.workerId }, include: { location: true } });
      const attendance = await currentWorkerAttendance(item.workerId, tx);
      if (!worker?.active || worker.employee_status === FORMER_EMPLOYEE_STATUS || worker.must_change_password || worker.sede_id !== locationId || attendance?.location_id !== locationId || !canRequestClient(attendance?.type ?? null, false)) throw new Error("La lavoratrice non è più disponibile o timbrata in questa sede.");
      const target = snapshot.items.find(b => b.id === item.bookingId);
      if (item.date !== snapshot.date || !target || !sameSalon(target.serviceTitle, worker.location?.name ?? "") || !isWaitingClient(target.status)) throw new Error("La cliente non è più in attesa. Aggiorna.");
      const currentRows = await tx.setting.findMany({ where: { key: { in: keys } } });
      // Abort rather than overwrite an assignment or status changed since loading.
      for (const k of keys) {
        if (JSON.stringify(currentRows.find(r => r.key === k)?.value ?? null) !== JSON.stringify(snapshot.settings.find(r => r.key === k)?.value ?? null)) throw new Error("Agenda cambiata. Aggiorna e riprova.");
      }
      if (target.teamRevision !== item.teamRevision || target.statusRevision !== item.statusRevision) throw new Error("Assegnazione cambiata dopo la richiesta. Rifiutala e chiedi un nuovo invio.");
      const busy = snapshot.items.some(b => b.status === "INIZIATO" && isAssignedWorker(worker.id, b.team, snapshot.aliases));
      if (busy) throw new Error("La lavoratrice sta già seguendo una cliente.");
      const now = new Date().toISOString();
      const changes = [
        { key: keys[0], entry: { teammates: [{ id: worker.id, name: worker.name, photoUrl: worker.photo_url }], updatedAt: now, updatedBy: actor.name ?? actor.id } },
        { key: keys[1], entry: { status: "INIZIATO", startedAt: now, stoppedAt: null, elapsedSeconds: 0, updatedAt: now, updatedBy: actor.name ?? actor.id } },
      ];
      for (const change of changes) {
        const old = currentRows.find(r => r.key === change.key);
        const value = { ...(old?.value as Record<string, Prisma.InputJsonValue> ?? {}), [item.bookingId]: change.entry } as Prisma.InputJsonValue;
        if (old) {
          const updated = await tx.setting.updateMany({ where: { key: change.key, value: { equals: old.value as Prisma.InputJsonValue } }, data: { value } });
          if (updated.count !== 1) throw new Error("Agenda cambiata. Aggiorna e riprova.");
        } else { await tx.setting.create({ data: { key: change.key, value } }); }
      }
    }
    const updated = await tx.setting.updateMany({ where: { key, value: { equals: row.value as Prisma.InputJsonValue } }, data: { value: { ...item, state: decision === "approved" ? "done" : "cancelled", decision, handledBy: actor.id, handledByName: actor.name ?? actor.id } } });
    if (updated.count !== 1) throw new Error("Richiesta già gestita.");
    await tx.shopifyOrderComment.create({ data: { order_name: item.bookingId, user_name: actor.name ?? actor.id, user_role: actor.role, message: `Richiesta di ${item.workerName}: ${decision === "approved" ? "approvata, cliente assegnata e servizio iniziato" : "rifiutata"}.` } });
    await liveChanged(tx);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
