import test from "node:test";
import assert from "node:assert/strict";
import { hasRecentWorkerConfirmation, rememberWorkerConfirmation, WORKER_CONFIRMATION_TTL_MS } from "../lib/appointment-worker-confirmation";

const context = { bookingId: "booking-1", operatorId: "admin-1", salon: "Corso", workerId: "aurora" };
function storage() {
  const entries = new Map<string, string>();
  return { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
}

test("confirmation lasts exactly one hour and reopening does not extend it", () => {
  const session = storage();
  assert.equal(hasRecentWorkerConfirmation(session, context, 1000), false);
  rememberWorkerConfirmation(session, context, 1000);
  assert.equal(hasRecentWorkerConfirmation(session, context, 1000), true);
  assert.equal(hasRecentWorkerConfirmation(session, context, 1000 + WORKER_CONFIRMATION_TTL_MS - 1), true);
  assert.equal(hasRecentWorkerConfirmation(session, context, 1000 + WORKER_CONFIRMATION_TTL_MS), false);
  rememberWorkerConfirmation(session, context, 1000 + WORKER_CONFIRMATION_TTL_MS);
  assert.equal(hasRecentWorkerConfirmation(session, context, 2000 + WORKER_CONFIRMATION_TTL_MS), true);
});

test("another customer, operator, salon or assigned worker requires confirmation", () => {
  const session = storage();
  rememberWorkerConfirmation(session, context, 1000);
  for (const field of ["bookingId", "operatorId", "salon", "workerId"]) {
    assert.equal(hasRecentWorkerConfirmation(session, { ...context, [field]: "other" }, 2000), false);
  }
  rememberWorkerConfirmation(session, { ...context, workerId: "melissa" }, 2000);
  assert.equal(hasRecentWorkerConfirmation(session, context, 3000), false);
  assert.equal(hasRecentWorkerConfirmation(session, { ...context, workerId: "melissa" }, 3000), true);
});

test("unavailable or malformed storage and a backwards clock safely ask again", () => {
  const session = storage();
  rememberWorkerConfirmation(session, context, 1000);
  assert.equal(hasRecentWorkerConfirmation(session, context, 999), false);
  assert.equal(hasRecentWorkerConfirmation(null, context), false);
  assert.equal(hasRecentWorkerConfirmation({ ...session, getItem: () => "invalid" }, context), false);
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(hasRecentWorkerConfirmation(blocked, context), false);
  assert.doesNotThrow(() => rememberWorkerConfirmation(blocked, context));
  assert.equal(hasRecentWorkerConfirmation(session, { ...context, operatorId: "" }, 2000), false);
});
