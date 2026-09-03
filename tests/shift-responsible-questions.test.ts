import assert from "node:assert/strict";
import test from "node:test";
import { activeShiftFollowUps, normalizeShiftResponsibleQuestions, type ShiftResponsibleQuestion } from "../lib/shift-responsible-questions";
import { buildShiftTaskCommentContext } from "../lib/shift-task-comment";

function question(overrides: Partial<ShiftResponsibleQuestion>): ShiftResponsibleQuestion {
  return {
    id: "q1",
    title: "Controllo",
    description: "",
    answerType: "YES_NO",
    followUpYes: "",
    followUpNo: "",
    ...overrides,
  };
}

test("mantiene le varianti SÌ e NO già esistenti", () => {
  const item = question({ followUpNo: "Descrivi il problema" });
  assert.deepEqual(activeShiftFollowUps(item, "YES"), []);
  assert.deepEqual(activeShiftFollowUps(item, "NO"), [{ key: "NO", prompt: "Descrivi il problema" }]);
});

test("attiva la variante della singola opzione selezionata", () => {
  const item = question({
    answerType: "MULTIPLE_CHOICE",
    options: ["Completo", "Mancante"],
    followUps: { OPTION_1: "Indica cosa manca" },
  });
  assert.deepEqual(activeShiftFollowUps(item, "Mancante"), [{ key: "OPTION_1", prompt: "Indica cosa manca" }]);
});

test("attiva più varianti quando sono selezionate più caselle", () => {
  const item = question({
    answerType: "CHECKBOXES",
    options: ["Ritardo", "Assenza"],
    followUps: { OPTION_0: "Indica il ritardo", OPTION_1: "Indica chi è assente" },
  });
  assert.equal(activeShiftFollowUps(item, JSON.stringify(["Ritardo", "Assenza"])).length, 2);
});

test("usa una variante generale per testo, file e note staff", () => {
  const item = question({ answerType: "STAFF_NOTE", followUps: { ANY: "Aggiungi un intervento" } });
  assert.deepEqual(activeShiftFollowUps(item, "{\"staffNotes\":[]}"), [{ key: "ANY", prompt: "Aggiungi un intervento" }]);
});

test("mantiene il tipo collegato alla cliente degli appuntamenti", () => {
  const [item] = normalizeShiftResponsibleQuestions([{ id: "q-client", title: "Nota cliente", answerType: "CLIENT_NOTE" }]);
  assert.equal(item.answerType, "CLIENT_NOTE");
  assert.deepEqual(activeShiftFollowUps({ ...item, followUps: { ANY: "Aggiungi un dettaglio" } }, JSON.stringify({ appointmentId: "a1", note: "Nota" })), [{ key: "ANY", prompt: "Aggiungi un dettaglio" }]);
});

test("mantiene fino a dieci voci per le risposte scritte multiple", () => {
  const options = Array.from({ length: 12 }, (_, index) => `Voce ${index + 1}`);
  const [item] = normalizeShiftResponsibleQuestions([{ id: "q-multi", title: "Dettagli", answerType: "MULTI_TEXT", options }]);
  assert.equal(item.answerType, "MULTI_TEXT");
  assert.equal(item.options?.length, 10);
  assert.deepEqual(item.options, options.slice(0, 10));
});

test("mantiene il tipo che genera una task", () => {
  const [item] = normalizeShiftResponsibleQuestions([{ id: "q-task", title: "Attività", answerType: "TASK" }]);
  assert.equal(item.answerType, "TASK");
});

test("mantiene il tipo timeline con ora e nota libera", () => {
  const [item] = normalizeShiftResponsibleQuestions([{ id: "q-timeline", title: "Cronologia", answerType: "TIMELINE" }]);
  assert.equal(item.answerType, "TIMELINE");
});

test("salva etichette personalizzate mantenendo Sì e No come valori interni", () => {
  const [item] = normalizeShiftResponsibleQuestions([{ id: "q1", title: "Stato", answerType: "YES_NO", yesLabel: "Completato", noLabel: "Da completare" }]);
  assert.equal(item.yesLabel, "Completato");
  assert.equal(item.noLabel, "Da completare");
  assert.deepEqual(activeShiftFollowUps({ ...item, followUpYes: "Dettagli" }, "YES"), [{ key: "YES", prompt: "Dettagli" }]);
});

test("prepara per la task un commento leggibile senza JSON o identificativi", () => {
  const questions = [
    question({ id: "presence", title: "Tutti presenti", yesLabel: "Sì, tutti presenti" }),
    question({ id: "breaks", title: "Pause", answerType: "STAFF_NOTE" }),
    question({ id: "clients", title: "Clienti", answerType: "CLIENT_NOTE" }),
    question({ id: "details", title: "Servizi rifiutati", answerType: "MULTI_TEXT" }),
    question({ id: "timeline", title: "Eventi della giornata", answerType: "TIMELINE" }),
    question({ id: "task", title: "Problemi aperti", answerType: "TASK" }),
  ];
  const context = buildShiftTaskCommentContext("2026-09-03", "Controllare il sistema", questions, {
    presence: "YES",
    breaks: JSON.stringify({ staffNotes: [{ staffId: "internal-1", name: "Angelica Pasculli", note: "Pausa alle 12:00" }] }),
    clients: JSON.stringify({ clientNotes: [{ appointmentId: "internal-2", name: "Alessandra Vergallo", time: "10:00", service: "Trattamento", note: "Richiamare" }] }),
    details: JSON.stringify({ textEntries: [{ label: "Motivo:", value: "Cliente assente" }] }),
    timeline: JSON.stringify({ timelineEntries: [{ time: "14:30", note: "Cliente richiamata" }, { time: "09:15", note: "Apertura completata" }] }),
    task: JSON.stringify({ taskTitle: "Controllare il sistema", assignees: [{ id: "internal-3", name: "Steven Alvarez" }] }),
  });

  assert.match(context.readableText, /Tutti presenti: Sì, tutti presenti/);
  assert.match(context.readableText, /Angelica Pasculli: Pausa alle 12:00/);
  assert.match(context.readableText, /Alessandra Vergallo \(10:00 · Trattamento\): Richiamare/);
  assert.match(context.readableText, /Motivo: Cliente assente/);
  assert.match(context.readableText, /14:30 — Cliente richiamata/);
  assert.doesNotMatch(context.readableText, /internal-/);
  assert.doesNotMatch(context.readableText, /Problemi aperti/);
  assert.doesNotMatch(context.readableText, /staffNotes|clientNotes|textEntries/);
});
