import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeAppointmentStatus,
  parseSavedAppointmentStatus,
  resolveAgendaAppointmentStatus,
  visibleAppointmentStatusChange,
} from "../lib/appointment-status";

const savedArrival = {
  status: "IN_ATTESA",
  updatedAt: "2026-11-14T09:00:00.000Z",
  updatedBy: "Operatrice",
};
const sheetConfirmation = {
  status: "PRENOTATO",
  updatedAt: "2026-11-14T09:05:00.000Z",
  updatedBy: "Foglio prenotazioni",
};

test("the active salon's saved arrival takes precedence over the imported confirmation", () => {
  assert.deepEqual(resolveAgendaAppointmentStatus(savedArrival, sheetConfirmation, true), savedArrival);
  assert.deepEqual(resolveAgendaAppointmentStatus(undefined, sheetConfirmation, true), sheetConfirmation);
});

test("legacy calendar views prefer sheet status and fall back to a saved status", () => {
  assert.deepEqual(resolveAgendaAppointmentStatus(savedArrival, sheetConfirmation, false), sheetConfirmation);
  assert.deepEqual(resolveAgendaAppointmentStatus(savedArrival, { updatedBy: "Solo nota" }, false), savedArrival);
  assert.equal(resolveAgendaAppointmentStatus(undefined, { status: "non supportato" }, true), null);
});

test("saved and imported arrival spellings share the existing Arrivata state", () => {
  for (const status of ["Arrivata", "Arrivato", " ARRIVED ", "Arrivata in ritardo", "In Attesa"]) {
    assert.equal(normalizeAppointmentStatus(status), "IN_ATTESA", status);
  }
  assert.equal(normalizeAppointmentStatus("Paid"), "PRENOTATO");
});

test("a late calendar response cannot reset a pending or just-saved arrival", () => {
  const saved = parseSavedAppointmentStatus(savedArrival);
  assert.ok(saved);
  const pending = { ...saved, updatedAt: null };
  assert.equal(visibleAppointmentStatusChange(pending, sheetConfirmation.updatedAt), pending);
  assert.equal(visibleAppointmentStatusChange(saved, "2026-11-14T08:55:00.000Z"), saved);
  assert.equal(visibleAppointmentStatusChange(saved, null), saved);
  assert.equal(visibleAppointmentStatusChange(saved, saved.updatedAt), undefined);
  assert.equal(visibleAppointmentStatusChange(saved, "2026-11-14T09:10:00.000Z"), undefined);
});

test("a status save must return valid server confirmation", () => {
  assert.equal(parseSavedAppointmentStatus(null), null);
  assert.equal(parseSavedAppointmentStatus({ status: "IN_ATTESA" }), null);
  assert.equal(parseSavedAppointmentStatus({ ...savedArrival, updatedAt: "invalid" }), null);
  assert.equal(parseSavedAppointmentStatus(savedArrival)?.status, "IN_ATTESA");
});
