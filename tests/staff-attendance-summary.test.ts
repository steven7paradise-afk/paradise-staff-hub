import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStaffSummary } from "../lib/staff-attendance-summary";
const date = (day: string) => new Date(`${day}T00:00:00Z`);
const employee = { id: "1", name: "Utente 1", active: true, location: { name: "Salone" } };
const shift = (day = "2026-08-03", code = "L") => ({ user_id: "1", date: date(day), start_time: "09:00", end_time: "18:00", category: { name: code, code, start_time: null, end_time: null }, location: { name: "Salone" } });
const clock = (minute: number, type = "ENTRATA", note: string | null = null) => ({ user_id: "1", date: date("2026-08-03"), timestamp: new Date(`2026-08-03T07:${String(minute).padStart(2, "0")}:00Z`), type, note });
const leave = (type = "MALATTIA", status = "APPROVED") => ({ user_id: "1", type, status, start_date: date("2026-07-31"), end_date: date("2026-08-03"), start_time: null as string | null, end_time: null as string | null, reason: null as string | null });
const base = { employees: [employee], schedules: [shift()], clocks: [] as ReturnType<typeof clock>[], leaves: [] as ReturnType<typeof leave>[], start: date("2026-08-01"), end: date("2026-09-01"), now: new Date("2026-08-16T12:00:00Z") };
test("three-minute grace and late minutes", () => {
  assert.equal(buildStaffSummary({ ...base, clocks: [clock(3)] })[0].late, 0);
  const row = buildStaffSummary({ ...base, clocks: [clock(10)] })[0];
  assert.equal(row.late, 1); assert.equal(row.lateMinutes, 7); assert.equal(row.missing, 0);
});
test("missing clock needs verification; future, rest and closed shifts excluded", () => {
  const row = buildStaffSummary({ ...base, schedules: [shift(), shift("2026-08-17"), shift("2026-08-04", "R"), shift("2026-08-05", "CHIUSO")] })[0];
  assert.equal(row.missing, 1); assert.equal(row.events[0].status, "Da verificare");
});
test("approved overlapping sickness clipped to month and deduplicated", () => {
  const row = buildStaffSummary({ ...base, leaves: [leave(), leave()] })[0];
  assert.equal(row.sickness, 3); assert.equal(row.missing, 0);
});
test("sickness without justification is separate from justified sickness", () => {
  const row = buildStaffSummary({ ...base, employees: [{ ...employee, photo_url: "/photo.jpg" }], leaves: [{ ...leave(), sickness_unjustified: true }] })[0];
  assert.equal(row.sickness, 0); assert.equal(row.unjustified, 3); assert.equal(row.photoUrl, "/photo.jpg");
  assert.equal(row.events[0].status, "Senza giustifica");
});
test("pending/rejected leave does not excuse absence", () => {
  const row = buildStaffSummary({ ...base, leaves: [leave("FERIE", "PENDING"), leave("MALATTIA", "REJECTED")] })[0];
  assert.equal(row.pending, 1); assert.equal(row.holidays, 0); assert.equal(row.sickness, 0); assert.equal(row.missing, 1);
});
test("approved leave with times covering the shift is not a missing attendance", () => {
  const row = buildStaffSummary({ ...base, leaves: [{ ...leave("FERIE"), start_time: "00:00", end_time: "23:59" }] })[0];
  assert.equal(row.missing, 0); assert.equal(row.holidays, 3);
});
test("partial permit does not excuse missing clock; auto-late is not permit days", () => {
  const row = buildStaffSummary({ ...base, leaves: [{ ...leave("PERMESSO"), start_time: "10:00", end_time: "11:00" }, { ...leave("PERMESSO"), reason: "RITARDO AUTOMATICO — test" }] })[0];
  assert.equal(row.missing, 1); assert.equal(row.permits, 3);
});
test("break late logs counted with entrance late logs", () => {
  const row = buildStaffSummary({ ...base, clocks: [clock(10), clock(30, "RIENTRO", "Rientro pausa in ritardo: ritardo 5 min")] })[0];
  assert.equal(row.late, 2); assert.equal(row.lateMinutes, 12);
});
test("today before deadline is not absence", () => {
  assert.equal(buildStaffSummary({ ...base, now: new Date("2026-08-03T06:00:00Z") })[0].missing, 0);
});
