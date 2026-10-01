import assert from "node:assert/strict";
import test from "node:test";
import { closestAppointmentPayment, canCorrectAppointmentClient, uniqueAppointmentPayment, appointmentDayPayments } from "../lib/appointment-payment-match";

const order = (id: string, createdAt: string, financialStatus = "paid") => ({ id, orderName: `#${id}`, createdAt, financialStatus });

test("seleziona il pagamento effettuato nello stesso giorno più vicino all'appuntamento", () => {
  assert.equal(closestAppointmentPayment([
    order("1", "2026-09-16T10:05:00Z"),
    order("2", "2026-09-17T09:45:00Z"),
    order("3", "2026-09-17T10:10:00Z"),
    order("4", "2026-09-17T10:01:00Z", "pending"),
  ], "2026-09-17T10:00:00Z")?.id, "3");
});

test("esclude l'acconto e non usa un pagamento di un altro giorno", () => {
  assert.equal(closestAppointmentPayment([
    order("1", "2026-09-17T10:01:00Z"),
    order("2", "2026-09-16T10:00:00Z"),
  ], "2026-09-17T10:00:00Z", "#1"), null);
});

test("il giorno del pagamento segue Roma anche a cavallo della mezzanotte", () => {
  assert.equal(closestAppointmentPayment([
    order("1", "2026-09-16T22:30:00Z"),
  ], "2026-09-17T07:00:00Z")?.id, "1");
  assert.equal(closestAppointmentPayment([], "invalid"), null);
});

test("correggi cliente è disponibile solo a responsabili e amministratori", () => {
  for (const role of ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]) assert.equal(canCorrectAppointmentClient(role), true);
  for (const role of ["DIPENDENTE", "MAGAZZINO", "PC_CASSA", null]) assert.equal(canCorrectAppointmentClient(role), false);
});

test("la notifica cambia cliente senza ereditare pagamenti omonimi o ambigui", () => {
  const start = "2026-09-29T10:00:00Z";
  const alice = { email: "alice@example.com", phone: "+393331111111" };
  const bea = { email: "bea@example.com", phone: "+393332222222" };
  const alicePayment = { ...order("1", start), ...alice, clientName: "Maria Rossi" };
  const beaPayment = { ...order("2", start), ...bea, clientName: "Maria Rossi" };
  const orders = [alicePayment, beaPayment];
  assert.equal(uniqueAppointmentPayment(orders, alice, start)?.id, "1");
  assert.equal(uniqueAppointmentPayment(orders, bea, start)?.id, "2");
  assert.equal(uniqueAppointmentPayment([alicePayment], bea, start), null);
  assert.equal(uniqueAppointmentPayment(orders, {}, start), null);
  assert.equal(uniqueAppointmentPayment(orders, { email: alice.email, phone: bea.phone }, start), null);
  assert.equal(uniqueAppointmentPayment([...orders, { ...alicePayment, id: "3", orderName: "#3" }], alice, start), null);
});

test("mostra uno, due o tre pagamenti del giorno, incluso l'acconto e senza duplicati", () => {
  const customer = {email: "cliente@example.com"};
  const payments = [1, 2, 3].map(i => ({...order(String(i), `2026-10-01T10:0${i}:00+02:00`), ...customer}));
  for (const count of [1, 2, 3]) assert.equal(appointmentDayPayments(payments.slice(0,count),customer,"2026-10-01T09:00:00+02:00","#1").length,count);
  assert.deepEqual(appointmentDayPayments([...payments, payments[0], {...payments[0], id:"old",createdAt:"2026-09-30T10:00:00+02:00"}, {...payments[0],id:"unpaid",financialStatus:"pending"}],customer,"2026-10-01T09:00:00+02:00").map(o=>o.id),["3","2","1"]);
});

test("il cliente Shopify dell'ordine prenotato supera il refuso email, non collega altre persone", () => {
  const start="2026-10-01T10:00:00+02:00";
  const booking={...order("27966","2026-09-21T10:00:00+02:00"),customerId:"customer-a",email:"cliente@gmail.com"};
  const payments=[{...booking,...order("28575",start)},{...booking,...order("28578","2026-10-01T10:30:00+02:00")}];
  const other={...payments[0],id:"other",customerId:"customer-b"};
  assert.deepEqual(appointmentDayPayments([booking,...payments,other],{email:"cliente@gmai.com"},start,"#27966").map(o=>o.id),["28578","28575"]);
  assert.equal(appointmentDayPayments([booking,...payments],{email:"altra@example.com"},start,"999").length,0);
  assert.equal(appointmentDayPayments(payments,{},start).length,0);
  assert.equal(appointmentDayPayments(payments,{},"invalid").length,0);
});

test("tutti i pagamenti rispettano il giorno italiano a cavallo della mezzanotte", () => {
  const customer={email:"cliente@example.com"};
  const orders=[{...order("1","2026-09-30T22:30:00Z"),...customer},{...order("2","2026-10-01T22:30:00Z"),...customer}];
  assert.deepEqual(appointmentDayPayments(orders,customer,"2026-10-01T10:00:00+02:00").map(o=>o.id),["1"]);
});
