import assert from "node:assert/strict";
import test from "node:test";
import { appendClientControlChecks } from "../lib/client-control-checks-note";
import { combinedWorkerServiceNote, emptyWorkerService } from "../lib/worker-service-sections";

const none = { beforeMedia: false, afterMedia: false, products: false, review: false };

test("receipt includes only explicitly selected checks once after all workers", () => {
  const receipt = combinedWorkerServiceNote([
    { ...emptyWorkerService("a"), services: ["Colore"] },
    { ...emptyWorkerService("b"), services: ["Piega"] },
  ], [{ id: "a", name: "Nicol" }, { id: "b", name: "Francesca" }], "2026-10-01");
  const result = appendClientControlChecks(receipt, { ...none, beforeMedia: true, review: true });
  assert.equal(result, `${receipt}\n\n-----------------------\nVERIFICHE E CONTROLLI\nPrima foto/video: Sì\nRecensione: Sì`);
  assert.doesNotMatch(result, /Prodotti|Dopo foto/);
});

test("repeated confirmation updates or removes checks without duplicating the base note", () => {
  const checks = { ...none, products: true, afterMedia: true };
  const first = appendClientControlChecks("Nota originale", checks);
  assert.equal(appendClientControlChecks(first, checks), first);
  assert.equal(appendClientControlChecks(first, none), "Nota originale");
  assert.equal(appendClientControlChecks(first, { ...none, review: true }), "Nota originale\n\n-----------------------\nVERIFICHE E CONTROLLI\nRecensione: Sì");
  assert.equal(appendClientControlChecks(appendClientControlChecks("", checks), none), "");
});
