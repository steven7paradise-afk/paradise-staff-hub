import assert from "node:assert/strict";
import test from "node:test";
import {
  appointmentStaffDisplayName,
  isAlwaysActiveAppointmentStaff,
} from "../lib/appointment-staff-access";

test("Franci può usare gli appuntamenti da ogni tablet autorizzato", () => {
  assert.equal(isAlwaysActiveAppointmentStaff("Franci"), true);
  assert.equal(isAlwaysActiveAppointmentStaff("  FRANCI  "), true);
  assert.equal(isAlwaysActiveAppointmentStaff("Profilo rinominato", "cmqf02qgq0001jx0913ddfys1"), true);
});

test("Steven dipende dalla timbratura come gli altri profili", () => {
  assert.equal(isAlwaysActiveAppointmentStaff("Steven Alvarez"), false);
  assert.equal(isAlwaysActiveAppointmentStaff("Profilo rinominato", "cmpmp66np0001ie09hko78bsb"), false);
});

test("il selettore mostra i nomi brevi richiesti", () => {
  assert.equal(appointmentStaffDisplayName("Franci"), "Francesca");
  assert.equal(appointmentStaffDisplayName("Steven Alvarez"), "Steven");
  assert.equal(appointmentStaffDisplayName("Jessica Inturri"), "Jessica Inturri");
});

test("gli altri profili continuano a dipendere da sede e timbratura", () => {
  assert.equal(isAlwaysActiveAppointmentStaff("Melissa Valenti"), false);
  assert.equal(isAlwaysActiveAppointmentStaff(null), false);
});
