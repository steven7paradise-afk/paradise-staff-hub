import test from "node:test";
import assert from "node:assert/strict";
import { bookingBelongsToSalon, isWorkspaceAdmin, officeNoteText, workspaceModules } from "../lib/mobile-workspace-policy";
import { defaultRolePermissions } from "../lib/roles";

test("unidentified salon can only read appointments", () => {
  const modules = workspaceModules(null);
  assert.deepEqual(modules.map((item) => item.id), ["appointments"]);
  assert.equal(modules[0].canEdit, false);
});

test("admin menu uses effective permissions, not an unconditional role bypass", () => {
  assert.deepEqual(workspaceModules({ role: "ADMIN" }, { view: [], edit: [] }), []);
  const modules = workspaceModules({ role: "ADMIN" }, { view: ["/appointments"], edit: [] });
  assert.deepEqual(modules.map((item) => item.id), ["appointments"]);
  assert.equal(modules[0].canEdit, false);
});

test("default administrators see each implemented native module", () => {
  const modules = workspaceModules({ role: "ADMIN" }, defaultRolePermissions().ADMIN);
  assert.deepEqual(modules.map((item) => item.id), ["appointments", "employees", "locations"]);
});

test("employees do not receive the staff directory by default", () => {
  assert.equal(workspaceModules({ role: "DIPENDENTE" }, defaultRolePermissions().DIPENDENTE).some((item) => item.id === "employees"), false);
});

test("a shared device never infers salon from missing booking information", () => {
  assert.equal(bookingBelongsToSalon(undefined, "Buenos Aires"), false);
  assert.equal(bookingBelongsToSalon("Consulenza online", "Buenos Aires"), false);
  assert.equal(bookingBelongsToSalon("Piega | Duomo", "Buenos Aires"), false);
  assert.equal(bookingBelongsToSalon("Buenos Aires / Duomo", "Buenos Aires"), false);
  assert.equal(bookingBelongsToSalon("Piega | Buenos Aires", "Corso Buenos Aires"), true);
  assert.equal(bookingBelongsToSalon("Piega | Duomo", "Duomo"), true);
  assert.equal(bookingBelongsToSalon("Piega | Buenos Aires", "Ufficio"), false);
});

test("admin access excludes salon workers and unknown roles", () => {
  for (const role of ["ZERO", "SUPER_ADMIN", "ADMIN"]) assert.equal(isWorkspaceAdmin(role), true);
  for (const role of ["RESPONSABILE", "DIPENDENTE", "MAGAZZINO", "", "admin"]) assert.equal(isWorkspaceAdmin(role), false);
});

test("shared office note text is preserved verbatim for optimistic concurrency", () => {
  assert.equal(officeNoteText({ text: "150g 2 fasce\nby ufficio" }), "150g 2 fasce\nby ufficio");
  assert.equal(officeNoteText({ text: 12 }), "");
  assert.equal(officeNoteText(null), "");
});
