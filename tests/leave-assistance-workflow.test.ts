import assert from "node:assert/strict";
import test from "node:test";
import { shouldCreateLeaveAssistanceWorkflow } from "../lib/leave-assistance-workflow";

for (const type of ["FERIE", "PERMESSO", "MALATTIA", "RIPOSO"] as const) {
  test(`creates the assistance workflow when ${type} is approved`, () => {
    assert.equal(shouldCreateLeaveAssistanceWorkflow("PENDING", "APPROVED", type), true);
  });
}

test("does not create duplicates when an approved request is saved again", () => {
  assert.equal(shouldCreateLeaveAssistanceWorkflow("APPROVED", "APPROVED", "FERIE"), false);
});

test("does not create the workflow for rejected or generic requests", () => {
  assert.equal(shouldCreateLeaveAssistanceWorkflow("PENDING", "REJECTED", "PERMESSO"), false);
  assert.equal(shouldCreateLeaveAssistanceWorkflow("PENDING", "APPROVED", "ALTRO"), false);
});
