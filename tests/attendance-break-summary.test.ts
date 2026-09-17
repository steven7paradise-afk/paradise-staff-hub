import assert from "node:assert/strict";
import test from "node:test";
import { attendanceReportDayKeys, summarizeLateBreakReturns } from "../lib/attendance-break-summary";

function at(value: string) {
  return new Date(`2026-09-16T${value}:00.000Z`);
}

test("counts every late return and its total minutes", () => {
  const result = summarizeLateBreakReturns([
    { type: "ENTRATA", timestamp: at("08:00") },
    { type: "PAUSA", timestamp: at("11:00") },
    { type: "RIENTRO", timestamp: at("12:05") },
    { type: "PAUSA", timestamp: at("15:00") },
    { type: "RIENTRO", timestamp: at("16:02") },
  ], 60);

  assert.deepEqual(result, { lateCount: 2, lateMinutes: 7 });
});

test("allows up to sixty extra seconds before counting a late return", () => {
  const result = summarizeLateBreakReturns([
    { type: "PAUSA", timestamp: at("11:00") },
    {
      type: "RIENTRO",
      timestamp: new Date("2026-09-16T12:00:59.000Z"),
      note: "Rientro pausa in ritardo: durata 61 min; limite 60 min; ritardo 1 min.",
    },
  ], 60);

  assert.deepEqual(result, { lateCount: 0, lateMinutes: 0 });
});

test("counts a pause once the full sixty-second tolerance is exhausted", () => {
  const result = summarizeLateBreakReturns([
    { type: "PAUSA", timestamp: at("11:00") },
    { type: "RIENTRO", timestamp: at("12:01") },
  ], 60);

  assert.deepEqual(result, { lateCount: 1, lateMinutes: 1 });
});

test("considers an administrator-modified pause correct", () => {
  const result = summarizeLateBreakReturns([
    { type: "PAUSA", timestamp: at("11:00") },
    {
      type: "RIENTRO",
      timestamp: at("12:30"),
      note: "Modificata manualmente da Admin - Rientro pausa in ritardo: durata 90 min; limite 60 min; ritardo 30 min.",
    },
  ], 60);

  assert.deepEqual(result, { lateCount: 0, lateMinutes: 0 });
});

test("includes attendance days that have logs even when planning is missing", () => {
  const result = attendanceReportDayKeys(
    [new Date("2026-08-25T00:00:00.000Z")],
    [new Date("2026-08-25T00:00:00.000Z"), new Date("2026-08-26T00:00:00.000Z")],
  );

  assert.deepEqual(result, ["2026-08-25", "2026-08-26"]);
});
