import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { type TestContext } from "node:test";
import bcrypt from "bcryptjs";
import { NextRequest, type NextResponse } from "next/server";
import { POST as enterPin } from "../app/api/appointments/pc/pin-entry/route";
import { POST as recordActivity } from "../app/api/appointments/pc/activity/route";
import { POST as logout } from "../app/api/appointments/pc/logout/route";
import {
  appointmentsPcCookieName,
  appointmentsPcWorkerCookieName,
  type PCAccessMode,
} from "../lib/appointments-pc-auth";
import { appointmentPcArrivalCookieName, verifyAppointmentPcArrival } from "../lib/appointment-pc-arrival-session";
import { appointmentPcReceptionCookieName, verifyAppointmentPcReception } from "../lib/appointment-pc-reception-session";
import { prisma } from "../lib/prisma";

const ORIGIN = "https://staff.example.test";
const NOW = Date.parse("2026-11-18T10:00:00.000Z");
const MIDNIGHT = Date.parse("2026-11-18T23:00:00.000Z");
const SECRET = "synthetic-reception-login-secret";
const PIN = "7142";
const PIN_HASH = bcrypt.hashSync(PIN, 4);
let fixtureNumber = 0;

function fixture(t: TestContext, options: { mode?: PCAccessMode; receptionist?: boolean; clockedIn?: boolean } = {}) {
  const suffix = ++fixtureNumber;
  const token = `synthetic-reception-login-device-${suffix}`;
  const locationId = `fixture-repubblica-${suffix}`;
  const user = {
    id: `fixture-reception-login-user-${suffix}`,
    name: `Reception fixture ${suffix}`,
    email: null,
    role: "DIPENDENTE",
    mansione: options.receptionist === false ? "Parrucchiera" : "Receptionist",
    sede_id: locationId,
    pin_hash: PIN_HASH,
    photo_url: null,
    attendance_logs: options.clockedIn
      ? [{ type: "ENTRATA", timestamp: new Date(NOW - 60_000), location_id: locationId }]
      : [],
  };
  const world = { candidates: [user], userQueries: 0 };
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = SECRET;
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const original = {
    setting: prisma.setting.findUnique,
    location: prisma.location.findUnique,
    locations: prisma.location.findMany,
    candidates: prisma.user.findMany,
    user: prisma.user.findFirst,
  };
  t.after(() => {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
    prisma.setting.findUnique = original.setting;
    prisma.location.findUnique = original.location;
    prisma.location.findMany = original.locations;
    prisma.user.findMany = original.candidates;
    prisma.user.findFirst = original.user;
  });
  prisma.setting.findUnique = (async ({ where }: { where: { key: string } }) => {
    assert.equal(where.key, "appointments_authorized_pcs");
    return { value: [{
      code: `fixture-reception-login-code-${suffix}`,
      name: "PC Reception fixture",
      locationId,
      accessMode: options.mode ?? "reception",
      accessTokenHash: createHash("sha256").update(token).digest("hex"),
      archivedAt: null,
    }] };
  }) as unknown as typeof original.setting;
  prisma.location.findUnique = (async ({ where }: { where: { id: string } }) => {
    assert.equal(where.id, locationId);
    return { id: locationId, active: true, name: "Salone Repubblica" };
  }) as unknown as typeof original.location;
  prisma.location.findMany = (async () => [
    { id: locationId, active: true, name: "Salone Repubblica" },
  ]) as unknown as typeof original.locations;
  prisma.user.findMany = (async () => world.candidates) as unknown as typeof original.candidates;
  prisma.user.findFirst = (async ({ where }: { where: { id: string; active: boolean } }) => {
    world.userQueries++;
    assert.equal(where.active, true);
    return world.candidates.find(candidate => candidate.id === where.id) ?? null;
  }) as unknown as typeof original.user;
  return { token, locationId, user, world };
}

function request(path: string, cookies: Record<string, string>, body: object = {}) {
  return new NextRequest(`${ORIGIN}/api/appointments/pc/${path}`, {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      "Content-Type": "application/json",
      Cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join("; "),
    },
    body: JSON.stringify(body),
  });
}

function operatorCookies(response: NextResponse) {
  return Object.fromEntries(response.cookies.getAll().map(({ name, value }) => [name, value]));
}

test("Reception personal PIN issues only device-bound operator cookies until Rome midnight", async t => {
  const { token, locationId, user } = fixture(t);
  const response = await enterPin(request("pin-entry", { [appointmentsPcCookieName]: token }, { pin: PIN, salone: "repubblica" }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.worker.id, user.id);
  assert.equal(body.worker.arrivalOnly, true);
  assert.equal(body.appointmentUrl, `/appointments/repubblica?worker=${encodeURIComponent(user.name)}`);
  assert.deepEqual(response.cookies.getAll().map(cookie => cookie.name).sort(), [
    appointmentPcArrivalCookieName, appointmentPcReceptionCookieName, appointmentsPcWorkerCookieName,
  ].sort());
  const workerCookie = response.cookies.get(appointmentsPcWorkerCookieName)!;
  const receptionCookie = response.cookies.get(appointmentPcReceptionCookieName)!;
  assert.equal(workerCookie.value, user.id);
  assert.equal(workerCookie.maxAge, (MIDNIGHT - NOW) / 1000);
  assert.equal(receptionCookie.maxAge, workerCookie.maxAge);
  assert.equal(receptionCookie.httpOnly, true);
  assert.equal(receptionCookie.sameSite, "lax");
  assert.equal(receptionCookie.path, "/");
  assert.equal(response.cookies.get(appointmentPcArrivalCookieName)?.maxAge, 0);
  assert.equal(response.cookies.get(appointmentsPcCookieName), undefined);
  assert.deepEqual(verifyAppointmentPcReception(receptionCookie.value, token, locationId, SECRET), {
    userId: user.id, expiresAt: MIDNIGHT,
  });
  assert.equal(verifyAppointmentPcReception(receptionCookie.value, "different-device", locationId, SECRET), null);
  assert.equal(verifyAppointmentPcReception(receptionCookie.value, token, "different-site", SECRET), null);
  assert.equal(verifyAppointmentPcReception(receptionCookie.value.replace(user.id, "different-user"), token, locationId, SECRET), null);
});

test("the identical Reception PIN on a worker-purpose device retains the five-minute session", async t => {
  const { token, user } = fixture(t, { mode: "worker", clockedIn: true });
  const response = await enterPin(request("pin-entry", { [appointmentsPcCookieName]: token }, { pin: PIN, salone: "repubblica" }));
  assert.equal(response.status, 200);
  assert.equal(response.cookies.get(appointmentsPcWorkerCookieName)?.value, user.id);
  assert.equal(response.cookies.get(appointmentsPcWorkerCookieName)?.maxAge, 300);
  assert.equal(response.cookies.get(appointmentPcReceptionCookieName)?.value, "");
  assert.equal(response.cookies.get(appointmentPcReceptionCookieName)?.maxAge, 0);
  const arrival = response.cookies.get(appointmentPcArrivalCookieName)!;
  assert.equal(arrival.maxAge, 300);
  assert.deepEqual(verifyAppointmentPcArrival(arrival.value, token, SECRET), { userId: user.id, arrivalOnly: false });
  t.mock.timers.tick(300_000);
  assert.equal(verifyAppointmentPcArrival(arrival.value, token, SECRET), null);
});

test("an ordinary clocked-in worker cannot enter through a Reception-purpose device", async t => {
  const { token } = fixture(t, { receptionist: false, clockedIn: true });
  const response = await enterPin(request("pin-entry", { [appointmentsPcCookieName]: token }, { pin: PIN, salone: "repubblica" }));
  assert.equal(response.status, 403);
  assert.equal(response.cookies.getAll().length, 0);
});

test("a duplicate full PIN cannot select either Reception identity", async t => {
  const { token, user, world } = fixture(t);
  world.candidates.push({ ...user, id: `${user.id}-duplicate`, name: "Second Reception fixture" });
  const response = await enterPin(request("pin-entry", { [appointmentsPcCookieName]: token }, { pin: PIN, salone: "repubblica" }));
  assert.equal(response.status, 403);
  assert.equal(response.cookies.getAll().length, 0);
});

for (const [name, pin, authorized, expectedStatus] of [
  ["a PIN prefix", "71", true, 400],
  ["a wrong full PIN", "0000", true, 403],
  ["an unauthorized device", PIN, false, 401],
] as const) {
  test(`${name} never creates an operator or admin session`, async t => {
    const { token } = fixture(t);
    const response = await enterPin(request("pin-entry", {
      [appointmentsPcCookieName]: authorized ? token : `unauthorized-${token}`,
    }, { pin, salone: "repubblica" }));
    assert.equal(response.status, expectedStatus);
    assert.equal(response.cookies.getAll().length, 0);
  });
}

test("Reception activity remains valid after five minutes without renewing any cookie or expiry", async t => {
  const { token } = fixture(t);
  const login = await enterPin(request("pin-entry", { [appointmentsPcCookieName]: token }, { pin: PIN, salone: "repubblica" }));
  assert.equal(login.status, 200);
  const cookies = { [appointmentsPcCookieName]: token, ...operatorCookies(login) };
  t.mock.timers.tick(5 * 60_000 + 1);
  const response = await recordActivity(request("activity", cookies, { activityAgeMs: 5 * 60_000 + 1 }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, expiresAt: MIDNIGHT });
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.cookies.getAll().length, 0);
});

test("Reception activity rejects the signed daily grant at Rome midnight", async t => {
  const { token, world } = fixture(t);
  const login = await enterPin(request("pin-entry", { [appointmentsPcCookieName]: token }, { pin: PIN, salone: "repubblica" }));
  assert.equal(login.status, 200);
  t.mock.timers.tick(MIDNIGHT - NOW);
  const response = await recordActivity(request("activity", {
    [appointmentsPcCookieName]: token, ...operatorCookies(login),
  }, { activityAgeMs: 0 }));
  assert.equal(response.status, 401);
  assert.equal(response.cookies.getAll().length, 0);
  assert.equal(world.userQueries, 0);
});

test("explicit logout clears all operator grants while preserving the activated device", async t => {
  const { token } = fixture(t);
  const login = await enterPin(request("pin-entry", { [appointmentsPcCookieName]: token }, { pin: PIN, salone: "repubblica" }));
  assert.equal(login.status, 200);
  const response = await logout(request("logout", {
    [appointmentsPcCookieName]: token,
    ...operatorCookies(login),
    [appointmentPcArrivalCookieName]: "previous-short-arrival-grant",
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { redirectTo: "/appointments/repubblica?choose=1" });
  assert.deepEqual(response.cookies.getAll().map(cookie => cookie.name).sort(), [
    appointmentsPcWorkerCookieName, appointmentPcArrivalCookieName, appointmentPcReceptionCookieName,
  ].sort());
  for (const cookie of response.cookies.getAll()) {
    assert.equal(cookie.value, "");
    assert.equal(cookie.maxAge, 0);
  }
  assert.equal(response.cookies.get(appointmentsPcCookieName), undefined);
});
