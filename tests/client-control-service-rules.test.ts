import assert from "node:assert/strict";
import test from "node:test";
import { allowsMissingFinalPaymentOrder } from "../lib/client-control-service-rules";

test("sistemazione fasce non richiede l'ordine del saldo finale", () => {
  assert.equal(allowsMissingFinalPaymentOrder(["Sistemazione fasce"]), true);
  assert.equal(allowsMissingFinalPaymentOrder(["Piega", "Sistemazione fascia"]), true);
});

test("gli altri servizi continuano a richiedere il saldo finale", () => {
  assert.equal(allowsMissingFinalPaymentOrder(["Applicazione"]), false);
  assert.equal(allowsMissingFinalPaymentOrder(["Rimozione"]), false);
  assert.equal(allowsMissingFinalPaymentOrder([]), false);
});
