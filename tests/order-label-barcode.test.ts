import assert from "node:assert/strict";
import test from "node:test";
import { orderLabelBarcodeValue, orderLabelQrValue } from "../lib/order-label-pdf-client";

test("the printed barcode uses the short visible order number", () => {
  assert.equal(orderLabelBarcodeValue("cmtaaiyr2000xs90j9t4bcrx2", "#25989"), "25989");
});

test("the printed barcode removes characters unsupported by the compact label", () => {
  assert.equal(orderLabelBarcodeValue("response-id", "# 25 989 / test"), "25989test");
});

test("the response id remains a fallback when the order number is unavailable", () => {
  assert.equal(orderLabelBarcodeValue("response-id"), "response-id");
});

test("the QR opens the matching order from a normal phone camera", () => {
  assert.equal(
    orderLabelQrValue("response-id", "#25989"),
    "https://staff-paradise.tech/o/25989",
  );
});
