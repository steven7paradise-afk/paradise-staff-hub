import assert from "node:assert/strict";
import test from "node:test";

import { attendanceMonthsFromDates, contractActiveInPayrollMonth, payrollMonthKey, workedInPayrollMonth } from "../lib/payroll-status";

test("crea una sola voce per ogni mese in cui il collaboratore ha timbrato", () => {
  assert.deepEqual(
    attendanceMonthsFromDates([
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-31T00:00:00.000Z"),
      new Date("2026-09-01T00:00:00.000Z"),
    ]),
    ["2026-08", "2026-09"],
  );
});

test("include nel riepilogo soltanto chi ha timbrato nel mese selezionato", () => {
  const workedMonths = [payrollMonthKey(9, 2026)];

  assert.equal(workedInPayrollMonth(workedMonths, 8, 2026), false);
  assert.equal(workedInPayrollMonth(workedMonths, 9, 2026), true);
});

test("mantiene la compatibilita per le viste che non forniscono le timbrature", () => {
  assert.equal(workedInPayrollMonth(undefined, 8, 2026), true);
});

test("considera attivo un contratto che copre anche solo una parte del mese", () => {
  assert.equal(contractActiveInPayrollMonth("2026-08-15", null, 8, 2026), true);
  assert.equal(contractActiveInPayrollMonth("2026-07-01", "2026-08-10", 8, 2026), true);
});

test("esclude contratti non ancora iniziati, gia terminati o senza data di inizio", () => {
  assert.equal(contractActiveInPayrollMonth("2026-09-01", null, 8, 2026), false);
  assert.equal(contractActiveInPayrollMonth("2026-07-01", "2026-07-31", 8, 2026), false);
  assert.equal(contractActiveInPayrollMonth(null, null, 8, 2026), false);
});
