import assert from "node:assert/strict";
import test from "node:test";
import { normalizeScannedOrderReference, orderCodeCandidates } from "../lib/order-code-reader";

test("legge il numero ordine dai QR brevi e dai link Shopify", () => {
  assert.equal(normalizeScannedOrderReference("https://staff-paradise.tech/o/25989"), "25989");
  assert.equal(
    normalizeScannedOrderReference("https://admin.shopify.com/store/paradise/orders/6123456789012"),
    "6123456789012",
  );
  assert.equal(normalizeScannedOrderReference("gid://shopify/Order/6123456789012"), "6123456789012");
});

test("un ordine può essere trovato sia dal numero visibile sia dall'id Shopify salvato", () => {
  const candidates = orderCodeCandidates({
    responseId: "response-123",
    visibleOrderNumber: "#25989",
    answers: {
      order_shopify_order: "#25989",
      shopify_link: "https://admin.shopify.com/store/paradise/orders/6123456789012",
    },
  });
  assert.equal(candidates.has("25989"), true);
  assert.equal(candidates.has("6123456789012"), true);
  assert.equal(candidates.has("response-123"), true);
});
