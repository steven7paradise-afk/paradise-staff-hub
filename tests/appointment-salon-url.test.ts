import assert from "node:assert/strict";
import test from "node:test";
import {
  appointmentSalonSlugFromName,
  appointmentSalonUrl,
  isAppointmentWorkerDestination,
  isSameAppointmentDestination,
  normalizeAppointmentAgendaSalon,
  normalizeAppointmentSalonSlug,
  repubblicaIncludesLegacyBuenosAires,
} from "../lib/appointment-salon-url";

test("normalizza e costruisce gli indirizzi dei saloni", () => {
  assert.equal(normalizeAppointmentSalonSlug("Corso Buenos Aires"), "buenos-aires");
  assert.equal(appointmentSalonUrl("buenos-aires"), "/appointments/buenos-aires");
  assert.equal(appointmentSalonSlugFromName("Salone Repubblica"), "repubblica");
  assert.equal(normalizeAppointmentSalonSlug("Salone Repubblica"), "repubblica");
  assert.equal(appointmentSalonUrl("repubblica"), "/appointments/repubblica");
});

test("l'Ufficio resta una sede interna ma non un filtro dell'agenda clienti", () => {
  assert.equal(appointmentSalonSlugFromName("Ufficio Paradise"), "ufficio");
  assert.equal(normalizeAppointmentAgendaSalon("ufficio"), null);
  assert.equal(normalizeAppointmentAgendaSalon("Salone Repubblica"), "repubblica");
});

test("il PIN accetta solo la destinazione operativa di un salone", () => {
  assert.equal(isAppointmentWorkerDestination("/appointments/repubblica?worker=Persona%20Demo"), true);
  for (const invalid of [undefined, "/appointments", "/appointments/repubblica?choose=1", "/appointments/repubblica?worker=%20", "/appointments/corso?worker=Demo", "/appointments/repubblica?worker=Demo#extra", "//example.net/appointments/repubblica?worker=Demo"]) {
    assert.equal(isAppointmentWorkerDestination(invalid), false);
  }
});

test("la sede unica Repubblica include gli appuntamenti storici di Buenos Aires", () => {
  const locations = [
    { id: "salone", name: "Salone Repubblica", active: true },
    { id: "ufficio", name: "Ufficio Paradise", active: true },
    { id: "legacy", name: "Corso Buenos Aires", active: false },
  ];
  assert.equal(repubblicaIncludesLegacyBuenosAires(locations, "salone"), true);
  assert.equal(repubblicaIncludesLegacyBuenosAires(locations, "ufficio"), false);
  assert.equal(repubblicaIncludesLegacyBuenosAires(locations.map((location) => ({ ...location, active: true })), "salone"), false);
});

test("riconosce quando il PIN prova ad aprire la stessa destinazione", () => {
  assert.equal(
    isSameAppointmentDestination(
      "https://www.staff-paradise.tech/appointments/buenos-aires?worker=Laura%20Barreca",
      "/appointments/buenos-aires?worker=Laura%20Barreca",
    ),
    true,
  );
  assert.equal(
    isSameAppointmentDestination(
      "https://www.staff-paradise.tech/appointments/buenos-aires",
      "/appointments/buenos-aires?worker=Laura%20Barreca",
    ),
    false,
  );
});
