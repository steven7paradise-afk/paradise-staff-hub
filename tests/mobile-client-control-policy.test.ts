import { test } from "node:test";
import assert from "node:assert/strict";
import { isAssignedWorker, controlPatch, controlFields } from "../lib/mobile-client-control-policy";

test("only assigned local IDs or explicit external aliases grant access", () => {
  assert.equal(isAssignedWorker("worker-a", [{ id: "worker-a", name: "A" }], {}), true);
  assert.equal(isAssignedWorker("worker-a", [{ id: "external", name: "A" }], { external: { userId: "worker-a" } }), true);
  assert.equal(isAssignedWorker("worker-b", [{ id: "worker-a", name: "B" }], {}), false);
  assert.equal(isAssignedWorker("worker-a", [{ id: "unknown", name: "A" }], {}), false);
  assert.equal(isAssignedWorker("worker-a", [], {}), false);
});
test("patch cannot change ownership, payment verification or booking identity", () => {
  for (const key of ["booking_id", "client_control_service_staff", "client_control_payment_verified", "client_control_correctness"]) {
    assert.equal(controlPatch({ [key]: "forged" }), null);
  }
  assert.equal(controlPatch({ custom_services: [] }), null);
  assert.equal(controlPatch({ custom_extra_note: "x".repeat(4001) }), null);
  assert.deepEqual(controlPatch({ custom_services: "Applicazione|Piega", custom_grammi: " 100g " }), { custom_services: ["Applicazione", "Piega"], custom_grammi: "100g" });
});
test("existing form values roundtrip without exposing unrelated answers", () => {
  const fields = controlFields({ custom_services: ["Colore", "Taglio"], custom_fasce: "3", secret: "not exposed" });
  assert.equal(fields.custom_services, "Colore|Taglio");
  assert.equal(fields.secret, undefined);
  assert.equal(fields.second_shopify_order, "");
});
