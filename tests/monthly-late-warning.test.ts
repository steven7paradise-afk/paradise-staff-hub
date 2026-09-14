import assert from "node:assert/strict";
import test from "node:test";
import {
  MONTHLY_LATE_WARNING_DURATION_MS,
  shouldShowMonthlyLateWarning,
} from "../lib/monthly-late-warning";

test("shows the dashboard warning only after more than three monthly delays", () => {
  assert.equal(shouldShowMonthlyLateWarning(3), false);
  assert.equal(shouldShowMonthlyLateWarning(4), true);
  assert.equal(shouldShowMonthlyLateWarning(8), true);
});

test("keeps the warning visible for one minute", () => {
  assert.equal(MONTHLY_LATE_WARNING_DURATION_MS, 60_000);
});
