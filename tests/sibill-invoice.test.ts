import assert from "node:assert/strict";
import test from "node:test";
import { buildSibillInvoiceDraft, parseItalianBillingAddress, SibillDraftError } from "../lib/sibill-invoice";

const company = {
  id: "company-1",
  name: "Paradise Beauty Srl",
  vat_number: "13218610965",
  fiscal_regime: "RF01",
  company_identity: {
    address: "Corso Buenos Aires 10",
    city: "Milano",
    country: "IT",
    postal_code: "20124",
    province_code: "MI",
  },
};

test("parses a complete Italian billing address", () => {
  assert.deepEqual(parseItalianBillingAddress("Via Roma 10, 20100 Milano (MI)"), {
    address: "Via Roma 10",
    postalCode: "20100",
    city: "Milano",
    province: "MI",
  });
});

test("builds a private-client draft with VAT included and no SDI issue flag", () => {
  const payload = buildSibillInvoiceDraft({
    invoice_client_type: "Privato (Codice Fiscale)",
    invoice_client_name: "Maria Rossi",
    invoice_fiscal_code: "RSSMRA80A01F205X",
    invoice_address: "Via Roma 10, 20100 Milano (MI)",
    invoice_amount: "122",
    invoice_payment_method: "Carta di Credito / Bancomat",
  }, company, new Date("2026-09-07T10:00:00Z"));

  assert.equal(payload.fattura_elettronica_header.dati_trasmissione.codice_destinatario, "0000000");
  assert.equal(payload.fattura_elettronica_body[0].dati_beni_servizi.dati_riepilogo[0].imponibile_importo, "100.00");
  assert.equal(payload.fattura_elettronica_body[0].dati_beni_servizi.dati_riepilogo[0].imposta, "22.00");
  assert.equal(payload.fattura_elettronica_body[0].dati_pagamento[0].dettaglio_pagamento[0].modalita_pagamento, "MP08");
});

test("requires a complete address before creating a Sibill draft", () => {
  assert.throws(
    () => buildSibillInvoiceDraft({
      invoice_client_type: "Privato (Codice Fiscale)",
      invoice_client_name: "Maria Rossi",
      invoice_fiscal_code: "RSSMRA80A01F205X",
      invoice_address: "Via Roma 10",
      invoice_amount: "100",
    }, company),
    (error) => error instanceof SibillDraftError && error.message.includes("CAP Città"),
  );
});
