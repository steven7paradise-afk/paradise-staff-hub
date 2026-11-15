import assert from "node:assert/strict";
import test from "node:test";
import { recoverAppointmentArchiveDay, scheduleTodayAppointmentRecovery } from "../lib/appointment-archive";
import { prisma } from "../lib/prisma";

const day = "2026-11-14";
const makeBooking = (id: string, start_date: string) => ({
  id, start_date, service: { title: "Servizio demo" },
});

test("day recovery adds new appointments and moves only a strictly newer booking, preserving local fields", async (t) => {
  const token = process.env.COWLENDAR_API_TOKEN;
  const realtime = process.env.APPOINTMENTS_REALTIME_ENABLED;
  process.env.COWLENDAR_API_TOKEN = "test-only";
  process.env.APPOINTMENTS_REALTIME_ENABLED = "false";
  t.after(() => {
    if (token === undefined) delete process.env.COWLENDAR_API_TOKEN;
    else process.env.COWLENDAR_API_TOKEN = token;
    if (realtime === undefined) delete process.env.APPOINTMENTS_REALTIME_ENABLED;
    else process.env.APPOINTMENTS_REALTIME_ENABLED = realtime;
  });

  t.mock.method(globalThis, "fetch", async (url: string) => {
    const params = new URL(url).searchParams;
    assert.equal(params.get("start"), "2026-11-13T23:00:00.000Z");
    assert.equal(params.get("end"), "2026-11-14T23:00:00.000Z");
    return Response.json({
      data: [
        makeBooking("existing", "2026-11-14T10:30:00.000Z"),
        makeBooking("missing", "2026-11-14T13:00:00.000Z"),
        { ...makeBooking("rescheduled", "2026-11-14T10:30:00.000Z"), updated_at: "2026-11-14T08:31:00Z", order_id: "42" },
        { ...makeBooking("signed", "2026-11-14T10:30:00.000Z"), updated_at: "2026-11-14T08:31:00Z" },
        { ...makeBooking("concurrent", "2026-11-14T10:30:00.000Z"), updated_at: "2026-11-14T08:31:00Z" },
        makeBooking("next-day", "2026-11-14T23:00:00.000Z"),
      ],
      pagination: { has_more: false, next_cursor: null },
    });
  });
  const findMany = prisma.appointmentArchive.findMany;
  const transaction = prisma.$transaction;
  const lookupOrder = prisma.shopifyOrderCache.findMany;
  const query = prisma.$queryRaw;
  prisma.$queryRaw = (async () => [{ deadline_ms: null }]) as unknown as typeof query;
  prisma.shopifyOrderCache.findMany = (async () => [{ order_id: "42", order_name: "#42" }]) as unknown as typeof lookupOrder;
  t.after(() => {
    prisma.appointmentArchive.findMany = findMany;
    prisma.$transaction = transaction;
    prisma.shopifyOrderCache.findMany = lookupOrder;
    prisma.$queryRaw = query;
  });
  const prior = {
    updated_at: "2026-11-14T08:30:00Z", start_date: "2026-11-14T09:30:00Z",
    order_id: "42", archiveOrderName: "#42", legacyNote: "retained",
  };
  prisma.appointmentArchive.findMany = (async (args: { where: { id: { in: string[] } } }) => {
    assert.deepEqual(args.where.id.in, ["existing", "missing", "rescheduled", "signed", "concurrent"]);
    return [
      { id: "existing", payload: prior },
      { id: "rescheduled", payload: prior },
      { id: "signed", payload: { ...prior, archiveWebhookUpdatedAt: Date.parse("2026-11-14T08:32:00Z") } },
      { id: "concurrent", payload: prior },
    ];
  }) as unknown as typeof findMany;
  let inserted = 0;
  const written = t.mock.fn(async (args: {
    where: { id: string; payload: { equals: unknown } };
    data: { start_at: Date; payload: typeof prior; sheet?: unknown };
  }) => {
    assert.deepEqual(args.where.payload.equals, prior);
    assert.equal("sheet" in args.data, false);
    assert.equal(args.data.start_at.toISOString(), "2026-11-14T10:30:00.000Z");
    assert.equal(args.data.payload.legacyNote, "retained");
    if (args.where.id === "concurrent") return { count: 0 };
    assert.equal(args.where.id, "rescheduled");
    assert.equal(args.data.payload.archiveOrderName, "#42");
    return { count: 1 };
  });
  prisma.$transaction = (async (save: (tx: unknown) => unknown) => save({
    appointmentArchive: {
      createMany: async ({ data, skipDuplicates }: { data: { id: string }[]; skipDuplicates: boolean }) => {
        assert.equal(skipDuplicates, true);
        assert.deepEqual(data.map(row => row.id), ["missing"]);
        inserted += data.length;
        return { count: data.length };
      },
      updateMany: written,
    },
  })) as unknown as typeof transaction;
  assert.equal(await recoverAppointmentArchiveDay(day), 2);
  assert.equal(inserted, 1);
  assert.deepEqual(written.mock.calls.map(call => call.arguments[0].where.id), ["rescheduled", "concurrent"]);
});

test("concurrent callers share today's lease and a Cowlendar 429 persists its full cooldown", async (t) => {
  const token = process.env.COWLENDAR_API_TOKEN;
  process.env.COWLENDAR_API_TOKEN = "test-day-rate-limit";
  const query = prisma.$queryRaw;
  const execute = prisma.$executeRaw;
  const update = prisma.setting.updateMany;
  t.after(() => {
    if (token === undefined) delete process.env.COWLENDAR_API_TOKEN;
    else process.env.COWLENDAR_API_TOKEN = token;
    prisma.$queryRaw = query;
    prisma.$executeRaw = execute;
    prisma.setting.updateMany = update;
  });
  const request = t.mock.method(globalThis, "fetch", async () => new Response(null, {
    status: 429, headers: { "Retry-After": "120" },
  }));
  let leaseToken: string | undefined;
  const claim = t.mock.fn(async (_query: TemplateStringsArray, ...values: unknown[]) => {
    leaseToken = values.find((value): value is string => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value));
    return [{ claimed: true, until: null, rate_limited: false }];
  });
  prisma.$queryRaw = (async (sql: TemplateStringsArray, ...values: unknown[]) => sql.join("").includes("AS deadline_ms")
    ? [{ deadline_ms: null }]
    : claim(sql, ...values)) as unknown as typeof query;
  prisma.$executeRaw = (async () => 1) as unknown as typeof execute;
  const record = t.mock.fn(async (args: { where: unknown; data: { value: { until: number; rateLimited: boolean } } }) => ({
    count: args.data.value.rateLimited ? 1 : 0,
  }));
  prisma.setting.updateMany = record as unknown as typeof prisma.setting.updateMany;
  const startedAt = Date.now();

  const first = scheduleTodayAppointmentRecovery();
  assert.equal(scheduleTodayAppointmentRecovery(), first);
  assert.deepEqual(await first, { status: "rate-limited" });
  assert.deepEqual(await scheduleTodayAppointmentRecovery(), { status: "rate-limited" });
  assert.equal(claim.mock.callCount(), 1);
  assert.equal(request.mock.callCount(), 1);
  assert.equal(record.mock.callCount(), 1);
  const stored = record.mock.calls[0].arguments[0];
  assert.deepEqual(stored.where, {
    key: "appointment_archive_day_recovery", value: { path: ["token"], equals: leaseToken },
  });
  assert.equal(stored.data.value.rateLimited, true);
  assert.ok(stored.data.value.until >= startedAt + 120_000);
});
