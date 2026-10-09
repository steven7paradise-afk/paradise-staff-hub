import { Prisma } from "@prisma/client";
import { after } from "next/server";
import { prisma } from "./prisma";
import { sendPlanningSnapshot, planningWebhookConfig } from "./planning-integration-contract";

const KEY = "planning_integration_revision_v1";
type State = { revision: number; pending: boolean };
function state(value: unknown): State {
  const saved = value as Partial<State> | null;
  return { revision: Number(saved?.revision || 0), pending: saved?.pending === true };
}

/** Must run in the same transaction as the planning edit. */
export async function queuePlanningUpdate(tx: Prisma.TransactionClient) {
  // Serialize revisions across all writers, including concurrent bulk updates.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(781233910)`;
  const previous = state((await tx.setting.findUnique({ where: { key: KEY } }))?.value);
  const value = { revision: previous.revision + 1, pending: true };
  await tx.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

export function deliverPlanningAfterResponse() {
  if (!planningWebhookConfig()) return;
  after(async () => {
    try { await deliverPlanningUpdate(); }
    catch { console.error("Planning webhook pending; retry endpoint can resume delivery."); }
  });
}

export async function planningMutation<T>(write: (tx: Prisma.TransactionClient) => Promise<T>) {
  const result = await prisma.$transaction(async tx => {
    await queuePlanningUpdate(tx);
    return write(tx);
  }, { timeout: 30000 });
  deliverPlanningAfterResponse();
  return result;
}

/** A complete, consistent snapshot. No credentials or unrelated HR fields. */
export async function planningSnapshot() {
  return prisma.$transaction(async tx => {
    const current = state((await tx.setting.findUnique({ where: { key: KEY } }))?.value);
    const [workers, locations, categories, entries, workerLocations] = await Promise.all([
      tx.user.findMany({ where: { OR: [{ schedule_entries: { some: {} } }, { active: true }] }, select: { id: true, name: true, active: true, sede_id: true, mansione: true }, orderBy: { id: "asc" } }),
      tx.location.findMany({ select: { id: true, name: true, active: true, opening_time: true, closing_time: true }, orderBy: { id: "asc" } }),
      tx.scheduleCategory.findMany({ select: { id: true, name: true, code: true, location_id: true, color: true, text_color: true, start_time: true, end_time: true, editable_time: true, paid_hours: true, active: true }, orderBy: { id: "asc" } }),
      tx.scheduleEntry.findMany({ select: { id: true, user_id: true, location_id: true, category_id: true, date: true, start_time: true, end_time: true, note: true, updated_at: true }, orderBy: [{ date: "asc" }, { id: "asc" }] }),
      tx.scheduleWorkerOverride.findMany({ select: { user_id: true, location_id: true }, orderBy: [{ location_id: "asc" }, { user_id: "asc" }] }),
    ]);
    return { schemaVersion: 1, event: "planning.updated", revision: current.revision, generatedAt: new Date().toISOString(), timezone: "Europe/Rome", mode: "replace", data: {
      workers, locations, categories, workerLocations,
      entries: entries.map(entry => ({ ...entry, date: entry.date.toISOString().slice(0, 10), updated_at: entry.updated_at.toISOString() })),
    } };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
}

export async function deliverPlanningUpdate() {
  const config = planningWebhookConfig();
  if (!config) return { status: "not_configured" as const };
  const current = state((await prisma.setting.findUnique({ where: { key: KEY } }))?.value);
  if (!current.pending) return { status: "idle" as const };
  const snapshot = await planningSnapshot();
  const body = JSON.stringify(snapshot);
  if (await sendPlanningSnapshot(body, snapshot.revision, config)) {
    // Do not acknowledge a newer change that arrived during this request.
    await prisma.setting.updateMany({ where: { key: KEY, value: { path: ["revision"], equals: snapshot.revision } }, data: { value: { revision: snapshot.revision, pending: false } } });
    return { status: "delivered" as const, revision: snapshot.revision };
  }
  return { status: "pending" as const, revision: snapshot.revision };
}
