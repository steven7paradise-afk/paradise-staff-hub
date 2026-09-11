import assert from "node:assert/strict";
import test from "node:test";
import { compareCanceledAppointmentsLast } from "../lib/appointment-order";

test("mantiene gli appuntamenti annullati dopo quelli attivi", () => {
  const appointments = [
    { id: "canceled-early", startDate: "2026-09-11T09:00:00.000Z", isCanceled: true },
    { id: "active-late", startDate: "2026-09-11T15:00:00.000Z", isCanceled: false },
    { id: "active-early", startDate: "2026-09-11T10:00:00.000Z", isCanceled: false },
    { id: "canceled-late", startDate: "2026-09-11T16:00:00.000Z", isCanceled: true },
  ];

  appointments.sort((left, right) => (
    compareCanceledAppointmentsLast(left, right) ||
    new Date(left.startDate).getTime() - new Date(right.startDate).getTime()
  ));

  assert.deepEqual(
    appointments.map((appointment) => appointment.id),
    ["active-early", "active-late", "canceled-early", "canceled-late"],
  );
});
