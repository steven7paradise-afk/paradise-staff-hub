import { appointmentDateKey } from "./appointment-date";
import { prisma } from "./prisma";

export type ClientControlAppointmentStatus = "completed" | "upcoming" | "canceled" | "past";

export type ClientControlCowlendarHistory = {
  status: "ready" | "unlinked";
  customer: { name: string; email: string; phone: string } | null;
  total: number;
  completed: number;
  upcoming: number;
  canceled: number;
  appointments: Array<{ id: string; date: string; day: string; service: string; status: ClientControlAppointmentStatus }>;
  orderId: string | null;
};

type ArchiveHistoryRow = Omit<ClientControlCowlendarHistory, "appointments" | "orderId"> & {
  appointments: Array<Omit<ClientControlCowlendarHistory["appointments"][number], "day">>;
  orderId: string | null;
};

export async function loadClientControlCowlendarHistory(bookingId: string): Promise<ClientControlCowlendarHistory | null> {
  const [history] = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL statement_timeout = '2500ms'`;
    return tx.$queryRaw<ArchiveHistoryRow[]>`
    WITH normalized AS NOT MATERIALIZED (
      SELECT booking.id, booking.start_at, booking.payload, contact.name, contact.email, contact.phone,
        LOWER(REGEXP_REPLACE(contact.name, '[[:space:]]+', ' ', 'g')) AS name_key,
        CASE WHEN contact.email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
          THEN LOWER(contact.email) END AS email_key,
        CASE
          WHEN phone.digits ~ '^39(0[0-9]{7,10}|3[0-9]{9})$' THEN SUBSTRING(phone.digits FROM 3)
          WHEN phone.digits ~ '^[0-9]{8,15}$' THEN phone.digits
        END AS phone_key
      FROM appointment_archive AS booking
      CROSS JOIN LATERAL (
        SELECT NULLIF(BTRIM(booking.payload #>> '{customer,phone}'), '') AS phone
      ) AS direct
      LEFT JOIN LATERAL (
        SELECT MIN(answer.value #>> '{}') AS phone
        FROM JSONB_EACH(
          CASE WHEN JSONB_TYPEOF(booking.payload->'form_data') = 'object'
            THEN booking.payload->'form_data' ELSE '{}'::jsonb END
        ) AS answer
        WHERE direct.phone IS NULL
          AND answer.key ~* 'telefono|phone|cellulare'
          AND JSONB_TYPEOF(answer.value) = 'string'
          AND REGEXP_REPLACE(answer.value #>> '{}', '[^0-9]', '', 'g') ~ '^[0-9]{8,17}$'
        HAVING COUNT(DISTINCT REGEXP_REPLACE(answer.value #>> '{}', '[^0-9]', '', 'g')) = 1
      ) AS form ON TRUE
      CROSS JOIN LATERAL (
        SELECT COALESCE(NULLIF(BTRIM(booking.payload #>> '{customer,name}'), ''), BTRIM(CONCAT_WS(' ',
          booking.payload #>> '{form_data,firstname}', booking.payload #>> '{form_data,lastname}'))) AS name,
          COALESCE(BTRIM(booking.payload #>> '{customer,email}'), '') AS email,
          COALESCE(direct.phone, BTRIM(form.phone), '') AS phone
      ) AS contact
      CROSS JOIN LATERAL (
        SELECT REGEXP_REPLACE(REGEXP_REPLACE(contact.phone, '[^0-9]', '', 'g'), '^00', '') AS digits
      ) AS phone
    ),
    anchor AS MATERIALIZED (
      SELECT * FROM normalized WHERE id = ${bookingId}
    ),
    matched AS MATERIALIZED (
      SELECT id, start_at, payload FROM anchor
      UNION ALL
      SELECT candidate.id, candidate.start_at, candidate.payload
      FROM anchor
      JOIN normalized AS candidate ON candidate.id <> anchor.id
        AND (candidate.email_key = anchor.email_key OR candidate.phone_key = anchor.phone_key)
        AND (anchor.email_key IS NULL OR candidate.email_key IS NULL OR candidate.email_key = anchor.email_key)
        AND (anchor.phone_key IS NULL OR candidate.phone_key IS NULL OR candidate.phone_key = anchor.phone_key)
        AND (candidate.name_key = '' OR anchor.name_key = '' OR candidate.name_key = anchor.name_key)
      WHERE anchor.email_key IS NOT NULL OR anchor.phone_key IS NOT NULL
    ),
    history AS MATERIALIZED (
      SELECT matched.id, start_at, COALESCE(NULLIF(BTRIM(payload #>> '{service,title}'), ''), 'Servizio non indicato') AS service,
        CASE
          WHEN COALESCE(payload->>'is_canceled', payload->>'isCanceled') = 'true'
            OR effective.status IN ('annullato', 'annullata', 'canceled', 'cancelled', 'non_presentato', 'no_show', 'no-show', 'no show')
            THEN 'canceled'
          WHEN effective.status IN ('completed', 'completato', 'completata', 'pagato', 'paid') THEN 'completed'
          WHEN start_at >= CURRENT_TIMESTAMP THEN 'upcoming'
          ELSE 'past'
        END AS status
      FROM matched
      LEFT JOIN settings ON settings.key = 'appointment_status_overrides'
      CROSS JOIN LATERAL (
        SELECT LOWER(COALESCE(NULLIF(BTRIM(settings.value->matched.id->>'status'), ''),
          NULLIF(BTRIM(payload->>'attendance'), ''), NULLIF(BTRIM(payload->>'confirmation_status'), ''), '')) AS status
      ) AS effective
    ),
    totals AS (
      SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'upcoming')::int AS upcoming,
        COUNT(*) FILTER (WHERE status = 'canceled')::int AS canceled
      FROM history
    ),
    recent AS (
      SELECT id, start_at, service, status FROM history ORDER BY start_at DESC, id LIMIT 20
    )
    SELECT CASE WHEN anchor.email_key IS NOT NULL OR anchor.phone_key IS NOT NULL THEN 'ready' ELSE 'unlinked' END AS status,
      CASE WHEN anchor.name <> '' OR anchor.email <> '' OR anchor.phone <> ''
        THEN JSONB_BUILD_OBJECT('name', anchor.name, 'email', anchor.email, 'phone', anchor.phone) END AS customer,
      totals.*,
      (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', id, 'date', start_at, 'service', service, 'status', status)
        ORDER BY start_at DESC, id) FROM recent) AS appointments,
      anchor.payload->>'order_id' AS "orderId"
    FROM anchor CROSS JOIN totals
    `;
  }, { maxWait: 1000, timeout: 4000 });
  if (!history) return null;

  const orderId = history.orderId?.trim().match(/^(?:gid:\/\/shopify\/Order\/)?([0-9]+)$/)?.[1] ?? null;
  const appointments = history.appointments.map(appointment => {
    const instant = new Date(appointment.date);
    return { ...appointment, date: instant.toISOString(), day: appointmentDateKey(instant) };
  });
  return { ...history, orderId, appointments };
}
