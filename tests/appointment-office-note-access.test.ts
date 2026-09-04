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

test("customer assistance cannot manage appointment office notes", () => {
  assert.equal(
    canManageAppointmentOfficeNotes({
      role: "DIPENDENTE",
      locationName: "Ufficio Paradise",
      mansione: "Assistenza clienti",
    }),
    false,
  );
});

test("salon PCs cannot manage appointment office notes", () => {
  assert.equal(
    canManageAppointmentOfficeNotes({
      role: "ADMIN",
      locationName: "Ufficio Paradise",
      isPC: true,
    }),
    false,
  );
});
