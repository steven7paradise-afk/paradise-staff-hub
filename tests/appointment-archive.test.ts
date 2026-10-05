import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { readAppointmentArchive, syncAppointmentArchive } from "../lib/appointment-archive";

function mockMethod(t: any, target: any, key: string, implementation: (...args: any[]) => any) {
  const previous = target[key];
  const mock = t.mock.fn(implementation);
  target[key] = mock;
  t.after(() => { target[key] = previous; });
  return mock;
}

test("archive read is paginated and works without any external service", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("External reads forbidden"); });
  mockMethod(t, prisma.appointmentArchive, "count", async () => 1214);
  const find = mockMethod(t, prisma.appointmentArchive, "findMany", async () => [{ payload: { id: "test", start_date: "2026-09-01T10:00:00Z" }, sheet: null }]);
  mockMethod(t, prisma.appointmentArchiveSync, "findMany", async () => [{ month: "2026-09", completed_at: new Date(), lease_until: null, error: false }]);
  const result = await readAppointmentArchive("2026-09-01", "2026-09-30", { page: 2, search: "Rosa" });
  assert.equal(result.ready, true);
  assert.equal(result.count, 1214);
  assert.equal(result.bookings[0].id, "test");
  const args = find.mock.calls[0].arguments[0] as any;
  assert.equal(args.take, 100); assert.equal(args.skip, 100);
  assert.equal(args.where.search_text.contains, "Rosa");
});

test("failed upstream import does not overwrite or delete the saved archive", async t => {
  const originalToken = process.env.COWLENDAR_API_TOKEN;
  process.env.COWLENDAR_API_TOKEN = "test-only";
  t.after(() => { if (originalToken === undefined) delete process.env.COWLENDAR_API_TOKEN; else process.env.COWLENDAR_API_TOKEN = originalToken; });
  let pages = 0;
  t.mock.method(globalThis, "fetch", async () => {
    if (++pages === 1) return Response.json({ data: [{ id: "test", start_date: "2026-09-01T10:00:00Z" }], pagination: { has_more: true, next_cursor: "page2" } });
    throw new Error("External service offline on page two");
  });
  mockMethod(t, prisma.appointmentArchiveSync, "upsert", async () => ({}));
  const state = mockMethod(t, prisma.appointmentArchiveSync, "updateMany", async () => ({ count: 1 }));
  const transaction = mockMethod(t, prisma, "$transaction", async () => { throw new Error("Must not publish failed import"); });
  t.mock.method(console, "error", () => {});
  await syncAppointmentArchive("2026-09", true);
  assert.equal(transaction.mock.callCount(), 0);
  assert.equal(pages, 2);
  const last = state.mock.calls.at(-1)!.arguments[0] as any;
  assert.equal(last.data.error, true);
  assert.ok(last.data.lease_until > new Date());
});

test("an active import lease prevents duplicate external downloads", async t => {
  const network = t.mock.method(globalThis, "fetch", async () => { throw new Error("Should not fetch"); });
  mockMethod(t, prisma.appointmentArchiveSync, "upsert", async () => ({}));
  mockMethod(t, prisma.appointmentArchiveSync, "updateMany", async () => ({ count: 0 }));
  await syncAppointmentArchive("2026-09", true);
  assert.equal(network.mock.callCount(), 0);
});
