import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { APPOINTMENT_EVENTS_CHANNEL, APPOINTMENT_REVISION_KEY } from "./cowlendar-webhook";

// Persist local changes and their notification together. NOTIFY fires at commit.
export async function saveAppointmentChange<T>(save: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if (process.env.APPOINTMENTS_REALTIME_ENABLED !== "true") return save(prisma);
  return prisma.$transaction(async (tx) => {
    const result = await save(tx);
    const revision = randomUUID();
    await tx.setting.upsert({ where: { key: APPOINTMENT_REVISION_KEY },
      create: { key: APPOINTMENT_REVISION_KEY, value: revision }, update: { value: revision } });
    await tx.$queryRaw`SELECT pg_notify(${APPOINTMENT_EVENTS_CHANNEL}, ${revision})::text`;
    return result;
  });
}
