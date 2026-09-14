import assert from "node:assert/strict";
import test from "node:test";
import { monthlyWorkedUserIds, visibleWorkHoursWorkers } from "../lib/work-hours-visibility";

test("keeps a former employee visible in a month with even one clock event", () => {
  const workedUserIds = monthlyWorkedUserIds([{ user_id: "jasmine" }], []);
  const visible = visibleWorkHoursWorkers([
    { id: "active-worker", active: true },
    { id: "jasmine", active: false },
  ], workedUserIds);

  assert.deepEqual(visible.map((worker) => worker.id), ["active-worker", "jasmine"]);
});

test("keeps a former employee visible when positive monthly hours were recorded manually", () => {
  const workedUserIds = monthlyWorkedUserIds([], [
    { user_id: "jasmine", hours: 7.5 },
    { user_id: "former-with-zero", hours: 0 },
  ]);

  assert.deepEqual(workedUserIds, ["jasmine"]);
});

test("hides a former employee from later months without work", () => {
  const visible = visibleWorkHoursWorkers([
    { id: "active-worker", active: true },
    { id: "jasmine", active: false },
  ], []);

  assert.deepEqual(visible.map((worker) => worker.id), ["active-worker"]);
});
