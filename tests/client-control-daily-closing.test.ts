import assert from "node:assert/strict";
import test from "node:test";
import { canAutomaticallyCloseControl } from "../lib/client-control-daily-closing";

const baseAnswers = {
  client_control_client_name: "Roberta Di Matteo",
  client_control_email: "roberta@example.com",
};

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    orderName: "#27086",
    clientName: "Roberta Di Matteo",
    totalPrice: 100,
    totalTax: 0,
    netAmount: 100,
    paidAmount: 100,
    lineItems: [],
    note: null,
    email: "roberta@example.com",
    phone: null,
    createdAt: null,
    financialStatus: "paid",
    paymentGateways: ["cash"],
    paymentMethod: "CONTANTI" as const,
    paymentBreakdown: [],
    paymentReference: null,
    transactionStatus: "success",
    transactionProcessedAt: null,
    billingAddress: null,
    ...overrides,
  };
}

test("chiude automaticamente una bozza verificata e pagata su Shopify", () => {
  assert.equal(canAutomaticallyCloseControl({
    answers: baseAnswers,
    finalOrder: order(),
    finalPaymentOptional: false,
  }), true);
});

test("chiude una consulenza gratuita anche senza stato paid", () => {
  assert.equal(canAutomaticallyCloseControl({
    answers: baseAnswers,
    finalOrder: order({ totalPrice: 0, paidAmount: 0, financialStatus: "pending", paymentMethod: "DA_VERIFICARE" }),
    finalPaymentOptional: true,
  }), true);
});

test("non chiude automaticamente se il cliente non coincide", () => {
  assert.equal(canAutomaticallyCloseControl({
    answers: baseAnswers,
    finalOrder: order({ clientName: "Altra Cliente", email: "altra@example.com" }),
    finalPaymentOptional: false,
  }), false);
});
