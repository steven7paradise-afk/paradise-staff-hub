import assert from "node:assert/strict";
import test from "node:test";
import {
  appointmentSalonSlugFromName,
  appointmentSalonUrl,
  isSameAppointmentDestination,
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
