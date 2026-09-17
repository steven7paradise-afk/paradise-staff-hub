import assert from "node:assert/strict";
import test from "node:test";
import { closestAppointmentPayment, canCorrectAppointmentClient } from "../lib/appointment-payment-match";

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
