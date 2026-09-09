import assert from "node:assert/strict";
import test from "node:test";
import { normalizeShopifyOrderReference } from "../lib/shopify";

test("normalizza i codici ordine Shopify incollati nel formulario", () => {
  assert.equal(normalizeShopifyOrderReference("#27159"), "#27159");
  assert.equal(normalizeShopifyOrderReference("27 159"), "27159");
  assert.equal(normalizeShopifyOrderReference("Ordine Shopify # 27159"), "#27159");
  assert.equal(normalizeShopifyOrderReference("https://admin.shopify.com/store/paradise/orders/1234567890123"), "1234567890123");
  assert.equal(normalizeShopifyOrderReference("Maria Rossi"), null);
});
