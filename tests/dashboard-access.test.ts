import assert from "node:assert/strict";
import test from "node:test";
import { canViewManagementDashboard } from "../lib/dashboard-access";

test("la dashboard direzionale è riservata ai ruoli amministrativi", () => {
  assert.equal(canViewManagementDashboard("ZERO"), true);
  assert.equal(canViewManagementDashboard("SUPER_ADMIN"), true);
  assert.equal(canViewManagementDashboard("ADMIN"), true);
});

test("responsabili e dipendenti vedono soltanto la dashboard personale", () => {
  assert.equal(canViewManagementDashboard("RESPONSABILE"), false);
  assert.equal(canViewManagementDashboard("MAGAZZINO"), false);
  assert.equal(canViewManagementDashboard("DIPENDENTE"), false);
});
