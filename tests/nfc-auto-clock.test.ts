import assert from "node:assert/strict";
import test from "node:test";
import { nextSequentialAttendanceAction } from "../lib/attendance-state";

const at = (type: "ENTRATA" | "PAUSA" | "RIENTRO" | "USCITA", hour: number) => ({
  type,
  timestamp: `2026-09-10T${String(hour).padStart(2, "0")}:00:00.000Z`,
});

test("NFC segue Entrata, Pausa, Rientro e Uscita", () => {
  assert.equal(nextSequentialAttendanceAction([]), "ENTRATA");
  assert.equal(nextSequentialAttendanceAction([at("ENTRATA", 8)]), "PAUSA");
  assert.equal(nextSequentialAttendanceAction([at("ENTRATA", 8), at("PAUSA", 12)]), "RIENTRO");
  assert.equal(nextSequentialAttendanceAction([at("ENTRATA", 8), at("PAUSA", 12), at("RIENTRO", 13)]), "USCITA");
  assert.equal(nextSequentialAttendanceAction([at("ENTRATA", 8), at("PAUSA", 12), at("RIENTRO", 13), at("USCITA", 17)]), null);
});

test("NFC continua un turno notturno aperto", () => {
  assert.equal(nextSequentialAttendanceAction([], "BREAK"), "RIENTRO");
  assert.equal(nextSequentialAttendanceAction([], "IN"), "USCITA");
});
