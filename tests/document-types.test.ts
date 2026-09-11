import assert from "node:assert/strict";
import test from "node:test";
import { employeeDocumentGroup, isDocumentType } from "../lib/document-types";

test("riconosce Lettera di contestazione come tipo documento valido", () => {
  assert.equal(isDocumentType("LETTERA_CONTESTAZIONE"), true);
});

test("la tipologia esplicita prevale sulle parole presenti nel titolo", () => {
  assert.equal(
    employeeDocumentGroup("LETTERA_CONTESTAZIONE", "Contestazione relativa al contratto"),
    "LETTERE_CONTESTAZIONE",
  );
});

test("classifica anche le lettere storiche dal titolo", () => {
  assert.equal(
    employeeDocumentGroup("DOCUMENTO", "Richiamo disciplinare per ritardo"),
    "LETTERE_CONTESTAZIONE",
  );
});
