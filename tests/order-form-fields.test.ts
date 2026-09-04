import test from "node:test";
import assert from "node:assert/strict";
import { mergeOrderCustomerFields, ORDER_FORM_FIELD_IDS } from "../lib/order-form";

test("mette Shopify, cliente e pagamento all'inizio senza perdere le domande operative", () => {
  const result = mergeOrderCustomerFields([
    { id: "legacy_name", label: "Nome cognome", type: "text", required: true },
    { id: "legacy_paid", label: "Quanto ha pagato", type: "money", required: true },
    { id: "work", label: "Cosa dobbiamo fare?", type: "textarea", required: true },
  ]);

  assert.deepEqual(result.slice(0, 5).map((field) => field.id), [
    ORDER_FORM_FIELD_IDS.shopifyOrder,
    ORDER_FORM_FIELD_IDS.clientName,
    ORDER_FORM_FIELD_IDS.clientEmail,
    ORDER_FORM_FIELD_IDS.clientPhone,
    ORDER_FORM_FIELD_IDS.paidAmount,
  ]);
  assert.equal(result.some((field) => field.id === "legacy_name"), false);
  assert.equal(result.some((field) => field.id === "legacy_paid"), false);
  assert.equal(result.some((field) => field.id === "work"), true);
});

test("la migrazione dei campi ordine è ripetibile senza creare duplicati", () => {
  const once = mergeOrderCustomerFields([{ id: "work", label: "Note lavorazione", type: "textarea" }]);
  const twice = mergeOrderCustomerFields(once);

  assert.deepEqual(twice, once);
});
