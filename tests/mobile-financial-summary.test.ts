import { test } from "node:test";
import assert from "node:assert/strict";
import { financialSummary } from "../lib/mobile-financial-summary";
const date = (day: string) => new Date(`${day}T00:00:00Z`);
test("uses latest closing and does not subtract already reconciled vault expenses twice", () => {
  const result = financialSummary("2026-09-25", [
    { location_id: "a", date: date("2026-09-10"), withdrawn: 1000 },
    { location_id: "a", date: date("2026-09-10"), withdrawn: 900 },
    { location_id: "a", date: date("2026-08-10"), withdrawn: 500 },
  ], [
    { location_id: "a", date: date("2026-09-10"), amount: 100 },
    { location_id: "a", date: date("2026-09-24"), amount: 50 },
  ], [{ key: "cash_week_close:a:example", value: { weekKey: "2026-09-07:2026-09-13", bank_deposit: 300, withdrawals: 100 } }], "2026-08");
  assert.equal(result.available, 550);
  assert.equal(result.revenue, 1000);
  assert.equal(result.deposits, 300);
  assert.equal(result.withdrawals, 100);
  assert.equal(result.expenses, 150);
});
test("empty movements and negative availability are not invented or clamped", () => {
  const empty = financialSummary("2026-09-25", [], [], [], null);
  assert.equal(empty.available, 0);
  assert.equal(empty.deposits, 0);
  const negative = financialSummary("2026-09-25", [], [{ location_id: "a", date: date("2026-09-24"), amount: 50 }], [], null);
  assert.equal(negative.available, -50);
});
