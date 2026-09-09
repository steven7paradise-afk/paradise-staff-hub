import assert from "node:assert/strict";
import test from "node:test";
import {
  appointmentDateKey,
  appointmentDayBoundaryIso,
  initialAppointmentDateFilter,
  isAppointmentDateKey,
} from "../lib/appointment-date";

test("riconosce oggi e domani senza nascondere il giorno richiesto", () => {
  assert.deepEqual(
    initialAppointmentDateFilter({ initialRangeFrom: "2026-09-10", initialRangeTo: "2026-09-10", today: "2026-09-09" }),
    { mode: "tomorrow", from: "2026-09-10", to: "2026-09-10" },
  );
  assert.deepEqual(
    initialAppointmentDateFilter({ initialRangeFrom: "2026-09-12", initialRangeTo: "2026-09-14", today: "2026-09-09" }),
    { mode: "custom", from: "2026-09-12", to: "2026-09-14" },
  );
});

test("calcola i confini del giorno nel fuso orario di Roma anche con ora legale", () => {
  assert.equal(appointmentDayBoundaryIso("2026-09-10"), "2026-09-09T22:00:00.000Z");
  assert.equal(appointmentDayBoundaryIso("2026-09-10", true), "2026-09-10T21:59:59.999Z");
  assert.equal(appointmentDayBoundaryIso("2026-12-10"), "2026-12-09T23:00:00.000Z");
});

test("produce chiavi data di Roma e rifiuta date impossibili", () => {
  assert.equal(appointmentDateKey(new Date("2026-09-09T22:30:00.000Z")), "2026-09-10");
  assert.equal(isAppointmentDateKey("2026-02-29"), false);
  assert.equal(isAppointmentDateKey("2028-02-29"), true);
});
