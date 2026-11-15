import { Prisma } from "@prisma/client";
import type { CowlendarBooking } from "./cowlendar";
import { archiveSearchText } from "./appointment-archive-range";

export const COWLENDAR_WEBHOOK_VERSION_FIELD = "archiveWebhookUpdatedAt";
export const COWLENDAR_DAY_VERSION_FIELD = "archiveDayUpdatedAt";

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function dateTime(value: unknown): value is string {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().startsWith(value.slice(0, 10));
}

function nonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function optionalStrings(source: Record<string, unknown>, fields: string[]) {
  const result = { ...source };
  for (const field of fields) {
    if (result[field] !== null && typeof result[field] !== "string") delete result[field];
  }
  return result;
}

type ParsedWebhookBooking = {
  booking: CowlendarBooking;
  sourceVersion: number;
  insertOnly: boolean;
};

export function parseCowlendarWebhookBooking(data: unknown, type: string, eventCreatedAt?: unknown): ParsedWebhookBooking | null {
  const booking = object(data);
  if (!booking) return null;

  if (typeof booking.id !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(booking.id) ||
      !dateTime(booking.start_date) ||
      (booking.end_date != null && (!dateTime(booking.end_date) || Date.parse(booking.end_date) < Date.parse(booking.start_date))) ||
      (booking.is_canceled != null && typeof booking.is_canceled !== "boolean") ||
      (type === "booking.canceled" && booking.is_canceled === false)) return null;

  // The creation timestamp is stable across delivery retries but does not version an existing row.
  const insertOnly = booking.updated_at == null && type === "booking.created";
  const sourceVersion = cowlendarArchiveVersion(insertOnly ? eventCreatedAt : booking.updated_at);
  if (sourceVersion === null) return null;

  const source = optionalStrings(booking, [
    "booking_str", "booking_type", "timezone", "confirmation_status", "attendance", "financial_status",
    "notes", "note", "internal_note", "customer_note", "created_at",
  ]);
  if (typeof booking.order_id === "number" && Number.isSafeInteger(booking.order_id) && booking.order_id > 0) {
    source.order_id = String(booking.order_id);
  } else if (booking.order_id !== null && !nonemptyString(booking.order_id)) delete source.order_id;
  if (booking.end_date == null) delete source.end_date;
  if (insertOnly) delete source.updated_at;
  if (booking.is_canceled == null) delete source.is_canceled;
  if (type === "booking.canceled") source.is_canceled = true;

  const service = object(booking.service);
  if (service && /^[a-zA-Z0-9_-]{1,160}$/.test(typeof service.id === "string" ? service.id : "")) {
    source.service = optionalStrings(service, ["title", "type", "image_url", "image", "thumbnail"]);
  } else delete source.service;

  const customer = object(booking.customer);
  if (customer) source.customer = optionalStrings(customer, ["name", "email", "phone", "locale"]);
  else delete source.customer;
  if (!object(booking.form_data)) delete source.form_data;

  const price = object(booking.price);
  if (price) {
    const normalizedPrice = optionalStrings(price, ["currency"]);
    if (price.amount !== null && !Number.isFinite(price.amount)) delete normalizedPrice.amount;
    source.price = normalizedPrice;
  } else delete source.price;

  const teammates = Array.isArray(booking.teammates) ? booking.teammates.map(object) : null;
  if (teammates?.every((teammate): teammate is Record<string, unknown> => teammate !== null && nonemptyString(teammate.id))) {
    source.teammates = teammates.map(teammate => optionalStrings(teammate, ["firstname", "lastname", "thumbnail"]));
  } else delete source.teammates;

  // The name is derived locally from the linked Shopify order, never from Cowlendar.
  delete source.archiveOrderName;
  delete source[COWLENDAR_WEBHOOK_VERSION_FIELD];
  delete source[COWLENDAR_DAY_VERSION_FIELD];
  return { booking: source as CowlendarBooking, sourceVersion, insertOnly };
}

export function cowlendarArchiveVersion(value: unknown) {
  return dateTime(value) ? Date.parse(value) : null;
}

export function cowlendarSavedArchiveVersion(payload: unknown) {
  const saved = object(payload);
  const observed = [
    cowlendarArchiveVersion(saved?.updated_at),
    saved?.[COWLENDAR_WEBHOOK_VERSION_FIELD],
    saved?.[COWLENDAR_DAY_VERSION_FIELD],
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return observed.length ? Math.max(...observed) : null;
}

export function cowlendarArchiveProtectionVersion(payload: Prisma.Sql) {
  const numericField = (field: string) => Prisma.sql`CASE
    WHEN jsonb_typeof(${payload}->${field}::text) = 'number'
    THEN (${payload}->>${field}::text)::numeric
    ELSE NULL END`;
  return Prisma.sql`GREATEST(${numericField(COWLENDAR_WEBHOOK_VERSION_FIELD)}, ${numericField(COWLENDAR_DAY_VERSION_FIELD)})`;
}

/** Apply one authenticated upstream booking without spending the GET quota. */
export async function applyCowlendarWebhookBooking(
  tx: Prisma.TransactionClient,
  { booking, sourceVersion, insertOnly }: ParsedWebhookBooking,
  receivedAt: Date,
): Promise<boolean | null> {
  const data = { ...booking, [COWLENDAR_WEBHOOK_VERSION_FIELD]: sourceVersion };
  const startAt = new Date(booking.start_date);
  const canInsert = nonemptyString(booking.service?.id) && nonemptyString(booking.service?.title) && (
    nonemptyString(booking.customer?.name) || nonemptyString(booking.customer?.email) || nonemptyString(booking.customer?.phone) ||
    (nonemptyString(booking.form_data?.firstname) && nonemptyString(booking.form_data?.lastname))
  );

  for (;;) {
    if (canInsert) {
      const inserted = await tx.$executeRaw`
        INSERT INTO appointment_archive (id, start_at, search_text, payload, synced_at)
        VALUES (${booking.id}, ${startAt}, ${archiveSearchText(booking)}, ${JSON.stringify(data)}::jsonb, ${receivedAt})
        ON CONFLICT (id) DO NOTHING
      `;
      if (inserted) return true;
    }

    const [saved] = await tx.$queryRaw<{ payload: Prisma.JsonValue }[]>`
      SELECT payload FROM appointment_archive WHERE id = ${booking.id} FOR UPDATE
    `;
    // Monthly reconciliation could have deleted the row since the insert conflict.
    if (!saved) {
      if (canInsert) continue;
      return null;
    }

    const payload = object(saved.payload);
    const savedVersion = cowlendarSavedArchiveVersion(payload);
    // Equal versions are ambiguous and can be resolved by the normal import.
    if (insertOnly || (savedVersion !== null && savedVersion >= sourceVersion)) return false;

    const merged: Record<string, unknown> = { ...payload, ...data };
    for (const key of ["service", "customer", "form_data", "price"] as const) {
      const patch = object(booking[key]);
      const previous = object(payload?.[key]);
      if (patch && previous && (!patch.id || !previous.id || patch.id === previous.id)) {
        merged[key] = { ...previous, ...patch };
      }
    }
    if (booking.teammates && Array.isArray(payload?.teammates)) {
      const previous = new Map(payload.teammates.map(object).map(teammate => [teammate?.id, teammate]));
      merged.teammates = booking.teammates.map(teammate => ({ ...previous.get(teammate.id), ...teammate }));
    }
    // Moving a booking without its new end time would retain the old slot's duration.
    if (booking.end_date == null && dateTime(payload?.start_date) && Date.parse(payload.start_date) !== startAt.getTime()) return null;
    if (payload?.is_canceled === true && booking.is_canceled !== true) {
      merged.is_canceled = true;
      merged.confirmation_status = payload.confirmation_status;
      merged.attendance = payload.attendance;
    }

    const orderName = String(payload?.order_id ?? "") === String(merged.order_id ?? "") &&
      typeof payload?.archiveOrderName === "string"
      ? payload.archiveOrderName : null;
    await tx.$executeRaw`
      UPDATE appointment_archive SET start_at = ${startAt},
        search_text = ${archiveSearchText(merged, orderName || "")},
        payload = ${JSON.stringify({ ...merged, archiveOrderName: orderName })}::jsonb,
        synced_at = GREATEST(synced_at, ${receivedAt})
      WHERE id = ${booking.id}
    `;
    return true;
  }
}
