import assert from "node:assert/strict";
import test from "node:test";
import { canRequestClient, isWaitingClient } from "../lib/client-assignment-policy";
import { canAdvanceLiveItem, validLiveInput, type LiveItem } from "../lib/salon-live-policy";

test("only free clocked-in workers can request a waiting client", () => {
  assert.equal(canRequestClient("ENTRATA", false), true);
  assert.equal(canRequestClient("RIENTRO", false), true);
  for (const state of [null, "USCITA", "PAUSA", "UNKNOWN"]) assert.equal(canRequestClient(state, false), false);
  assert.equal(canRequestClient("ENTRATA", true), false);
  assert.equal(isWaitingClient("IN_ATTESA"), true);
  assert.equal(isWaitingClient("ARRIVATO_IN_RITARDO"), true);
  for (const state of ["INIZIATO", "COMPLETATO", "PRENOTATO", "ANNULLATO"]) assert.equal(isWaitingClient(state), false);
});
test("assignment requests cannot use generic desk creation or completion", () => {
  const item = { id: "b54ec441-e339-4b00-88c0-cf46cd786c20", kind: "assignment", state: "open", workerId: "staff", bookingId: "booking", handledBy: "desk" } as LiveItem;
  assert.equal(validLiveInput({ ...item, date: "2026-09-25" }), false);
  for (const state of ["claimed", "done", "cancelled"]) {
    assert.equal(canAdvanceLiveItem(item, state, "desk"), false);
    assert.equal(canAdvanceLiveItem({ ...item, state: "claimed" }, state, "desk"), false);
  }
});
