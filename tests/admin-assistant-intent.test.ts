import assert from "node:assert/strict";
import test from "node:test";
import { requestedClientQuestionMode, requestedClientResponseType, requiredAssistantTool, requestedRequestType, requestedTaskStatus, requestedTeamStatus, taskChecklistProgress, verifiedClientAppointmentStatus } from "../lib/admin-assistant-intent";

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
  assert.equal(requiredAssistantTool("Come stanno andando le task di Steven?"), "get_task_overview");
});

test("forces Controllo Cliente search for a named client", () => {
  assert.equal(requiredAssistantTool("Nel controllo cliente chi ha lavorato su Maria Rossi?"), "search_client_controls");
});

test("forces Controllo Cliente search for a worker client count", () => {
  assert.equal(requiredAssistantTool("Quante clienti ci sono oggi?"), "search_client_controls");
  assert.equal(requiredAssistantTool("Chi viene in salone domani?"), "search_client_controls");
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

test("routes staff profile questions to verified Staff data", () => {
  assert.equal(requiredAssistantTool("Di che reparto fa parte Arianna?"), "get_employee_profile");
  assert.equal(requiredAssistantTool("Arianna fa parte?"), "get_employee_profile");
  assert.equal(requiredAssistantTool("Dove lavora Arianna e che mansione ha?"), "get_employee_profile");
});

test("routes order assignment and completion questions to Orders", () => {
  assert.equal(requiredAssistantTool("Chi ha completato l'ordine 25989?"), "get_orders_overview");
  assert.equal(requiredAssistantTool("Quali ordini ha compilato Steven oggi?"), "get_orders_overview");
});

test("distinguishes scheduled, worked and completed client questions", () => {
  assert.equal(requestedClientQuestionMode("Quante clienti ci sono oggi?"), "SCHEDULED");
  assert.equal(requestedClientQuestionMode("Quante clienti ha fatto Angelica oggi?"), "WORKED");
  assert.equal(requestedClientQuestionMode("Quali appuntamenti sono stati completati oggi?"), "COMPLETED");
  assert.equal(requestedClientQuestionMode("Cosa è stato fatto alla cliente Maria?"), "DETAILS");
});

test("routes Cliente 360 questions even when the word cliente is omitted", () => {
  for (const question of [
    "Quanti grammi ha messo Martina Rossi?",
    "Quante fasce aveva nell'ultima applicazione?",
    "Quando ha fatto l'ultima riapplicazione?",
    "Fammi il recap dell'ultima visita",
    "Ci sono foto dell'ultima applicazione?",
    "Ha avuto segnalazioni dopo l'applicazione?",
  ]) {
    assert.equal(requiredAssistantTool(question), "search_client_controls");
  }
});

test("selects one Cliente 360 response shape from the question", () => {
  assert.equal(requestedClientResponseType("Quanti grammi ha messo Martina?"), "BRIEF");
  assert.equal(requestedClientResponseType("Fammi il recap dell'ultima visita"), "VISIT_RECAP");
  assert.equal(requestedClientResponseType("Fammi vedere tutta la timeline della cliente"), "TIMELINE");
  assert.equal(requestedClientResponseType("Confronta le ultime due applicazioni"), "COMPARE");
  assert.equal(requestedClientResponseType("Quanto ha pagato l'ultima volta?"), "PAYMENTS");
  assert.equal(requestedClientResponseType("Cosa dobbiamo sapere prima che arrivi?"), "ALERT");
});

test("does not treat the generic Cowlendar arrived flag as a verified arrival", () => {
  assert.equal(verifiedClientAppointmentStatus(null, "arrived", "confirmed"), "confirmed");
  assert.equal(verifiedClientAppointmentStatus(null, "no_show", "confirmed"), "NON_PRESENTATO");
  assert.equal(verifiedClientAppointmentStatus("IN_ATTESA", "arrived", "confirmed"), "IN_ATTESA");
});

test("calculates task progress from the real checklist", () => {
  assert.deepEqual(taskChecklistProgress([
    { text: "Prima attività", done: true, completedBy: "Steven", completedAt: "2026-08-27T09:00:00Z" },
    { text: "Seconda attività", done: false },
  ]), {
    total: 2,
    completed: 1,
    pending: 1,
    percentage: 50,
    items: [
      { text: "Prima attività", done: true, completedBy: "Steven", completedAt: "2026-08-27T09:00:00Z" },
      { text: "Seconda attività", done: false, completedBy: null, completedAt: null },
    ],
  });
});
