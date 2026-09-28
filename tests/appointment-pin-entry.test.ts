import test from "node:test";
import assert from "node:assert/strict";
import { isAppointmentEntryPin, isAppointmentPinOnlyRole, uniquelyMatchAppointmentPin } from "../lib/appointment-pin-entry";

test("accepts exactly four digits, preserving leading zeros", () => {
  assert.equal(isAppointmentEntryPin("0123"), true);
  for (const value of ["12", "123456", " 1234", "1234x", 1234, null, undefined]) assert.equal(isAppointmentEntryPin(value), false);
});
test("admin roles require full PIN and are not portrait-prefix identities", () => {
  for (const role of ["ADMIN", "SUPER_ADMIN", "ZERO"]) assert.equal(isAppointmentPinOnlyRole(role), true);
  for (const role of ["RESPONSABILE", "DIPENDENTE", null, undefined]) assert.equal(isAppointmentPinOnlyRole(role), false);
});
test("only one full PIN match can select a worker", async () => {
  const workers = [{ id: "a", pin: "0123" }, { id: "b", pin: "4567" }];
  assert.equal((await uniquelyMatchAppointmentPin(workers, async worker => worker.pin === "0123"))?.id, "a");
  assert.equal(await uniquelyMatchAppointmentPin(workers, async worker => worker.pin === "0000"), null);
  assert.equal(await uniquelyMatchAppointmentPin([...workers, { id: "c", pin: "0123" }], async worker => worker.pin === "0123"), null);
});
