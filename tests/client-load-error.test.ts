import assert from "node:assert/strict";
import test from "node:test";
import { isRecoverableClientLoadError } from "../lib/client-load-error";

test("riconosce un chunk mancante durante il deploy", () => {
  assert.equal(isRecoverableClientLoadError("Loading chunk 9449 failed. (error: https://example.test/page.js)"), true);
  assert.equal(isRecoverableClientLoadError("ChunkLoadError: Loading chunk 10 failed"), true);
});

test("non ricarica automaticamente per un errore applicativo ordinario", () => {
  assert.equal(isRecoverableClientLoadError("Impossibile salvare il commento"), false);
});
