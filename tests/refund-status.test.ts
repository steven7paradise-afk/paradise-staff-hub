import test from "node:test";
import assert from "node:assert/strict";
import { refundStates, validRefundStates, refundStatusHistory } from "../lib/refund-status";

test("refunds require approval before processing or completion", () => {
  assert.equal(validRefundStates("NEW", "REFUNDED"), false);
  assert.equal(validRefundStates("REJECTED", "IN_PROGRESS"), false);
  assert.equal(validRefundStates("APPROVED", "PENDING"), true);
  assert.equal(validRefundStates("APPROVED", "IN_PROGRESS"), true);
  assert.equal(validRefundStates("APPROVED", "REFUNDED"), true);
});
test("legacy combined states retain both meanings", () => {
  assert.deepEqual(refundStates("REFUNDED", null), { approval: "APPROVED", payment: "REFUNDED" });
  assert.deepEqual(refundStates("IN_PROGRESS", null), { approval: "APPROVED", payment: "IN_PROGRESS" });
  assert.deepEqual(refundStates("APPROVED", { text: "già rimborsato" }), { approval: "APPROVED", payment: "PENDING" });
  assert.deepEqual(refundStates("APPROVED", { refundPaymentStatus: "REFUNDED" }), { approval: "APPROVED", payment: "REFUNDED" });
  assert.equal(validRefundStates("APPROVED", "toString"), false);
});
test("historical approval identity is preserved separately from completion", () => {
  const history = refundStatusHistory([
    { type: "STATUS_CHANGE", to: "APPROVED", by: "Anna", at: "2026-09-23T10:00:00Z" },
    { type: "REFUND_PAYMENT_CHANGE", to: "REFUNDED", by: "Laura", at: "2026-09-23T11:00:00Z" },
    { type: "STATUS_CHANGE", to: "APPROVED", by: "Invalid", at: "invalid" },
    null,
  ]);
  assert.equal(history.length, 2);
  assert.equal(history.find(event => event.to === "APPROVED")?.by, "Anna");
  assert.equal(history.at(-1)?.by, "Laura");
  assert.deepEqual(refundStatusHistory(null), []);
});
