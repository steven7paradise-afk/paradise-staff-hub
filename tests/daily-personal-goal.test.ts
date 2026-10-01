import test from "node:test";
import assert from "node:assert/strict";
import { dailyPersonalTarget, countDailyCompletedCards, assignedDailyAppointments } from "../lib/daily-personal-goal";
const now = new Date("2026-10-01T10:00:00Z");
const worker = { id: "a", name: "Nicol" };
const card = (id: string, answers: Record<string, unknown> = {}, date = now) => ({ id, created_at: date, answers: { client_control_correctness: "Controllato", client_control_service_staff: ["Nicol"], ...answers } });
test("all defined professional levels require five completed cards", () => {
 for (const professionalLevel of ["Junior", "Autonomo", "Master"]) assert.equal(dailyPersonalTarget({professionalLevel}), 5);
 assert.equal(dailyPersonalTarget({}), 5);
});
test("daily goal excludes drafts, errors, other workers and previous days; counts one per booking", () => {
 const cards = [card("1",{booking_id:"b"}),card("2",{booking_id:"b"}),card("3",{client_control_is_draft:true}),card("4",{client_control_correctness:"Bozza"}),card("5",{client_control_service_staff:["Francesca"]}),card("6",{},new Date("2026-09-30T12:00:00Z"))];
 assert.equal(countDailyCompletedCards(cards,worker,["Nicol","Francesca"],now),1);
});
test("completion date takes precedence and respects midnight in Rome", () => {
 const cards=[card("a",{client_control_completed_at:"2026-09-30T22:30:00Z"},new Date("2026-09-29")),card("b",{client_control_completed_at:"2026-09-30T21:59:00Z"})];
 assert.equal(countDailyCompletedCards(cards,worker,["Nicol"],now),1);
});
test("assignments respect manual reassignment, canceled bookings and completed controls", () => {
 const booking=(id:string)=>({id,start_date:now.toISOString(),teammates:[{id:"external",firstname:"Nicol"}],customer:{name:"Esempio"}});
 const result=assignedDailyAppointments([booking("1"),booking("2"),{...booking("3"),is_canceled:true},booking("4")],{"2":{teammates:[{id:"b",name:"Francesca"}]}},{"4":{status:"NON_PRESENTATO"}},worker,["Nicol","Francesca"],[card("x",{booking_id:"1"})]);
 assert.deepEqual(result.map(x=>[x.id,x.noteCompleted]),[["1",true]]);
});

test("Cowlendar surname initial includes the third assigned appointment with its missing note", () => {
 const worker = { id: "melissa-j", name: "Melissa Jaku" };
 const known = ["Melissa Jaku", "Melissa Valente"];
 const bookings = ["1", "2", "3"].map(id => ({ id, start_date: now.toISOString(), teammates: [{id:"cowlendar-melissa",firstname:"MELISSA J",lastname:"| BUENOS AIRES"}] }));
 const cards = [card("a",{booking_id:"1"}), card("b",{booking_id:"2"})];
 const result = assignedDailyAppointments(bookings, {}, {}, worker, known, cards);
 assert.equal(result.length,3);
 assert.equal(result.filter(item => item.noteCompleted).length,2);
 assert.equal(result.filter(item => !item.noteCompleted).length,1);
 assert.equal(assignedDailyAppointments(bookings, {}, {}, {id:"melissa-v",name:"Melissa Valente"},known,cards).length,0);
 assert.equal(assignedDailyAppointments([{...bookings[0],teammates:[{id:"external",firstname:"Melissa"}]}],{},{},worker,known,cards).length,0);
});
