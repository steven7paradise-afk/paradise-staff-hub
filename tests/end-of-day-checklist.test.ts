import assert from "node:assert/strict";
import test from "node:test";
import { END_OF_DAY_CHANNELS, END_OF_DAY_CONFIRMATIONS, END_OF_DAY_COUNT_FIELDS, endOfDayAnomalyCount, normalizeEndOfDayPayload } from "../lib/end-of-day-checklist";

function validPayload() {
  return {
    date: "2026-09-08",
    counts: Object.fromEntries(END_OF_DAY_COUNT_FIELDS.map((field) => [field.key, 0])),
    channels: Object.fromEntries(END_OF_DAY_CHANNELS.map((channel) => [channel.key, true])),
    confirmations: Object.fromEntries(END_OF_DAY_CONFIRMATIONS.map((confirmation) => [confirmation.key, "YES"])),
    confirmationNotes: {}, notes: "", operatorOneName: "Anna Rossi", operatorTwoName: "Maria Bianchi", managerName: "Admin Paradise",
  };
}

test("accetta una checklist completa senza anomalie", () => {
  const result = normalizeEndOfDayPayload(validPayload());
  assert.equal(result.error, undefined);
  assert.equal(endOfDayAnomalyCount(result.data!), 0);
});

test("richiede il dettaglio quando una conferma è NO", () => {
  const payload = validPayload();
  payload.confirmations.applicationBandsAndGrams = "NO";
  const result = normalizeEndOfDayPayload(payload);
  assert.match(result.error ?? "", /Spiega cosa non è stato completato/);
});

test("richiede la nota finale quando un canale non è controllato", () => {
  const payload = validPayload();
  payload.channels.instagram = false;
  const result = normalizeEndOfDayPayload(payload);
  assert.match(result.error ?? "", /nota finale/);
});
