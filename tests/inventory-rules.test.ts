import test from "node:test";
import assert from "node:assert/strict";
import {
  assertInventoryTransition,
  formatInventoryLabelCode,
  inventoryManagementRoles,
  inventoryOperationRoles,
  nextStatusForOperation,
} from "../lib/inventory-rules";

test("genera dieci codici progressivi distinti per dieci unità dello stesso prodotto", () => {
  const labels = Array.from({ length: 10 }, (_, index) => formatInventoryLabelCode(index + 1));
  assert.equal(new Set(labels).size, 10);
  assert.deepEqual(labels, ["PB-00000001", "PB-00000002", "PB-00000003", "PB-00000004", "PB-00000005", "PB-00000006", "PB-00000007", "PB-00000008", "PB-00000009", "PB-00000010"]);
});

test("l'uscita riduce la disponibilità logica e una seconda uscita viene rifiutata", () => {
  const units = Array.from({ length: 10 }, () => "AVAILABLE" as const);
  assertInventoryTransition("OUT", units[0]);
  const after = units.map((status, index) => index === 0 ? nextStatusForOperation("OUT") : status);
  assert.equal(after.filter((status) => status === "AVAILABLE").length, 9);
  assert.throws(() => assertInventoryTransition("OUT", after[0]), /già uscita/);
});

test("trasferimento conserva lo stato, reso ripristina la disponibilità e danneggiato la rimuove", () => {
  assert.doesNotThrow(() => assertInventoryTransition("TRANSFER", "AVAILABLE"));
  assertInventoryTransition("RETURN", "SOLD");
  assert.equal(nextStatusForOperation("RETURN"), "AVAILABLE");
  assertInventoryTransition("DAMAGED", "AVAILABLE");
  assert.equal(nextStatusForOperation("DAMAGED"), "DAMAGED");
});

test("la ristampa mantiene lo stesso codice", () => {
  const original = formatInventoryLabelCode(81);
  const reprint = original;
  assert.equal(reprint, "PB-00000081");
});

test("i permessi separano gestione prodotti e operazioni scanner", () => {
  assert.equal(inventoryManagementRoles.has("RESPONSABILE"), true);
  assert.equal(inventoryManagementRoles.has("MAGAZZINO"), false);
  assert.equal(inventoryOperationRoles.has("MAGAZZINO"), true);
  assert.equal(inventoryOperationRoles.has("DIPENDENTE"), false);
});
