import assert from "node:assert/strict";
import test from "node:test";
import {
  appointmentSalonUrl,
  isSameAppointmentDestination,
  normalizeAppointmentSalonSlug,
} from "../lib/appointment-salon-url";

test("normalizza e costruisce gli indirizzi dei saloni", () => {
  assert.equal(normalizeAppointmentSalonSlug("Corso Buenos Aires"), "buenos-aires");
  assert.equal(appointmentSalonUrl("buenos-aires"), "/appointments/buenos-aires");
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
