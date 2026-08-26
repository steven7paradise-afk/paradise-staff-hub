import assert from "node:assert/strict";
import test from "node:test";
import { requestedTeamStatus } from "../lib/admin-assistant-intent";

test("recognizes a direct question about people currently on break", () => {
  assert.equal(requestedTeamStatus([{ role: "user", content: "Chi è in pausa?" }]), "IN_PAUSA");
});

test("keeps the previous break scope for a short follow-up", () => {
  assert.equal(requestedTeamStatus([
    { role: "user", content: "Quante persone sono in pausa?" },
    { role: "assistant", content: "In questo momento risultano due persone in pausa." },
    { role: "user", content: "Chi sono?" },
  ]), "IN_PAUSA");
});

test("does not turn a generic staff question into a status filter", () => {
  assert.equal(requestedTeamStatus([{ role: "user", content: "Chi sono tutti i lavoratori?" }]), null);
});

test("recognizes current absences without mixing them with breaks", () => {
  assert.equal(requestedTeamStatus([{ role: "user", content: "Chi non è entrato oggi?" }]), "NON_ENTRATO");
});
