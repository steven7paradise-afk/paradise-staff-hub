import assert from "node:assert/strict";
import test from "node:test";
import { readAppointmentRangeRevision } from "../lib/appointment-range-revision";
import { prisma } from "../lib/prisma";

test("live agenda revisions use the selected Rome dates across a month and daylight saving change", async (t) => {
  const revision = "0123456789abcdef0123456789abcdef";
  const original = prisma.$queryRaw;
  let dates: Date[] = [];
  let months: string[] = [];
  prisma.$queryRaw = (async (_query: TemplateStringsArray, ...values: unknown[]) => {
    dates = values.filter((value): value is Date => value instanceof Date);
    months = values.find(Array.isArray) || [];
    return [{ revision }];
  }) as unknown as typeof prisma.$queryRaw;
  t.after(() => { prisma.$queryRaw = original; });

  assert.equal(await readAppointmentRangeRevision("2026-10-25", "2026-11-01"), revision);
  assert.deepEqual(dates.map((date) => date.toISOString()), [
    "2026-10-24T22:00:00.000Z",
    "2026-11-01T22:59:59.999Z",
  ]);
  assert.deepEqual(months, ["2026-10", "2026-11"]);
});

test("invalid or overlong agenda ranges are rejected before querying bookings", async (t) => {
  const original = prisma.$queryRaw;
  const query = t.mock.fn(async () => []);
  prisma.$queryRaw = query as unknown as typeof prisma.$queryRaw;
  t.after(() => { prisma.$queryRaw = original; });

  await assert.rejects(readAppointmentRangeRevision("2026-02-30", "2026-03-01"));
  await assert.rejects(readAppointmentRangeRevision("2026-03-02", "2026-03-01"));
  await assert.rejects(readAppointmentRangeRevision("2026-01-01", "2027-01-01"));
  assert.equal(query.mock.callCount(), 0);
});
