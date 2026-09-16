import test from "node:test";
import assert from "node:assert/strict";
import { countedAttendanceTime, COUNT_FROM_ACTUAL_ENTRY_MARKER } from "../lib/work-hours";
test("10:15 is counted from 10:30 using the existing hours rule", () => {
  assert.equal(countedAttendanceTime({ type:"ENTRATA",timestamp:new Date("2026-09-16T10:15:00+02:00") }),"10:30");
});
test("actual entry counting exemption is preserved", () => {
  assert.equal(countedAttendanceTime({ type:"ENTRATA",timestamp:new Date("2026-09-16T10:15:00+02:00"),note:COUNT_FROM_ACTUAL_ENTRY_MARKER }),"10:15");
});
