import assert from "node:assert/strict";
import test from "node:test";
import {
  appointmentStaffDisplayName,
  isAlwaysActiveAppointmentStaff,
  suggestEmployeeForAppointmentSalon,
  employeeMatchesAppointmentLocation,
  appointmentOperatorInSalon,
  isClockedInAppointmentWorker,
  isAvailableAppointmentServiceWorker,
} from "../lib/appointment-staff-access";

test("Francesca titolare compare da Ufficio in entrambi i saloni anche senza timbratura", () => {
  const owner = { id: "cmqf02qgq0001jx0913ddfys1", name: "Franci", role: "ADMIN", locationName: "Ufficio Paradise" };
  for (const salon of ["Salone Buenos Aires", "Salone Duomo"]) {
    assert.equal(suggestEmployeeForAppointmentSalon(owner, salon), true);
    assert.equal(appointmentOperatorInSalon([owner], owner, salon)?.id, owner.id);
    assert.equal(appointmentOperatorInSalon([owner], { id: "kiosk-selected-worker", name: "Francesca" }, salon)?.id, owner.id);
    assert.equal(isAvailableAppointmentServiceWorker(owner, [], salon), true);
    assert.equal(isAvailableAppointmentServiceWorker(owner, [{ id: owner.id, status: "OUT", clockedInAt: null }], salon), true);
    assert.equal(isAvailableAppointmentServiceWorker({ ...owner, name: "Profilo rinominato" }, [], salon), true);
  }
});

test("la disponibilità della titolare non estende l'eccezione ad altri profili", () => {
  const salon = "Salone Buenos Aires";
  const worker = { id: "worker", name: "Aurora", role: "DIPENDENTE", locationName: salon };
  const attendance = [{ id: worker.id, status: "IN", clockedInAt: "2026-10-01T08:00:00Z" }];
  assert.equal(isAvailableAppointmentServiceWorker(worker, attendance, salon), true);
  assert.equal(isAvailableAppointmentServiceWorker(worker, [], salon), false);
  assert.equal(isAvailableAppointmentServiceWorker(worker, [{ ...attendance[0], status: "OUT" }], salon), false);
  assert.equal(isAvailableAppointmentServiceWorker(worker, attendance, "Salone Duomo"), false);
  assert.equal(isAvailableAppointmentServiceWorker({ ...worker, role: "ADMIN", locationName: "Ufficio Paradise" }, attendance, salon), false);
});

test("suggerisce solo la sede reale senza cambiare i permessi di ufficio e admin", () => {
  const office = { id: "office", name: "Operatore", role: "ADMIN", locationName: "Ufficio Paradise" };
  assert.equal(suggestEmployeeForAppointmentSalon(office, "Salone Buenos Aires"), false);
  assert.equal(employeeMatchesAppointmentLocation(office, "Salone Buenos Aires"), true);
  assert.equal(suggestEmployeeForAppointmentSalon({ ...office, locationName: null }, "Salone Buenos Aires"), false);
  for (const locationName of ["Salone Buenos Aires", "Corso Buenos Aires", "Salone Corso"]) {
    assert.equal(suggestEmployeeForAppointmentSalon({ ...office, role: "DIPENDENTE", locationName }, "buenos aires"), true);
  }
  assert.equal(suggestEmployeeForAppointmentSalon({ ...office, locationName: "Salone Duomo" }, "buenos aires"), false);
  assert.equal(suggestEmployeeForAppointmentSalon({ ...office, locationName: "Salone Duomo" }, "duomo"), true);
});

test("il popup riconosce il profilo attivo senza indovinare omonimi o personale ufficio", () => {
  const staff = [
    { id: "a", name: "Aurora Dassisti", locationName: "Salone Buenos Aires" },
    { id: "b", name: "Aurora Dassisti", locationName: "Salone Duomo" },
    { id: "c", name: "Steven Alvarez", role: "ADMIN", locationName: "Ufficio Paradise" },
  ];
  assert.equal(appointmentOperatorInSalon(staff, { id: "a", name: "Aurora" }, "Salone Buenos Aires")?.id, "a");
  assert.equal(appointmentOperatorInSalon(staff, { id: "b", name: "Aurora Dassisti" }, "Salone Buenos Aires"), undefined);
  assert.equal(appointmentOperatorInSalon(staff, { id: "c", name: "Steven Alvarez" }, "Salone Buenos Aires"), undefined);
  assert.equal(appointmentOperatorInSalon(staff, { id: "kiosk-selected-worker", name: "Aurora Dassisti" }, "Salone Buenos Aires")?.id, "a");
  assert.equal(appointmentOperatorInSalon([...staff, { ...staff[0], id: "duplicate" }], { name: "Aurora Dassisti" }, "Salone Buenos Aires"), undefined);
  assert.equal(appointmentOperatorInSalon(staff, null, "Salone Buenos Aires"), undefined);
});

test("le alternative dopo No richiedono una timbratura reale e nessuna uscita", () => {
  const clockedInAt = "2026-10-01T08:00:00Z";
  assert.equal(isClockedInAppointmentWorker({ status: "IN", clockedInAt }), true);
  assert.equal(isClockedInAppointmentWorker({ status: "BREAK", clockedInAt }), true);
  assert.equal(isClockedInAppointmentWorker({ status: "OUT", clockedInAt }), false);
  assert.equal(isClockedInAppointmentWorker({ status: "IN", clockedInAt: null }), false);
  assert.equal(isClockedInAppointmentWorker({ status: "IN", clockedInAt: "invalid" }), false);
});

test("Franci può usare gli appuntamenti da ogni tablet autorizzato", () => {
  assert.equal(isAlwaysActiveAppointmentStaff("Franci"), true);
  assert.equal(isAlwaysActiveAppointmentStaff("  FRANCI  "), true);
  assert.equal(isAlwaysActiveAppointmentStaff("Profilo rinominato", "cmqf02qgq0001jx0913ddfys1"), true);
});

test("Steven dipende dalla timbratura come gli altri profili", () => {
  assert.equal(isAlwaysActiveAppointmentStaff("Steven Alvarez"), false);
  assert.equal(isAlwaysActiveAppointmentStaff("Profilo rinominato", "cmpmp66np0001ie09hko78bsb"), false);
});

test("il selettore mostra i nomi brevi richiesti", () => {
  assert.equal(appointmentStaffDisplayName("Franci"), "Francesca");
  assert.equal(appointmentStaffDisplayName("Steven Alvarez"), "Steven");
  assert.equal(appointmentStaffDisplayName("Jessica Inturri"), "Jessica Inturri");
});

test("gli altri profili continuano a dipendere da sede e timbratura", () => {
  assert.equal(isAlwaysActiveAppointmentStaff("Melissa Valenti"), false);
  assert.equal(isAlwaysActiveAppointmentStaff(null), false);
});
