import assert from "node:assert/strict";
import test from "node:test";
import { shopifyOrderMatchKeys } from "../lib/shopify-payment-register";

test("abbina lo stesso ordine con o senza cancelletto", () => {
  assert.deepEqual(shopifyOrderMatchKeys("#26678"), ["26678"]);
  assert.deepEqual(shopifyOrderMatchKeys("26678"), ["26678"]);
});

test("estrae il codice ordine anche da testo o URL", () => {
  assert.ok(shopifyOrderMatchKeys("Saldo ordine #26678 pagato oggi").includes("26678"));
  assert.ok(shopifyOrderMatchKeys("https://admin.shopify.com/orders/26678").includes("26678"));
});

test("supporta più codici salvati nello stesso campo", () => {
  const keys = shopifyOrderMatchKeys("Acconto #26670 · saldo #26678");
  assert.ok(keys.includes("26670"));
  assert.ok(keys.includes("26678"));
});
