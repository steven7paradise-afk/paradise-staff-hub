import assert from "node:assert/strict";
import test from "node:test";
import { isBeforeDailyClosingTime, romeDateKey } from "../lib/daily-cash-closing";

test("la chiusura giornaliera usa sempre il giorno di Roma", () => {
  assert.equal(romeDateKey(new Date("2026-09-01T22:30:00.000Z")), "2026-09-02");
});

test("prima delle 19 richiede conferma e dalle 19 non la richiede", () => {
  assert.equal(isBeforeDailyClosingTime(new Date("2026-09-02T16:59:00.000Z")), true);
  assert.equal(isBeforeDailyClosingTime(new Date("2026-09-02T17:00:00.000Z")), false);
});
