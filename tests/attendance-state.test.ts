import assert from "node:assert/strict";
import test from "node:test";
import { deriveAttendanceState, permittedAttendanceActions } from "../lib/attendance-state";

test("deriva un turno completo con pausa", () => {
  const state = deriveAttendanceState([
    { type: "ENTRATA" as const, timestamp: "2026-08-25T07:00:00.000Z" },
    { type: "PAUSA" as const, timestamp: "2026-08-25T11:00:00.000Z" },
    { type: "RIENTRO" as const, timestamp: "2026-08-25T11:30:00.000Z" },
    { type: "USCITA" as const, timestamp: "2026-08-25T16:00:00.000Z" },
  ]);

  assert.equal(state.status, "OUT");
  assert.equal(state.breaks[0]?.minutes, 30);
  assert.deepEqual(state.invalidLogs, []);
});

test("rifiuta transizioni di timbratura fuori sequenza", () => {
  const state = deriveAttendanceState([
    { type: "PAUSA" as const, timestamp: "2026-08-25T07:00:00.000Z" },
    { type: "ENTRATA" as const, timestamp: "2026-08-25T08:00:00.000Z" },
  ]);

  assert.equal(state.status, "IN");
  assert.equal(state.invalidLogs.length, 1);
  assert.deepEqual(permittedAttendanceActions(state.status), ["PAUSA", "USCITA"]);
});
