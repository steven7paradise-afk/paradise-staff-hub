import assert from "node:assert/strict";
import test from "node:test";
import { cashClosingLocationOverride } from "../lib/cash-records";

test("routes Franci office cash closings to Salone Buenos Aires", () => {
  assert.equal(cashClosingLocationOverride("Franci", "Ufficio Paradise"), "Salone Buenos Aires");
});

test("keeps every other signer and location unchanged", () => {
  assert.equal(cashClosingLocationOverride("Aurora", "Ufficio Paradise"), null);
  assert.equal(cashClosingLocationOverride("Franci", "Salone Buenos Aires"), null);
});
