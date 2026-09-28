import assert from "node:assert/strict";
import test from "node:test";
import {
  appendBonusEvent, bonusBalance, canRegisterBonus, createBonusAccount,
  extraAppointmentQuota, previewBonusEvent, usesMonthlyBonus,
  type BonusAccount, type BonusAssignment, type BonusEventType, type BonusLevel,
  type NewBonusEvent, type ReworkPolicy,
} from "../lib/monthly-bonus";

const now = new Date("2026-11-01T12:00:00Z");
const rs = { id: "responsabile", name: "Responsabile test", role: "RESPONSABILE", active: true };
const assignment = (level: BonusLevel = "AUTONOMA"): BonusAssignment => ({ userId: "test-staff", level, responsibleIds: [rs.id], referenceMasterId: "master" });
const account = (level: BonusLevel = "AUTONOMA", policy: ReworkPolicy | null = null) => createBonusAccount("2026-10", assignment(level), policy);
function event(type: BonusEventType, i = 1): NewBonusEvent {
  return { id: `${type}-${i}`, sourceId: `source-${type}-${i}`, type, date: "2026-10-12", evidence: "Riferimento di test", namedReviewConfirmed: true, zeroReworksConfirmed: true };
}
function add(current: BonusAccount, type: BonusEventType, i = 1) {
  const actor = ["ZERO_REWORK", "TRAINING"].includes(type) ? { ...rs, id: "master", role: "DIPENDENTE" } : rs;
  return appendBonusEvent(current, assignment(current.level), actor, event(type, i), now);
}
function repeated(type: BonusEventType, count: number, level: BonusLevel = "AUTONOMA", policy: ReworkPolicy | null = null) {
  let result = account(level, policy);
  for (let i = 1; i <= count; i++) result = add(result, type, i);
  return result;
}

test("cutover is midnight in Rome on September 28; no earlier events", () => {
  assert.equal(usesMonthlyBonus(new Date("2026-09-27T21:59:59Z")), false);
  assert.equal(usesMonthlyBonus(new Date("2026-09-27T22:00:00Z")), true);
  assert.throws(() => createBonusAccount("2026-08", assignment(), null));
  assert.throws(() => createBonusAccount("2026-13", assignment(), null));
  const september = createBonusAccount("2026-09", assignment(), null);
  assert.throws(() => previewBonusEvent(september, { ...event("SHIFT_CHANGE"), date: "2026-09-27" }, now));
  assert.equal(previewBonusEvent(september, { ...event("SHIFT_CHANGE"), date: "2026-09-28" }, now).points, 1);
});

test("each level starts at half its cap, valued at 5 euro per point", () => {
  for (const [level, base, cap] of [["MASTER", 50, 100], ["AUTONOMA", 30, 60], ["JUNIOR", 20, 40]] as const) {
    assert.deepEqual(bonusBalance(account(level)), { base, cap, bonus: 0, malus: 0, points: base, euros: base * 5 });
  }
});

test("entry/break grace is three monthly events; fourth and every next are charged", () => {
  assert.deepEqual(repeated("ENTRY_LATE", 5).events.map(e => e.points), [0, 0, 0, -10, -10]);
  assert.deepEqual(repeated("BREAK_LATE", 5).events.map(e => e.points), [0, 0, 0, -2, -2]);
  assert.equal(repeated("ENTRY_LATE", 3).events.length, 3);
});

test("appearance permits two events; disciplinary letters and negative reviews none", () => {
  assert.deepEqual(repeated("APPEARANCE", 4).events.map(e => e.points), [0, 0, -10, -10]);
  assert.equal(add(account(), "DISCIPLINARY_LETTER").events[0].points, -20);
  assert.equal(add(account(), "NEGATIVE_REVIEW").events[0].points, -2);
});

test("no rework interpretation is silently selected", () => {
  assert.throws(() => add(account(), "REWORK"), /confermata/);
  assert.deepEqual(repeated("REWORK", 10, "AUTONOMA", "COMPLETED_BLOCK").events.map(e => e.points), [0, 0, 0, 0, 0, -20, 0, 0, -20, 0]);
  assert.deepEqual(repeated("REWORK", 10, "AUTONOMA", "STARTED_BLOCK").events.map(e => e.points), [0, 0, 0, -20, 0, 0, -20, 0, 0, -20]);
});

test("positive reviews award only from the 21st, and naming must be confirmed", () => {
  const result = repeated("POSITIVE_REVIEW", 22);
  assert.equal(bonusBalance(result).bonus, 2);
  assert.equal(result.events[19].points, 0);
  assert.equal(result.events[20].points, 1);
  for (const type of ["POSITIVE_REVIEW", "NEGATIVE_REVIEW"] as const) {
    assert.throws(() => previewBonusEvent(account(), { ...event(type), namedReviewConfirmed: false }, now), /esplicitamente/);
  }
});

test("half points and monthly extra appointment quota preserve decimals", () => {
  assert.deepEqual(extraAppointmentQuota(101, 100), { quota: 100, extra: 1, points: 0.5 });
  assert.deepEqual(extraAppointmentQuota(99, 100), { quota: 100, extra: 0, points: 0 });
  assert.equal(bonusBalance(add(account(), "EXTRA_APPOINTMENT")).euros, 152.5);
  assert.throws(() => extraAppointmentQuota(3.5, 1));
  assert.throws(() => extraAppointmentQuota(10, -1));
  assert.deepEqual(extraAppointmentQuota(101, 90), { quota: 90, extra: 11, points: 5.5 });
  assert.throws(() => extraAppointmentQuota(101, null as unknown as number));
  assert.throws(() => add(account("JUNIOR"), "EXTRA_APPOINTMENT"));
});

test("cap/floor apply to the final sum, not progressively to event balances", () => {
  const capped = repeated("SHIFT_CHANGE", 40);
  assert.equal(bonusBalance(capped).points, 60);
  assert.equal(bonusBalance(add(capped, "DISCIPLINARY_LETTER")).points, 50);
  assert.equal(bonusBalance(repeated("DISCIPLINARY_LETTER", 4)).points, 0);
});

test("each month resets grace, base and balance without deleting history", () => {
  const october = repeated("ENTRY_LATE", 8);
  const november = createBonusAccount("2026-11", assignment("MASTER"), null);
  assert.equal(bonusBalance(october).points, 0);
  assert.equal(bonusBalance(november).points, 50);
  assert.equal(previewBonusEvent(november, { ...event("ENTRY_LATE"), date: "2026-11-01" }, now).points, 0);
  assert.equal(october.events.length, 8);
});

test("permissions are explicit: admins consult, Master only own Junior-specific bonuses", () => {
  const junior = assignment("JUNIOR");
  for (const role of ["ZERO", "SUPER_ADMIN", "ADMIN"]) assert.equal(canRegisterBonus({ ...rs, role }, junior, "TRAINING"), false);
  const master = { ...rs, id: "master", role: "DIPENDENTE" };
  assert.equal(canRegisterBonus(master, junior, "TRAINING"), true);
  assert.equal(canRegisterBonus(master, junior, "ZERO_REWORK"), true);
  assert.equal(canRegisterBonus(master, junior, "ENTRY_LATE"), false);
  assert.equal(canRegisterBonus(master, junior, "SHIFT_CHANGE"), false);
  assert.equal(canRegisterBonus(rs, junior, "TRAINING"), false);
  assert.equal(canRegisterBonus(master, { ...junior, referenceMasterId: "other" }, "TRAINING"), false);
  assert.equal(canRegisterBonus({ ...rs, active: false }, junior, "TRAINING"), false);
  assert.equal(canRegisterBonus(rs, { ...junior, responsibleIds: [] }, "ENTRY_LATE"), false);
});

test("Junior zero-rework reward requires complete month and verified absence, once only", () => {
  assert.throws(() => previewBonusEvent(account("JUNIOR"), event("ZERO_REWORK"), new Date("2026-10-31T12:00:00Z")), /fine del mese/);
  assert.throws(() => previewBonusEvent(account("JUNIOR"), { ...event("ZERO_REWORK"), zeroReworksConfirmed: false }, now));
  assert.throws(() => add(add(account("JUNIOR", "COMPLETED_BLOCK"), "REWORK"), "ZERO_REWORK"));
  const awarded = add(account("JUNIOR", "COMPLETED_BLOCK"), "ZERO_REWORK");
  assert.equal(bonusBalance(awarded).bonus, 3);
  assert.throws(() => add(awarded, "ZERO_REWORK", 2));
  assert.throws(() => add(awarded, "REWORK"), /correzione/);
  assert.throws(() => add(account("MASTER"), "TRAINING"));
  assert.equal(bonusBalance(add(account("JUNIOR"), "TRAINING")).bonus, 2);
});

test("append retains original account and records actor, evidence and registration time", () => {
  const original = account();
  const updated = add(original, "URGENT_AVAILABILITY");
  assert.equal(original.events.length, 0);
  assert.equal(updated.events[0].actorId, rs.id);
  assert.equal(updated.events[0].actorName, rs.name);
  assert.equal(updated.events[0].recordedAt, now.toISOString());
  assert.throws(() => add(updated, "URGENT_AVAILABILITY"), /già registrato/);
  assert.throws(() => previewBonusEvent(updated, { ...event("SHIFT_CHANGE"), sourceId: updated.events[0].sourceId }, now));
});

test("invalid, cross-month and future dates, missing evidence and mismatched accounts fail", () => {
  for (const date of ["2026-10-32", "2026-09-30", "2026-11-01"]) {
    assert.throws(() => previewBonusEvent(account(), { ...event("SHIFT_CHANGE"), date }, now));
  }
  assert.throws(() => previewBonusEvent(account(), event("SHIFT_CHANGE"), new Date("2026-10-01T12:00:00Z")));
  assert.throws(() => previewBonusEvent(account(), { ...event("SHIFT_CHANGE"), evidence: " " }, now));
  assert.throws(() => appendBonusEvent(account(), { ...assignment(), userId: "other" }, rs, event("SHIFT_CHANGE"), now));
});

test("backdated registration cannot change the previously recorded grace events", () => {
  const original = repeated("ENTRY_LATE", 3);
  const updated = appendBonusEvent(original, assignment(), rs, { ...event("ENTRY_LATE", 4), date: "2026-10-01" }, now);
  assert.deepEqual(updated.events.slice(0, 3), original.events);
  assert.equal(updated.events[3].points, -10);
});
