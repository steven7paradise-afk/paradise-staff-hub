import assert from "node:assert/strict";
import test from "node:test";
import { recoverAppointmentArchiveDay } from "../lib/appointment-archive";
import { prisma } from "../lib/prisma";

const day = "2026-11-14";
const makeBooking = (id: string, start_date: string) => ({
  id, start_date, service: { title: "Servizio demo" },
});

test("day recovery inserts only missing bookings and preserves existing archive rows", async (t) => {
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
        makeBooking("next-day", "2026-11-14T23:00:00.000Z"),
      ],
      pagination: { has_more: false, next_cursor: null },
    });
  });
  const findMany = prisma.appointmentArchive.findMany;
  const transaction = prisma.$transaction;
  t.after(() => {
    prisma.appointmentArchive.findMany = findMany;
    prisma.$transaction = transaction;
  });
  prisma.appointmentArchive.findMany = (async (args: { where: { id: { in: string[] } } }) => {
    assert.deepEqual(args.where.id.in, ["existing", "missing"]);
    return [{ id: "existing" }];
  }) as unknown as typeof findMany;
  let inserted = 0;
  prisma.$transaction = (async (save: (tx: unknown) => unknown) => save({
    appointmentArchive: {
      createMany: async ({ data, skipDuplicates }: { data: { id: string }[]; skipDuplicates: boolean }) => {
        assert.equal(skipDuplicates, true);
        assert.deepEqual(data.map(row => row.id), ["missing"]);
        inserted += data.length;
        return { count: data.length };
      },
    },
  })) as unknown as typeof transaction;
  assert.equal(await recoverAppointmentArchiveDay(day), 1);
  assert.equal(inserted, 1);
});
