import assert from "node:assert/strict";
import test from "node:test";
import { canDecideTaskCompletion, canRequestTaskCompletion } from "../lib/task-completion-workflow";

test("il personale assegnato può richiedere il completamento una sola volta", () => {
  assert.equal(canRequestTaskCompletion({ isAssignee: true, currentStatus: "ACTIVE" }), true);
  assert.equal(canRequestTaskCompletion({ isAssignee: false, currentStatus: "ACTIVE" }), false);
  assert.equal(canRequestTaskCompletion({ isAssignee: true, currentStatus: "COMPLETION_REQUESTED" }), false);
  assert.equal(canRequestTaskCompletion({ isAssignee: true, currentStatus: "COMPLETED" }), false);
});

test("solo chi ha assegnato la task può confermare o rifiutare", () => {
  const pending = { createdById: "creator", currentStatus: "COMPLETION_REQUESTED" };
  assert.equal(canDecideTaskCompletion({ ...pending, userId: "creator", role: "ADMIN" }), true);
  assert.equal(canDecideTaskCompletion({ ...pending, userId: "worker", role: "DIPENDENTE" }), false);
  assert.equal(canDecideTaskCompletion({ ...pending, userId: "other-admin", role: "ADMIN" }), false);
  assert.equal(canDecideTaskCompletion({ ...pending, userId: "zero", role: "ZERO" }), true);
  assert.equal(canDecideTaskCompletion({ ...pending, userId: "creator", role: "ADMIN", currentStatus: "ACTIVE" }), false);
});
