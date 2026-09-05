import assert from "node:assert/strict";
import test from "node:test";
import { resolveOrderConfirmer } from "../lib/order-confirmation";

const staff = [
  { id: "worker-1", name: "Franci Paradise", photo_url: "https://example.test/franci.jpg" },
  { id: "worker-2", name: "Melissa Valenti", photo_url: null },
];

test("the explicitly assigned confirmer has priority", () => {
  assert.deepEqual(resolveOrderConfirmer({
    assigned_to_id: "worker-1",
    activity_log: [{ type: "STATUS_CHANGE", by: "Melissa Valenti", to: "READY" }],
  }, staff), staff[0]);
});

test("older orders recover the latest confirmer from the status history", () => {
  assert.deepEqual(resolveOrderConfirmer({
    activity_log: [
      { type: "STATUS_CHANGE", by: "Franci Paradise", to: "PREPARING" },
      { type: "STATUS_CHANGE", by: "Melissa Valenti", to: "READY" },
    ],
  }, staff), staff[1]);
});

test("an order without a confirmation keeps creator attribution separate", () => {
  assert.equal(resolveOrderConfirmer({ activity_log: [] }, staff), null);
});
