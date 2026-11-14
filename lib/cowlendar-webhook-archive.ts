import { Prisma } from "@prisma/client";
import type { CowlendarBooking } from "./cowlendar";
import { archiveSearchText } from "./appointment-archive-range";

export const COWLENDAR_WEBHOOK_VERSION_FIELD = "archiveWebhookUpdatedAt";

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function dateTime(value: unknown): value is string {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value));
}

function nullableString(value: unknown) {
  return value === null || typeof value === "string";
}

// A partial webhook must never replace the source data already in the archive.
export function parseCowlendarWebhookBooking(data: unknown, type: string) {
  const booking = object(data);
  if (!booking) return null;
  const service = object(booking.service);
  const customer = object(booking.customer);
  const price = object(booking.price);

  if (typeof booking.id !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(booking.id) ||
      !dateTime(booking.start_date) || !dateTime(booking.end_date) || !dateTime(booking.updated_at) ||
      Date.parse(booking.end_date) < Date.parse(booking.start_date) ||
      typeof booking.is_canceled !== "boolean" || (type === "booking.canceled" && !booking.is_canceled) ||
      typeof booking.booking_str !== "string" ||
      (booking.booking_type !== undefined && !nullableString(booking.booking_type)) ||
      !nullableString(booking.order_id) || !nullableString(booking.confirmation_status) ||
      !nullableString(booking.attendance) || !nullableString(booking.financial_status) ||
      !service || typeof service.id !== "string" || !nullableString(service.title) ||
      !customer || !nullableString(customer.name) || !nullableString(customer.email) ||
      !nullableString(customer.phone) || !object(booking.form_data) ||
      !price || typeof price.amount !== "number" || !Number.isFinite(price.amount) ||
      !nullableString(price.currency) || !Array.isArray(booking.teammates) ||
      !booking.teammates.every((entry) => {
        const teammate = object(entry);
        return teammate && typeof teammate.id === "string" &&
          nullableString(teammate.firstname) && nullableString(teammate.lastname);
      })) return null;

  // The name is derived locally from the linked Shopify order, never from Cowlendar.
  const source = { ...booking };
  delete source.archiveOrderName;
  delete source[COWLENDAR_WEBHOOK_VERSION_FIELD];
  return source as CowlendarBooking & { updated_at: string };
}

export function cowlendarArchiveVersion(value: unknown) {
  return dateTime(value) ? Date.parse(value) : null;
}

export function cowlendarWebhookVersion(payload: Prisma.Sql) {
  return Prisma.sql`CASE
    WHEN jsonb_typeof(${payload}->${COWLENDAR_WEBHOOK_VERSION_FIELD}::text) = 'number'
    THEN (${payload}->>${COWLENDAR_WEBHOOK_VERSION_FIELD}::text)::numeric
    ELSE NULL END`;
}

/** Apply one authenticated upstream booking without spending the GET quota. */
export async function applyCowlendarWebhookBooking(
  tx: Prisma.TransactionClient,
  booking: CowlendarBooking & { updated_at: string },
  receivedAt: Date,
): Promise<boolean> {
  const sourceVersion = Date.parse(booking.updated_at);
  const data = { ...booking, [COWLENDAR_WEBHOOK_VERSION_FIELD]: sourceVersion };
  const startAt = new Date(booking.start_date);

  for (;;) {
    const inserted = await tx.$executeRaw`
      INSERT INTO appointment_archive (id, start_at, search_text, payload, synced_at)
      VALUES (${booking.id}, ${startAt}, ${archiveSearchText(booking)}, ${JSON.stringify(data)}::jsonb, ${receivedAt})
      ON CONFLICT (id) DO NOTHING
    `;
    if (inserted) return true;

    const [saved] = await tx.$queryRaw<{ payload: Prisma.JsonValue }[]>`
      SELECT payload FROM appointment_archive WHERE id = ${booking.id} FOR UPDATE
    `;
    // Monthly reconciliation could have deleted the row since the insert conflict.
    if (!saved) continue;

    const payload = object(saved.payload);
    const marker = payload?.[COWLENDAR_WEBHOOK_VERSION_FIELD];
    const savedVersion = typeof marker === "number" && Number.isFinite(marker)
      ? marker : cowlendarArchiveVersion(payload?.updated_at);
    // Equal versions are ambiguous and can be resolved by the normal import.
    if (savedVersion !== null && savedVersion >= sourceVersion) return false;

    const orderName = String(payload?.order_id ?? "") === String(booking.order_id ?? "") &&
      typeof payload?.archiveOrderName === "string"
      ? payload.archiveOrderName : null;
    await tx.$executeRaw`
      UPDATE appointment_archive SET start_at = ${startAt},
        search_text = ${archiveSearchText(booking, orderName || "")},
        payload = COALESCE(payload, '{}'::jsonb) || ${JSON.stringify({ ...data, archiveOrderName: orderName })}::jsonb,
        synced_at = GREATEST(synced_at, ${receivedAt})
      WHERE id = ${booking.id}
    `;
    return true;
  }
}
