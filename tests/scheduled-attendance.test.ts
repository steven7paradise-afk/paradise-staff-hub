import assert from "node:assert/strict";
import test from "node:test";
import { ABSENCE_GRACE_MINUTES, compareScheduledClock, scheduledEntryPolicy } from "../lib/scheduled-attendance";

test("applica tre minuti di tolleranza ai turni ordinari", () => {
  const policy = scheduledEntryPolicy({ plannedStart: "09:00", plannedEnd: "18:00", locationName: "Salone Buenos Aires" });

  assert.equal(ABSENCE_GRACE_MINUTES, 3);
  assert.equal(policy.deadlineMinutes, 9 * 60 + 3);
});

test("applica tre minuti anche dopo il limite flessibile delle 10:00 in ufficio", () => {
  const policy = scheduledEntryPolicy({ plannedStart: "09:00", plannedEnd: "18:00", locationName: "Ufficio Paradise" });

  assert.equal(policy.officeFlexible, true);
  assert.equal(policy.deadlineMinutes, 10 * 60 + 3);
});

test("non segna assente al terzo minuto ma solo dopo il limite", () => {
  const base = {
    plannedStart: "09:00",
    plannedEnd: "18:00",
    locationName: "Ufficio Paradise",
    categoryName: "Turno ufficio",
    categoryCode: "UFF",
    hasClockEntry: false,
    hasApprovedLeave: false,
  };

  const withinTolerance = compareScheduledClock({ ...base, now: new Date("2026-08-27T08:03:00.000Z") });
  const late = compareScheduledClock({ ...base, now: new Date("2026-08-27T08:04:00.000Z") });

  assert.equal(withinTolerance.absent, false);
  assert.equal(late.absent, true);
});
