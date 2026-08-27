import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_ASSISTANT_SESSION_TTL_MS, isClearAssistantCommand, readAssistantSession, writeAssistantSession } from "../lib/admin-assistant-session";

test("keeps the assistant conversation for forty minutes", () => {
  const now = Date.UTC(2026, 7, 26, 18, 0);
  const stored = writeAssistantSession([{ role: "user", content: "Chi è in pausa?" }], now);
  assert.deepEqual(readAssistantSession(stored, now + ADMIN_ASSISTANT_SESSION_TTL_MS - 1), [{ role: "user", content: "Chi è in pausa?" }]);
});

test("expires the conversation after forty minutes", () => {
  const now = Date.UTC(2026, 7, 26, 18, 0);
  const stored = writeAssistantSession([{ role: "user", content: "Test" }], now);
  assert.equal(readAssistantSession(stored, now + ADMIN_ASSISTANT_SESSION_TTL_MS), null);
});

test("ignores invalid stored data", () => {
  assert.equal(readAssistantSession("not-json"), null);
});

test("recognizes commands that really clear the assistant chat", () => {
  for (const command of ["clear", "Pulisci chat", "pulisce la chat", "cancella conversazione", "riparti da zero"]) {
    assert.equal(isClearAssistantCommand(command), true);
  }
  assert.equal(isClearAssistantCommand("pulisci i ritardi di oggi"), false);
});
