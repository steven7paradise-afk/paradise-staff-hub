import test from "node:test";
import assert from "node:assert/strict";
import { shiftResponseDays, shiftResponseProgress, shiftResponseState } from "../lib/shift-response-progress";
import { normalizeShiftResponsibleQuestions, type ShiftResponsibleQuestion } from "../lib/shift-responsible-questions";
const question: ShiftResponsibleQuestion = { id: "q", title: "Controllo", description: "", answerType: "YES_NO", followUpYes: "", followUpNo: "Motivo" };
test("assigned days remain visible before any response", () => {
  assert.deepEqual(shiftResponseDays({ "2026-10-06": "a" }, { "2026-10-05": { q: "YES" } }), ["2026-10-06", "2026-10-05"]);
});
test("required follow-up prevents premature completion", () => {
  assert.equal(shiftResponseProgress([question], { q: "NO" }).percent, 0);
  assert.equal(shiftResponseProgress([question], { q: "NO", "q::NO": "   " }).percent, 0);
  assert.equal(shiftResponseProgress([question], { q: "NO", "q::NO": "Manca materiale" }).percent, 100);
  assert.equal(shiftResponseProgress([question], { q: "YES" }).percent, 100);
});
test("future and unstarted shifts are distinct and empty modules are not complete", () => {
  const progress = shiftResponseProgress([], {});
  assert.equal(progress.percent, 0);
  assert.equal(shiftResponseState("2026-10-07", "2026-10-06", progress, {}), "Programmato");
  assert.equal(shiftResponseState("2026-10-05", "2026-10-06", progress, {}), "Da iniziare");
  assert.equal(shiftResponseState("2026-10-06", "2026-10-06", progress, { q: "NO" }), "In compilazione");
});

test("empty event sections do not reduce completion, mandatory checks still do", () => {
  const events = ["POSTO LAMPO", "CLIENTI / PROBLEMATICHE", "SERVIZI RIFIUTATI / NON ESEGUITI", "Problemi ancora aperti:"];
  const questions = normalizeShiftResponsibleQuestions([
    { ...question, followUpNo: "" },
    ...events.map((title, i) => ({ ...question, id: `event-${i}`, title, required: true })),
  ]);
  assert.equal(questions.filter(q => q.required).length, 1);
  assert.deepEqual(shiftResponseProgress(questions, { q: "YES" }), { completed: 1, total: 1, percent: 100 });
  assert.equal(shiftResponseProgress(questions, {}).percent, 0);
});
