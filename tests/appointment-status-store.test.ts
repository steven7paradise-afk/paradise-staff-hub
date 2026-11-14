import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import { Client } from "pg";
import { APPOINTMENT_EVENTS_CHANNEL, APPOINTMENT_REVISION_KEY } from "../lib/cowlendar-webhook";

const testDatabase = process.env.PARADISE_STATUS_TEST_DATABASE_URL;

test("concurrent status saves keep each booking and its latest service timing", {
  skip: !testDatabase && "Requires a local PostgreSQL test database",
}, async (t) => {
  const url = new URL(testDatabase!);
  assert.equal(url.protocol, "postgresql:");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));

  const schema = `appointment_status_test_${randomUUID().replace(/-/g, "")}`;
  url.searchParams.delete("schema");
  const maintenance = new Client({ connectionString: url.href });
  await maintenance.connect();
  t.after(async () => {
    try { await maintenance.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
    finally { await maintenance.end(); }
  });
  await maintenance.query(`CREATE SCHEMA ${schema}`);

  await maintenance.query(`
    CREATE TABLE ${schema}.settings (id text PRIMARY KEY, key text UNIQUE NOT NULL, value jsonb NOT NULL)
  `);
  url.searchParams.set("schema", schema);
  const originalDatabase = process.env.DATABASE_URL;
  const originalRealtime = process.env.APPOINTMENTS_REALTIME_ENABLED;
  process.env.DATABASE_URL = url.href;
  process.env.APPOINTMENTS_REALTIME_ENABLED = "false";
  t.after(() => {
    if (originalDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabase;
    if (originalRealtime === undefined) delete process.env.APPOINTMENTS_REALTIME_ENABLED;
    else process.env.APPOINTMENTS_REALTIME_ENABLED = originalRealtime;
  });
  const { prisma } = await import("../lib/prisma");
  const { saveAppointmentStatus } = await import("../lib/appointment-status-store");
  t.after(() => prisma.$disconnect());

  const transitionAt = new Date("2026-11-14T09:00:00.000Z");
  await Promise.all(Array.from({ length: 8 }, (_, index) =>
    saveAppointmentStatus(`booking-${index}`, {
      status: "IN_ATTESA",
      updatedBy: "Operatrice test",
      transitionAt,
      trackServiceTime: true,
    }),
  ));

  const started = await saveAppointmentStatus("booking-0", {
    status: "INIZIATO",
    updatedBy: "Operatrice test",
    transitionAt,
    trackServiceTime: true,
  });
  const completed = await saveAppointmentStatus("booking-0", {
    status: "COMPLETATO",
    updatedBy: "Operatrice test",
    transitionAt: new Date("2026-11-14T09:05:00.000Z"),
    trackServiceTime: true,
  });
  assert.equal(started.previousStatus, "IN_ATTESA");
  assert.notEqual(started.entry.updatedAt, transitionAt.toISOString());
  assert.equal(completed.previousStatus, "INIZIATO");
  assert.equal(completed.entry.startedAt, transitionAt.toISOString());
  assert.equal(completed.entry.elapsedSeconds, 300);

  const { rows: [{ value }] } = await maintenance.query(
    `SELECT value FROM ${schema}.settings WHERE key = $1`,
    ["appointment_status_overrides"],
  );
  assert.equal(Object.keys(value).length, 8);
  assert.deepEqual(value["booking-0"], completed.entry);
  for (let index = 1; index < 8; index += 1) {
    assert.equal(value[`booking-${index}`].status, "IN_ATTESA");
  }

  await maintenance.query(`LISTEN ${APPOINTMENT_EVENTS_CHANNEL}`);
  process.env.APPOINTMENTS_REALTIME_ENABLED = "true";
  const [notification] = await Promise.all([
    once(maintenance, "notification", { signal: AbortSignal.timeout(3000) }),
    saveAppointmentStatus("booking-8", {
      status: "IN_ATTESA",
      updatedBy: "Operatrice test",
    }),
  ]);
  const [event] = notification;
  const eventRevision = await maintenance.query(
    `SELECT value FROM ${schema}.settings WHERE key = $1`,
    [APPOINTMENT_REVISION_KEY],
  );
  assert.equal(event.payload, eventRevision.rows[0].value);
  const saved = await maintenance.query(
    `SELECT value -> 'booking-8' ->> 'status' AS status FROM ${schema}.settings WHERE key = $1`,
    ["appointment_status_overrides"],
  );
  assert.equal(saved.rows[0].status, "IN_ATTESA");
});
