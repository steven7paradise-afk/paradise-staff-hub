import type { CowlendarBooking } from "./cowlendar";

export type PostoLampoControl = {
  id: string;
  updated_at: Date | string;
  answers: unknown;
  user_location_name: string | null;
};
export type PostoLampoRow = {
  id: string;
  date: string;
  client: string;
  salon: string;
  staff: string[];
  result: "Completato" | "Da verificare" | "Non effettuato";
  status: string;
  paid: number | null;
  order: string;
};
export type PostoLampoReport = {
  monthLabel: string;
  salon: string;
  generatedAt: string;
  rows: PostoLampoRow[];
  totals: { appointments: number; completed: number; toVerify: number; notPerformed: number };
};

export function isPostoLampo(value: unknown) {
  return /\bpost[oi]\s+lamp[oi]\b/i.test(String(value ?? ""));
}

function names(value: unknown): string[] {
  return (Array.isArray(value) ? value.map(String) : String(value ?? "").split(/[,;]+/)).map(name => name.trim()).filter(Boolean);
}
function isTrue(value: unknown) {
  return value === true || ["true", "1", "si", "sì"].includes(String(value ?? "").toLowerCase());
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function paid(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const amount = typeof value === "number" ? value : Number(String(value).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."));
  return Number.isFinite(amount) ? amount : null;
}
export function romeMonthRange(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) throw new Error("Periodo non valido");
  const boundary = (y: number, m: number) => {
    const utc = new Date(Date.UTC(y, m - 1, 1));
    const offset = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", timeZoneName: "shortOffset" }).formatToParts(utc).find(p => p.type === "timeZoneName")?.value;
    const hours = Number(offset?.match(/GMT\+(\d+)/)?.[1]);
    if (!hours) throw new Error("Fuso orario non disponibile");
    return new Date(utc.getTime() - hours * 3_600_000);
  };
  return { start: boundary(year, month), end: boundary(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1) };
}

export function buildPostoLampoReport({ bookings, controls, overrides, year, month, salon = "Tutti", todayOnly = false, hour = null, now = new Date() }: {
  bookings: CowlendarBooking[];
  controls: PostoLampoControl[];
  overrides: unknown;
  year: number;
  month: number;
  salon?: string;
  todayOnly?: boolean;
  hour?: string | null;
  now?: Date;
}): PostoLampoReport {
  const { start, end } = romeMonthRange(year, month);
  const overrideMap = record(overrides);
  const byBooking = new Map<string, PostoLampoControl[]>();
  for (const control of controls) {
    const answers = record(control.answers);
    const id = String(answers.booking_id ?? "");
    if (!id) continue;
    const list = byBooking.get(id) ?? [];
    list.push(control);
    byBooking.set(id, list);
  }
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
  const hourFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" });
  const labels: Record<string, string> = { booked: "Prenotato", paid: "Pagato", arrived: "Arrivato", completed: "Completato", started: "Iniziato", "no-show": "Non presentato", COMPLETATO: "Completato", NON_PRESENTATO: "Non presentato", PRENOTATO: "Prenotato", INIZIATO: "Iniziato", PAGATO: "Pagato", IN_ATTESA: "In attesa", ARRIVATO_IN_RITARDO: "Arrivato in ritardo" };
  const rows: PostoLampoRow[] = [];
  for (const booking of new Map(bookings.map(b => [b.id, b])).values()) {
    const date = new Date(booking.start_date);
    if (!isPostoLampo(booking.service?.title) || !(date >= start && date < end)) continue;
    if (todayOnly && day.format(date) !== day.format(now)) continue;
    if (hour && hourFormatter.format(date) !== hour) continue;
    const linked = (byBooking.get(booking.id) ?? []).sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    // The latest control is authoritative, including edits back to draft/error.
    const control = linked[0];
    const answers = record(control?.answers);
    const assigned = (booking.teammates ?? []).map(t => `${t.firstname ?? ""} ${t.lastname ?? ""}`.trim()).filter(Boolean);
    const location = String(answers.client_control_location || control?.user_location_name || (/DUOMO/i.test(assigned.join(" ")) ? "Salone Duomo" : /BUENOS\s*AIRES/i.test(assigned.join(" ")) ? "Salone Buenos Aires" : "Sede non indicata"));
    if (salon !== "Tutti" && location !== salon) continue;
    const state = String(record(overrideMap[booking.id]).status || booking.attendance || "");
    const correctness = String(answers.client_control_correctness ?? "").trim();
    const notPerformed = !!booking.is_canceled || /no[\s_-]*show|non_presentato/i.test(state) || /no[\s_-]*show/i.test(correctness);
    const invalidControl = isTrue(answers.client_control_is_draft) || correctness.toLowerCase() === "errore";
    const completed = !notPerformed && (state.toLowerCase() === "completed" || state === "COMPLETATO" || (!!control && !invalidControl));
    const staff = names(answers.client_control_service_staff);
    rows.push({ id: booking.id, date: date.toISOString(), client: String(answers.client_control_client_name || booking.customer?.name || "Cliente non indicato"), salon: location, staff: staff.length ? [...new Set(staff)] : names(answers.client_control_service_owner).length ? names(answers.client_control_service_owner) : assigned, result: notPerformed ? "Non effettuato" : completed ? "Completato" : "Da verificare", status: booking.is_canceled ? "Annullato" : labels[state] || "Da verificare", paid: invalidControl ? null : paid(answers.client_control_paid), order: String(answers.client_control_shopify_order ?? "") });
  }
  rows.sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { monthLabel: new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1))), salon, generatedAt: now.toISOString(), rows, totals: { appointments: rows.length, completed: rows.filter(r => r.result === "Completato").length, toVerify: rows.filter(r => r.result === "Da verificare").length, notPerformed: rows.filter(r => r.result === "Non effettuato").length } };
}
