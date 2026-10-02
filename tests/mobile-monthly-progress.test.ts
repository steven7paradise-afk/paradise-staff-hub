import test from "node:test";
import assert from "node:assert/strict";
import { monthlyProgress } from "../lib/mobile-monthly-progress";
const date = new Date("2026-10-02T00:00:00Z");
const log = (type: string, time: string) => ({ date, type, timestamp: new Date(`2026-10-02T${time}:00+02:00`) });
const shift = { date, start_time: "10:00", end_time: "18:00", location: { name: "Salone" }, category: { code: "L", name: "Lavoro", start_time: null, end_time: null, paid_hours: null } };
const now = new Date("2026-10-02T15:00:00+02:00");
test("live monthly work excludes breaks and uses assigned shift", () => {
  const r = monthlyProgress([log("ENTRATA", "10:00"), log("PAUSA", "12:00"), log("RIENTRO", "13:00")], [shift], [], 60, now, "2026-10-02");
  assert.equal(r.workedSeconds, 4 * 3600); assert.equal(r.plannedSeconds, 7 * 3600); assert.equal(r.running, true); assert.equal(r.lateMinutes, 0);
});
test("pause freezes work; completed pause and entrance delays follow policy", () => {
  const r = monthlyProgress([log("ENTRATA", "10:10"), log("PAUSA", "12:00"), log("RIENTRO", "13:05"), log("USCITA", "14:00")], [shift], [], 60, now, "2026-10-02");
  assert.equal(r.lateMinutes, 12); assert.equal(r.workedSeconds, 165 * 60); assert.equal(r.running, false);
});
test("open historical day does not grow indefinitely", () => {
  const r = monthlyProgress([log("ENTRATA", "10:00")], [shift], [], 60, new Date("2026-10-03T15:00:00+02:00"), "2026-10-03");
  assert.equal(r.workedSeconds, 0); assert.equal(r.incompleteDays, 1); assert.equal(r.running, false);
});
test("rest and approved full day leave do not add planned hours", () => {
  const leave = { start_date: date, end_date: date, type: "FERIE", start_time: null, end_time: null };
  assert.equal(monthlyProgress([], [shift], [leave], 60, now, "2026-10-02").plannedSeconds, 0);
  assert.equal(monthlyProgress([], [{ ...shift, category: { ...shift.category, code: "R", name: "Riposo" } }], [], 60, now, "2026-10-02").plannedSeconds, 0);
});
