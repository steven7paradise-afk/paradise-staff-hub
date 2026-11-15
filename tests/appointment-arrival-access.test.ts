import assert from "node:assert/strict";
import test from "node:test";
import {
  canRecordEarlyAppointmentArrival, isAppointmentArrivalStatus, isBeforeSalonOpening, isReceptionArrivalAgendaPath, isRepubblicaReceptionist,
} from "../lib/appointment-arrival-access";
import { signAppointmentPcArrival, verifyAppointmentPcArrival } from "../lib/appointment-pc-arrival-session";
import { hasAvailableAssignedAppointmentWorker, hasPresentAppointmentWorker, resolveAppointmentStatusWorkers } from "../lib/appointment-status-access";
import { prisma } from "../lib/prisma";

test("early arrival requires Reception or administration and uses the salon's local opening time", () => {
  assert.equal(canRecordEarlyAppointmentArrival({ role: "DIPENDENTE", mansione: "Receptionist" }), true);
  assert.equal(canRecordEarlyAppointmentArrival({ role: "RESPONSABILE", mansione: "Reception salone" }), true);
  assert.equal(canRecordEarlyAppointmentArrival({ role: "ADMIN" }), true);
  assert.equal(canRecordEarlyAppointmentArrival({ role: "RESPONSABILE" }), false);
  assert.equal(canRecordEarlyAppointmentArrival({ role: "DIPENDENTE", mansione: "Parrucchiera" }), false);
  assert.equal(isBeforeSalonOpening(new Date("2026-11-15T08:50:00Z"), "10:00"), true);
  assert.equal(isBeforeSalonOpening(new Date("2026-11-15T09:00:00Z"), "10:00"), false);
  assert.equal(isBeforeSalonOpening(new Date("2026-07-15T07:50:00Z"), "10:00"), true);
  assert.equal(isBeforeSalonOpening(new Date("2026-07-15T08:50:00Z"), null), false);
});

test("off-shift Reception operations cover only the agenda reads and arrival submission", () => {
  assert.equal(isRepubblicaReceptionist({ mansione: "Receptionist", location: { name: "Salone Repubblica", active: true } }), true);
  assert.equal(isRepubblicaReceptionist({ mansione: "Receptionist", location: { name: "Corso Buenos Aires", active: false } }), true);
  assert.equal(isRepubblicaReceptionist({ mansione: "Receptionist", location: { name: "Salone Duomo", active: true } }), false);
  assert.equal(isReceptionArrivalAgendaPath("/appointments", "GET"), true);
  assert.equal(isReceptionArrivalAgendaPath("/api/appointments/events", "GET"), true);
  assert.equal(isReceptionArrivalAgendaPath("/api/appointments/status", "POST"), true);
  assert.equal(isReceptionArrivalAgendaPath("/api/appointments/team", "POST"), false);
  assert.equal(isReceptionArrivalAgendaPath("/api/service-forms/submit", "POST"), false);
  assert.equal(isAppointmentArrivalStatus("IN_ATTESA"), true);
  assert.equal(isAppointmentArrivalStatus("ARRIVATO_IN_RITARDO"), true);
  assert.equal(isAppointmentArrivalStatus("INIZIATO"), false);
});

test("a cashier arrival session is short-lived, signed and bound to its authorized device", () => {
  const now = 1_700_000_000_000;
  const expiresAt = now + 300_000;
  const secret = "synthetic-test-signing-key";
  const device = "synthetic-device-token";
  const token = signAppointmentPcArrival("receptionist", device, true, secret, expiresAt);
  assert.deepEqual(verifyAppointmentPcArrival(token, device, secret, now), { userId: "receptionist", arrivalOnly: true });
  assert.equal(verifyAppointmentPcArrival(token.replace("receptionist", "admin"), device, secret, now), null);
  assert.equal(verifyAppointmentPcArrival(token.replace("limited", "standard"), device, secret, now), null);
  assert.equal(verifyAppointmentPcArrival(token, "other-device", secret, now), null);
  assert.equal(verifyAppointmentPcArrival(token, device, "other-key", now), null);
  assert.equal(verifyAppointmentPcArrival(token, device, secret, expiresAt), null);
  assert.equal(verifyAppointmentPcArrival(token, device, undefined, now), null);
});

test("start checks actual worker identities from local assignments, aliases or unique names", () => {
  const workers = [
    { id: "a", name: "Arianna Rossi", sede_id: "salon", location: { name: "Salone Repubblica" } },
    { id: "b", name: "Béatrice Bianchi", sede_id: "salon", location: { name: "Salone Repubblica" } },
  ];
  const booking = { teammates: [{ id: "external-a", firstname: "Alias" }, { id: "external-b", firstname: "Beatrice" }] };
  assert.deepEqual(resolveAppointmentStatusWorkers(workers, booking, undefined, { "external-a": { userId: "a" } }), workers);
  assert.deepEqual(resolveAppointmentStatusWorkers(workers, booking, [{ id: "unknown", name: "Arianna Rossi" }], {}), []);
  assert.deepEqual(resolveAppointmentStatusWorkers(workers, booking, [{ id: "b" }], {}), [workers[1]]);
  assert.deepEqual(resolveAppointmentStatusWorkers(workers, { teammates: [{ id: "unassigned", firstname: "Staff disponibile" }] }, undefined, {}), []);
});

test("a service needs an active shift in the correct salon", async t => {
  const startedAt = new Date("2026-11-15T09:05:00Z");
  const worker = "assigned";
  const location = "repubblica";
  const clockIn = { user_id: worker, location_id: location, type: "ENTRATA", timestamp: new Date("2026-11-15T09:00:00Z") } as const;
  const clockOut = { ...clockIn, type: "USCITA", timestamp: new Date("2026-11-15T09:04:00Z") } as const;
  const original = prisma.attendanceLog.findMany;
  t.after(() => { prisma.attendanceLog.findMany = original; });
  let logs: readonly (typeof clockIn | typeof clockOut)[] = [];
  prisma.attendanceLog.findMany = (async () => logs) as unknown as typeof original;
  assert.equal(await hasPresentAppointmentWorker([worker], [location], startedAt), false);
  logs = [clockIn];
  assert.equal(await hasPresentAppointmentWorker([], [location], startedAt), false);
  assert.equal(await hasPresentAppointmentWorker([worker], ["other"], startedAt), false);
  assert.equal(await hasPresentAppointmentWorker([worker], [location], startedAt), true);
  logs = [clockIn, clockOut];
  assert.equal(await hasPresentAppointmentWorker([worker], [location], startedAt), false);
});

test("an assigned owner can start without clocking in at the appointment salon", async t => {
  const now = new Date("2026-11-15T09:05:00Z");
  const salon = ["repubblica"];
  const owner = { id: "cmqf02qgq0001jx0913ddfys1", name: "Francesca" };
  const sameFirstName = { id: "other-worker", name: "Francesca" };
  const original = prisma.attendanceLog.findMany;
  const findLogs = t.mock.fn(async () => []);
  prisma.attendanceLog.findMany = findLogs as unknown as typeof original;
  t.after(() => { prisma.attendanceLog.findMany = original; });

  assert.equal(await hasAvailableAssignedAppointmentWorker([owner], salon, now), true);
  assert.equal(await hasAvailableAssignedAppointmentWorker([owner], [], now), false);
  assert.equal(await hasAvailableAssignedAppointmentWorker([], salon, now), false);
  assert.equal(findLogs.mock.callCount(), 0);

  assert.equal(await hasAvailableAssignedAppointmentWorker([sameFirstName], salon, now), false);
  assert.equal(findLogs.mock.callCount(), 1);
});
