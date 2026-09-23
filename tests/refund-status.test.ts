import test from "node:test";
import assert from "node:assert/strict";
import { canChangeRefundStatus, refundStatusHistory, REFUND_STATUS_LABELS } from "../lib/refund-status";

test("refunds require approval before processing or completion", () => {
  assert.equal(canChangeRefundStatus("NEW", "REFUNDED"), false);
  assert.equal(canChangeRefundStatus("REJECTED", "IN_PROGRESS"), false);
  assert.equal(canChangeRefundStatus("NEW", "APPROVED"), true);
  assert.equal(canChangeRefundStatus("APPROVED", "IN_PROGRESS"), true);
  assert.equal(canChangeRefundStatus("IN_PROGRESS", "REFUNDED"), true);
  assert.equal(canChangeRefundStatus("APPROVED", "REFUNDED"), true);
});
test("completed refunds cannot silently reopen and unknown states are rejected", () => {
  assert.equal(canChangeRefundStatus("REFUNDED", "NEW"), false);
  assert.equal(canChangeRefundStatus("NEW", "PAID"), false);
  assert.equal(canChangeRefundStatus("NEW", "toString"), false);
  assert.equal(REFUND_STATUS_LABELS.REFUNDED, "Rimborsato");
});
test("historical approval identity is preserved separately from completion", () => {
  const history = refundStatusHistory([
    { type: "STATUS_CHANGE", to: "APPROVED", by: "Anna", at: "2026-09-23T10:00:00Z" },
    { type: "STATUS_CHANGE", to: "REFUNDED", by: "Laura", at: "2026-09-23T11:00:00Z" },
    { type: "STATUS_CHANGE", to: "APPROVED", by: "Invalid", at: "invalid" },
    null,
  ]);
  assert.equal(history.length, 2);
  assert.equal(history.find(event => event.to === "APPROVED")?.by, "Anna");
  assert.equal(history.at(-1)?.by, "Laura");
  assert.deepEqual(refundStatusHistory(null), []);
});
