import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { publishAppointmentChange } from "./appointment-realtime";
import { readAppointmentStatusRevisions, type AppointmentAgendaRange, type AppointmentAgendaRevision } from "./appointment-range-revision";
import { prisma } from "./prisma";

const STATUS_SETTING_KEY = "appointment_status_overrides";

export type AppointmentStatusEntry = {
  status: string;
  updatedAt: string;
  updatedBy: string;
  startedAt?: string | null;
  stoppedAt?: string | null;
  elapsedSeconds?: number;
};

type StatusUpdate = {
  status: string;
  updatedBy: string;
  transitionAt?: Date;
  trackServiceTime?: boolean;
  agendaRange?: AppointmentAgendaRange;
};

type StatusEntryWithTiming = AppointmentStatusEntry & {
  startedAt: string | null;
  stoppedAt: string | null;
  elapsedSeconds: number;
};

type StatusSave<T> = { previousStatus?: string; entry: T; agendaRevision?: AppointmentAgendaRevision };

export async function saveAppointmentStatus(
  bookingId: string,
  update: StatusUpdate & { trackServiceTime: true },
): Promise<StatusSave<StatusEntryWithTiming>>;
export async function saveAppointmentStatus(
  bookingId: string,
  update: StatusUpdate,
): Promise<StatusSave<AppointmentStatusEntry>>;
export async function saveAppointmentStatus(
  bookingId: string,
  update: StatusUpdate,
): Promise<StatusSave<AppointmentStatusEntry>> {
  return prisma.$transaction(async (tx) => {
    const readForUpdate = () => tx.$queryRaw<Array<{ entry: Partial<AppointmentStatusEntry> | null }>>`
      SELECT value::jsonb -> ${bookingId}::text AS entry
      FROM settings
      WHERE key = ${STATUS_SETTING_KEY}
      FOR UPDATE
    `;
    // Serialize status transitions against this shared settings row, even with realtime disabled.
    let [row] = await readForUpdate();
    if (!row) {
      await tx.$executeRaw`
        INSERT INTO settings (id, key, value)
        VALUES (${randomUUID()}, ${STATUS_SETTING_KEY}, '{}'::jsonb)
        ON CONFLICT (key) DO NOTHING
      `;
      [row] = await readForUpdate();
    }

    const previous = row?.entry;
    const previousStatus = previous?.status;
    const transitionAt = update.transitionAt ?? new Date();
    const previousUpdate = Date.parse(previous?.updatedAt ?? "");
    const updatedAt = Number.isFinite(previousUpdate)
      ? new Date(Math.max(transitionAt.getTime(), previousUpdate + 1))
      : transitionAt;
    const entry: AppointmentStatusEntry = {
      status: update.status,
      updatedAt: updatedAt.toISOString(),
      updatedBy: update.updatedBy,
    };

    if (update.trackServiceTime) {
      entry.startedAt = previous?.startedAt ?? null;
      entry.stoppedAt = previous?.stoppedAt ?? null;
      entry.elapsedSeconds = Number(previous?.elapsedSeconds || 0);

      if (update.status === "INIZIATO" && (previousStatus !== "INIZIATO" || !entry.startedAt)) {
        entry.startedAt = transitionAt.toISOString();
        entry.stoppedAt = null;
        entry.elapsedSeconds = 0;
      } else if (update.status !== "INIZIATO" && previousStatus === "INIZIATO" && entry.startedAt) {
        const startedAt = Date.parse(entry.startedAt);
        if (Number.isFinite(startedAt)) {
          entry.elapsedSeconds = Math.max(0, Math.floor((transitionAt.getTime() - startedAt) / 1000));
        }
        entry.stoppedAt = transitionAt.toISOString();
      }
    }

    const agendaRevision = update.agendaRange
      ? await readAppointmentStatusRevisions(tx, update.agendaRange, bookingId, entry)
      : undefined;

    await tx.$executeRaw`
      UPDATE settings
      SET value = (CASE WHEN jsonb_typeof(value::jsonb) = 'object' THEN value::jsonb ELSE '{}'::jsonb END)
        || jsonb_build_object(${bookingId}::text, ${JSON.stringify(entry)}::jsonb)
      WHERE key = ${STATUS_SETTING_KEY}
    `;
    await publishAppointmentChange(tx);
    return { previousStatus, entry, agendaRevision };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
