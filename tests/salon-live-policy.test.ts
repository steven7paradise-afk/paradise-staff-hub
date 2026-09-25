import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { canAdvanceLiveItem, validLiveInput, type LiveItem } from "../lib/salon-live-policy";
const base = { id: randomUUID(), bookingId: "booking-1", date: "2026-09-24", kind: "coffee" };
test("accepts bounded requests and rejects malformed payloads", () => {
  assert.equal(validLiveInput(base), true);
  for (const patch of [{ id: "-".repeat(36) }, { kind: "payment" }, { bookingId: "" }, { text: "x".repeat(2001) }, { kind: "note", text: "  " }]) assert.equal(validLiveInput({ ...base, ...patch }), false);
  assert.equal(validLiveInput({ ...base, kind: "note", text: "Verificare acconto" }), true);
});
test("products require a safe barcode and bounded integer quantity", () => {
  const product = { ...base, kind: "product", barcode: "1234567890123", quantity: 2 };
  assert.equal(validLiveInput(product), true);
  for (const quantity of [-1, 0, 1.5, 100, "2", null]) assert.equal(validLiveInput({ ...product, quantity }), false);
  assert.equal(validLiveInput({ ...product, barcode: '" OR *' }), false);
});
test("only the claiming cashier can complete or cancel; closed states cannot reopen", () => {
  const item: LiveItem = { ...base, locationId: "salon-1", customerName: "Test", workerId: "worker", workerName: "Test", kind: "coffee", text: "", createdAt: new Date().toISOString(), state: "open" };
  assert.equal(canAdvanceLiveItem(item, "claimed", "cashier"), true);
  assert.equal(canAdvanceLiveItem(item, "done", "cashier"), false);
  const claimed: LiveItem = { ...item, state: "claimed", handledBy: "cashier" };
  assert.equal(canAdvanceLiveItem(claimed, "done", "other"), false);
  assert.equal(canAdvanceLiveItem(claimed, "cancelled", "cashier"), true);
  assert.equal(canAdvanceLiveItem(claimed, "done", "cashier"), true);
  assert.equal(canAdvanceLiveItem({ ...claimed, state: "done" }, "claimed", "cashier"), false);
});
