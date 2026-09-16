import assert from "node:assert/strict";
import test from "node:test";
import { communicationBannerExpiry } from "../lib/communication-banner";

test("banner defaults to exactly 72 hours", () => {
  assert.equal(communicationBannerExpiry(undefined, new Date("2026-09-16T10:00:00Z")).toISOString(), "2026-09-19T10:00:00.000Z");
});
test("custom end date uses Italian end of day in summer and winter", () => {
  assert.equal(communicationBannerExpiry("2026-09-22", new Date("2026-09-16T10:00:00Z")).toISOString(), "2026-09-22T21:59:59.999Z");
  assert.equal(communicationBannerExpiry("2026-12-22", new Date("2026-12-16T10:00:00Z")).toISOString(), "2026-12-22T22:59:59.999Z");
});
test("reject invalid dates and durations shorter than three days", () => {
  const now = new Date("2026-09-16T10:00:00Z");
  for (const date of ["2026-02-30", "invalid", "2026-09-17"]) assert.throws(() => communicationBannerExpiry(date, now));
});
