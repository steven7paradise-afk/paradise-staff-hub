import { assignedDailyAppointments } from "./daily-personal-goal";
import type { CowlendarBooking } from "./cowlendar";

export type ProfilePerformance = { monthLabel: string; total: number; activeDays: number; daily: { date: string; count: number }[]; services: { name: string; count: number }[] };
const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(date);
export function profilePerformance(bookings: CowlendarBooking[], teams: Parameters<typeof assignedDailyAppointments>[1], statuses: Parameters<typeof assignedDailyAppointments>[2], worker: { id: string; name: string }, names: string[], now = new Date()): ProfilePerformance {
  const today = dayKey(now);
  const month = today.slice(0, 7);
  const assigned = new Set(assignedDailyAppointments(bookings, teams, statuses, worker, names, []).map(item => item.id));
  const daily = Array.from({length: Number(today.slice(-2))}, (_, index) => ({date: `${month}-${String(index + 1).padStart(2, "0")}`, count: 0}));
  const services = new Map<string, number>();
  const seen = new Set<string>();
  for (const booking of bookings) {
    const status = String(statuses[booking.id]?.status || booking.attendance || booking.confirmation_status || "").trim().toUpperCase();
    if (!assigned.has(booking.id) || seen.has(booking.id) || !["COMPLETATO", "COMPLETA"].includes(status)) continue;
    const date = dayKey(new Date(booking.start_date));
    const day = daily.find(item => item.date === date);
    if (!day) continue;
    seen.add(booking.id); day.count++;
    const service = booking.service?.title?.trim() || "Servizio non specificato";
    services.set(service, (services.get(service) || 0) + 1);
  }
  return { monthLabel: new Intl.DateTimeFormat("it-IT", {month: "long", year: "numeric", timeZone: "Europe/Rome"}).format(now), total: seen.size, activeDays: daily.filter(day => day.count > 0).length, daily, services: [...services].map(([name,count]) => ({name,count})).sort((a,b) => b.count-a.count) };
}
