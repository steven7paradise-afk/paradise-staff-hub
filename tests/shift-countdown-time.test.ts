import test from "node:test";
import assert from "node:assert/strict";
import { shiftCountdownTarget } from "../lib/shift-countdown-time";

test("countdown targets use the shared snapshot and Rome timezone on server and client", () => {
  const original = process.env.TZ;
  try {
    for (const zone of ["UTC", "Europe/Rome", "America/New_York"]) {
      process.env.TZ = zone;
      assert.equal(shiftCountdownTarget("19:00", new Date("2026-10-07T16:53:00Z"))?.toISOString(), "2026-10-07T17:00:00.000Z");
      assert.equal(shiftCountdownTarget("10:00", new Date("2026-01-07T08:00:00Z"))?.toISOString(), "2026-01-07T09:00:00.000Z");
      assert.equal(shiftCountdownTarget("10:00", new Date("2026-10-07T23:30:00Z"))?.toISOString(), "2026-10-08T08:00:00.000Z");
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("missing or invalid schedule times have no countdown target", () => {
  const now = new Date("2026-10-07T10:00:00Z");
  for (const time of [null, "", "invalid", "25:00", "10:65"]) assert.equal(shiftCountdownTarget(time, now), null);
});
