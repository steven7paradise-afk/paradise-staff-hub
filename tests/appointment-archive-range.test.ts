import assert from "node:assert/strict";
import test from "node:test";
import { archiveMonths, archiveSearchText } from "../lib/appointment-archive-range";

test("archive covers historic months and year boundaries exactly", () => {
  assert.deepEqual(archiveMonths("2026-09-01", "2026-09-30"), ["2026-09"]);
  assert.deepEqual(archiveMonths("2025-12-31", "2026-02-02"), ["2025-12", "2026-01", "2026-02"]);
  assert.throws(() => archiveMonths("2026-10-10", "2026-09-01"));
  assert.throws(() => archiveMonths("2024-01-01", "2026-10-01"));
});
test("search covers order numbers and customers from booking forms", () => {
  const text = archiveSearchText({ id: "a", order_id: "1234567", customer: { name: "Rosa Rezaeian", phone: "+393331234567" }, form_data: { email: "rosa@example.test" } }, "#28598");
  for (const term of ["rosa rezaeian", "393331234567", "rosa@example.test", "#28598"]) assert.ok(text.includes(term));
});
