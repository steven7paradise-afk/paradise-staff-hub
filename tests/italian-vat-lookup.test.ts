import assert from "node:assert/strict";
import test from "node:test";
import { hasValidItalianVatChecksum, normalizeItalianViesCompany } from "../lib/italian-vat-lookup";

test("validates an Italian VAT checksum", () => {
  assert.equal(hasValidItalianVatChecksum("09063910013"), true);
  assert.equal(hasValidItalianVatChecksum("09063910014"), false);
  assert.equal(hasValidItalianVatChecksum("123"), false);
});

test("normalizes the multiline company address returned by VIES", () => {
  assert.deepEqual(normalizeItalianViesCompany({
    name: "CALIENDO ALESSIA",
    address: "VIALE ABRUZZI 92 \n20131 MILANO MI\n",
  }), {
    name: "CALIENDO ALESSIA",
    street: "VIALE ABRUZZI 92",
    postalCode: "20131",
    city: "MILANO",
    province: "MI",
    address: "VIALE ABRUZZI 92, 20131 MILANO (MI)",
  });
});

test("normalizes punctuation in a VIES company name", () => {
  const company = normalizeItalianViesCompany({
    name: "LOOKLOVERS HAIRSTYLIST DI PULICE ANCONELLA SNC !!S.N.C.",
    address: "VIALE DEI GRACCHI N 29\n13040 BORGO D'ALE VC",
  });
  assert.equal(company?.name, "LOOKLOVERS HAIRSTYLIST DI PULICE ANCONELLA SNC S.N.C.");
  assert.equal(company?.address, "VIALE DEI GRACCHI N 29, 13040 BORGO D'ALE (VC)");
});

test("requires complete location data from VIES", () => {
  assert.equal(normalizeItalianViesCompany({ name: "AZIENDA TEST", address: "VIA ROMA 1" }), null);
});
