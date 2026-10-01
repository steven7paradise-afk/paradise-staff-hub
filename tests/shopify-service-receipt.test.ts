import test from "node:test";
import assert from "node:assert/strict";
import { mergeShopifyServiceReceipt } from "../lib/shopify-service-receipt";
import { emptyWorkerService, workerServiceReceipt, restoreWorkerServices, combinedWorkerServiceNote } from "../lib/worker-service-sections";

test("Shopify receipt uses display name, appointment date, note then one service per line", () => {
  const section = { ...emptyWorkerService("franci"), services: ["Colore", "Piega"], details: ["Onde morbide.", "Staff: Sabrina Bellahsak. Collaboratrice assegnata da Paradise Staff Hub: Franci."] };
  assert.equal(workerServiceReceipt(section, "Franci", "2026-10-01T10:00:00+02:00"), "Francesca..............01/10/2026\n-----------------------\nNOTA\nOnde morbide.\n-----------------------\nSERVIZI ESEGUITI\nColore\nPiega");
});
test("reconfirm replaces only this appointment receipt, preserving other notes", () => {
  const old = "Nicol...01/10/2026\nNOTA\nVecchia\nSERVIZI\nTaglio";
  const next = "Nicol...01/10/2026\nNOTA\nNuova\nSERVIZI\nTaglio\nPiega";
  const unrelated = "Nota cliente importante.\n\nUn altro appuntamento.";
  const first = mergeShopifyServiceReceipt(unrelated, old, []);
  const second = mergeShopifyServiceReceipt(first, next, [old]);
  assert.equal(second, unrelated + "\n\n" + next);
  assert.equal(mergeShopifyServiceReceipt(second, next, [old, next]), second);
  assert.equal(mergeShopifyServiceReceipt(unrelated, "", []), unrelated);
});
test("a receipt substring inside someone else's text is preserved", () => {
  assert.equal(mergeShopifyServiceReceipt("Testo: vecchia nota", "nuova", ["vecchia nota"]), "Testo: vecchia nota\n\nnuova");
});
test("legacy assignment lines are not imported as written service details", () => {
  const fallback = { services: ["Riapplicazione"], grammi: "100g", lunghezza: "", fasce: "2", atteggiamento: "" };
  const result = restoreWorkerServices({ client_control_notes_text: "Sezione 1 — Franci (principale): Servizi: Riapplicazione con 100 g e 2 fasce. Staff: Sabrina Bellahsak. Collaboratrice assegnata da Paradise Staff Hub: Franci." }, ["franci"], "", fallback);
  assert.deepEqual(result[0].details, []);
});


test("same worker has one dated header and no empty placeholders across two sections", () => {
  const primary = { ...emptyWorkerService("franci"), services: ["Riapplicazione"], grammi: "100g", fasce: "2" };
  const secondary = { ...emptyWorkerService("franci"), slot: "additional" as const, atteggiamento: "Simpatica" };
  const staff = [{ id: "franci", name: "Franci" }];
  const before = combinedWorkerServiceNote([primary, secondary], staff, "2026-10-01T11:00:00Z");
  const after = combinedWorkerServiceNote([{ ...primary, lunghezza: "55cm" }, secondary], staff, "2026-10-01T11:00:00Z");
  const updated = mergeShopifyServiceReceipt(before, after, [before]);
  assert.equal(updated, after);
  for (const value of ["Francesca", "01/10/2026", "Riapplicazione", "Grammi: 100g", "Fasce: 2", "Cliente: Simpatica", "Lunghezza: 55cm"]) {
    assert.equal(updated.split(value).length - 1, 1);
  }
  assert.doesNotMatch(updated, /Nessun|NOTA|Staff:/);
});
