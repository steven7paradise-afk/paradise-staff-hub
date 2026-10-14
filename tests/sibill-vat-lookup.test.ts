import assert from "node:assert/strict";
import test from "node:test";
import { ItalianVatLookupError } from "../lib/italian-vat-lookup";
import { reconcileVatCompanyData, lookupVerifiedItalianVatCompany } from "../lib/sibill-vat-lookup";

const vies = {
  name: "CILLO NUNZIA",
  address: "VIA ROMA 1, 20100 MILANO (MI)",
  street: "VIA ROMA 1",
  postalCode: "20100",
  city: "MILANO",
  province: "MI",
  vat: "02925550739",
};

test("combines matching VIES and Sibill company data", () => {
  const company = reconcileVatCompanyData(vies, {
    company_name: "NUNZIA CILLO",
    vat_number: "IT02925550739",
    tax_number: "CLLNZE80A01F205X",
    address: "Via Roma 1",
    postal_code: "20100",
    city: "Milano",
    province_code: "MI",
  });

  assert.equal(company.name, "NUNZIA CILLO");
  assert.equal(company.address, "Via Roma 1, 20100 Milano (MI)");
  assert.equal(company.taxNumber, "CLLNZE80A01F205X");
  assert.equal(company.source, "VIES + SIBILL");
});

test("blocks a different VAT number returned by Sibill", () => {
  assert.throws(
    () => reconcileVatCompanyData(vies, {
      company_name: "CILLO NUNZIA",
      vat_number: "09063910013",
    }),
    (error) => error instanceof ItalianVatLookupError && error.status === 409,
  );
});

test("uses Sibill billing location and records differences with VIES", () => {
  const company = reconcileVatCompanyData(vies, {
      company_name: "CILLO NUNZIA",
      vat_number: "02925550739",
      postal_code: "00100",
      city: "ROMA",
      province_code: "RM",
    });
  assert.equal(company.postalCode, "00100");
  assert.equal(company.city, "ROMA");
  assert.equal(company.province, "RM");
  assert.ok(company.warning?.includes("Indirizzo diverso"));
});


test("searches Sibill when VIES does not list the VAT", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.SIBILL_API_TOKEN;
  process.env.SIBILL_API_TOKEN = "test-token";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify(calls === 1 ? { isValid: false } : { data: { vat_number: "12989161000", company_name: "Test", address: "Via Roma 1", postal_code: "20100", city: "Milano", province_code: "MI" } }), { status: 200 });
  };
  try {
    const result = await lookupVerifiedItalianVatCompany("12989161000");
    assert.equal(calls, 2);
    assert.equal(result.source, "SIBILL");
    assert.equal(result.name, "Test");
    assert.match(result.warning || "", /VIES non completata/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.SIBILL_API_TOKEN;
    else process.env.SIBILL_API_TOKEN = originalToken;
  }
});
