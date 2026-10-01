import test from "node:test";
import assert from "node:assert/strict";
import { isAppointmentOfficeLocation, canAssignAppointmentOfficeStaff } from "../lib/appointment-office-staff";

test("office access uses the exact assigned location, including normalized salon prefix", () => {
  for (const name of ["Ufficio", " UFFICIO ", "Salone   Ufficio", "Ufficio Paradise"]) assert.equal(isAppointmentOfficeLocation(name), true);
  for (const name of [undefined, "", "Buenos Aires", "Duomo", "Ufficio esterno", "ADMIN"]) assert.equal(isAppointmentOfficeLocation(name), false);
});
test("office operator may choose any office member without requiring an admin role", () => {
  assert.equal(canAssignAppointmentOfficeStaff("Ufficio", "Salone Ufficio"), true);
});
test("salon and unknown operators cannot gain office assignment through the extension", () => {
  assert.equal(canAssignAppointmentOfficeStaff("Buenos Aires", "Ufficio"), false);
  assert.equal(canAssignAppointmentOfficeStaff(undefined, "Ufficio"), false);
  assert.equal(canAssignAppointmentOfficeStaff("Ufficio", "Duomo"), false);
});
