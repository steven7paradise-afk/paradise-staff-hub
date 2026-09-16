import test from "node:test";
import assert from "node:assert/strict";
import JsBarcode from "jsbarcode";
import { createShippingFrameDecoder } from "../lib/shipping-frame-decoder";

function barcode(value: string, vertical = false) {
  const encoded: { encodings?: { data: string }[] } = {};
  JsBarcode(encoded, value, { format: "CODE128", displayValue: false });
  const bars = encoded.encodings!.map(part => part.data).join("");
  const width = bars.length * 3 + 60, height = 160;
  const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 20; y < 140; y++) for (let x = 30; x < width - 30; x++) {
    if (bars[Math.floor((x - 30) / 3)] !== "1") continue;
    const position = vertical ? ((x * height + height - 1 - y) * 4) : (y * width + x) * 4;
    rgba[position] = rgba[position + 1] = rgba[position + 2] = 0;
  }
  return { rgba, width: vertical ? height : width, height: vertical ? width : height };
}
test("decodes a real product Code128 without native browser detection", () => {
  const image = barcode("PRD003832042");
  assert.equal(createShippingFrameDecoder("BARCODE")(image.rgba, image.width, image.height), "PRD003832042");
});
test("decodes a vertical product barcode", () => {
  const image = barcode("PRD004232144", true);
  assert.equal(createShippingFrameDecoder("BARCODE")(image.rgba, image.width, image.height), "PRD004232144");
});
test("decodes a courier tracking and rejects an empty frame", () => {
  const decode = createShippingFrameDecoder("TRACKING");
  const image = barcode("6801679393");
  assert.equal(decode(image.rgba, image.width, image.height), "6801679393");
  assert.equal(decode(new Uint8ClampedArray(100 * 100 * 4).fill(255), 100, 100), null);
});
