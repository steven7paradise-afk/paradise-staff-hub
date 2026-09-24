import test from "node:test";
import assert from "node:assert/strict";
import { isValidShiftNote, SHIFT_ANSWER_PAYLOAD_LIMIT } from "../lib/shift-note-limits";
import { normalizeShiftResponsibleAnswers } from "../lib/shift-responsible-questions";
import { normalizeShiftResponsibleAccess } from "../lib/shift-responsible-access";

test("notes accept 5000 characters and reject 5001 or blank text", () => {
  assert.equal(isValidShiftNote("a".repeat(5000)), true);
  assert.equal(isValidShiftNote("a".repeat(5001)), false);
  assert.equal(isValidShiftNote(" \n "), false);
});

test("thirty long staff notes survive serialization and reload without truncation", () => {
  const answer = JSON.stringify({ staffNotes: Array.from({ length: 30 }, (_, i) => ({
    staffId: `staff-${i}`, name: `Persona ${i}`, note: "\u0001".repeat(5000),
  })) });
  assert.ok(answer.length < SHIFT_ANSWER_PAYLOAD_LIMIT);
  assert.equal(normalizeShiftResponsibleAnswers({ "2026-09-23": { q: answer } })["2026-09-23"].q, answer);
});

test("day comments retain all 5000 characters after reload", () => {
  const text = "n".repeat(5000);
  const result = normalizeShiftResponsibleAccess({ "2026-09-23": { comments: [{
    id: "comment", authorId: "user", authorName: "Persona", text, at: "2026-09-23T10:00:00Z",
  }] } });
  assert.equal(result["2026-09-23"].comments[0].text, text);
});
