import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { getCompleteCowlendarBookingsForRange, updateCowlendarBookingStatus } from "../lib/cowlendar";
import { prisma } from "../lib/prisma";

const start = "2026-11-14T00:00:00.000Z";
const end = "2026-11-15T00:00:00.000Z";
const booking = (id: string) => ({ id, start_date: "2026-11-14T10:00:00.000Z" });

let testTime = Date.now();

function withTestToken(t: TestContext, activePauseMs = 0) {
  const original = process.env.COWLENDAR_API_TOKEN;
  process.env.COWLENDAR_API_TOKEN = "test-only";
  let now = testTime += 300_000;
  t.mock.method(Date, "now", () => now);
  const query = prisma.$queryRaw;
  const execute = prisma.$executeRaw;
  const sharedDeadline = activePauseMs ? now + activePauseMs : null;
  const read = t.mock.fn(async () => [{ deadline_ms: sharedDeadline }]);
  const save = t.mock.fn<(...args: [TemplateStringsArray, ...unknown[]]) => Promise<number>>(async () => 1);
  prisma.$queryRaw = read as unknown as typeof query;
  prisma.$executeRaw = save as unknown as typeof execute;
  t.after(() => {
    prisma.$queryRaw = query;
    prisma.$executeRaw = execute;
    if (original === undefined) delete process.env.COWLENDAR_API_TOKEN;
    else process.env.COWLENDAR_API_TOKEN = original;
  });
  return { read, save, advance: (ms: number) => { now += ms; } };
}

test("a rate-limited second page is retried without dropping earlier bookings", async (t) => {
  withTestToken(t);
  const cursors: Array<string | null> = [];

  t.mock.method(globalThis, "fetch", async (input: string) => {
    const cursor = new URL(input).searchParams.get("cursor");
    cursors.push(cursor);
    if (!cursor) {
      return Response.json({
        data: [booking("first")],
        pagination: { has_more: true, next_cursor: "next" },
      });
    }
    if (cursors.length === 2) return new Response(null, { status: 429, headers: { "Retry-After": "0" } });
    return Response.json({
      data: [booking("second")],
      pagination: { has_more: false, next_cursor: null },
    });
  });

  const result = await getCompleteCowlendarBookingsForRange(start, end);
  assert.deepEqual(result.map((item) => item.id), ["first", "second"]);
  assert.deepEqual(cursors, [null, "next", "next"]);
});

test("a long Retry-After is saved and prevents immediate requests", async (t) => {
  const { read, save } = withTestToken(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response(null, {
    status: 429,
    headers: { "Retry-After": "60" },
  }));

  await assert.rejects(getCompleteCowlendarBookingsForRange(start, end), /Cowlendar 429/);
  await assert.rejects(getCompleteCowlendarBookingsForRange(start, end), /Cowlendar 429/);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(read.mock.callCount(), 1);
  assert.equal(save.mock.callCount(), 1);
  const [sql, , key, deadline] = save.mock.calls[0].arguments;
  assert.match(sql.join(""), /ON CONFLICT \(key\) DO UPDATE[\s\S]*< /);
  assert.equal(key, "cowlendar_rate_limit");
  assert.equal(deadline, Date.now() + 60_000);
});

test("an existing shared pause skips both HTTP paths until expiry", async (t) => {
  const { read, save, advance } = withTestToken(t, 60_000);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json({
    data: [booking("after-cooldown")], pagination: { has_more: false, next_cursor: null },
  }));

  await Promise.all([
    assert.rejects(getCompleteCowlendarBookingsForRange(start, end), /Cowlendar 429/),
    assert.rejects(updateCowlendarBookingStatus("demo", "IN_ATTESA"), /Cowlendar 429/),
  ]);
  assert.equal(read.mock.callCount(), 1);
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(save.mock.callCount(), 0);

  advance(60_000);
  assert.equal((await getCompleteCowlendarBookingsForRange(start, end))[0].id, "after-cooldown");
  assert.equal(read.mock.callCount(), 2);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("a 429 from a write also pauses reads and saves the HTTP-date deadline", async (t) => {
  const { save } = withTestToken(t);
  const retryAt = new Date(Date.now() + 120_000).toUTCString();
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response(null, {
    status: 429, headers: { "Retry-After": retryAt },
  }));

  await assert.rejects(updateCowlendarBookingStatus("demo", "IN_ATTESA"), /Cowlendar 429/);
  await assert.rejects(getCompleteCowlendarBookingsForRange(start, end), /Cowlendar 429/);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(save.mock.calls[0].arguments[3], Date.parse(retryAt));
});

test("an unspecified rate limit also pauses other complete-range requests", async (t) => {
  withTestToken(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 429 }));
  await assert.rejects(getCompleteCowlendarBookingsForRange(start, end), /Cowlendar 429/);
  await assert.rejects(getCompleteCowlendarBookingsForRange(start, end), /Cowlendar 429/);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("a page without documented pagination cannot replace a complete snapshot", async (t) => {
  withTestToken(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ data: [booking("first")] }));

  await assert.rejects(getCompleteCowlendarBookingsForRange(start, end), /Calendario incompleto/);
});

test("the overall deadline aborts an upstream retry", async (t) => {
  withTestToken(t);
  const controller = new AbortController();
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    setTimeout(() => controller.abort(), 10);
    return new Response(null, { status: 503 });
  });

  await assert.rejects(getCompleteCowlendarBookingsForRange(start, end, controller.signal), { name: "AbortError" });
  assert.equal(fetchMock.mock.callCount(), 1);
});
