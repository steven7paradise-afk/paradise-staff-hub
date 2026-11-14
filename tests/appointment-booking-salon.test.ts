import assert from "node:assert/strict";
import test from "node:test";
import { agendaSalonScope, resolveAgendaAppointmentSalon } from "../lib/appointment-booking-salon";

const repubblica = { id: "client-salon", name: "Salone Repubblica", active: true };
const office = { id: "office", name: "Ufficio Paradise", active: true };
const legacy = { id: "old-salon", name: "Corso Buenos Aires", active: false };
const oneSalon = agendaSalonScope([repubblica, office, legacy]);

const genericBooking = {
  service: { title: "Riapplicazione microtessitura" },
  teammates: [{ firstname: "Staff", lastname: "Disponibile" }],
};

test("assigns a generic unallocated booking to the only active client salon", () => {
  assert.equal(resolveAgendaAppointmentSalon(genericBooking, [], oneSalon, true), "repubblica");
  assert.equal(resolveAgendaAppointmentSalon({ ...genericBooking, form_data: { sede: "No data" } }, [], oneSalon, true), "repubblica");
  for (const name of ["Salone Duomo", "Studio Navigli"]) {
    const scope = agendaSalonScope([repubblica, office, { id: "another", name, active: true }]);
    assert.equal(resolveAgendaAppointmentSalon(genericBooking, [], scope, true), "altro");
  }
});

test("respects explicit venue information over staff inference or defaults", () => {
  assert.equal(resolveAgendaAppointmentSalon({ ...genericBooking, form_data: { sede: "Salone Duomo" } }, [repubblica.name], oneSalon, true), "duomo");
  assert.equal(resolveAgendaAppointmentSalon({ ...genericBooking, form_data: { salone: "Studio Navigli" } }, [repubblica.name], oneSalon, true), "altro");
  assert.equal(resolveAgendaAppointmentSalon({ ...genericBooking, service: { title: "Piega | Duomo" } }, [repubblica.name], oneSalon, true), "duomo");
});

test("office labels are ignored as venues for the client agenda", () => {
  const booking = { service: { title: "Microtessitura" }, teammates: [{ firstname: "Operatrice", lastname: "Paradise" }] };
  assert.equal(resolveAgendaAppointmentSalon(booking, [office.name], oneSalon, true), "repubblica");
  const twoSalons = agendaSalonScope([repubblica, office, { ...legacy, active: true }]);
  assert.equal(resolveAgendaAppointmentSalon(booking, [office.name], twoSalons, true), "altro");
  assert.equal(resolveAgendaAppointmentSalon({ ...booking, form_data: { salone: office.name } }, [], oneSalon, true), "repubblica");
  assert.equal(resolveAgendaAppointmentSalon({ ...booking, service: { title: "Microtessitura | Ufficio Paradise" } }, [], oneSalon, true), "repubblica");
  assert.equal(resolveAgendaAppointmentSalon({ ...booking, form_data: { sede: "Salone Duomo", salone: office.name } }, [], oneSalon, true), "duomo");
});

test("maps historical Buenos Aires labels to Repubblica only when no distinct location is active", () => {
  const booking = { service: { title: "RIAPPLICAZIONE BUENOS AIRES - ACCONTO 20€" } };
  assert.equal(resolveAgendaAppointmentSalon(booking, [], oneSalon, true), "repubblica");
  const twoSalons = agendaSalonScope([repubblica, office, { ...legacy, active: true }]);
  assert.equal(resolveAgendaAppointmentSalon(booking, [repubblica.name], twoSalons, true), "buenos-aires");
  assert.equal(resolveAgendaAppointmentSalon({ service: { title: "Repubblica o Buenos Aires" } }, [], twoSalons, true), "altro");
});
