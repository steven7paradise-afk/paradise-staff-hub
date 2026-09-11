import assert from "node:assert/strict";
import test from "node:test";
import { isLikelySameCustomerEmail } from "../lib/shopify-customer-match";

test("riconosce l'email di Chiara con due lettere adiacenti invertite", () => {
  assert.equal(
    isLikelySameCustomerEmail("graziolichaira04@gmail.com", "graziolichiara04@gmail.com"),
    true,
  );
});

test("riconosce un singolo errore nel dominio dell'email", () => {
  assert.equal(
    isLikelySameCustomerEmail("kharratihind@gnail.com", "kharratihind@gmail.com"),
    true,
  );
});

test("non collega indirizzi di clienti diverse", () => {
  assert.equal(
    isLikelySameCustomerEmail("chiara.rossi@gmail.com", "chiara.bianchi@gmail.com"),
    false,
  );
  assert.equal(
    isLikelySameCustomerEmail("cliente@gmail.com", "cliente@yahoo.com"),
    false,
  );
});
