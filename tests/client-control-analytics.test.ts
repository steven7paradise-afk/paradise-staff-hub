import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClientControlAnalytics, clientControlWorkerCounts, workerCalendarDays, analyticsMonthRange, type AnalyticsCard } from "../lib/client-control-analytics";
const staff = [{ id: "a", name: "Nicol" }, { id: "b", name: "Giuseppe" }, { id: "editor", name: "Admin che salva" }];
function card(id: string, answers: Record<string, unknown> = {}): AnalyticsCard {
  return { id, created_at: "2026-09-12T10:00:00Z", updated_at: "2026-09-12T10:00:00Z", answers: { booking_id: id, primary_staff_id: "a", client_control_correctness: "Controllato", client_control_is_draft: false, client_control_notes_text: "Nota reale", ...answers } };
}
const section = (id: string, slot?: string) => ({ staffId: id, slot, services: ["Piega"], details: [] });
const build = (cards: AnalyticsCard[]) => buildClientControlAnalytics({ month: "2026-09", cards, bookings: [], staff });
test("il principale che svolge entrambi i servizi conta una volta, senza nota secondaria", () => {
  const rows = build([card("one", { worker_service_sections: [section("a"), section("a", "additional")] })]);
  assert.deepEqual(clientControlWorkerCounts(rows).map(w => [w.id, w.primary, w.secondary]), [["a", 1, 0]]);
});
test("secondario diverso conteggiato separatamente e mai attribuito a chi conferma", () => {
  const rows = build([card("one", { client_control_last_editor_id: "editor", worker_service_sections: [section("a"), section("b")] })]);
  assert.deepEqual(clientControlWorkerCounts(rows).map(w => [w.id, w.primary, w.secondary]), [["a", 1, 0], ["b", 0, 1]]);
});
test("sezione secondaria vuota non conta e la bozza con nota non è completata", () => {
  const rows = build([card("one", { worker_service_sections: [section("a"), { staffId: "b", services: [], details: [], draftDetail: "Non ancora aggiunto" }] }), card("draft", { client_control_correctness: "Bozza", client_control_is_draft: true })]);
  assert.equal(rows.find(r => r.id === "draft")?.category, "pending");
  assert.equal(clientControlWorkerCounts(rows)[0].primary, 1);
  assert.equal(rows[0].secondaryNotes.length, 0);
});
test("Rosa incoerente, confermata senza testo e annullati restano distinti", () => {
  const rows = build([card("rosa", { client_control_correctness: "Bozza" }), card("missing", { client_control_notes_text: "" }), card("cancel", { client_control_correctness: "No Show" })]);
  assert.equal(rows.find(r => r.id === "rosa")?.category, "inconsistent");
  assert.equal(rows.find(r => r.id === "missing")?.category, "missing");
  assert.equal(rows.find(r => r.id === "cancel")?.category, "cancelled");
  assert.equal(clientControlWorkerCounts(rows).length, 0);
});
test("duplicato Aurora: preferisce confermata senza raddoppiare", () => {
  const rows = build([card("confirmed", { booking_id: "same" }), { ...card("draft", { booking_id: "same", client_control_correctness: "Bozza", client_control_is_draft: true }), updated_at: "2026-09-13T12:00:00Z" }]);
  assert.equal(rows.length, 1); assert.equal(rows[0].cardId, "confirmed"); assert.equal(rows[0].duplicates, 1);
});
test("schede storiche: principale esplicito, nessuna nota secondaria inventata", () => {
  const rows = build([card("one", { primary_staff_id: undefined, client_control_service_owner: "Nicol", client_control_service_staff: ["Nicol", "Giuseppe"] })]);
  assert.equal(rows[0].primary?.id, "a"); assert.equal(rows[0].secondaryNotes.length, 0);
  assert.equal(build([card("none", { primary_staff_id: undefined })])[0].primary, null);
});
test("calendario 4 arancione, 5 verde, 6 rosso; futuro neutro e secondo ruolo escluso", () => {
  const rows = build(Array.from({ length: 6 }, (_, i) => card(`c${i}`)));
  assert.equal(workerCalendarDays("2026-09", rows.slice(0,4), "a", "2026-10-03")[11].tone, "orange");
  assert.equal(workerCalendarDays("2026-09", rows.slice(0,5), "a", "2026-10-03")[11].tone, "green");
  assert.equal(workerCalendarDays("2026-09", rows, "a", "2026-10-03")[11].tone, "red");
  assert.equal(workerCalendarDays("2026-09", rows, "a", "2026-09-11")[11].tone, "future");
  assert.equal(workerCalendarDays("2026-09", rows, "b", "2026-10-03")[11].count, 0);
});
test("confini mensili Roma e appuntamento annullato senza scheda", () => {
  const range = analyticsMonthRange("2026-10");
  assert.equal(range.start.toISOString(), "2026-09-30T22:00:00.000Z"); assert.equal(range.end.toISOString(), "2026-10-31T23:00:00.000Z");
  const rows = buildClientControlAnalytics({ month: "2026-09", cards: [], staff, bookings: [{ id: "b", start_date: "2026-09-12T10:00:00Z", is_canceled: true }] });
  assert.equal(rows[0].category, "cancelled");
});
