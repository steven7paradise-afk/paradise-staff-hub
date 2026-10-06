import test from "node:test";
import assert from "node:assert/strict";
import { parseSocialSchedule, validateSocialSchedule, dueSocialPostsWhere } from "../lib/social-post-schedule";
test("schedule uses Rome timezone in summer and winter", () => {
  assert.equal(parseSocialSchedule("2026-10-06T12:00:00")?.toISOString(), "2026-10-06T10:00:00.000Z");
  assert.equal(parseSocialSchedule("2026-12-06T12:00:00")?.toISOString(), "2026-12-06T11:00:00.000Z");
  assert.equal(parseSocialSchedule("2026-10-06T10:00:00Z")?.toISOString(), "2026-10-06T10:00:00.000Z");
});
test("invalid dates and nonexistent DST times rejected", () => {
  for (const value of ["bad", "2026-02-30T12:00", "2026-03-29T02:30", "2026-10-06T25:00"]) assert.equal(parseSocialSchedule(value), null);
});
test("only future valid planned posts can be saved; other lifecycle stages can retain historical dates", () => {
  const now = new Date("2026-10-06T10:00:00Z");
  assert.ok(validateSocialSchedule("PLANNED", now, now));
  assert.equal(validateSocialSchedule("PLANNED", new Date(+now + 60000), now), null);
  for (const status of ["RECORDED", "DRAFT", "PUBLISHED"]) assert.equal(validateSocialSchedule(status, new Date(+now - 60000), now), null);
  assert.ok(validateSocialSchedule("UNKNOWN", now, now));
  assert.ok(validateSocialSchedule("PLANNED", null, now));
});
test("expiry update targets only planned posts at or before the deadline", () => {
  const now = new Date("2026-10-06T10:00:00Z");
  assert.deepEqual(dueSocialPostsWhere(now), {status:"PLANNED",scheduled_at:{lte:now}});
});
