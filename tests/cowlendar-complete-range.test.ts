import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { getCompleteCowlendarBookingsForRange } from "../lib/cowlendar";

const start = "2026-11-14T00:00:00.000Z";
const end = "2026-11-15T00:00:00.000Z";
const booking = (id: string) => ({ id, start_date: "2026-11-14T10:00:00.000Z" });

function withTestToken(t: TestContext) {
  const original = process.env.COWLENDAR_API_TOKEN;
  process.env.COWLENDAR_API_TOKEN = "test-only";
  t.after(() => {
    if (original === undefined) delete process.env.COWLENDAR_API_TOKEN;
    else process.env.COWLENDAR_API_TOKEN = original;
  });
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
    if (cursors.length === 2) return new Response(null, { status: 429 });
    return Response.json({
      data: [booking("second")],
      pagination: { has_more: false, next_cursor: null },
    });
  });

  const result = await getCompleteCowlendarBookingsForRange(start, end);
  assert.deepEqual(result.map((item) => item.id), ["first", "second"]);
  assert.deepEqual(cursors, [null, "next", "next"]);
});

test("a long Retry-After prevents immediate requests", async (t) => {
  withTestToken(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response(null, {
    status: 429,
    headers: { "Retry-After": "60" },
  }));

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
