import assert from "node:assert/strict";
import test from "node:test";
import { canAccess, canEdit, defaultRolePermissions, mergePermissionSets } from "../lib/roles";

test("un dipendente non accede alle pagine amministrative", () => {
  assert.equal(canAccess("/employees", "DIPENDENTE"), false);
  assert.equal(canAccess("/settings/devices", "DIPENDENTE"), false);
});

test("le spedizioni sono visibili e modificabili dai ruoli operativi previsti", () => {
  assert.equal(canAccess("/shipping", "MAGAZZINO"), true);
  assert.equal(canEdit("/shipping", "MAGAZZINO"), true);
  assert.equal(canAccess("/shipping", "DIPENDENTE"), false);
});

test("la matrice Zero resta completa", () => {
  const permissions = defaultRolePermissions().ZERO;
  assert.equal(permissions.view.includes("/shipping"), true);
  assert.equal(permissions.edit.includes("/shipping"), true);
});

test("la mansione aggiunge permessi senza nascondere quelli del ruolo", () => {
  const permissions = mergePermissionSets(
    { view: ["/dashboard", "/shift-reports"], edit: ["/shift-reports"] },
    { view: ["/notifications"], edit: [] },
  );
  assert.deepEqual(permissions.view, ["/dashboard", "/shift-reports", "/notifications"]);
  assert.deepEqual(permissions.edit, ["/shift-reports"]);
});
