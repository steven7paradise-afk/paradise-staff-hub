import test from "node:test";
import assert from "node:assert/strict";
import { resolveShippingScan, verifiedQuantity } from "../lib/shipping-scan";

const orderItems = [{
  id: "line-1",
  title: "Clip Paradise 55 cm",
  quantity: 2,
  barcode: "PRD003832042",
  sku: "SHOP-53961779315034",
  variantId: "53961779315034",
}];

test("lo scanner rifiuta un prodotto estraneo senza avanzare il conteggio", () => {
  const result = resolveShippingScan(orderItems, [], "PRD004232144\n");
  assert.equal(result.outcome, "UNKNOWN");
  assert.equal(verifiedQuantity(orderItems[0], []), 0);
});

test("ogni scansione corretta verifica una sola unità e poi segnala completo", () => {
  const first = resolveShippingScan(orderItems, [], "prd003832042");
  assert.equal(first.outcome, "MATCH");
  if (first.outcome !== "MATCH") return;
  assert.equal(first.nextQuantity, 1);

  const verifiedOnce = [first.key];
  const second = resolveShippingScan(orderItems, verifiedOnce, "PRD003832042");
  assert.equal(second.outcome, "MATCH");
  if (second.outcome !== "MATCH") return;
  assert.equal(second.nextQuantity, 2);

  const verifiedTwice = [...verifiedOnce, second.key];
  assert.equal(verifiedQuantity(orderItems[0], verifiedTwice), 2);
  assert.equal(resolveShippingScan(orderItems, verifiedTwice, "PRD003832042").outcome, "COMPLETE");
});
