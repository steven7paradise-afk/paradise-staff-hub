import assert from "node:assert/strict";
import test from "node:test";
import { overlappingAppointmentsByWorker } from "../lib/appointment-overlap";

function booking(id: string, start: string, end: string, workers: string[]) {
  return {
    id,
    dateKey: "2026-11-13",
    inferredSalon: "repubblica",
    startDate: `2026-11-13T${start}:00Z`,
    endDate: `2026-11-13T${end}:00Z`,
    customerEmail: `${id}@example.com`,
    workers,
  };
}

test("simultaneous appointments flag both visits only for a shared worker and a positive overlap", () => {
  const morning = booking("morning", "11:30", "12:30", ["a", "a", "b"]);
  const later = booking("later", "12:00", "12:45", ["b"]);
  const adjacent = booking("adjacent", "12:45", "13:00", ["b"]);
  const otherWorker = booking("other-worker", "12:00", "12:30", ["c"]);
  const canceled = { ...booking("canceled", "12:15", "12:25", ["a"]), isCanceled: true };
  const invalid = booking("invalid", "12:00", "11:59", ["b"]);

  const result = overlappingAppointmentsByWorker([adjacent, later, invalid, otherWorker, morning, canceled], (entry) => entry.workers);
  assert.deepEqual(result, new Map([["b", new Set(["morning", "later"])]]));
});

test("overlapping services within one visit do not trigger the simultaneous appointment indicator", () => {
  const first = booking("first", "10:00", "11:00", ["a"]);
  const second = { ...booking("second", "10:30", "11:30", ["a"]), customerEmail: first.customerEmail };
  const separateVisit = booking("separate", "11:00", "12:00", ["a"]);

  assert.deepEqual(overlappingAppointmentsByWorker([first, second], (entry) => entry.workers), new Map());
  assert.deepEqual(
    overlappingAppointmentsByWorker([first, second, separateVisit], (entry) => entry.workers),
    new Map([["a", new Set(["second", "separate"])]]),
  );
});
