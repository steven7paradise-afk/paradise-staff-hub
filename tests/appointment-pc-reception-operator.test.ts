import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { findAppointmentPcReceptionOperator } from "../lib/appointment-pc-reception-operator";
import { signAppointmentPcReception } from "../lib/appointment-pc-reception-session";
import type { AttendanceStateLog } from "../lib/attendance-state";
import { FORMER_EMPLOYEE_STATUS } from "../lib/former-employee";
import { prisma } from "../lib/prisma";

const NOW = Date.parse("2026-11-18T13:30:00.000Z");
const USER = "fixture-receptionist";
const DEVICE = "fixture-reception-device";
const SECRET = "synthetic-reception-resolver-secret";
const PC = { locationId: "fixture-repubblica", accessMode: "reception" as const };

function fixture(t: TestContext) {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = SECRET;
  t.mock.method(Date, "now", () => NOW);
  const findUser = prisma.user.findFirst;
  const findLocation = prisma.location.findUnique;
  const listLocations = prisma.location.findMany;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
    prisma.user.findFirst = findUser;
    prisma.location.findUnique = findLocation;
    prisma.location.findMany = listLocations;
  });
  const world = {
    user: {
      id: USER, name: "Reception demo", email: "reception@example.test", photo_url: null,
      role: "DIPENDENTE", mansione: "Receptionist", sede_id: PC.locationId as string | null,
      active: true, employee_status: "Attivo",
    },
    logs: [] as AttendanceStateLog[],
    location: { id: PC.locationId, name: "Salone Repubblica", active: true },
    legacy: { id: "fixture-legacy", name: "Corso Buenos Aires", active: false },
    userQueries: 0,
  };
  prisma.location.findUnique = (async ({ where }: { where: { id: string } }) => {
    assert.equal(where.id, PC.locationId);
    return world.location;
  }) as unknown as typeof findLocation;
  prisma.location.findMany = (async () => [
    world.location, world.legacy, { id: "fixture-duomo", name: "Salone Duomo", active: true },
  ]) as unknown as typeof listLocations;
  prisma.user.findFirst = (async (args: {
    where: { id: string; active: boolean; employee_status: { not: string } };
    select: { attendance_logs: { where: { date: { gte: Date; lt: Date }; timestamp: { lte: Date } } } };
  }) => {
    world.userQueries++;
    assert.equal(args.where.id, USER);
    assert.equal(args.where.active, true);
    assert.equal(args.where.employee_status.not, FORMER_EMPLOYEE_STATUS);
    const window = args.select.attendance_logs.where;
    assert.equal(window.date.gte.toISOString(), "2026-11-18T00:00:00.000Z");
    assert.equal(window.date.lt.toISOString(), "2026-11-19T00:00:00.000Z");
    assert.equal(window.timestamp.lte.getTime(), NOW);
    return world.user.active && world.user.employee_status !== FORMER_EMPLOYEE_STATUS
      ? { ...world.user, attendance_logs: world.logs.filter(log => new Date(log.timestamp).getTime() <= NOW) }
      : null;
  }) as unknown as typeof findUser;
  const grant = signAppointmentPcReception(USER, PC.locationId, DEVICE, SECRET, NOW);
  return { world, grant, resolve: () => findAppointmentPcReceptionOperator(PC, DEVICE, grant.token) };
}

test("Reception keeps the personal role and rechecks current attendance without another PIN", async t => {
  const { world, grant, resolve } = fixture(t);
  const first = await resolve();
  assert.deepEqual(first, {
    id: USER, name: world.user.name, email: world.user.email, photo_url: null,
    role: "DIPENDENTE", mansione: "Receptionist", sede_id: PC.locationId,
    arrivalOnly: true, expiresAt: grant.expiresAt,
  });
  world.logs = [{ type: "ENTRATA", timestamp: "2026-11-18T08:00:00Z" }];
  assert.equal((await resolve())?.arrivalOnly, false);
  world.logs.push({ type: "PAUSA", timestamp: "2026-11-18T12:00:00Z" });
  assert.equal((await resolve())?.arrivalOnly, false);
  world.logs.push({ type: "USCITA", timestamp: "2026-11-18T13:00:00Z" });
  assert.equal((await resolve())?.arrivalOnly, true);
  assert.equal(world.userQueries, 4);
});

test("future attendance cannot turn a limited Reception grant into an in-shift operator", async t => {
  const { world, resolve } = fixture(t);
  world.logs = [{ type: "ENTRATA", timestamp: new Date(NOW + 60_000) }];
  assert.equal((await resolve())?.arrivalOnly, true);
});

test("worker-purpose devices and invalid device/site grants cannot use Reception identity", async t => {
  const { world, grant } = fixture(t);
  assert.equal(await findAppointmentPcReceptionOperator({ ...PC, accessMode: "worker" }, DEVICE, grant.token), null);
  assert.equal(await findAppointmentPcReceptionOperator({ locationId: PC.locationId }, DEVICE, grant.token), null);
  assert.equal(await findAppointmentPcReceptionOperator(PC, "other-device", grant.token), null);
  assert.equal(await findAppointmentPcReceptionOperator({ ...PC, locationId: "other-site" }, DEVICE, grant.token), null);
  assert.equal(await findAppointmentPcReceptionOperator(PC, DEVICE, undefined), null);
  assert.equal(world.userQueries, 0);
});

test("the device salon must remain active Repubblica", async t => {
  const { world, resolve } = fixture(t);
  world.location.active = false;
  assert.equal(await resolve(), null);
  world.location.active = true;
  world.location.name = "Salone Duomo";
  assert.equal(await resolve(), null);
  assert.equal(world.userQueries, 0);
});

test("role and employment revocation immediately invalidate an otherwise signed daily grant", async t => {
  const { world, resolve } = fixture(t);
  assert.ok(await resolve());
  world.user.mansione = "Parrucchiera";
  assert.equal(await resolve(), null);
  world.user.role = "RESPONSABILE";
  assert.equal(await resolve(), null);
  world.user.mansione = "Reception salone";
  world.user.active = false;
  assert.equal(await resolve(), null);
  world.user.active = true;
  world.user.employee_status = FORMER_EMPLOYEE_STATUS;
  assert.equal(await resolve(), null);
});

test("Reception needs an eligible sede and legacy eligibility is rechecked", async t => {
  const { world, resolve } = fixture(t);
  world.user.sede_id = null;
  assert.equal(await resolve(), null);
  world.user.sede_id = "fixture-duomo";
  assert.equal(await resolve(), null);
  world.user.sede_id = world.legacy.id;
  assert.ok(await resolve());
  world.legacy.active = true;
  assert.equal(await resolve(), null);
});

test("existing PIN-only administrators retain their personal role and old attendance/site privilege", async t => {
  const { world, resolve } = fixture(t);
  world.user.mansione = "";
  world.user.sede_id = "fixture-duomo";
  for (const role of ["ADMIN", "SUPER_ADMIN", "ZERO"]) {
    world.user.role = role;
    const operator = await resolve();
    assert.equal(operator?.role, role);
    assert.equal(operator?.arrivalOnly, false);
    assert.equal(operator?.sede_id, "fixture-duomo");
  }
});
