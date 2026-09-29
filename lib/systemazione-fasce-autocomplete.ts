import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ASSISTANCE_TABLES_KEY, normalizeAssistanceSheets, type AssistanceSheet, type AssistanceTableRow } from "@/lib/assistance-tables";
import { CLIENT_CONTROL_FIELD_IDS as F, isClientControlFormName } from "@/lib/client-control-form";
import type { CowlendarBooking } from "@/lib/cowlendar";
import { findPreviousApplication, findSystemazioneControl, isSystemazioneFasceAppointment, previousApplicationStaff, responseMatchesAppointment, type PreviousClientControl, type SystemazioneFasceAppointment } from "@/lib/systemazione-fasce-table";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const missing = (value: unknown) => value == null || (typeof value === "string" && (!value.trim() || normalize(value) === "da verificare"));
const isTargetSheet = (sheet: AssistanceSheet) => /^sistemazione fasc(?:e|ia|ie)$/.test(normalize(sheet.name));
function columns(sheet: AssistanceSheet) {
  const find = (pattern: RegExp) => sheet.columns.find((column) => pattern.test(normalize(column.label)))?.id;
  return { previous: find(/^app(?:untamento)? precedente$/), current: find(/^sistemazione$/),
    name: find(/^nome cliente$/), email: find(/^e ?mail$/), phone: find(/^telefono$/), order: find(/^(numero )?ordine( shopify)?$/) };
}
function text(row: AssistanceTableRow, key?: string) { return key && typeof row.values[key] === "string" ? String(row.values[key]).trim() : ""; }
function hasPending(sheet: AssistanceSheet) {
  const c = columns(sheet);
  return isTargetSheet(sheet) && sheet.rows.some((row) => (c.previous && missing(row.values[c.previous])) || (c.current && missing(row.values[c.current])));
}

/** Read the newest known booking per ID, including cancellations. Never fetch externally. */
export function cachedSystemazioneAppointments(cacheValues: unknown[]): SystemazioneFasceAppointment[] {
  const latest = new Map<string, { timestamp: number; booking: CowlendarBooking }>();
  for (const value of cacheValues) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const cache = value as { timestamp?: number; data?: CowlendarBooking[] };
    if (!Array.isArray(cache.data)) continue;
    for (const booking of cache.data) {
      if (!booking?.id || !Number.isFinite(Date.parse(booking.start_date))) continue;
      const timestamp = Number(cache.timestamp) || 0;
      if (timestamp > (latest.get(String(booking.id))?.timestamp ?? -1)) latest.set(String(booking.id), { timestamp, booking });
    }
  }
  return [...latest.values()].map(({ booking: b }) => ({
    id: String(b.id), customerName: b.customer?.name?.trim() || [b.form_data?.firstname, b.form_data?.lastname].filter(Boolean).join(" "),
    customerEmail: b.customer?.email || String(b.form_data?.email || "") || null,
    customerPhone: b.customer?.phone || String(b.form_data?.phone || "") || null,
    serviceTitle: b.service?.title || "", shopifyOrderId: b.order_id ? String(b.order_id) : null,
    bookingStr: b.booking_str || null, startDate: b.start_date, teammates: [], notesText: null, isCanceled: Boolean(b.is_canceled),
  }));
}

/** Fill only missing staff cells; do not create rows, alter dates, or replace manual names. */
export function completePendingSystemazioneRows(sheets: AssistanceSheet[], appointments: SystemazioneFasceAppointment[], responses: PreviousClientControl[], now = new Date().toISOString()) {
  let filledCells = 0;
  let updatedRows = 0;
  const next = sheets.map((sheet) => {
    if (!hasPending(sheet)) return sheet;
    const c = columns(sheet);
    let changed = false;
    const rows = sheet.rows.map((row) => {
      if (!(c.previous && missing(row.values[c.previous])) && !(c.current && missing(row.values[c.current]))) return row;
      const sourceId = row.id.startsWith("sistemazione-fasce:") ? row.id.slice("sistemazione-fasce:".length) : null;
      const answers = { [F.clientName]: text(row, c.name), [F.email]: text(row, c.email), [F.phone]: text(row, c.phone), [F.shopifyOrder]: text(row, c.order) };
      const candidates = appointments.filter((appointment) => !appointment.isCanceled && isSystemazioneFasceAppointment(appointment.serviceTitle)
        && (sourceId ? String(appointment.id) === sourceId : responseMatchesAppointment(answers, appointment)));
      // Historical/manual rows with multiple bookings need review, not a guessed date.
      if (candidates.length !== 1) return row;
      const source = candidates[0];
      const appointment = { ...source, bookingStr: text(row, c.order) || source.bookingStr,
        customerName: text(row, c.name) || source.customerName, customerEmail: text(row, c.email) || source.customerEmail,
        customerPhone: text(row, c.phone) || source.customerPhone };
      const values = { ...row.values };
      for (const [key, response] of [
        [c.previous, c.previous && missing(values[c.previous]) ? findPreviousApplication(appointment, responses) : null],
        [c.current, c.current && missing(values[c.current]) ? findSystemazioneControl(appointment, responses) : null],
      ] as const) {
        const staff = previousApplicationStaff(response);
        if (key && missing(values[key]) && staff) { values[key] = staff; filledCells += 1; }
      }
      if (JSON.stringify(values) === JSON.stringify(row.values)) return row;
      changed = true; updatedRows += 1;
      return { ...row, values, updatedAt: now, reviewedAt: null, reviewedBy: null };
    });
    return changed ? { ...sheet, rows, updatedAt: now } : sheet;
  });
  return { sheets: next, filledCells, updatedRows };
}

export async function loadAutocompletedAssistanceSheets(db: Pick<typeof prisma, "setting" | "serviceForm" | "serviceFormResponse"> = prisma) {
  const setting = await db.setting.findUnique({ where: { key: ASSISTANCE_TABLES_KEY }, select: { value: true } });
  const sheets = normalizeAssistanceSheets(setting?.value);
  if (!setting || !sheets.some(hasPending)) return sheets;
  try {
    const [caches, forms] = await Promise.all([
      db.setting.findMany({ where: { OR: [{ key: { startsWith: "cowlendar_cache_range_" } }, { key: { startsWith: "cowlendar_cache_bookings_" } }] }, select: { value: true } }),
      db.serviceForm.findMany({ select: { id: true, name: true, category: true } }),
    ]);
    const formIds = forms.filter((form) => isClientControlFormName(form.name, form.category)).map((form) => form.id);
    const appointments = cachedSystemazioneAppointments(caches.map((cache) => cache.value));
    if (!appointments.length || !formIds.length) return sheets;
    const rawResponses = await db.serviceFormResponse.findMany({ where: { form_id: { in: formIds } }, select: { id: true, created_at: true, answers: true }, orderBy: { created_at: "desc" } });
    const responses = rawResponses.map((response) => ({ id: response.id, createdAt: response.created_at, answers: response.answers as Record<string, unknown> }));
    const result = completePendingSystemazioneRows(sheets, appointments, responses);
    if (!result.updatedRows) return sheets;
    // Optimistic write: if someone edited any sheet meanwhile, never overwrite it.
    const saved = await db.setting.updateMany({ where: { key: ASSISTANCE_TABLES_KEY, value: { equals: setting.value as Prisma.InputJsonValue } }, data: { value: result.sheets as unknown as Prisma.InputJsonValue } });
    if (saved.count) return result.sheets;
    return normalizeAssistanceSheets((await db.setting.findUnique({ where: { key: ASSISTANCE_TABLES_KEY }, select: { value: true } }))?.value);
  } catch (error) {
    console.error("Completamento automatico Sistemazione fasce non riuscito", error);
    return sheets;
  }
}
