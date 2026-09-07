import assert from "node:assert/strict";
import test from "node:test";
import { buildSibillInvoiceDraft, parseItalianBillingAddress, selectSibillAccountId, SibillDraftError } from "../lib/sibill-invoice";

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

test("parses the historical VIES address format without parentheses", () => {
  assert.deepEqual(parseItalianBillingAddress("VIALE ABRUZZI 92, 20131 MILANO MI"), {
    address: "VIALE ABRUZZI 92",
    postalCode: "20131",
    city: "MILANO",
    province: "MI",
  });
});

test("builds a private-client draft with VAT included and no SDI issue flag", () => {
  const payload = buildSibillInvoiceDraft({
    invoice_client_type: "Privato (Codice Fiscale)",
    invoice_client_name: "Maria Rossi",
    invoice_fiscal_code: "RSSMRA80A01F205X",
    invoice_address: "Via Roma 10, 20100 Milano (MI)",
    invoice_shopify_order: "26964",
    invoice_notes: "Corso formazione",
    invoice_amount: "122",
    invoice_payment_method: "Carta di Credito / Bancomat",
  }, company, new Date("2026-09-07T10:00:00Z"));

  assert.equal(payload.fattura_elettronica_header.dati_trasmissione.codice_destinatario, "0000000");
  assert.equal(payload.sistema_emittente, "PARADISE");
  assert.deepEqual(payload.fattura_elettronica_body[0].dati_generali.dati_generali_documento.causale, ["Ordine Shopify #26964"]);
  assert.equal(payload.fattura_elettronica_body[0].dati_beni_servizi.dettaglio_linee[0].descrizione, "Corso formazione");
  assert.equal(
    payload.fattura_elettronica_body[0].dati_beni_servizi.dettaglio_linee[0].altri_dati_gestionali?.[0]?.riferimento_testo,
    "Ordine Shopify #26964",
  );
  assert.equal(payload.fattura_elettronica_body[0].dati_beni_servizi.dati_riepilogo[0].imponibile_importo, "100.00");
  assert.equal(payload.fattura_elettronica_body[0].dati_beni_servizi.dati_riepilogo[0].imposta, "22.00");
  assert.equal(payload.fattura_elettronica_body[0].dati_pagamento[0].dettaglio_pagamento[0].modalita_pagamento, "MP08");
});

test("does not send an invalid historical SDI code to Sibill", () => {
  const payload = buildSibillInvoiceDraft({
    invoice_client_type: "Azienda / Libero Professionista (Partita IVA)",
    invoice_client_name: "Azienda Test Srl",
    invoice_vat_number: "09063910013",
    invoice_sdi_code: "USAL8PV CF",
    invoice_address: "VIALE ABRUZZI 92, 20131 MILANO MI",
    invoice_amount: "35",
    invoice_payment_method: "Carta di Credito / Bancomat",
  }, company);

  assert.equal(payload.fattura_elettronica_header.dati_trasmissione.codice_destinatario, "0000000");
});

test("uses the Shopify net and VAT totals when they reconcile with the order total", () => {
  const payload = buildSibillInvoiceDraft({
    invoice_client_type: "Privato (Codice Fiscale)",
    invoice_client_name: "Maria Rossi",
    invoice_fiscal_code: "RSSMRA80A01F205X",
    invoice_address: "Via Roma 10, 20100 Milano (MI)",
    invoice_shopify_order: "#26964",
    invoice_amount: "35",
    invoice_shopify_net_amount: "28.69",
    invoice_shopify_tax_amount: "6.31",
    invoice_payment_method: "Carta di Credito / Bancomat",
  }, company);

  const summary = payload.fattura_elettronica_body[0].dati_beni_servizi.dati_riepilogo[0];
  assert.equal(summary.imponibile_importo, "28.69");
  assert.equal(summary.imposta, "6.31");
  assert.equal(summary.aliquota_iva, "22.00");
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

test("selects the configured card account ending in 5597", () => {
  const accounts = [
    { id: "account-one", nickname: "Banca principale •••• 1020" },
    { id: "account-card", nickname: "Conto carta •••• 5597" },
  ];

  assert.equal(selectSibillAccountId(accounts, "CARD", undefined, "5597"), "account-card");
  assert.equal(selectSibillAccountId(accounts, "CARD", undefined, "9999"), null);
});

test("selects the active EUR 5597 account when Sibill exposes duplicate masked accounts", () => {
  const accounts = [
    { id: "account-usd", nickname: "Main · ***85597", currency: "USD", current_balance: { amount: "0", currency: "USD" } },
    { id: "account-empty-eur", nickname: "Main · ***85597", currency: "EUR", current_balance: { amount: "0", currency: "EUR" } },
    { id: "account-active-eur", nickname: "Main · ***85597", currency: "EUR", current_balance: { amount: "145059.51", currency: "EUR" } },
  ];

  assert.equal(selectSibillAccountId(accounts, "CARD", undefined, "5597"), "account-active-eur");
});

test("does not guess between duplicate 5597 accounts with the same balance", () => {
  const accounts = [
    { id: "account-one", nickname: "Main · ***85597", currency: "EUR", current_balance: { amount: "0", currency: "EUR" } },
    { id: "account-two", nickname: "Main · ***85597", currency: "EUR", current_balance: { amount: "0", currency: "EUR" } },
  ];

  assert.equal(selectSibillAccountId(accounts, "CARD", undefined, "5597"), null);
});

test("selects the active EUR card account when Sibill hides the masked number from the API", () => {
  const accounts = [
    { id: "account-usd", nickname: "Main", currency: "USD", current_balance: { amount: "0", currency: "USD" } },
    { id: "account-empty-eur", nickname: "Main", currency: "EUR", current_balance: { amount: "0", currency: "EUR" } },
    { id: "account-active-eur", nickname: "Main", currency: "EUR", current_balance: { amount: "145059.51", currency: "EUR" } },
  ];

  assert.equal(selectSibillAccountId(accounts, "CARD", undefined, "5597"), "account-active-eur");
});
