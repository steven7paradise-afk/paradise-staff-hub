import assert from "node:assert/strict";
import test from "node:test";
import { ItalianVatLookupError } from "../lib/italian-vat-lookup";
import { reconcileVatCompanyData } from "../lib/sibill-vat-lookup";

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

test("blocks conflicting registered locations", () => {
  assert.throws(
    () => reconcileVatCompanyData(vies, {
      company_name: "CILLO NUNZIA",
      vat_number: "02925550739",
      postal_code: "00100",
      city: "ROMA",
      province_code: "RM",
    }),
    (error) => error instanceof ItalianVatLookupError && error.message.includes("Sede aziendale diversa"),
  );
});
