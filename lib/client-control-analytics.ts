import { appointmentStaffDisplayName } from "./appointment-staff-access";
import type { CowlendarBooking } from "./cowlendar";

export type AnalyticsCard = { id: string; created_at: string; updated_at: string; answers: Record<string, unknown>; user_location_name?: string | null };
export type AnalyticsStaff = { id: string; name: string; salon?: string; photoUrl?: string | null; active?: boolean };
export type AnalyticsCategory = "completed" | "missing" | "pending" | "cancelled" | "inconsistent";
export type AnalyticsRow = {
  id: string; bookingId: string; cardId: string; date: string; dateSource: "appointment" | "created";
  client: string; salon: string; category: AnalyticsCategory; primary: AnalyticsStaff | null;
  secondary: AnalyticsStaff[]; primaryNote: boolean; secondaryNotes: AnalyticsStaff[];
  note: string; services: string[]; order: string; reason: string; duplicates: number;
  discovery: string; discoveryDetail: string;
  legacy: boolean; checks: { before: boolean; after: boolean; products: boolean; review: boolean };
};
const str = (v: unknown) => String(v ?? "").trim();
const names = (v: unknown) => (Array.isArray(v) ? v.map(str) : str(v).split(/[,;]+/).map(str)).filter(Boolean);
const key = (v: unknown) => str(v).toLocaleLowerCase("it").replace(/\s+/g, " ");
export const romeDate = (date: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
export function analyticsMonthRange(month: string) {
  const [year, m] = month.split("-").map(Number);
  const startOfDay = (year: number, m: number) => {
    const d = new Date(Date.UTC(year, m - 1, 1, 12));
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }).format(d));
    return new Date(Date.UTC(year, m - 1, 1) - (hour - 12) * 3600000);
  };
  return { start: startOfDay(year, m), end: startOfDay(year, m + 1) };
}
function meaningful(v: unknown) {
  const s = str(v);
  return Boolean(s && !/^(nessuna nota aggiunta\.?|nota ancora da compilare\.?|nessun servizio selezionato\.?)$/i.test(s));
}
export function buildClientControlAnalytics(input: {
  month: string; cards: AnalyticsCard[]; bookings: CowlendarBooking[]; staff: AnalyticsStaff[];
  statuses?: Record<string, { status?: string }>;
}) {
  const staffById = new Map(input.staff.map(s => [s.id, s]));
  const identify = (id: unknown, name?: unknown): AnalyticsStaff | null => {
    if (str(id) && staffById.has(str(id))) return staffById.get(str(id))!;
    if (str(id)) return { id: str(id), name: str(name) || "Collaboratore non disponibile" };
    if (!str(name)) return null;
    return input.staff.find(s => key(appointmentStaffDisplayName(s.name, s.id)) === key(appointmentStaffDisplayName(str(name)))) || { id: `name:${key(name)}`, name: str(name) };
  };
  const bookings = new Map(input.bookings.map(b => [b.id, b]));
  const groups = new Map<string, AnalyticsCard[]>();
  for (const card of input.cards) {
    const b = bookings.get(str(card.answers.booking_id));
    if (romeDate(b?.start_date || card.created_at).slice(0, 7) !== input.month) continue;
    const id = str(card.answers.booking_id) || `card:${card.id}`;
    groups.set(id, [...(groups.get(id) || []), card]);
  }
  for (const b of input.bookings) if (romeDate(b.start_date).slice(0, 7) === input.month && !groups.has(b.id)) groups.set(b.id, []);
  const rows: AnalyticsRow[] = [];
  for (const [id, cards] of groups) {
    const confirmed = (c: AnalyticsCard) => key(c.answers.client_control_correctness) === "controllato" && c.answers.client_control_is_draft !== true;
    const card = [...cards].sort((a, b) => Number(confirmed(b)) - Number(confirmed(a)) || Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
    const a = card?.answers || {}; const booking = bookings.get(id);
    const state = key(input.statuses?.[id]?.status || booking?.attendance || booking?.confirmation_status);
    const correctness = key(a.client_control_correctness);
    const cancelled = Boolean(booking?.is_canceled) || [state, correctness].some(s => ["annullato", "canceled", "cancelled", "non_presentato", "no_show", "no-show", "no show"].includes(s));
    const inconsistent = Boolean(card) && ((correctness === "bozza" && a.client_control_is_draft === false) || (correctness === "controllato" && a.client_control_is_draft === true));
    const sections = Array.isArray(a.worker_service_sections) ? a.worker_service_sections as Record<string, unknown>[] : [];
    const selected = names(a.client_control_service_staff);
    const primary = identify(a.primary_staff_id || sections.find(s => !s.slot)?.staffId, a.client_control_service_owner || selected[0]);
    const sectionHasNote = (s: Record<string, unknown>) => names(s.services).length > 0 || names(s.details).some(meaningful);
    const hasSectionNotes = sections.some(sectionHasNote);
    const hasLegacyNote = meaningful(a.client_control_notes_text) || meaningful(a.custom_extra_note);
    const hasNote = sections.length ? hasSectionNotes : hasLegacyNote;
    const isConfirmed = Boolean(card && confirmed(card));
    const category: AnalyticsCategory = cancelled ? "cancelled" : inconsistent ? "inconsistent" : isConfirmed ? (hasNote ? "completed" : "missing") : !card && ["completed", "completato"].includes(state) ? "missing" : "pending";
    const secondary = [...new Map(sections.map(s => identify(s.staffId)).filter((s): s is AnalyticsStaff => Boolean(s && s.id !== primary?.id)).map(s => [s.id, s])).values()];
    const secondaryNotes = category === "completed" ? secondary.filter(s => sections.some(section => section.staffId === s.id && sectionHasNote(section))) : [];
    const primaryNote = category === "completed" && Boolean(primary) && (sections.length ? sections.some(s => s.staffId === primary!.id && sectionHasNote(s)) : hasLegacyNote);
    rows.push({ id, bookingId: booking?.id || str(a.booking_id), cardId: card?.id || "", date: romeDate(booking?.start_date || card!.created_at), dateSource: booking ? "appointment" : "created",
      client: str(a.client_control_client_name || booking?.customer?.name) || "Cliente non indicata", salon: str(a.client_control_location || card?.user_location_name) || "Sede non indicata",
      category, primary, secondary, primaryNote, secondaryNotes, note: str(a.client_control_notes_text || a.custom_extra_note), services: [...new Set([...names(a.custom_services), ...sections.flatMap(s => names(s.services))])],
      order: str(a.second_shopify_order || a.client_control_shopify_order), duplicates: Math.max(0, cards.length - 1), legacy: sections.length === 0,
      reason: cancelled ? "Annullato o non presentato: escluso dai conteggi note." : inconsistent ? "Stato e indicatore di bozza non coincidono: esclusa dai conteggi." : category === "missing" ? (card ? "Scheda confermata senza contenuto della nota." : "Appuntamento completato senza scheda collegata: verificare eventuali altri collegamenti.") : category === "pending" ? (hasNote ? "Nota presente, conferma ancora da verificare." : "Scheda da compilare o da confermare.") : sections.length ? "Note attribuite alle sezioni del servizio." : "Scheda storica: nota unica attribuita al principale; secondari non ricostruiti.",
      discovery: str(a.client_control_discovery_source) || "Non indicato", discoveryDetail: str(a.client_control_discovery_other),
      checks: { before: a.client_control_before_media === true, after: a.client_control_after_media === true, products: a.client_control_products === true, review: a.client_control_review === true },
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.client.localeCompare(b.client));
}
export function clientControlWorkerCounts(rows: AnalyticsRow[]) {
  const workers = new Map<string, AnalyticsStaff & { primary: number; secondary: number }>();
  for (const row of rows) {
    for (const [role, people] of [["primary", row.primaryNote && row.primary ? [row.primary] : []], ["secondary", row.secondaryNotes]] as const) {
      for (const person of people) {
        const item = workers.get(person.id) || { ...person, primary: 0, secondary: 0 };
        item[role]++; workers.set(person.id, item);
      }
    }
  }
  return [...workers.values()].sort((a, b) => b.primary - a.primary || b.secondary - a.secondary || a.name.localeCompare(b.name));
}

export function workerCalendarDays(month: string, rows: AnalyticsRow[], workerId: string, today = romeDate(new Date())) {
  const [year, m] = month.split("-").map(Number);
  return Array.from({ length: new Date(Date.UTC(year, m, 0)).getUTCDate() }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const count = rows.filter(r => r.date === date && r.primary?.id === workerId && r.primaryNote).length;
    const secondary = rows.filter(r => r.date === date && r.secondaryNotes.some(s => s.id === workerId)).length;
    return { date, count, secondary, tone: date > today ? "future" : count === 5 ? "green" : count > 5 ? "red" : "orange" };
  });
}

export type AnalyticsDelay = AnalyticsStaff & {
  entryMinutes: number; breakMinutes: number; totalMinutes: number;
  days: { date: string; entryMinutes: number; breakMinutes: number; totalMinutes: number }[];
};

export type AnalyticsAbsence = AnalyticsStaff & {
  requestId: string; from: string; to: string; time: string; type: string;
  category: "approved" | "unjustified" | "pending"; label: string;
};
