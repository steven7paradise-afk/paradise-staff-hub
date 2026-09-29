import assert from "node:assert/strict";
import test from "node:test";
import type { AssistanceSheet, AssistanceTableRow } from "../lib/assistance-tables";
import { resultBonusTableOccurrences } from "../lib/result-bonus-tables";

const people = [{ id: "a", name: "Aurora Dassisti" }, { id: "m", name: "Melissa Jaku" }, { id: "v", name: "Melissa Valente" }];
function row(id: string, previous: string, createdAt = "2026-09-15T10:00:00Z"): AssistanceTableRow {
  return { id, nome: "", cognome: "", testo: "", image: null, file: null, values: { prev: previous, repair: "Melissa Valente", order: "123" }, createdAt, updatedAt: "2026-10-20T10:00:00Z", reviewedAt: "2026-10-20T10:00:00Z", reviewedBy: "Responsabile" };
}
function sheet(rows: AssistanceTableRow[]): AssistanceSheet {
  return { id: "s", name: "Sistemazione fasce", columns: [{ id: "prev", label: "app. precedente", type: "text" }, { id: "repair", label: "sistemazione", type: "text" }, { id: "order", label: "Numero ordine", type: "text" }], rows, createdAt: "2026-09-01", updatedAt: "2026-09-01" };
}
test("nessun punto per righe non controllate, anche se i nomi sono già compilati", () => {
  const pending = row("pending", "Aurora Dassisti");
  delete pending.reviewedAt;
  delete pending.reviewedBy;
  const unchecked = { ...row("unchecked", "Melissa Jaku"), reviewedAt: null, reviewedBy: null };
  const invalid = { ...row("invalid", "Melissa Valente"), reviewedAt: "invalid" };
  assert.deepEqual(resultBonusTableOccurrences([sheet([pending, unchecked, invalid])], "2026-09", people), []);
});
test("la spunta abilita il conteggio e rimuoverla lo esclude nuovamente", () => {
  const checked = row("checked", "Aurora Dassisti");
  assert.equal(resultBonusTableOccurrences([sheet([checked])], "2026-09", people).length, 1);
  checked.reviewedAt = null;
  checked.reviewedBy = null;
  assert.equal(resultBonusTableOccurrences([sheet([checked])], "2026-09", people).length, 0);
});
test("attribuisce solo ad app. precedente, una volta per riga e lavoratore", () => {
  const data = sheet([row("1", "Aurora Dassisti, Aurora Dassisti; Melissa Jaku"), row("1", "Aurora Dassisti")]);
  assert.deepEqual(resultBonusTableOccurrences([data], "2026-09", people).map((item) => item.userId), ["a", "m"]);
});
test("il mese è quello di inserimento in Italia, non quello di modifica", () => {
  const data = sheet([row("1", "Aurora Dassisti", "2026-08-31T22:30:00Z"), row("2", "Aurora Dassisti", "2026-08-15T10:00:00Z")]);
  assert.equal(resultBonusTableOccurrences([data], "2026-09", people).length, 1);
  assert.equal(resultBonusTableOccurrences([data], "2026-10", people).length, 0);
});
test("non attribuisce nomi incompleti, ambigui o da verificare; accetta cognome prima del nome", () => {
  const data = sheet([row("1", "Melissa"), row("2", "Da verificare"), row("3", "DASSISTI AURORA"), row("4", "Aurora Dassisti", "invalid")]);
  assert.equal(resultBonusTableOccurrences([data], "2026-09", people).length, 1);
  assert.equal(resultBonusTableOccurrences([sheet([row("5", "Aurora Dassisti")])], "2026-09", [...people, { id: "duplicate", name: "Aurora Dassisti" }]).length, 0);
});

test("legge nomi completi da Staff: nelle note senza attribuire altri nomi citati", () => {
  const data = sheet([row("1", "28/08: Staff: Aurora Dassisti e Melissa Jaku Grammi: 100. Note: piega con Melissa Valente"), row("2", "Fatta da Aurora. Staff: Aurora Dassisti Stato cambiato"), row("3", "Staff: Melissa Paradise")]);
  assert.deepEqual(resultBonusTableOccurrences([data], "2026-09", people).map((item) => item.userId), ["a", "m", "a"]);
});
