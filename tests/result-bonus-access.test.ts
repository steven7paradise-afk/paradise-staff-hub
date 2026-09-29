import assert from "node:assert/strict";
import test from "node:test";
import { mayConfigureResultBonus, mayManageResultBonus } from "../lib/result-bonus-data";
import { canAccess, canEdit, type Role } from "../lib/roles";

test("gestione premio e dinamiche riservate agli amministratori attivi", () => {
  for (const role of ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE", "MAGAZZINO"]) {
    const actor = { id: "actor", name: "Test", role, active: true };
    const allowed = ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(role);
    assert.equal(mayConfigureResultBonus(actor), allowed, role);
    assert.equal(mayManageResultBonus(actor), allowed, role);
    assert.equal(mayConfigureResultBonus({ ...actor, active: false }), false, role);
    assert.equal(mayManageResultBonus({ ...actor, active: false }), false, role);
    for (const path of ["/premio-risultato", "/premio-risultato/dinamiche"]) {
      const staleGrant = { view: ["/premio-risultato"], edit: ["/premio-risultato"] };
      assert.equal(canAccess(path, role as Role, "", staleGrant), allowed, `${role} ${path}`);
      assert.equal(canEdit(path, role as Role, "", staleGrant), allowed, `${role} ${path}`);
    }
  }
});
