import type { Prisma } from "@prisma/client";
import { APPOINTMENT_ARCHIVE_RATE_LIMIT_KEY_PREFIX, archiveMonths } from "./appointment-archive-range";
import { appointmentDayBoundaryIso } from "./appointment-date";
import { prisma } from "./prisma";
import { COWLENDAR_WEBHOOK_VERSION_FIELD } from "./cowlendar-webhook-archive";

export type AppointmentAgendaRange = { from: string; to: string };
export type AppointmentAgendaRevision = { before: string; after: string };

async function readRangeRevisions(
  { from, to }: AppointmentAgendaRange,
  db: Prisma.TransactionClient,
  change?: { bookingId: string; entry: object },
) {
  const months = archiveMonths(from, to);
  const start = new Date(appointmentDayBoundaryIso(from));
  const end = new Date(appointmentDayBoundaryIso(to, true));
  const [snapshot] = await db.$queryRaw<{ revision: string; next_revision: string | null }[]>`
    WITH bookings AS (
      SELECT booking.id, status.value -> booking.id AS saved_status,
        jsonb_build_array(
          booking.id,
          EXTRACT(EPOCH FROM booking.start_at),
          booking.payload - 'updated_at' - ${COWLENDAR_WEBHOOK_VERSION_FIELD}::text,
          CASE WHEN jsonb_typeof(booking.sheet) = 'object' THEN booking.sheet - 'updatedAt' END,
          (team.value -> booking.id) -> 'teammates',
          CASE WHEN jsonb_typeof(bot.value -> booking.id) = 'object'
            THEN (bot.value -> booking.id) - 'updatedAt' - 'source' END,
          NULLIF(btrim(note.value ->> 'text'), '')
        ) AS details
      FROM appointment_archive AS booking
      LEFT JOIN settings AS status ON status.key = 'appointment_status_overrides'
      LEFT JOIN settings AS team ON team.key = 'appointment_team_overrides'
      LEFT JOIN settings AS bot ON bot.key = 'appointment_bot_updates'
      LEFT JOIN settings AS note ON note.key = 'appointment_office_note:' || booking.id
      WHERE booking.start_at >= ${start} AND booking.start_at <= ${end}
    ), hashes AS (
      SELECT string_agg(md5(jsonb_build_array(details, saved_status)::text), '' ORDER BY id) AS current,
        string_agg(md5(jsonb_build_array(details,
          CASE WHEN id = ${change?.bookingId ?? null}::text THEN ${change ? JSON.stringify(change.entry) : null}::jsonb
          ELSE saved_status END)::text), '' ORDER BY id) FILTER (WHERE ${Boolean(change)}) AS projected
      FROM bookings
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

/** Project a single status write on one database snapshot so concurrent edits keep their own revision. */
export async function readAppointmentStatusRevisions(
  db: Prisma.TransactionClient,
  range: AppointmentAgendaRange,
  bookingId: string,
  entry: object,
): Promise<AppointmentAgendaRevision> {
  const snapshot = await readRangeRevisions(range, db, { bookingId, entry });
  return { before: snapshot.revision, after: snapshot.next_revision ?? snapshot.revision };
}
