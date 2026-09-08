import assert from "node:assert/strict";
import test from "node:test";
import { canAccess, canEdit, defaultRolePermissions, mergePermissionSets, normalizeRolePermissions } from "../lib/roles";

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

test("Ordini Shopify ha un permesso separato configurabile", () => {
  assert.equal(canAccess("/shopify-orders", "RESPONSABILE", undefined, { view: ["/shopify-orders"], edit: [] }), true);
  assert.equal(canAccess("/shopify-orders", "RESPONSABILE", undefined, { view: ["/orders"], edit: ["/orders"] }), false);
  assert.equal(defaultRolePermissions().ZERO.view.includes("/shopify-orders"), true);
});

test("la mansione aggiunge permessi senza nascondere quelli del ruolo", () => {
  const permissions = mergePermissionSets(
    { view: ["/dashboard", "/tasks"], edit: ["/tasks"] },
    { view: ["/notifications"], edit: [] },
  );
  assert.deepEqual(permissions.view, ["/dashboard", "/tasks", "/notifications"]);
  assert.deepEqual(permissions.edit, ["/tasks"]);
});

test("la checklist di fine giornata separa lettura e scrittura per i lavoratori", () => {
  const readOnly = { view: ["/fine-giornata"], edit: [] };
  const readWrite = { view: ["/fine-giornata"], edit: ["/fine-giornata"] };

  assert.equal(canAccess("/fine-giornata", "DIPENDENTE"), false);
  assert.equal(canAccess("/fine-giornata", "DIPENDENTE", undefined, readOnly), true);
  assert.equal(canEdit("/fine-giornata", "DIPENDENTE", undefined, readOnly), false);
  assert.equal(canEdit("/fine-giornata", "DIPENDENTE", undefined, readWrite), true);
});

test("le vecchie matrici permessi mantengono la checklist disponibile agli amministratori", () => {
  const permissions = normalizeRolePermissions({
    ADMIN: { view: ["/dashboard"], edit: [] },
    SUPER_ADMIN: { view: ["/dashboard"], edit: [] },
  });

  assert.equal(permissions.ADMIN.view.includes("/fine-giornata"), true);
  assert.equal(permissions.ADMIN.edit.includes("/fine-giornata"), true);
  assert.equal(permissions.SUPER_ADMIN.view.includes("/fine-giornata"), true);
  assert.equal(permissions.SUPER_ADMIN.edit.includes("/fine-giornata"), true);
});
