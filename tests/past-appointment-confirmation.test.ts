import test from "node:test";
import assert from "node:assert/strict";
import { isPastCompletedAppointment } from "../lib/appointment-worker-confirmation";

test("skip worker question only for completed past appointments", () => {
  const now = Date.parse("2026-10-05T15:00:00Z");
  assert.equal(isPastCompletedAppointment("2026-10-01T08:00:00Z", "COMPLETATO", now), true);
  assert.equal(isPastCompletedAppointment("2026-10-05T08:00:00Z", "COMPLETATO", now), true);
  assert.equal(isPastCompletedAppointment("2026-10-01T08:00:00Z", "CONFERMATO", now), false);
  assert.equal(isPastCompletedAppointment("2026-10-06T08:00:00Z", "COMPLETATO", now), false);
  assert.equal(isPastCompletedAppointment("invalid", "COMPLETATO", now), false);
});
