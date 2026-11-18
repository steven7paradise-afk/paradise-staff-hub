import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { NextRequest } from "next/server";
import ts from "typescript";

const NOW = Date.parse("2026-11-18T22:59:58.500Z");
const MIDNIGHT = Date.parse("2026-11-18T23:00:00.000Z");
const DEVICE_COOKIE = "appointments_pc_token";
const WORKER_COOKIE = "appointments_pc_worker";
const RECEPTION_COOKIE = "appointments_pc_reception_operator";
const PAYMENT_CHANNEL = "fixture_payments_changed";
type TimerCallback = () => void | Promise<void>;

function fixture(mode: "worker" | "reception" = "reception") {
  let now = NOW;
  let timerId = 0;
  const timeouts = new Map<number, { deadline: number; callback: TimerCallback }>();
  const intervals = new Map<number, TimerCallback>();
  const clients: FakeClient[] = [];
  const world = { workerAllowed: true, workerChecks: 0, receptionChecks: 0 };
  class FakeClient extends EventEmitter {
    connected = false;
    ended = 0;
    queries: string[] = [];
    constructor() { super(); clients.push(this); }
    async connect() { this.connected = true; }
    async query(sql: string) { this.queries.push(sql); return []; }
    async end() { this.ended++; }
  }
  const dependencies: Record<string, unknown> = {
    "pg": { Client: FakeClient },
    "@/lib/appointments-pc-auth": {
      appointmentsPcCookieName: DEVICE_COOKIE,
      appointmentsPcWorkerCookieName: WORKER_COOKIE,
      checkPCAuthorization: async (token: string) => {
        assert.equal(token, "fixture-device");
        return { locationId: "fixture-repubblica", accessMode: mode };
      },
      appointmentSalonForPC: async () => "repubblica",
      findAppointmentPcWorker: async (location: string, salon: string, worker: string) => {
        assert.equal(location, "fixture-repubblica");
        assert.equal(salon, "repubblica");
        assert.equal(worker, "fixture-worker");
        world.workerChecks++;
        return world.workerAllowed ? { id: worker } : null;
      },
    },
    "@/lib/prisma": { prisma: { setting: { findUnique: async ({ where }: { where: { key: string } }) => ({ value: `initial-${where.key}` }) } } },
    "@/lib/appointment-archive-range": { archiveMonths: () => ["2026-11"] },
    "@/lib/appointment-date": { appointmentDateKey: () => "2026-11-18" },
    "@/lib/appointment-archive": {},
    "@/lib/appointment-range-revision": { readAppointmentRangeRevision: async () => "fixture-agenda-revision" },
    "@/lib/appointment-realtime": {
      appointmentsRealtimeEnabled: () => true,
      APPOINTMENT_ARCHIVE_INVALIDATION_CHANNEL: "fixture_archive_invalidated",
    },
    "@/lib/salon-live": { APPOINTMENT_ROSTER_EVENTS_CHANNEL: "fixture_roster_changed", APPOINTMENT_ROSTER_REVISION_KEY: "roster" },
    "@/lib/cowlendar": { hasCowlendarToken: () => false },
    "@/lib/operational-session": { getOperationalUser: async () => { throw new Error("Unexpected operational-session fallback"); } },
    "@/lib/roles": {},
    "@/lib/shopify-payment-webhook": { PAYMENT_EVENTS_CHANNEL: PAYMENT_CHANNEL, PAYMENT_REVISION_KEY: "payments" },
    "@/lib/cowlendar-webhook": { APPOINTMENT_EVENTS_CHANNEL: "fixture_appointments_changed", APPOINTMENT_REVISION_KEY: "appointments" },
    "@/lib/appointment-pc-arrival-session": { appointmentPcArrivalCookieName: "appointments_pc_arrival_operator" },
    "@/lib/appointment-pc-arrival-operator": { findAppointmentPcArrivalOperator: async () => null },
    "@/lib/appointment-pc-reception-session": { appointmentPcReceptionCookieName: RECEPTION_COOKIE },
    "@/lib/appointment-pc-reception-operator": {
      findAppointmentPcReceptionOperator: async (_pc: unknown, token: string, grant?: string) => {
        assert.equal(token, "fixture-device");
        world.receptionChecks++;
        return grant === "signed-reception" && now < MIDNIGHT ? { expiresAt: MIDNIGHT } : null;
      },
    },
  };
  const exports: Record<string, unknown> = {};
  const code = ts.transpileModule(readFileSync("app/api/appointments/events/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name: string) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unmocked dependency: ${name}`);
      return dependencies[name];
    },
    Response,
    ReadableStream,
    TextEncoder,
    Date: class extends Date { static now() { return now; } },
    process: { env: { APPOINTMENTS_REALTIME_DATABASE_URL: "postgresql://fixture@127.0.0.1:1/unused" } },
    setTimeout: (callback: TimerCallback, delay: number) => {
      const id = ++timerId;
      timeouts.set(id, { callback, deadline: now + delay });
      return id;
    },
    clearTimeout: (id?: number) => { if (id !== undefined) timeouts.delete(id); },
    setInterval: (callback: TimerCallback) => { const id = ++timerId; intervals.set(id, callback); return id; },
    clearInterval: (id?: number) => { if (id !== undefined) intervals.delete(id); },
  });
  const route = exports as unknown as typeof import("../app/api/appointments/events/route");
  const open = (signed = true) => route.GET(new NextRequest(
    "https://staff.example.test/api/appointments/events?from=2026-11-18&to=2026-11-18&scope=cashier",
    { headers: { Cookie: [
      `${DEVICE_COOKIE}=fixture-device`, `${WORKER_COOKIE}=fixture-worker`,
      ...(signed ? [`${RECEPTION_COOKIE}=signed-reception`] : []),
    ].join("; ") } },
  ));
  return {
    open, clients, world, timeouts, intervals,
    setNow(value: number) { now = value; },
    async dispatchTimeouts() {
      for (const [id, timer] of [...timeouts]) {
        if (timer.deadline > now) continue;
        timeouts.delete(id);
        await timer.callback();
      }
    },
    async heartbeat() {
      for (const callback of [...intervals.values()]) await callback();
    },
  };
}

async function consumeInitialEvents(response: Response) {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  const reader = response.body!.getReader();
  const messages: string[] = [];
  for (let i = 0; i < 3; i++) {
    const next = await reader.read();
    assert.equal(next.done, false);
    messages.push(new TextDecoder().decode(next.value));
  }
  assert.ok(messages[0].includes("event: appointments.changed"));
  assert.ok(messages[1].includes("event: payments.changed"));
  assert.ok(messages[2].includes("event: roster.changed"));
  await Promise.resolve();
  return reader;
}

test("Reception stream closes exactly at Rome midnight instead of retaining the four-minute stream", async () => {
  const f = fixture();
  const reader = await consumeInitialEvents(await f.open());
  assert.equal(f.clients[0].connected, true);
  assert.equal(f.timeouts.size, 1);
  assert.equal([...f.timeouts.values()][0].deadline, MIDNIGHT);
  f.setNow(MIDNIGHT - 1);
  await f.dispatchTimeouts();
  assert.equal(f.clients[0].ended, 0);
  f.setNow(MIDNIGHT);
  await f.dispatchTimeouts();
  assert.equal(f.clients[0].ended, 1);
  assert.equal((await reader.read()).done, true);
  assert.equal(f.intervals.size, 0);
});

test("a queued notification after Reception expiry cannot send data before its timeout is dispatched", async () => {
  const f = fixture();
  const reader = await consumeInitialEvents(await f.open());
  f.setNow(MIDNIGHT);
  assert.equal(f.timeouts.size, 1);
  assert.equal(f.clients[0].ended, 0);
  f.clients[0].emit("notification", { channel: PAYMENT_CHANNEL, payload: "11111111-1111-4111-a111-111111111111" });
  assert.equal((await reader.read()).done, true);
  assert.equal(f.clients[0].ended, 1);
  assert.equal(f.timeouts.size, 0);
});

test("worker streams retain their four-minute limit and worker predicate while unsigned Reception never connects", async () => {
  const worker = fixture("worker");
  const reader = await consumeInitialEvents(await worker.open(false));
  assert.equal(worker.world.workerChecks, 1);
  assert.equal(worker.world.receptionChecks, 0);
  assert.equal([...worker.timeouts.values()][0].deadline, NOW + 240_000);
  await worker.heartbeat();
  assert.equal(worker.world.workerChecks, 2);
  assert.equal(worker.clients[0].ended, 0);
  assert.ok(new TextDecoder().decode((await reader.read()).value).includes(": keepalive"));
  worker.setNow(NOW + 240_000 - 1);
  await worker.dispatchTimeouts();
  assert.equal(worker.clients[0].ended, 0);
  worker.setNow(NOW + 240_000);
  await worker.dispatchTimeouts();
  assert.equal((await reader.read()).done, true);

  const noWorker = fixture("worker");
  noWorker.world.workerAllowed = false;
  assert.equal((await noWorker.open(false)).status, 401);
  assert.equal(noWorker.world.workerChecks, 1);
  assert.equal(noWorker.clients.length, 0);

  const unsignedReception = fixture();
  assert.equal((await unsignedReception.open(false)).status, 401);
  assert.equal(unsignedReception.world.receptionChecks, 1);
  assert.equal(unsignedReception.world.workerChecks, 0);
  assert.equal(unsignedReception.clients.length, 0);
});
