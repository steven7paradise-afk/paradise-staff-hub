import type { CowlendarBooking } from "./cowlendar";
import { isPostoLampo } from "./posto-lampo-report";

export const AGENDA_OUTCOMES = ["Scheda da creare", "No-show", "Spostato", "Annullato"] as const;
export const WAIT_REASONS = ["Ritardo lavoro precedente", "Sovrapposizione in agenda", "Personale mancante", "Altro"] as const;
export type AgendaNotes = {
  outcomes: Record<string, string>;
  waits: Array<{ bookingId: string; minutes: number; reason: string; note: string }>;
};
export type AgendaAppointment = { id: string; name: string; time: string; start: string; end?: string | null; service: string; staff: string; confirmed: boolean; outcome: string; automaticOutcome: boolean };
export type AgendaReport = { appointments: AgendaAppointment[]; totals: { planned: number; completed: number; noShow: number; cancelled: number; moved: number; flash: number }; notes: AgendaNotes; version: string | null; updatedAt: string };
export const emptyAgendaNotes = (): AgendaNotes => ({ outcomes: {}, waits: [] });
export function romeAgendaDate(value: string | Date) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(date) : "";
}
export function hasSavedServiceNotes(answers: Record<string, unknown> | undefined) {
  if (!answers || /no\s*show|non presentat/i.test(String(answers.client_control_correctness || ""))) return false;
  return [answers.client_control_notes_text, answers.client_control_shopify_order_note, answers.custom_extra_note].some(value => typeof value === "string" && value.trim().length > 0);
}
export function buildAgendaReport(day: string, bookings: CowlendarBooking[], controls: Array<{ answers: unknown; updated_at: Date | string }>, statuses: Record<string, { status?: string }>, teams: Record<string, { teammates?: Array<{ name?: string }> }>, notes: AgendaNotes) {
  const latest = new Map<string, Record<string, unknown>>();
  for (const control of [...controls].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))) {
    const a = control.answers as Record<string, unknown> | null;
    const id = String(a?.booking_id || "");
    if (id && a && !latest.has(id)) latest.set(id, a);
  }
  const distinct = new Map(bookings.filter(b => romeAgendaDate(b.start_date) === day && /buenos aires/i.test([b.service?.title, b.booking_str, b.form_data?.sede, b.form_data?.salone].join(" "))).map(b => [String(b.id), b]));
  const appointments: AgendaAppointment[] = [...distinct.values()].map(b => {
    const a = latest.get(String(b.id));
    const status = String(statuses[String(b.id)]?.status || b.attendance || b.confirmation_status || "").toUpperCase();
    const automatic = b.is_canceled || b.isCanceled || ["ANNULLATO", "CANCELLED", "CANCELED"].includes(status) ? "Annullato" : ["NON_PRESENTATO", "NO_SHOW", "NO-SHOW"].includes(status) ? "No-show" : ["RIPROGRAMMATO", "SPOSTATO", "RESCHEDULED"].includes(status) ? "Spostato" : "";
    const confirmed = !automatic && hasSavedServiceNotes(a);
    return { id: String(b.id), name: b.customer?.name || [b.form_data?.firstname, b.form_data?.lastname].filter(Boolean).join(" ") || "Cliente", time: new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(new Date(b.start_date)), start: b.start_date, end: b.end_date, service: b.service?.title || "Servizio", staff: (teams[String(b.id)]?.teammates?.map(t => t.name).filter(Boolean) || b.teammates?.map(t => `${t.firstname || ""} ${t.lastname || ""}`.split("|")[0].trim()) || []).join(", ") || "Non assegnato", confirmed, outcome: confirmed ? "" : automatic || notes.outcomes[String(b.id)] || "", automaticOutcome: Boolean(automatic) };
  }).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  return { appointments, totals: { planned: appointments.length, completed: appointments.filter(a => a.confirmed).length, noShow: appointments.filter(a => a.outcome === "No-show").length, cancelled: appointments.filter(a => a.outcome === "Annullato").length, moved: appointments.filter(a => a.outcome === "Spostato").length, flash: [...distinct.values()].filter(b => isPostoLampo(b.service?.title) && b.created_at && romeAgendaDate(b.created_at) === day).length } };
}

export function agendaGroup(a: AgendaAppointment, now: string): 'review' | 'upcoming' | 'progress' | 'resolved' | 'completed' {
  if (a.confirmed) return 'completed';
  if (['No-show', 'Annullato', 'Spostato'].includes(a.outcome)) return 'resolved';
  const time = new Date(now).getTime();
  if (new Date(a.start).getTime() > time) return 'upcoming';
  if (a.end && new Date(a.end).getTime() > time) return 'progress';
  return 'review';
}

/** Unfinished appointments, including those still in progress or yet to start. */
export function remainingAgendaAppointments(appointments: AgendaAppointment[]): number {
  return appointments.filter(a => !a.confirmed && !['No-show', 'Annullato', 'Spostato'].includes(a.outcome)).length;
}
