import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import type { Prisma } from "@prisma/client";
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
    CREATE TABLE ${schema}.settings (id text PRIMARY KEY, key text UNIQUE NOT NULL, value jsonb NOT NULL);
    CREATE TABLE ${schema}.appointment_archive (
      id text PRIMARY KEY,
      start_at timestamptz NOT NULL,
      payload jsonb NOT NULL,
      sheet jsonb
    );
    CREATE TABLE ${schema}.appointment_archive_sync (
      month text PRIMARY KEY,
      completed_at timestamptz,
      error boolean NOT NULL DEFAULT false
    );
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
  const { readAppointmentEditRevisions, readAppointmentRangeRevision } = await import("../lib/appointment-range-revision");
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

  await maintenance.query(`
    INSERT INTO ${schema}.appointment_archive (id, start_at, payload) VALUES
      ('booking-0', '2026-11-14 09:00:00Z', '{}'),
      ('booking-1', '2026-11-14 10:00:00Z', '{}'),
      ('booking-external', '2026-11-14 10:30:00Z', '{}'),
      ('booking-2', '2026-11-15 11:00:00Z', '{}')
  `);
  const agendaRange = { from: "2026-11-14", to: "2026-11-14" };
  const followingDay = "2026-11-15";
  const readVisibleRevision = () => readAppointmentRangeRevision(agendaRange.from, agendaRange.to);
  const readFollowingRevision = () => readAppointmentRangeRevision(followingDay, followingDay);

  await t.test("a saved status changes only the affected agenda day", async () => {
    const before = await readVisibleRevision();
    const followingRevision = await readFollowingRevision();
    const result = await saveAppointmentStatus("booking-0", {
      status: "IN_ATTESA",
      updatedBy: "Operatrice test",
      trackServiceTime: true,
      agendaRange,
    });

    const after = await readVisibleRevision();
    assert.notEqual(before, after);
    assert.deepEqual(result.agendaRevision, { before, after });
    assert.equal(await readFollowingRevision(), followingRevision);

    const outOfRange = await saveAppointmentStatus("booking-2", {
      status: "INIZIATO",
      updatedBy: "Operatrice test",
      agendaRange,
    });
    assert.deepEqual(outOfRange.agendaRevision, { before: after, after });
    assert.equal(await readVisibleRevision(), after);
    assert.notEqual(await readFollowingRevision(), followingRevision);
  });

  await t.test("the projected team or office note revision matches a committed edit in the visible range", async () => {
    const teammates = [{ id: "worker-b", name: "Operatrice B", photoUrl: null }];
    const noteText = "Nota aggiornata";
    await prisma.setting.create({
      data: {
        key: "appointment_team_overrides",
        value: { "booking-0": { teammates: [{ id: "worker-a", name: "Operatrice A", photoUrl: null }] } },
      },
    });
    const edits = [
      {
        bookingId: "booking-0",
        key: "appointment_team_overrides",
        value: { "booking-0": { teammates, updatedAt: "2026-11-14T10:00:00Z" } },
        change: { kind: "team", teammates },
      },
      ...["booking-0", "booking-2"].map(bookingId => ({
        bookingId,
        key: `appointment_office_note:${bookingId}`,
        value: { text: noteText },
        change: { kind: "office-note" as const, text: noteText },
      })),
    ] as const satisfies ReadonlyArray<{
      bookingId: string;
      key: string;
      value: Prisma.InputJsonObject;
      change: Parameters<typeof readAppointmentEditRevisions>[3];
    }>;

    for (const { bookingId, key, value, change } of edits) {
      const before = await readVisibleRevision();
      const beforeFollowingDay = await readFollowingRevision();
      const projected = await prisma.$transaction(async (tx) => {
        const revisions = await readAppointmentEditRevisions(tx, agendaRange, bookingId, change);
        await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
        return revisions;
      });

      const after = await readVisibleRevision();
      const afterFollowingDay = await readFollowingRevision();
      const editedVisibleDay = bookingId !== "booking-2";
      assert.deepEqual(projected, { before, after });
      assert.equal(before !== after, editedVisibleDay);
      assert.equal(beforeFollowingDay !== afterFollowingDay, !editedVisibleDay);
    }
  });

  await t.test("upstream status updates affect the revision only without a local status", async () => {
    const updatePayload = async (bookingId: string, payload: Record<string, string | boolean>) => {
      await maintenance.query(
        `UPDATE ${schema}.appointment_archive SET payload = payload || $2::jsonb WHERE id = $1`,
        [bookingId, JSON.stringify(payload)],
      );
    };

    const upstreamUpdates: Record<string, string>[] = [
      { status: "IN_ATTESA" },
      { attendance: "IN_ATTESA" },
      { confirmation_status: "CONFIRMED" },
    ];
    for (const payload of upstreamUpdates) {
      const before = await readVisibleRevision();
      await updatePayload("booking-0", payload);
      assert.equal(await readVisibleRevision(), before);
      await updatePayload("booking-external", payload);
      assert.notEqual(await readVisibleRevision(), before);
    }

    const beforeCancellation = await readVisibleRevision();
    await updatePayload("booking-0", { is_canceled: true });
    assert.notEqual(await readVisibleRevision(), beforeCancellation);
  });

  await t.test("a concurrent office note cannot be acknowledged as the status change", async () => {
    const before = await readVisibleRevision();
    // Pause the real UPDATE in its transaction while an independent edit commits.
    await maintenance.query(`
      CREATE FUNCTION ${schema}.pause_status_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM pg_advisory_xact_lock(hashtext(TG_TABLE_SCHEMA));
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER pause_status_update BEFORE UPDATE ON ${schema}.settings
        FOR EACH ROW WHEN (OLD.key = 'appointment_status_overrides')
        EXECUTE FUNCTION ${schema}.pause_status_update()
    `);
    await maintenance.query("SELECT pg_advisory_lock(hashtext($1))", [schema]);
    const saving = saveAppointmentStatus("booking-0", {
      status: "INIZIATO",
      updatedBy: "Operatrice test",
      trackServiceTime: true,
      agendaRange,
    });
    void saving.catch(() => {}); // Await the outcome after releasing the lock.
    let result: Awaited<typeof saving>;
    try {
      const deadline = AbortSignal.timeout(3_000);
      while (!deadline.aborted) {
        const { rows: [{ blocked }] } = await maintenance.query<{ blocked: boolean }>(`
          SELECT EXISTS (
            SELECT 1 FROM pg_locks
            WHERE locktype = 'advisory' AND NOT granted
              AND pg_backend_pid() = ANY(pg_blocking_pids(pid))
          ) AS blocked
        `);
        if (blocked) break;
        await sleep(15);
      }
      assert.equal(deadline.aborted, false, "Status update reached the advisory lock");
      await maintenance.query(
        `INSERT INTO ${schema}.settings (id, key, value) VALUES ($1, $2, $3::jsonb)`,
        [randomUUID(), "appointment_office_note:booking-1", JSON.stringify({ text: "Nuova nota" })],
      );
    } finally {
      await maintenance.query("SELECT pg_advisory_unlock(hashtext($1))", [schema]);
      result = await saving;
    }

    const { agendaRevision } = result;
    const finalRevision = await readVisibleRevision();
    assert.ok(agendaRevision);
    assert.equal(agendaRevision.before, before);
    assert.notEqual(agendaRevision.after, finalRevision);
    await maintenance.query(
      `DELETE FROM ${schema}.settings WHERE key = $1`,
      ["appointment_office_note:booking-1"],
    );
    assert.equal(agendaRevision.after, await readVisibleRevision());
  });
});
