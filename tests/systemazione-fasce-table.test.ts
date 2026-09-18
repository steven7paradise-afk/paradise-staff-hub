import assert from "node:assert/strict";
import test from "node:test";
import type { AssistanceSheet } from "../lib/assistance-tables";
import {
  applySystemazioneAppointmentsToSheet,
  findPreviousApplication,
  findSystemazioneControl,
  isSystemazioneFasceAppointment,
  previousApplicationStaff,
  type PreviousClientControl,
  type SystemazioneFasceAppointment,
} from "../lib/systemazione-fasce-table";

const appointment: SystemazioneFasceAppointment = {
  id: "booking-42",
  customerName: "Maria Rossi",
  customerEmail: "maria@example.com",
  customerPhone: "+39 333 123 4567",
  serviceTitle: "Sistemazione fasce",
  shopifyOrderId: "987654321",
  bookingStr: "#1234",
  startDate: "2026-09-18T14:00:00.000Z",
  teammates: [{ name: "Sara Campani" }],
  notesText: "Cliente avvisata",
  isCanceled: false,
};

function response(overrides: Partial<PreviousClientControl> = {}): PreviousClientControl {
  return {
    id: "response-1",
    createdAt: "2026-08-10T10:00:00.000Z",
    answers: {
      client_control_service_title: "Applicazione extension",
      client_control_shopify_order: "1234",
      client_control_client_name: "Maria Rossi",
      client_control_email: "maria@example.com",
      client_control_phone: "3331234567",
      client_control_service_staff: ["Angelica Pasculli"],
      client_control_correctness: "Controllato",
    },
    ...overrides,
  };
}

function sheet(): AssistanceSheet {
  return {
    id: "sheet-1",
    name: "sistemazione fasce",
    columns: [
      { id: "client", label: "nome cliente", type: "text" },
      { id: "phone", label: "telefono", type: "text" },
      { id: "photo", label: "foto", type: "file" },
      { id: "notes", label: "note", type: "text" },
      { id: "email", label: "email", type: "text" },
      { id: "previous", label: "app. precedente", type: "text" },
      { id: "current", label: "sistemazione", type: "text" },
    ],
    rows: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("riconosce Sistemazione fasce anche con maiuscole e accenti", () => {
  assert.equal(isSystemazioneFasceAppointment("SISTEMAZIONE FASCE - CORSO"), true);
  assert.equal(isSystemazioneFasceAppointment("Sistemazione fascie"), true);
  assert.equal(isSystemazioneFasceAppointment("Applicazione fasce"), false);
});

test("trova l'applicazione precedente e chi l'ha svolta", () => {
  const previous = findPreviousApplication(appointment, [
    response({ id: "future", createdAt: "2026-09-19T10:00:00.000Z" }),
    response(),
  ]);
  assert.equal(previous?.id, "response-1");
  assert.equal(previousApplicationStaff(previous), "Angelica Pasculli");
});

test("usa la scheda della stessa giornata per chi ha svolto la sistemazione", () => {
  const control = findSystemazioneControl(appointment, [
    response({
      id: "systemazione",
      createdAt: "2026-09-18T15:00:00.000Z",
      answers: {
        client_control_service_title: "Sistemazione fasce",
        client_control_shopify_order: "#1234",
        client_control_service_staff: ["Claudia Saltini"],
        client_control_correctness: "Controllato",
      },
    }),
  ]);
  assert.equal(previousApplicationStaff(control), "Claudia Saltini");
});

test("non usa la semplice assegnazione in agenda come lavoro svolto", () => {
  const result = applySystemazioneAppointmentsToSheet({
    sheet: sheet(),
    appointments: [appointment],
    responses: [response()],
  });
  assert.equal(result.sheet.rows[0].values.current, "Da verificare");
});

test("ignora un controllo cliente della sistemazione ancora in bozza", () => {
  const draftControl = response({
    id: "draft-systemazione",
    createdAt: "2026-09-18T15:00:00.000Z",
    answers: {
      client_control_service_title: "Sistemazione fasce",
      client_control_shopify_order: "#1234",
      client_control_service_staff: ["Claudia Saltini"],
      client_control_is_draft: true,
    },
  });
  const result = applySystemazioneAppointmentsToSheet({
    sheet: sheet(),
    appointments: [appointment],
    responses: [response(), draftControl],
  });
  assert.equal(result.sheet.rows[0].values.current, "Da verificare");
});

test("compila la riga, aggiunge Numero ordine e non crea doppioni", () => {
  const first = applySystemazioneAppointmentsToSheet({
    sheet: sheet(),
    appointments: [appointment],
    responses: [response()],
    now: "2026-09-18T11:00:00.000Z",
  }).sheet;
  const orderColumn = first.columns.find((column) => column.label === "Numero ordine");

  assert.ok(orderColumn);
  assert.equal(first.rows.length, 1);
  assert.equal(first.rows[0].values.client, "Maria Rossi");
  assert.equal(first.rows[0].values.previous, "Angelica Pasculli");
  assert.equal(first.rows[0].values.current, "Da verificare");
  assert.equal(first.rows[0].values[orderColumn.id], "#1234");

  const secondResult = applySystemazioneAppointmentsToSheet({
    sheet: first,
    appointments: [appointment],
    responses: [response()],
    now: "2026-09-18T11:05:00.000Z",
  });
  const second = secondResult.sheet;
  assert.equal(second.rows.length, 1);
  assert.equal(secondResult.changed, false);
});

test("ignora appuntamenti annullati", () => {
  const result = applySystemazioneAppointmentsToSheet({
    sheet: sheet(),
    appointments: [{ ...appointment, isCanceled: true }],
    responses: [response()],
  });
  assert.equal(result.sheet.rows.length, 0);
});
