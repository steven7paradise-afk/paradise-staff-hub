export const TIMEZONE = "Europe/Rome";
export function romeDate(date = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
export function romeIso(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "longOffset" }).formatToParts(date);
  const p = Object.fromEntries(parts.map(v => [v.type, v.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${p.timeZoneName.replace("GMT", "") || "+00:00"}`;
}
export function addDays(day: string, count: number) { return new Date(Date.parse(`${day}T12:00:00Z`) + count * 86400000).toISOString().slice(0, 10); }
export function dayStart(day: string) {
  const utc = new Date(`${day}T00:00:00Z`);
  const offset = romeIso(utc).slice(-6);
  return new Date(`${day}T00:00:00${offset}`);
}
export type ClockLog = { type: string; timestamp: Date };
export function attendanceForDay(logs: ClockLog[], day: string, now: Date) {
  const start = dayStart(day).getTime(), end = Math.min(dayStart(addDays(day, 1)).getTime(), now.getTime());
  let state: "OUT" | "IN" | "BREAK" = "OUT", since = 0, minutes = 0;
  let checkedIn: Date | null = null, checkedOut: Date | null = null, shiftEntry: Date | null = null;
  const breaks: { started_at: string; ended_at: string | null; minutes: number }[] = [];
  const duration = (a: number, b: number) => Math.max(0, Math.min(b, end) - Math.max(a, start)) / 60000;
  for (const log of [...logs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
    const time = log.timestamp.getTime(); if (time > end) break;
    if (log.type === "ENTRATA" && state === "OUT") { state = "IN"; since = time; shiftEntry = log.timestamp; if (time >= start) checkedIn ??= log.timestamp; }
    else if (log.type === "PAUSA" && state === "IN") { minutes += duration(since, time); if (time >= start) checkedIn ??= shiftEntry; state = "BREAK"; since = time; }
    else if (log.type === "RIENTRO" && state === "BREAK") { if (time >= start) breaks.push({ started_at: romeIso(new Date(Math.max(since, start))), ended_at: romeIso(log.timestamp), minutes: Math.round(duration(since, time)) }); state = "IN"; since = time; }
    else if (log.type === "USCITA" && state !== "OUT") {
      if (state === "IN") minutes += duration(since, time);
      else if (time >= start) breaks.push({ started_at: romeIso(new Date(Math.max(since, start))), ended_at: romeIso(log.timestamp), minutes: Math.round(duration(since, time)) });
      if (time >= start) { checkedOut = log.timestamp; checkedIn ??= shiftEntry; }
      state = "OUT";
    }
  }
  if (state === "IN") { minutes += duration(since, end); if (end >= start) checkedIn ??= shiftEntry; }
  if (state === "BREAK" && end >= start) { checkedIn ??= shiftEntry; breaks.push({ started_at: romeIso(new Date(Math.max(since, start))), ended_at: null, minutes: Math.round(duration(since, end)) }); }
  const status = state === "IN" ? "in_sede" : state === "BREAK" ? "in_pausa" : checkedOut ? "fuori_sede" : "non_timbrato";
  return { status: status as "in_sede" | "in_pausa" | "fuori_sede" | "non_timbrato", checked_in_at: checkedIn ? romeIso(checkedIn) : null, checked_out_at: state === "OUT" && checkedOut ? romeIso(checkedOut) : null, worked_minutes: Math.round(minutes), breaks };
}
