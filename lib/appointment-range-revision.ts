import { archiveMonths } from "./appointment-archive-range";
import { appointmentDayBoundaryIso } from "./appointment-date";
import { prisma } from "./prisma";

/** Compare the saved agenda for a Rome date range without returning customer data. */
export async function readAppointmentRangeRevision(from: string, to: string): Promise<string> {
  const months = archiveMonths(from, to);
  const start = new Date(appointmentDayBoundaryIso(from));
  const end = new Date(appointmentDayBoundaryIso(to, true));
  const [snapshot] = await prisma.$queryRaw<{ revision: string }[]>`
    SELECT md5(COALESCE(
      string_agg(
        md5(jsonb_build_array(
          booking.id,
          EXTRACT(EPOCH FROM booking.start_at),
          booking.payload - 'updated_at',
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
          WHEN count(completed_at) = ${months.length}::integer THEN 'ready'
          WHEN bool_or(error) THEN 'failed'
          ELSE 'loading'
        END
        FROM appointment_archive_sync
        WHERE month = ANY(${months}::text[])
      )
    )) AS revision
    FROM appointment_archive AS booking
    LEFT JOIN settings AS status ON status.key = 'appointment_status_overrides'
    LEFT JOIN settings AS team ON team.key = 'appointment_team_overrides'
    LEFT JOIN settings AS bot ON bot.key = 'appointment_bot_updates'
    LEFT JOIN settings AS note ON note.key = 'appointment_office_note:' || booking.id
    WHERE booking.start_at >= ${start} AND booking.start_at <= ${end}
  `;
  return snapshot.revision;
}
