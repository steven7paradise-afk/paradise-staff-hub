import assert from "node:assert/strict";
import test from "node:test";
import { FORMER_EMPLOYEE_STATUS, resolveEmployeeActive } from "../lib/former-employee";

test("un blocco esplicito ha priorità anche per un ex dipendente", () => {
  assert.equal(resolveEmployeeActive(false, FORMER_EMPLOYEE_STATUS, true), false);
});

test("un ex dipendente resta attivo per i documenti se lo stato account non viene inviato", () => {
  assert.equal(resolveEmployeeActive(undefined, FORMER_EMPLOYEE_STATUS, false), true);
});

test("un profilo ordinario conserva lo stato se la richiesta non lo modifica", () => {
  assert.equal(resolveEmployeeActive(undefined, "Attivo", false), false);
  assert.equal(resolveEmployeeActive(true, "Attivo", false), true);
});
