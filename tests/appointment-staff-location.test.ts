import test from "node:test";
import assert from "node:assert/strict";
import { canWorkAcrossAppointmentLocations, employeeMatchesAppointmentLocation, matchAppointmentEmployeeIds } from "../lib/appointment-staff-access";

const staff = [
  { id: "franci", name: "Franci", role: "ZERO", locationName: "Ufficio Paradise" },
  { id: "melissa", name: "Melissa Valente", role: "DIPENDENTE", locationName: "Salone Buenos Aires" },
];
test("only administrative roles work across all appointment locations", () => {
  for (const role of ["ADMIN", "SUPER_ADMIN", "ZERO"]) {
    assert.equal(canWorkAcrossAppointmentLocations(role), true);
    assert.equal(employeeMatchesAppointmentLocation({ ...staff[0], role }, "Salone Duomo"), true);
  }
  for (const role of ["DIPENDENTE", "RESPONSABILE", "", undefined]) assert.equal(canWorkAcrossAppointmentLocations(role), false);
  assert.equal(employeeMatchesAppointmentLocation(staff[1], "Salone Duomo"), false);
});
test("Franci is not lost when the selected team also contains Melissa", () => {
  assert.deepEqual(matchAppointmentEmployeeIds(staff, staff, "Salone Buenos Aires"), ["franci", "melissa"]);
  assert.deepEqual(matchAppointmentEmployeeIds([staff[0]], staff, "Salone Duomo"), ["franci"]);
});
test("explicit IDs beat names and unknown ambiguous names never select another worker", () => {
  assert.deepEqual(matchAppointmentEmployeeIds([{ id: "franci", name: "Francesca Paradise" }], staff, "Salone Buenos Aires"), ["franci"]);
  const sameNames = [...staff, { ...staff[1], id: "melissa2", name: "Melissa Jaku" }];
  assert.deepEqual(matchAppointmentEmployeeIds([{ id: "external", name: "Melissa" }], sameNames, "Salone Buenos Aires"), []);
  assert.deepEqual(matchAppointmentEmployeeIds([{ id: "external", name: "Melissa Valente | BUENOS AIRES" }], staff, "Salone Buenos Aires"), ["melissa"]);
});
