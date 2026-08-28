import assert from "node:assert/strict";
import test from "node:test";
import { normalizeShiftReportData, romeDayRange, shiftReportStatusLabel } from "../lib/shift-reports";

test("normalizza la verifica per singolo cliente", () => {
  const report = normalizeShiftReportData({
    daySummary: "  Giornata positiva  ",
    dayRating: 9,
    clientChecks: {
      client1: { status: "OK", note: " Tutto bene " },
      client2: { status: "PROBLEM", note: " Cliente insoddisfatta " },
      invalid: { status: "UNKNOWN", note: "test" },
    },
    finishedProducts: [{ id: "prod-1", name: "Shampoo Paradise" }, { id: "", name: "Non valido" }],
  });
  assert.equal(report.daySummary, "Giornata positiva");
  assert.equal(report.dayRating, 5);
  assert.deepEqual(report.clientChecks.client1, { status: "OK", note: "Tutto bene" });
  assert.deepEqual(report.clientChecks.client2, { status: "PROBLEM", note: "Cliente insoddisfatta" });
  assert.equal(report.clientChecks.invalid.status, "");
  assert.deepEqual(report.finishedProducts, [{ id: "prod-1", name: "Shampoo Paradise" }]);
});

test("calcola il giorno operativo usando il fuso di Roma", () => {
  const summer = romeDayRange("2026-08-28");
  assert.equal(summer.start.toISOString(), "2026-08-27T22:00:00.000Z");
  assert.equal(summer.end.toISOString(), "2026-08-28T22:00:00.000Z");
  assert.equal(summer.date.toISOString(), "2026-08-28T00:00:00.000Z");
});

test("l'approvazione viene mostrata come definitiva", () => {
  assert.equal(shiftReportStatusLabel("APPROVATO"), "Approvato definitivo");
  assert.equal(shiftReportStatusLabel("DA_CORREGGERE"), "Da correggere");
});
