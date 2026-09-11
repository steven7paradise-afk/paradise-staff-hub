import assert from "node:assert/strict";
import test from "node:test";
import { isRestReminderTime, romeCalendarDate } from "../lib/rest-reminder-time";

test("invia il promemoria riposo alle 15:00 italiane con ora legale", () => {
  assert.equal(isRestReminderTime(new Date("2026-08-28T13:00:00.000Z")), true);
});

test("invia il promemoria riposo alle 15:00 italiane con ora solare", () => {
  assert.equal(isRestReminderTime(new Date("2026-12-28T14:00:00.000Z")), true);
});

test("non invia il promemoria a mezzanotte o fuori dalla finestra delle 15", () => {
  assert.equal(isRestReminderTime(new Date("2026-08-27T22:00:00.000Z")), false);
  assert.equal(isRestReminderTime(new Date("2026-08-28T12:59:00.000Z")), false);
  assert.equal(isRestReminderTime(new Date("2026-08-28T14:00:00.000Z")), false);
});

test("calcola il giorno di Roma prima di cercare il riposo di domani", () => {
  assert.equal(romeCalendarDate(new Date("2026-08-27T22:30:00.000Z")).toISOString(), "2026-08-28T00:00:00.000Z");
});
