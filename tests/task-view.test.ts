import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTaskView, TASK_VIEW_OPTIONS } from "../lib/task-view";

test("normalizza la vista Task preferita", () => {
  assert.equal(normalizeTaskView("board"), "BOARD");
  assert.equal(normalizeTaskView(" CALENDAR "), "CALENDAR");
  assert.equal(normalizeTaskView("non-valida"), "HOME");
  assert.equal(normalizeTaskView(null), "HOME");
});

test("mantiene disponibili le cinque viste della pagina Task", () => {
  assert.deepEqual(
    TASK_VIEW_OPTIONS.map((option) => option.value),
    ["HOME", "TABLE", "BOARD", "CALENDAR", "LIST"],
  );
});
