import type { Prisma } from "@prisma/client";
import { APPOINTMENT_ARCHIVE_RATE_LIMIT_KEY_PREFIX, archiveMonths } from "./appointment-archive-range";
import { addAppointmentDays, appointmentDayBoundaryIso, isAppointmentDateKey } from "./appointment-date";
import { appointmentsRealtimeEnabled } from "./appointment-realtime";
import { prisma } from "./prisma";
import { COWLENDAR_WEBHOOK_VERSION_FIELD } from "./cowlendar-webhook-archive";

export type AppointmentAgendaRange = { from: string; to: string };
export type AppointmentAgendaRevision = { before: string; after: string };

type AppointmentAgendaEdit =
  | { kind: "status"; entry: object }
  | { kind: "team"; teammates: object[] }
  | { kind: "office-note"; text: string };

export function visibleAgendaRange(value: unknown): AppointmentAgendaRange | undefined {
  if (!appointmentsRealtimeEnabled() || !value || typeof value !== "object") return undefined;
  const { from, to } = value as { from?: unknown; to?: unknown };
  if (!isAppointmentDateKey(from) || !isAppointmentDateKey(to) || from > to || to > addAppointmentDays(from, 31)) return undefined;
  return { from, to };
}

async function readRangeRevisions(
  { from, to }: AppointmentAgendaRange,
  db: Prisma.TransactionClient,
  change?: { bookingId: string; edit: AppointmentAgendaEdit },
) {
  const months = archiveMonths(from, to);
  const start = new Date(appointmentDayBoundaryIso(from));
  const end = new Date(appointmentDayBoundaryIso(to, true));
  const { bookingId = null, edit } = change ?? {};
  const [snapshot] = await db.$queryRaw<{ revision: string; next_revision: string | null }[]>`
    WITH bookings AS (
      SELECT booking.id, status.value -> booking.id AS saved_status,
        EXTRACT(EPOCH FROM booking.start_at) AS starts_at,
        booking.payload - 'updated_at' - ${COWLENDAR_WEBHOOK_VERSION_FIELD}::text AS payload,
        CASE WHEN jsonb_typeof(booking.sheet) = 'object' THEN booking.sheet - 'updatedAt' END AS sheet,
        (team.value -> booking.id) -> 'teammates' AS saved_team,
        CASE WHEN jsonb_typeof(bot.value -> booking.id) = 'object'
          THEN (bot.value -> booking.id) - 'updatedAt' - 'source' END AS bot_update,
        NULLIF(btrim(note.value ->> 'text'), '') AS saved_note
      FROM appointment_archive AS booking
      LEFT JOIN settings AS status ON status.key = 'appointment_status_overrides'
      LEFT JOIN settings AS team ON team.key = 'appointment_team_overrides'
      LEFT JOIN settings AS bot ON bot.key = 'appointment_bot_updates'
      LEFT JOIN settings AS note ON note.key = 'appointment_office_note:' || booking.id
      WHERE booking.start_at >= ${start} AND booking.start_at <= ${end}
    ), changes AS (
      SELECT *,
        CASE WHEN id = ${edit?.kind === "team" ? bookingId : null}::text
          THEN ${edit?.kind === "team" ? JSON.stringify(edit.teammates) : null}::jsonb ELSE saved_team END AS next_team,
        CASE WHEN id = ${edit?.kind === "office-note" ? bookingId : null}::text
          THEN NULLIF(btrim(${edit?.kind === "office-note" ? edit.text : null}::text), '') ELSE saved_note END AS next_note,
        CASE WHEN id = ${edit?.kind === "status" ? bookingId : null}::text
          THEN ${edit?.kind === "status" ? JSON.stringify(edit.entry) : null}::jsonb ELSE saved_status END AS next_status
      FROM bookings
    -- The live agenda prefers a saved local status to upstream attendance
    -- and confirmation. Cowlendar syncing those fields is not another edit.
    ), hashes AS (
      SELECT string_agg(md5(jsonb_build_array(
        jsonb_build_array(id, starts_at,
          CASE WHEN saved_status ->> 'status' IN ('PRENOTATO', 'NON_PRESENTATO', 'RIPROGRAMMATO', 'INIZIATO', 'IN_ATTESA', 'COMPLETATO', 'ARRIVATO_IN_RITARDO', 'PAGATO')
            THEN payload - 'status' - 'attendance' - 'confirmation_status' ELSE payload END,
          sheet, saved_team, bot_update, saved_note), saved_status
        )::text), '' ORDER BY id) AS current,
        string_agg(md5(jsonb_build_array(
          jsonb_build_array(id, starts_at,
            CASE WHEN next_status ->> 'status' IN ('PRENOTATO', 'NON_PRESENTATO', 'RIPROGRAMMATO', 'INIZIATO', 'IN_ATTESA', 'COMPLETATO', 'ARRIVATO_IN_RITARDO', 'PAGATO')
              THEN payload - 'status' - 'attendance' - 'confirmation_status' ELSE payload END,
            sheet, next_team, bot_update, next_note), next_status
        )::text), '' ORDER BY id) FILTER (WHERE ${Boolean(change)}) AS projected
      FROM changes
    ), health AS (
        SELECT CASE
          WHEN bool_or(archive.error AND rate_limit.key IS NOT NULL) THEN 'rate-limited'
          WHEN bool_or(archive.error) THEN 'failed'
          WHEN count(completed_at) = ${months.length}::integer THEN 'ready'
          ELSE 'loading'
        END AS state
        FROM appointment_archive_sync AS archive
        LEFT JOIN settings AS rate_limit ON rate_limit.key = ${APPOINTMENT_ARCHIVE_RATE_LIMIT_KEY_PREFIX} || archive.month
        WHERE archive.month = ANY(${months}::text[])
    )
    SELECT md5(jsonb_build_array(hashes.current, health.state)::text) AS revision,
      CASE WHEN ${Boolean(change)} THEN md5(jsonb_build_array(hashes.projected, health.state)::text) END AS next_revision
    FROM hashes CROSS JOIN health
  `;
  return snapshot;
}

/** Compare the saved agenda for a Rome date range without returning customer data. */
export async function readAppointmentRangeRevision(from: string, to: string): Promise<string> {
  const snapshot = await readRangeRevisions({ from, to }, prisma);
  return snapshot.revision;
}

/** Project one edit on a single snapshot so concurrent edits keep their own revision. */
export async function readAppointmentEditRevisions(
  db: Prisma.TransactionClient,
  range: AppointmentAgendaRange,
  bookingId: string,
  edit: AppointmentAgendaEdit,
): Promise<AppointmentAgendaRevision> {
  const snapshot = await readRangeRevisions(range, db, { bookingId, edit });
  return { before: snapshot.revision, after: snapshot.next_revision ?? snapshot.revision };
}
