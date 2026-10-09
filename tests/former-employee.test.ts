import assert from "node:assert/strict";
import test from "node:test";
import { FORMER_EMPLOYEE_STATUS, resolveEmployeeActive, hasFormerEmployeeDocumentAccess } from "../lib/former-employee";

test("un blocco esplicito ha priorità anche per un ex dipendente", () => {
  assert.equal(resolveEmployeeActive(false, FORMER_EMPLOYEE_STATUS, true), false);
});

test("un ex dipendente viene disattivato anche se lo stato account non viene inviato", () => {
  assert.equal(resolveEmployeeActive(undefined, FORMER_EMPLOYEE_STATUS, false), false);
});

test("un profilo ordinario conserva lo stato se la richiesta non lo modifica", () => {
  assert.equal(resolveEmployeeActive(undefined, "Attivo", false), false);
  assert.equal(resolveEmployeeActive(true, "Attivo", false), true);
});

 test("lo stato ex dipendente prevale su una richiesta di riattivazione", () => {
  assert.equal(resolveEmployeeActive(true, FORMER_EMPLOYEE_STATUS, true), false);
});

test("le vecchie scadenze documentali non ripristinano l'accesso", () => {
  assert.equal(hasFormerEmployeeDocumentAccess({ exDocumentAccessUntil: "2099-01-01T00:00:00Z" }), false);
  assert.equal(hasFormerEmployeeDocumentAccess({}), false);
});
