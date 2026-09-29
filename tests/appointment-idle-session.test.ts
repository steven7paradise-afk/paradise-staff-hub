import test from "node:test";
import assert from "node:assert/strict";
import { AppointmentIdleSession, appointmentSessionRemainingSeconds } from "../lib/appointment-idle-session";

test("locks at five minutes without interaction", () => {
  const session = new AppointmentIdleSession(1000);
  assert.equal(session.expired(300999), false);
  assert.equal(session.expired(301000), true);
});
test("interaction renews for five minutes, checking/polling does not", () => {
  const session = new AppointmentIdleSession(0);
  assert.equal(session.interact(240000), true);
  assert.equal(session.expired(539999), false);
  assert.equal(session.expired(540000), true);
  assert.equal(session.interact(540000), false);
});
test("renewal preserves actual last interaction and rejects invalid ages", () => {
  assert.equal(appointmentSessionRemainingSeconds(0), 300);
  assert.equal(appointmentSessionRemainingSeconds(10000), 290);
  for (const age of [300000, 400000, -1, NaN, Infinity, undefined, "0"]) {
    assert.equal(appointmentSessionRemainingSeconds(age), 0);
  }
});
test("clock rollback does not reopen a session", () => {
  assert.equal(new AppointmentIdleSession(1000).interact(999), false);
});
