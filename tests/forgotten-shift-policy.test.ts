import assert from "node:assert/strict";
import test from "node:test";

import { forgottenShiftExitTime } from "../lib/forgotten-shift-policy";

test("non crea una seconda uscita quando il turno è già chiuso", () => {
  const exit = forgottenShiftExitTime([
    { type: "ENTRATA", timestamp: new Date("2026-09-09T08:00:00.000Z") },
    { type: "PAUSA", timestamp: new Date("2026-09-09T11:26:42.000Z") },
    { type: "RIENTRO", timestamp: new Date("2026-09-09T12:25:35.000Z") },
    // The rounded exit can precede invalid taps that happened seconds earlier.
    { type: "USCITA", timestamp: new Date("2026-09-09T17:00:00.000Z") },
    { type: "PAUSA", timestamp: new Date("2026-09-09T17:12:48.000Z") },
    { type: "RIENTRO", timestamp: new Date("2026-09-09T17:12:59.000Z") },
  ]);

  assert.equal(exit, null);
});

test("chiude un turno realmente aperto otto ore dopo l'entrata", () => {
  const exit = forgottenShiftExitTime([
    { type: "ENTRATA", timestamp: new Date("2026-09-09T08:00:00.000Z") },
  ]);

  assert.equal(exit?.toISOString(), "2026-09-09T16:00:00.000Z");
});
