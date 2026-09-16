import test from "node:test";
import assert from "node:assert/strict";
import { leaveCoversWholeShift } from "../lib/register-leave";
test("Simona's approved vacation with hours covers her full shift", () => {
  assert.equal(leaveCoversWholeShift({start_time:"10:00",end_time:"19:00"},"10:00","19:00"),true);
});
test("full-day absence without times remains full-day", () => {
  assert.equal(leaveCoversWholeShift({}),true);
});
test("partial permission does not excuse the entire day", () => {
  assert.equal(leaveCoversWholeShift({start_time:"10:00",end_time:"12:00"},"10:00","19:00"),false);
});
test("a wider absence interval covers the shift", () => {
  assert.equal(leaveCoversWholeShift({start_time:"09:00",end_time:"20:00"},"10:00","19:00"),true);
});
test("missing shift times are not guessed", () => {
  assert.equal(leaveCoversWholeShift({start_time:"10:00",end_time:"19:00"}),false);
});
