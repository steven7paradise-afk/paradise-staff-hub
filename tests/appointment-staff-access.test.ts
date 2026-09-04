import assert from "node:assert/strict";
import test from "node:test";
import { isAlwaysActiveAppointmentStaff } from "../lib/appointment-staff-access";

test("Franci può usare gli appuntamenti da ogni tablet autorizzato", () => {
  assert.equal(isAlwaysActiveAppointmentStaff("Franci"), true);
  assert.equal(isAlwaysActiveAppointmentStaff("  FRANCI  "), true);
});

test("gli altri profili continuano a dipendere da sede e timbratura", () => {
  assert.equal(isAlwaysActiveAppointmentStaff("Melissa Valenti"), false);
  assert.equal(isAlwaysActiveAppointmentStaff(null), false);
});
