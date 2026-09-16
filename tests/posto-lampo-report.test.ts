import assert from "node:assert/strict";
import test from "node:test";
import { buildPostoLampoReport, isPostoLampo, romeMonthRange } from "../lib/posto-lampo-report";
import type { CowlendarBooking } from "../lib/cowlendar";

const booking = (id: string, extra: Partial<CowlendarBooking> = {}): CowlendarBooking => ({ id, start_date: "2026-08-04T09:00:00Z", service: { title: "POSTO LAMPO – BLOCCO INTERNO" }, customer: { name: id }, attendance: "booked", teammates: [{ id: "staff", firstname: "LAURA |", lastname: "BUENOS AIRES" }], ...extra });
const report = (bookings: CowlendarBooking[], extra: Partial<Parameters<typeof buildPostoLampoReport>[0]> = {}) => buildPostoLampoReport({ bookings, controls: [], overrides: {}, year: 2026, month: 8, ...extra });

test("riconosce il servizio, non ogni testo contenente lampo", () => {
  assert.equal(isPostoLampo("POSTO LAMPO – BLOCCO INTERNO"), true);
  assert.equal(isPostoLampo("posti lampi"), true);
  assert.equal(isPostoLampo("Rimozione lampo"), false);
});
test("periodi mensili Roma includono mezzanotte locale e cambio ora", () => {
  assert.equal(romeMonthRange(2026, 8).start.toISOString(), "2026-07-31T22:00:00.000Z");
  assert.equal(romeMonthRange(2026, 8).end.toISOString(), "2026-08-31T22:00:00.000Z");
  assert.equal(romeMonthRange(2026, 3).start.toISOString(), "2026-02-28T23:00:00.000Z");
  assert.equal(romeMonthRange(2026, 3).end.toISOString(), "2026-03-31T22:00:00.000Z");
  assert.throws(() => romeMonthRange(2026, 13));
});
test("deduplica appuntamenti ed esclude altri servizi e date fuori mese", () => {
  const result=report([booking("a"), booking("a"), booking("b",{service:{title:"Piega"}}), booking("c",{start_date:"2026-08-31T22:00:00Z"}), booking("d",{start_date:"2026-07-31T22:00:00Z"})]);
  assert.deepEqual(result.rows.map(r=>r.id), ["d", "a"]);
  assert.equal(result.totals.appointments,2);
});
test("controllo inviato completa; bozze, errori e no show non incrementano effettuati", () => {
  const controls=["a","b","c","d"].map(id=>({id,updated_at:new Date(),user_location_name:null,answers:{booking_id:id,client_control_is_draft:id==="b"?"true":false,client_control_correctness:id==="c"?"Errore":id==="d"?"No Show":"Finito",client_control_paid:"0"}}));
  const result=report([booking("a"),booking("b"),booking("c"),booking("d"),booking("e",{attendance:"completed"}),booking("f",{attendance:"completed",is_canceled:true})],{controls});
  assert.deepEqual(result.totals,{appointments:6,completed:2,toVerify:2,notPerformed:2});
  assert.equal(result.rows[0].paid,0);
  assert.equal(result.rows[1].paid,null);
});
test("override no show prevale su completato; importi mancanti non diventano zero", () => {
  const result=report([booking("a",{attendance:"completed"}),booking("b")],{overrides:{a:{status:"NON_PRESENTATO"},b:{status:"COMPLETATO"}}});
  assert.deepEqual(result.totals,{appointments:2,completed:1,toVerify:0,notPerformed:1});
  assert.equal(result.rows[1].paid,null);
});
test("il controllo più recente prevale su un vecchio duplicato", () => {
  const result=report([booking("a")],{controls:[{id:"old",updated_at:"2026-08-01",user_location_name:null,answers:{booking_id:"a"}},{id:"new",updated_at:"2026-08-05",user_location_name:null,answers:{booking_id:"a",client_control_is_draft:true}}]});
  assert.equal(result.totals.completed,0);
});
test("filtra sede, oggi e ora usando data appuntamento Roma", () => {
  const result=report([booking("a"),booking("b",{start_date:"2026-08-05T09:00:00Z"}),booking("c",{start_date:"2026-08-04T10:00:00Z"})],{salon:"Salone Buenos Aires",todayOnly:true,hour:"11",now:new Date("2026-08-04T15:00:00Z")});
  assert.deepEqual(result.rows.map(r=>r.id),["a"]);
  assert.equal(report([booking("a")],{salon:"Salone Duomo"}).rows.length,0);
});
