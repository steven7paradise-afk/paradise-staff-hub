import assert from "node:assert/strict";
import test from "node:test";
import { isAdminRole } from "../lib/passkey";

test("Face ID Tablet Clock accepts only administrative roles", () => {
  assert.equal(isAdminRole("ZERO"), true);
  assert.equal(isAdminRole("SUPER_ADMIN"), true);
  assert.equal(isAdminRole("ADMIN"), true);
  assert.equal(isAdminRole("RESPONSABILE"), false);
  assert.equal(isAdminRole("MAGAZZINO"), false);
  assert.equal(isAdminRole("DIPENDENTE"), false);
  assert.equal(isAdminRole(undefined), false);
});
