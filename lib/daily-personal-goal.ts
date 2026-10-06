import { resolveCanonicalStaffName } from "./client-control-normalize";

// Cowlendar can use a first name plus surname initial (e.g. MELISSA J).
// Resolve abbreviations only when they identify exactly one staff member.
export function resolveDashboardStaffName(value: string, knownNames: string[]) {
  const clean = value.split("|")[0].trim();
  const tokens = (name: string) => name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const parts = tokens(clean);
  if (!parts.length) return "";
  const exact = knownNames.find(name => tokens(name).join(" ") === parts.join(" "));
  if (exact) return exact;
  const candidates = knownNames.filter(name => {
    const full = tokens(name);
    return parts.length <= full.length && parts.every((part, index) => part === full[index] || (index > 0 && part.length === 1 && full[index]?.startsWith(part)));
  });
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) return clean;
  return resolveCanonicalStaffName(clean, knownNames);
}

// The daily target is shared by all three levels, including staff awaiting level assignment.
export function dailyPersonalTarget(_workforceData: unknown): number {
  return 5;
}

const names = (value: unknown): string[] => (Array.isArray(value) ? value : String(value || "").split(/[,;]+/)).map(String).map(value => value.trim()).filter(Boolean);
const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

type Card = { id: string; created_at: Date; answers: unknown; user?: { name: string | null } | null };
export function countDailyCompletedCards(cards: Card[], worker: { id: string; name: string }, canonicalNames: string[], today = new Date()) {
  const counted = new Set<string>();
  const workerName = resolveDashboardStaffName(worker.name, canonicalNames);
  for (const card of cards) {
    const a = (card.answers || {}) as Record<string, unknown>;
    if (a.client_control_is_draft === true || String(a.client_control_correctness || "").trim().toLowerCase() !== "controllato") continue;
    const completedAt = a.client_control_completed_at ? new Date(String(a.client_control_completed_at)) : card.created_at;
    if (!Number.isFinite(completedAt.getTime()) || dayKey(completedAt) !== dayKey(today)) continue;
    const sections = Array.isArray(a.worker_service_sections) ? a.worker_service_sections as Array<{ staffId?: string }> : [];
    const selected = names(a.client_control_service_staff);
    const owner = names(a.client_control_service_owner);
    const assigned = sections.length ? sections.some(section => section.staffId === worker.id)
      : (selected.length ? selected : owner.length ? owner : [card.user?.name || ""]).some(name => resolveDashboardStaffName(name, canonicalNames) === workerName);
    if (assigned) counted.add(String(a.booking_id || card.id));
  }
  return counted.size;
}

export type AssignedDailyAppointment = { id: string; client: string; service: string; start: string; noteCompleted: boolean };
export function assignedDailyAppointments(
  bookings: import("./cowlendar").CowlendarBooking[],
  teamOverrides: Record<string, { teammates?: Array<{ id?: string; name?: string }> }>,
  statuses: Record<string, { status?: string }>,
  worker: { id: string; name: string }, canonicalNames: string[], cards: Card[],
): AssignedDailyAppointment[] {
  const canonical = resolveDashboardStaffName(worker.name, canonicalNames);
  const completed = new Set(cards.filter(card => {
    const a = (card.answers || {}) as Record<string, unknown>;
    return a.client_control_is_draft !== true && String(a.client_control_correctness || "").toLowerCase() === "controllato";
  }).map(card => String((card.answers as Record<string, unknown>).booking_id || "")));
  const seen = new Set<string>();
  return bookings.filter(booking => {
    if (seen.has(booking.id)) return false;
    seen.add(booking.id);
    const status = String(statuses[booking.id]?.status || booking.attendance || booking.confirmation_status || "").toUpperCase();
    if (booking.is_canceled || ["ANNULLATO", "CANCELED", "CANCELLED", "NON_PRESENTATO", "NO_SHOW"].includes(status)) return false;
    const overridden = teamOverrides[booking.id]?.teammates;
    const team = overridden?.length ? overridden : (booking.teammates || []).map(mate => ({ id: mate.id, name: `${mate.firstname || ""} ${mate.lastname || ""}`.split("|")[0].trim() }));
    return team.some(mate => mate.id === worker.id || (mate.name && resolveDashboardStaffName(mate.name, canonicalNames) === canonical));
  }).sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date)).map(booking => ({
    id: booking.id, client: booking.customer?.name || "Cliente", service: booking.service?.title || "Servizio", start: booking.start_date, noteCompleted: completed.has(String(booking.id)),
  }));
}

/** Counts each service once per booking, using only this worker's completed sections. */
export function dailyPerformedServices(cards: Card[], worker: { id: string; name: string }, canonicalNames: string[], today = new Date()) {
  const counted = new Set<string>();
  const totals = new Map<string, number>();
  const seenBookings = new Set<string>();
  for (const card of cards) {
    const a = (card.answers || {}) as Record<string, unknown>;
    const booking = String(a.booking_id || card.id);
    // Queries provide newest revisions first. Never revive an older saved revision.
    if (seenBookings.has(booking)) continue;
    seenBookings.add(booking);
    if (a.client_control_is_draft === true || String(a.client_control_correctness || "").trim().toLowerCase() !== "controllato") continue;
    const completedAt = a.client_control_completed_at ? new Date(String(a.client_control_completed_at)) : card.created_at;
    if (!Number.isFinite(completedAt.getTime()) || dayKey(completedAt) !== dayKey(today)) continue;
    const sections = Array.isArray(a.worker_service_sections) ? a.worker_service_sections as Array<{ staffId?: string; services?: unknown }> : [];
    let services: string[] = [];
    if (sections.length) services = sections.filter(section => section?.staffId === worker.id).flatMap(section => Array.isArray(section.services) ? section.services.filter((value): value is string => typeof value === "string") : []);
    else {
      const selected = names(a.client_control_service_staff);
      const assigned = selected.length ? selected : names(a.client_control_service_owner);
      // Legacy shared notes do not identify who performed each individual service.
      if (assigned.length === 1 && resolveDashboardStaffName(assigned[0], canonicalNames) === resolveDashboardStaffName(worker.name, canonicalNames)) services = names(a.custom_services);
    }
    for (const raw of services) {
      const service = raw.trim();
      const key = `${booking}:${service.toLocaleLowerCase("it")}`;
      if (!service || counted.has(key)) continue;
      counted.add(key);
      totals.set(service, (totals.get(service) || 0) + 1);
    }
  }
  return [...totals].map(([service, count]) => ({ service, count })).sort((a, b) => b.count - a.count || a.service.localeCompare(b.service, "it"));
}
