import test from "node:test";
import assert from "node:assert/strict";
import { clientControlProductSelection, restoreClientControlProducts } from "../lib/client-control-products";

test("new cards and legacy automatic product checks start unchecked", () => {
  assert.equal(restoreClientControlProducts({}), false);
  assert.equal(restoreClientControlProducts({ client_control_products: true, client_control_products_list: "Riapplicazione" }), false);
});
test("manual choices survive saving and reopening despite Shopify items", () => {
  for (const checked of [false, true]) {
    const answers = { ...clientControlProductSelection(checked), client_control_products_list: "Shampoo, Colore" };
    assert.equal(answers.client_control_products, checked);
    assert.equal(restoreClientControlProducts(answers), checked);
  }
});
test("legacy explicit selection without imported products remains selected", () => {
  assert.equal(restoreClientControlProducts({ client_control_products: true }), true);
  assert.equal(restoreClientControlProducts({ client_control_products: "false" }), false);
});
