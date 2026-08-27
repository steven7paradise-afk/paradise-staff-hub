import assert from "node:assert/strict";
import test from "node:test";
import { buildAssistantDateContext, requestedDayPeriod, requestedMonthPeriod } from "../lib/admin-assistant-date";

const context = buildAssistantDateContext(new Date("2026-08-26T17:00:00.000Z"));

test("builds an authoritative Rome date context", () => {
  assert.equal(context.today, "2026-08-26");
  assert.equal(context.yesterday, "2026-08-25");
  assert.equal(context.tomorrow, "2026-08-27");
  assert.equal(context.weekStart, "2026-08-24");
  assert.equal(context.weekEnd, "2026-08-30");
});

test("resolves this month without asking the model", () => {
  assert.deepEqual(requestedMonthPeriod("Aurora ha fatto ritardi questo mese?", context), { month: 8, year: 2026 });
});

test("resolves previous month across a year boundary", () => {
  const january = buildAssistantDateContext(new Date("2027-01-12T10:00:00.000Z"));
  assert.deepEqual(requestedMonthPeriod("cedolini del mese scorso", january), { month: 12, year: 2026 });
});

test("resolves an Italian month name and explicit year", () => {
  assert.deepEqual(requestedMonthPeriod("turnistica ottobre 2027", context), { month: 10, year: 2027 });
});

test("resolves today into an exact server-side interval", () => {
  assert.deepEqual(requestedDayPeriod("Steven ha completato task oggi?", context), {
    day: "2026-08-26",
    start: "2026-08-25T22:00:00.000Z",
    end: "2026-08-26T22:00:00.000Z",
  });
});

test("resolves yesterday into one exact Rome calendar day", () => {
  assert.deepEqual(requestedDayPeriod("Dimmi i ritardi di ieri", context), {
    day: "2026-08-25",
    start: "2026-08-24T22:00:00.000Z",
    end: "2026-08-25T22:00:00.000Z",
  });
});

test("resolves tomorrow into one exact Rome calendar day", () => {
  assert.deepEqual(requestedDayPeriod("Chi sarà assente domani?", context), {
    day: "2026-08-27",
    start: "2026-08-26T22:00:00.000Z",
    end: "2026-08-27T22:00:00.000Z",
  });
});
