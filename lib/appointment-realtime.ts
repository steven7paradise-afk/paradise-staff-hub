import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { APPOINTMENT_EVENTS_CHANNEL, APPOINTMENT_REVISION_KEY } from "./cowlendar-webhook";

export const APPOINTMENT_ARCHIVE_INVALIDATION_KEY = "appointment_archive_invalidation_revision";
export const APPOINTMENT_ARCHIVE_INVALIDATION_CHANNEL = "paradise_appointment_archive_invalidated";

export function appointmentsRealtimeEnabled() {
  return process.env.APPOINTMENTS_REALTIME_ENABLED === "true" &&
    Boolean(process.env.APPOINTMENTS_REALTIME_DATABASE_URL);
}

export async function publishAppointmentChange(tx: Prisma.TransactionClient) {
  if (process.env.APPOINTMENTS_REALTIME_ENABLED !== "true") return;
  const revision = randomUUID();
  await tx.setting.upsert({
    where: { key: APPOINTMENT_REVISION_KEY },
    create: { key: APPOINTMENT_REVISION_KEY, value: revision },
    update: { value: revision },
  });
  await tx.$queryRaw`SELECT pg_notify(${APPOINTMENT_EVENTS_CHANNEL}, ${revision})::text`;
}

// Persist local changes and their notification together. NOTIFY fires at commit.
export async function saveAppointmentChange<T>(save: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if (process.env.APPOINTMENTS_REALTIME_ENABLED !== "true") return save(prisma);
  return prisma.$transaction(async (tx) => {
    const result = await save(tx);
    await publishAppointmentChange(tx);
    return result;
  });
}
