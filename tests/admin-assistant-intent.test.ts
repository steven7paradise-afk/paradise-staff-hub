import assert from "node:assert/strict";
import test from "node:test";
import { requiredAssistantTool, requestedRequestType, requestedTaskStatus, requestedTeamStatus } from "../lib/admin-assistant-intent";

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

test("recognizes a completed-task question without relying on the model", () => {
  assert.equal(requestedTaskStatus("Steven ha completato task oggi?"), "COMPLETED");
});

test("forces a database search for task questions", () => {
  assert.equal(requiredAssistantTool("Steven ha completato task oggi?"), "get_task_overview");
});

test("forces Controllo Cliente search for a named client", () => {
  assert.equal(requiredAssistantTool("Nel controllo cliente chi ha lavorato su Maria Rossi?"), "search_client_controls");
});

test("forces Controllo Cliente search for a worker client count", () => {
  assert.equal(requiredAssistantTool("Quante cliente ha fatto Angelica oggi?"), "search_client_controls");
  assert.equal(requiredAssistantTool("Quante persone ha servito Angelica oggi?"), "search_client_controls");
});

test("recognizes multiple ways to ask for late arrivals", () => {
  for (const question of [
    "Sai dirmi i ritardi di oggi?",
    "Chi è arrivato in ritardo ieri?",
    "Domani ci sono persone in ritardo?",
    "Fammi vedere entrate ritardate oggi",
  ]) {
    assert.equal(requestedRequestType(question), "RITARDO");
    assert.equal(requiredAssistantTool(question), "get_requests_overview");
  }
});

test("recognizes request categories despite common spelling variants", () => {
  assert.equal(requestedRequestType("mallattie di oggi"), "MALATTIA");
  assert.equal(requestedRequestType("chi è in ferie domani"), "FERIE");
  assert.equal(requestedRequestType("permessi di ieri"), "PERMESSO");
  assert.equal(requestedRequestType("riposi di oggi"), "RIPOSO");
});
