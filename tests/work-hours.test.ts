import assert from "node:assert/strict";
import test from "node:test";

import { calculateClockHours, COUNT_FROM_ACTUAL_ENTRY_MARKER } from "../lib/work-hours";

test("mantiene l'arrotondamento ordinario quando l'admin conferma la prassi", () => {
  const hours = calculateClockHours([
    { type: "ENTRATA", timestamp: new Date("2026-08-31T10:07:00.000Z") },
    { type: "USCITA", timestamp: new Date("2026-08-31T18:00:00.000Z") },
  ]);

  assert.equal(hours.grossHours, 8);
});

test("conteggia dall'istante reale quando l'admin rimuove la penalità", () => {
  const hours = calculateClockHours([
    {
      type: "ENTRATA",
      timestamp: new Date("2026-08-31T10:07:00.000Z"),
      note: `[${COUNT_FROM_ACTUAL_ENTRY_MARKER}]`,
    },
    { type: "USCITA", timestamp: new Date("2026-08-31T18:00:00.000Z") },
  ]);

  assert.equal(hours.grossHours, 7.88);
});
