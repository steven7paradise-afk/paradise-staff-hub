import assert from "node:assert/strict";
import test from "node:test";
import {
  assistantApiKeyFromHeaders,
  assistantToolsForAccess,
  safeSecretMatches,
} from "../lib/admin-assistant-bridge";

test("reads the private assistant key from Bearer authorization", () => {
  const headers = new Headers({ authorization: "Bearer private-key" });
  assert.equal(assistantApiKeyFromHeaders(headers), "private-key");
});

test("falls back to x-api-key", () => {
  const headers = new Headers({ "x-api-key": "fallback-key" });
  assert.equal(assistantApiKeyFromHeaders(headers), "fallback-key");
});

test("compares private keys without accepting missing or different values", () => {
  assert.equal(safeSecretMatches("same-key", "same-key"), true);
  assert.equal(safeSecretMatches("wrong-key", "same-key"), false);
  assert.equal(safeSecretMatches("", "same-key"), false);
});

test("keeps confirmed communications but blocks assistant-memory writes", () => {
  const tools = [
    { name: "get_team_status" },
    { name: "remember_instruction" },
    { name: "prepare_communication" },
    { name: "get_orders_overview" },
  ];
  assert.deepEqual(
    assistantToolsForAccess(tools, true).map((tool) => tool.name),
    ["get_team_status", "prepare_communication", "get_orders_overview"],
  );
  assert.equal(assistantToolsForAccess(tools, false).length, tools.length);
});
