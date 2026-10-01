import assert from "node:assert/strict";
import test from "node:test";
import { emptyWorkerService, workerServiceKey, reconcileWorkerServices, orderedServiceStaff, parseWorkerServices, restoreWorkerServices, combinedWorkerServiceNote, workerServiceNote } from "../lib/worker-service-sections";

const fallback = { services: [], grammi: "", lunghezza: "", fasce: "", atteggiamento: "" };
test("board owner remains first and duplicate collaborators are removed", () => {
  assert.deepEqual(orderedServiceStaff(["b", "a", "b"], "a"), ["a", "b"]);
});
test("multiple services and notes remain attached to their worker; drafts are not committed notes", () => {
  const a = { ...emptyWorkerService("a"), services: ["Taglio", "Colore"], details: ["Solo punte"], draftDetail: "Non confermato" };
  const b = { ...emptyWorkerService("b"), services: ["Piega"], details: ["Onde morbide"] };
  const parsed = parseWorkerServices([a, b], ["a", "b"]);
  assert.deepEqual(parsed, [a, b]);
  assert.match(workerServiceNote(a), /Taglio e Colore/);
  assert.doesNotMatch(workerServiceNote(a), /Onde|Non confermato/);
  const note = combinedWorkerServiceNote(parsed, [{ id: "a", name: "Nicol" }, { id: "b", name: "Francesca" }]);
  assert.match(note, /Nicol\.{14}\d{2}\/\d{2}\/\d{4}[\s\S]*Solo punte/);
  assert.match(note, /Francesca[\s\S]*Onde morbide/);
});
test("reopening and changing the team preserve notes by identity", () => {
  const a = { ...emptyWorkerService("a"), details: ["Nota A"], draftDetail: "In corso" };
  const b = { ...emptyWorkerService("b"), details: ["Nota B"] };
  const answers = { worker_service_sections: [a, b] };
  assert.deepEqual(restoreWorkerServices(answers, ["b", "a", "c"], "Ufficio", fallback), [b, a, emptyWorkerService("c")]);
});
test("legacy office note is not copied into editable service details", () => {
  const restored = restoreWorkerServices({ custom_extra_note: "Solo punte\nCAPELLI IN UFFICIO" }, ["a", "b"], "CAPELLI IN UFFICIO", fallback);
  assert.deepEqual(restored[0].details, ["Solo punte"]);
  assert.deepEqual(restored[1].details, []);
});
test("server rejects missing, foreign, duplicate workers and unsupported services", () => {
  const a = emptyWorkerService("a");
  assert.throws(() => parseWorkerServices([], ["a"]));
  assert.throws(() => parseWorkerServices([a], ["b"]));
  assert.throws(() => parseWorkerServices([a, a], ["a", "b"]));
  assert.throws(() => parseWorkerServices([{ ...a, services: ["invalido"] }], ["a"]));
  assert.throws(() => parseWorkerServices([{ ...a, draftDetail: "x".repeat(601) }], ["a"]));
});

test("solo work defaults to two separately editable sections for the same worker", () => {
  const sections = reconcileWorkerServices([], ["a"]);
  assert.equal(sections.length, 2);
  assert.deepEqual(sections.map(section => section.staffId), ["a", "a"]);
  assert.notEqual(workerServiceKey(sections[0]), workerServiceKey(sections[1]));
  sections[0] = { ...sections[0], services: ["Taglio"], details: ["Solo punte"] };
  sections[1] = { ...sections[1], services: ["Piega"], details: ["Onde morbide"] };
  const saved = parseWorkerServices(sections, ["a"]);
  assert.deepEqual(restoreWorkerServices({ worker_service_sections: saved }, ["a"], "", fallback), sections);
  assert.doesNotMatch(workerServiceNote(saved[0]), /Onde|Piega/);
  assert.doesNotMatch(workerServiceNote(saved[1]), /punte|Taglio/);
  assert.equal((combinedWorkerServiceNote(saved, [{ id: "a", name: "Nicol" }]).match(/Nicol\.{14}/g) || []).length, 1);
});
test("a collaborator replaces the unused solo section without reassigning existing notes", () => {
  const sections = reconcileWorkerServices([], ["a"]);
  assert.deepEqual(reconcileWorkerServices(sections, ["a", "b"]).map(section => section.staffId), ["a", "b"]);
  sections[1].details = ["Lavoro fatto da A"];
  const team = reconcileWorkerServices(sections, ["a", "b"]);
  assert.equal(team.length, 3);
  assert.equal(team[1].staffId, "a");
  assert.equal(team[1].details[0], "Lavoro fatto da A");
  assert.deepEqual(team[2].details, []);
  assert.throws(() => parseWorkerServices([sections[1], sections[1]], ["a"]));
});
