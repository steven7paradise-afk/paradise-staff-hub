import { test } from "node:test";
import assert from "node:assert/strict";
import { staffDashboardItem } from "../lib/mobile-staff-dashboard";
const now = new Date("2026-09-25T10:00:00Z");
const worker = { id: "1", name: "Test", location: { name: "Salone" }, attendance_logs: [], leave_requests: [],
  schedule_entries: [{ start_time: "10:00", end_time: "18:00", location: null, category: { name: "Turno", code: "T", start_time: null, end_time: null } }] };
test("absence requires an elapsed scheduled shift; future shifts and rest are excluded", () => {
  assert.deepEqual(staffDashboardItem(worker, now).categories, ["absent"]);
  assert.deepEqual(staffDashboardItem({ ...worker, schedule_entries: [] }, now).categories, []);
  assert.deepEqual(staffDashboardItem(worker, new Date("2026-09-25T07:00:00Z")).categories, []);
  assert.deepEqual(staffDashboardItem({ ...worker, schedule_entries: [{ ...worker.schedule_entries[0], category: { ...worker.schedule_entries[0].category, name: "Riposo" } }] }, now).categories, []);
});
test("leave excludes absence and is not duplicated with planning", () => {
  assert.deepEqual(staffDashboardItem({ ...worker, leave_requests: [{ type: "FERIE", start_time: null, end_time: null }] }, now).categories, ["vacation"]);
  assert.deepEqual(staffDashboardItem({ ...worker, leave_requests: [{ type: "MALATTIA", start_time: null, end_time: null }] }, now).categories, ["sick"]);
});
test("pause remains present and recorded late arrival remains a separate metric", () => {
  const result = staffDashboardItem({ ...worker, attendance_logs: [
    { type: "ENTRATA" as const, timestamp: new Date("2026-09-25T08:10:00Z"), note: null },
    { type: "PAUSA" as const, timestamp: new Date("2026-09-25T09:00:00Z"), note: null },
  ] }, now);
  assert.deepEqual(result.categories, ["present", "late"]);
  assert.equal(result.lateMinutes, 7);
  assert.equal(result.detail, "In pausa");
});
test("future logs never mark a worker present", () => {
  assert.deepEqual(staffDashboardItem({ ...worker, attendance_logs: [{ type: "ENTRATA" as const, timestamp: new Date("2026-09-25T15:00:00Z"), note: null }] }, now).categories, ["absent"]);
});
