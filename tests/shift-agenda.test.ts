import test from "node:test";
import assert from "node:assert/strict";
import { remainingAgendaAppointments, buildAgendaReport, emptyAgendaNotes, romeAgendaDate } from "../lib/shift-agenda";
const day = "2026-10-07";
const booking = (id: string, extra = {}) => ({ id, start_date: `${day}T10:00:00+02:00`, service: { title: "BUENOS AIRES - SERVIZIO" }, ...extra });
test("deduplica appuntamenti, usa il giorno di Roma ed esclude altre sedi", () => {
 const a = booking("1");
 const result = buildAgendaReport(day, [a, a, booking("2", { service: { title: "Roma" } }), booking("3", { start_date: "2026-10-06T22:30:00Z" }), booking("4", { start_date: "2026-10-07T22:30:00Z" })], [], {}, {}, emptyAgendaNotes());
 assert.equal(result.totals.planned, 2);
 assert.equal(romeAgendaDate("2026-10-06T22:30:00Z"), day);
});
test("usa le note della versione più recente senza riutilizzare quelle vecchie", () => {
 const result = buildAgendaReport(day, [booking("1"), booking("2")], [
 { updated_at: "2026-10-07T12:00:00Z", answers: { booking_id: "1", client_control_correctness: "controllato", client_control_is_draft: true } },
 { updated_at: "2026-10-07T11:00:00Z", answers: { booking_id: "1", client_control_correctness: "controllato", client_control_notes_text: "Servizio annotato" } },
 { updated_at: "2026-10-07T11:00:00Z", answers: { booking_id: "2", client_control_correctness: "controllato", client_control_is_draft: false, client_control_notes_text: "Servizio annotato" } },
 ], {}, {}, emptyAgendaNotes());
 assert.equal(result.totals.completed, 1);
 assert.equal(result.appointments.find(a => a.id === "1")?.confirmed, false);
});
test("distingue esiti automatici e annotazioni senza dedurre no-show dalle schede mancanti", () => {
 const result = buildAgendaReport(day, [booking("1"), booking("2"), booking("3")], [], { "1": { status: "NON_PRESENTATO" } }, {}, { outcomes: { "2": "No-show" }, waits: [] });
 assert.equal(result.totals.noShow, 2);
 assert.equal(result.appointments.find(a => a.id === "1")?.automaticOutcome, true);
 assert.equal(result.appointments.find(a => a.id === "2")?.automaticOutcome, false);
 assert.equal(result.appointments.find(a => a.id === "3")?.outcome, "");
});
test("conta posti lampo solo con data creazione di oggi e conferma prevale su vecchie annotazioni", () => {
 const flash = { service: { title: "POSTO LAMPO BUENOS AIRES" } };
 const result = buildAgendaReport(day, [booking("1", { ...flash, created_at: `${day}T09:00:00Z` }), booking("2", { ...flash, created_at: "2026-10-06T09:00:00Z" }), booking("3", flash)], [{ updated_at: `${day}T11:00:00Z`, answers: { booking_id: "1", client_control_correctness: "controllato", client_control_notes_text: "Servizio annotato" } }], {}, {}, { outcomes: { "1": "No-show" }, waits: [] });
 assert.equal(result.totals.flash, 1);
 assert.equal(result.totals.completed, 1);
 assert.equal(result.totals.noShow, 0);
});

test('separa schede mancanti da appuntamenti futuri, in corso e chiusi', async () => {
 const {agendaGroup}=await import('../lib/shift-agenda');
 const a=buildAgendaReport(day,[booking('1',{end_date:`${day}T11:30:00+02:00`})],[],{},{},emptyAgendaNotes()).appointments[0];
 assert.equal(agendaGroup(a,`${day}T09:00:00+02:00`),'upcoming');
 assert.equal(agendaGroup(a,`${day}T11:00:00+02:00`),'progress');
 assert.equal(agendaGroup(a,`${day}T12:00:00+02:00`),'review');
 for(const outcome of ['No-show','Annullato','Spostato']) assert.equal(agendaGroup({...a,outcome},`${day}T12:00:00+02:00`),'resolved');
 assert.equal(agendaGroup({...a,confirmed:true},`${day}T12:00:00+02:00`),'completed');
});

test("remaining counter excludes resolved appointments and reaches zero once notes are saved", () => {
 const bookings = [booking("pending"), booking("future", { start_date: `${day}T19:00:00+02:00` }), booking("done"), booking("absent"), booking("cancelled"), booking("moved")];
 const controls = [{ updated_at: `${day}T12:00:00Z`, answers: { booking_id: "done", client_control_notes_text: "Lavoro eseguito" } }];
 const statuses = { absent: { status: "NON_PRESENTATO" }, cancelled: { status: "ANNULLATO" }, moved: { status: "RIPROGRAMMATO" } };
 const report = buildAgendaReport(day, bookings, controls, statuses, {}, emptyAgendaNotes());
 assert.equal(report.totals.planned, 6);
 assert.equal(remainingAgendaAppointments(report.appointments), 2);
 const completed = buildAgendaReport(day, bookings, [...controls, ...["pending", "future"].map(id => ({ updated_at: `${day}T19:30:00Z`, answers: { booking_id: id, client_control_notes_text: "Note salvate" } }))], statuses, {}, emptyAgendaNotes());
 assert.equal(remainingAgendaAppointments(completed.appointments), 0);
});

test('completed appointment with an agenda note counts even without a client form', () => {
 const result = buildAgendaReport(day, [booking('reapplication'), booking('color')], [
  {updated_at:`${day}T17:51:00Z`,answers:{booking_id:'color',client_control_notes_text:'Colore'}},
 ], {reapplication:{status:'COMPLETATO'},color:{status:'COMPLETATO'}}, {}, emptyAgendaNotes(), {reapplication:'150 gr 3 fasce by vero'});
 assert.equal(result.totals.completed,2);
 assert.equal(remainingAgendaAppointments(result.appointments),0);
});

test('completed status resolves the appointment while office notes alone do not', () => {
 const result = buildAgendaReport(day, [booking('planned'),booking('empty'),booking('canceled'),booking('no-show')], [],
 {planned:{status:'PRENOTATO'},empty:{status:'COMPLETATO'},canceled:{status:'ANNULLATO'},'no-show':{status:'NON_PRESENTATO'}}, {}, emptyAgendaNotes(),
 {planned:'Preparare materiale',empty:'  ',canceled:'Nota precedente','no-show':'Nota precedente'});
 assert.equal(result.totals.completed,1);
 assert.equal(result.appointments.find(a => a.id === "empty")?.completedInCalendar, true);
 assert.equal(remainingAgendaAppointments(result.appointments),1);
 assert.equal(result.totals.cancelled,1);
 assert.equal(result.totals.noShow,1);
});


test('completed appointments are matched by booking id, not a shared customer name', () => {
 const report = buildAgendaReport(day, [booking('giorgia-13', {customer:{name:'Giorgia'}}), booking('giorgia-17', {customer:{name:'Giorgia'}})], [], {'giorgia-13':{status:'COMPLETATO'}}, {}, emptyAgendaNotes());
 assert.equal(report.appointments.find(a => a.id === 'giorgia-13')?.confirmed, true);
 assert.equal(report.appointments.find(a => a.id === 'giorgia-17')?.confirmed, false);
 assert.equal(remainingAgendaAppointments(report.appointments), 1);
});
