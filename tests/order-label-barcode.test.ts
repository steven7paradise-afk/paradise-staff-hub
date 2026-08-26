import assert from "node:assert/strict";
import test from "node:test";
import { orderLabelBarcodeValue } from "../lib/order-label-pdf-client";

test("the printed barcode uses the short visible order number", () => {
  assert.equal(orderLabelBarcodeValue("cmtaaiyr2000xs90j9t4bcrx2", "#25989"), "25989");
});

test("the printed barcode removes characters unsupported by the compact label", () => {
  assert.equal(orderLabelBarcodeValue("response-id", "# 25 989 / test"), "25989test");
});

test("the response id remains a fallback when the order number is unavailable", () => {
  assert.equal(orderLabelBarcodeValue("response-id"), "response-id");
});
