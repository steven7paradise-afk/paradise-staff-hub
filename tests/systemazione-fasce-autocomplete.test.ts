import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAssistanceSheets, type AssistanceSheet } from "../lib/assistance-tables";
import { cachedSystemazioneAppointments, completePendingSystemazioneRows, loadAutocompletedAssistanceSheets } from "../lib/systemazione-fasce-autocomplete";
import type { PreviousClientControl, SystemazioneFasceAppointment } from "../lib/systemazione-fasce-table";

const appointment: SystemazioneFasceAppointment = { id: "booking", customerName: "Cliente Test", customerEmail: "client@example.com", customerPhone: null, serviceTitle: "Sistemazione fasce", shopifyOrderId: "321", bookingStr: "#321", startDate: "2026-09-29T10:00:00Z", teammates: [], notesText: null, isCanceled: false };
const sheet: AssistanceSheet = { id: "sheet", name: "sistemazione fasce", createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z", columns: [
  { id: "name", label: "nome cliente", type: "text" }, { id: "email", label: "email", type: "text" },
  { id: "previous", label: "app. precedente", type: "text" }, { id: "current", label: "sistemazione", type: "text" },
], rows: [{ id: "sistemazione-fasce:booking", nome: "", cognome: "", testo: "", image: null, file: null, values: { name: "Cliente Test", email: "client@example.com", previous: "Da verificare", current: "Da verificare" }, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z", reviewedAt: "2026-09-01T12:00:00Z", reviewedBy: "Admin" }] };
const previous: PreviousClientControl = { id: "previous", createdAt: "2026-09-09T10:00:00Z", answers: { client_control_email: "client@example.com", client_control_service_title: "ACCONTO 50€", custom_services: [], custom_grammi: "100g", custom_fasce: "2", client_control_service_staff: ["Aurora Dassisti"] } };
const current: PreviousClientControl = { id: "current", createdAt: "2026-09-29T12:00:00Z", answers: { booking_id: "booking", custom_services: ["Sistemazione fasce"], client_control_service_staff: ["Michela Alfonso"] } };

test("completa entrambi i nomi, conserva date/note e richiede un nuovo controllo", () => {
  const result = completePendingSystemazioneRows([sheet], [appointment], [previous, current]);
  assert.equal(result.filledCells, 2);
  assert.equal(result.updatedRows, 1);
  const row = result.sheets[0].rows[0];
  assert.equal(row.values.previous, "Aurora Dassisti");
  assert.equal(row.values.current, "Michela Alfonso");
  assert.equal(row.createdAt, sheet.rows[0].createdAt);
  assert.equal(row.reviewedAt, null);
  assert.equal(sheet.rows[0].values.previous, "Da verificare");
  assert.equal(completePendingSystemazioneRows(result.sheets, [appointment], [previous, current]).filledCells, 0);
});

test("non sostituisce uno staff già presente né attribuisce l'assegnazione in agenda", () => {
  const existing = { ...sheet, rows: [{ ...sheet.rows[0], values: { ...sheet.rows[0].values, previous: "Nome verificato" } }] };
  const result = completePendingSystemazioneRows([existing], [{ ...appointment, teammates: [{ name: "Non esecutore" }] }], [previous]);
  assert.equal(result.updatedRows, 0);
  assert.equal(result.sheets[0].rows[0].values.previous, "Nome verificato");
  assert.equal(result.sheets[0].rows[0].values.current, "Da verificare");
});

test("non completa bozze, appuntamenti annullati, assenti o righe manuali ambigue", () => {
  assert.equal(completePendingSystemazioneRows([sheet], [], [previous, current]).filledCells, 0);
  assert.equal(completePendingSystemazioneRows([sheet], [{ ...appointment, isCanceled: true }], [previous, current]).filledCells, 0);
  const draft = { ...current, answers: { ...current.answers, client_control_is_draft: true } };
  assert.equal(completePendingSystemazioneRows([sheet], [appointment], [draft]).filledCells, 0);
  const manual = { ...sheet, rows: [{ ...sheet.rows[0], id: "manual" }] };
  assert.equal(completePendingSystemazioneRows([manual], [appointment, { ...appointment, id: "another" }], [previous, current]).filledCells, 0);
  assert.equal(completePendingSystemazioneRows([manual], [appointment], [previous, current]).filledCells, 2);
});

test("la cache più recente prevale anche quando l'appuntamento viene annullato", () => {
  const booking = { id: "booking", start_date: appointment.startDate, service: { title: "Sistemazione fasce" }, customer: { name: "Cliente Test" } };
  const cached = cachedSystemazioneAppointments([{ timestamp: 20, data: [{ ...booking, is_canceled: true }] }, { timestamp: 10, data: [booking] }]);
  assert.equal(cached.length, 1);
  assert.equal(cached[0].isCanceled, true);
});

test("check finale resta salvato durante normalizzazione e rilettura", () => {
  const restored = normalizeAssistanceSheets(JSON.parse(JSON.stringify([sheet])));
  assert.equal(restored[0].rows[0].reviewedAt, sheet.rows[0].reviewedAt);
  assert.equal(restored[0].rows[0].reviewedBy, "Admin");
});

test("il caricamento automatico salva una volta e non sovrascrive modifiche concorrenti", async () => {
  let value: unknown = [sheet]; let writes = 0; let conflict = false;
  const db = {
    setting: {
      findUnique: async () => ({ value }),
      findMany: async () => [{ value: { timestamp: 1, data: [{ id: "booking", start_date: appointment.startDate, service: { title: "Sistemazione fasce" } }] } }],
      updateMany: async ({ data }: { data: { value: unknown } }) => { if (conflict) return { count: 0 }; writes++; value = data.value; return { count: 1 }; },
    },
    serviceForm: { findMany: async () => [{ id: "form", name: "Controllo Cliente", category: "Qualita" }] },
    serviceFormResponse: { findMany: async () => [previous, current].map((r) => ({ id: r.id, created_at: r.createdAt, answers: r.answers })) },
  } as unknown as Parameters<typeof loadAutocompletedAssistanceSheets>[0];
  const first = await loadAutocompletedAssistanceSheets(db);
  assert.equal(first[0].rows[0].values.current, "Michela Alfonso");
  await loadAutocompletedAssistanceSheets(db);
  assert.equal(writes, 1);
  value = [sheet]; conflict = true;
  const concurrent = await loadAutocompletedAssistanceSheets(db);
  assert.equal(concurrent[0].rows[0].values.current, "Da verificare");
  assert.equal(writes, 1);
});
