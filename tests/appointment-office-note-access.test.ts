import assert from "node:assert/strict";
import test from "node:test";
import { canManageAppointmentOfficeNotes } from "../lib/appointment-office-note-access";

test("admins can manage appointment office notes", () => {
  assert.equal(canManageAppointmentOfficeNotes({ role: "ADMIN" }), true);
});

test("office workers can manage appointment office notes", () => {
  assert.equal(
    canManageAppointmentOfficeNotes({
      role: "DIPENDENTE",
      locationName: "Ufficio Paradise",
      mansione: "Amministrazione",
    }),
    true,
  );
});

test("customer assistance in the office can manage appointment office notes", () => {
  assert.equal(
    canManageAppointmentOfficeNotes({
      role: "DIPENDENTE",
      locationName: "Ufficio Paradise",
      mansione: "Assistenza clienti",
    }),
    true,
  );
});

test("workers selected on the Buenos Aires tablet can manage appointment office notes", () => {
  assert.equal(
    canManageAppointmentOfficeNotes({
      role: "DIPENDENTE",
      locationName: "Corso Buenos Aires",
      isPC: true,
    }),
    true,
  );
});

test("an unassigned salon PC cannot manage appointment office notes", () => {
  assert.equal(canManageAppointmentOfficeNotes({ role: "RESPONSABILE", isPC: true }), false);
});
