import assert from "node:assert/strict";
import test from "node:test";
import { monthlyPersonalHours } from "../lib/personal-hours";

test("la chiusura salone resta a zero ore senza cambiare la nota", () => {
  const date = new Date("2026-09-02T00:00:00.000Z");
  const result = monthlyPersonalHours(
    2026,
    8,
    [{
      date,
      start_time: "10:00",
      end_time: "19:00",
      category: { name: "Chiusura salone", code: "CHIUSO", color: "#fff", text_color: "#000", start_time: "10:00", end_time: "19:00", paid_hours: 8 },
    }],
    [],
    [{ date, hours: 8, paid_break: false, manual_override: true, note: "Vecchia nota" }],
  );

  const closedDay = result.find((day) => day.date.toISOString().slice(0, 10) === "2026-09-02");
  assert.equal(closedDay?.workedHours, 0);
  assert.equal(closedDay?.note, "Vecchia nota");
});
