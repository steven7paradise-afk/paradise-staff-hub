import { APPOINTMENT_ARCHIVE_RATE_LIMIT_KEY_PREFIX, archiveMonths } from "./appointment-archive-range";
import { appointmentDayBoundaryIso } from "./appointment-date";
import { prisma } from "./prisma";
import { COWLENDAR_WEBHOOK_VERSION_FIELD } from "./cowlendar-webhook-archive";

/** Compare the saved agenda for a Rome date range without returning customer data. */
export async function readAppointmentRangeRevision(from: string, to: string): Promise<string> {
  const months = archiveMonths(from, to);
  const start = new Date(appointmentDayBoundaryIso(from));
  const end = new Date(appointmentDayBoundaryIso(to, true));
  const [snapshot] = await prisma.$queryRaw<{ revision: string }[]>`
    SELECT md5(jsonb_build_array(
      string_agg(
        md5(jsonb_build_array(
          booking.id,
          EXTRACT(EPOCH FROM booking.start_at),
          booking.payload - 'updated_at' - ${COWLENDAR_WEBHOOK_VERSION_FIELD}::text,
          CASE WHEN jsonb_typeof(booking.sheet) = 'object' THEN booking.sheet - 'updatedAt' END,
          status.value -> booking.id,
          (team.value -> booking.id) -> 'teammates',
          CASE WHEN jsonb_typeof(bot.value -> booking.id) = 'object'
            THEN (bot.value -> booking.id) - 'updatedAt' - 'source' END,
          NULLIF(btrim(note.value ->> 'text'), '')
        )::text),
        '' ORDER BY booking.id
      ),
      (
        SELECT CASE
          WHEN bool_or(archive.error AND rate_limit.key IS NOT NULL) THEN 'rate-limited'
          WHEN bool_or(archive.error) THEN 'failed'
          WHEN count(completed_at) = ${months.length}::integer THEN 'ready'
          ELSE 'loading'
        END
        FROM appointment_archive_sync AS archive
        LEFT JOIN settings AS rate_limit ON rate_limit.key = ${APPOINTMENT_ARCHIVE_RATE_LIMIT_KEY_PREFIX} || archive.month
        WHERE archive.month = ANY(${months}::text[])
      )
    )::text) AS revision
    FROM appointment_archive AS booking
    LEFT JOIN settings AS status ON status.key = 'appointment_status_overrides'
    LEFT JOIN settings AS team ON team.key = 'appointment_team_overrides'
    LEFT JOIN settings AS bot ON bot.key = 'appointment_bot_updates'
    LEFT JOIN settings AS note ON note.key = 'appointment_office_note:' || booking.id
    WHERE booking.start_at >= ${start} AND booking.start_at <= ${end}
  `;
  return snapshot.revision;
}
