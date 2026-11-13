import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../app/api/appointments/events/route";
import { findAppointmentPcWorker } from "../lib/appointments-pc-auth";
import { prisma } from "../lib/prisma";

const repubblica = { id: "repubblica-test", name: "Salone Repubblica", active: true };
const legacy = { id: "legacy-corso-test", name: "Corso Buenos Aires", active: false };
const otherSalon = { id: "another-salon-test", name: "Salone Duomo", active: true };

test("agenda cashier and live events resolve the same eligible worker", async (t) => {
  const lookup = prisma.user.findFirst;
  const listLocations = prisma.location.findMany;
  t.after(() => { prisma.user.findFirst = lookup; prisma.location.findMany = listLocations; });
  let locationId: string | null = repubblica.id;
  let separateLegacy = false;
  let role = "DIPENDENTE";
  prisma.user.findFirst = (async ({ where }: { where: { active: boolean; employee_status: unknown; OR: unknown } }) => {
    assert.equal(where.active, true);
    assert.ok(where.employee_status);
    assert.deepEqual(where.OR, [{ id: "test-worker" }, { name: "test-worker" }]);
    return { id: "test-worker", name: "Test Worker", sede_id: locationId, role };
  }) as unknown as typeof lookup;
  prisma.location.findMany = (async () => [repubblica, { ...legacy, active: separateLegacy }, otherSalon]) as unknown as typeof listLocations;
  assert.equal(await findAppointmentPcWorker(repubblica.id, "repubblica"), null);
  assert.equal(await findAppointmentPcWorker(repubblica.id, "repubblica", "%malformed"), null);
  assert.equal((await findAppointmentPcWorker(repubblica.id, "repubblica", "test-worker"))?.id, "test-worker");
  locationId = legacy.id;
  assert.equal((await findAppointmentPcWorker(repubblica.id, "repubblica", "test-worker"))?.id, "test-worker");
  separateLegacy = true;
  assert.equal(await findAppointmentPcWorker(repubblica.id, "repubblica", "test-worker"), null);
  locationId = otherSalon.id;
  assert.equal(await findAppointmentPcWorker(repubblica.id, "repubblica", "test-worker"), null);
  role = "ADMIN";
  assert.equal((await findAppointmentPcWorker(repubblica.id, "repubblica", "test-worker"))?.id, "test-worker");
});

test("cashier live scope refuses requests without a device and operator", async (t) => {
  const before = { url: process.env.APPOINTMENTS_REALTIME_DATABASE_URL, enabled: process.env.APPOINTMENTS_REALTIME_ENABLED };
  process.env.APPOINTMENTS_REALTIME_DATABASE_URL = "postgres://127.0.0.1:1/test";
  process.env.APPOINTMENTS_REALTIME_ENABLED = "true";
  t.after(() => {
    if (before.url === undefined) delete process.env.APPOINTMENTS_REALTIME_DATABASE_URL;
    else process.env.APPOINTMENTS_REALTIME_DATABASE_URL = before.url;
    if (before.enabled === undefined) delete process.env.APPOINTMENTS_REALTIME_ENABLED;
    else process.env.APPOINTMENTS_REALTIME_ENABLED = before.enabled;
  });
  const url = "https://staff.example.test/api/appointments/events?from=2026-11-13&to=2026-11-13&scope=cashier";
  assert.equal((await GET(new NextRequest(url))).status, 401);
  assert.equal((await GET(new NextRequest(url, { headers: { Cookie: "appointments_pc_worker=test-worker" } }))).status, 401);
});
