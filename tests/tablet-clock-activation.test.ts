import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { Prisma } from "@prisma/client";
import { NextRequest, type NextResponse } from "next/server";
import { GET, POST } from "../app/api/devices/activate/route";
import { prisma } from "../lib/prisma";
import { hashTabletToken, tabletCookieName, tabletDeviceCookieName } from "../lib/tablet-auth";

const activationUrl = "https://staff.example.test/api/devices/activate";
const originalLink = "a".repeat(64);
const replacementLink = "b".repeat(64);
const salonIp = "192.0.2.12";
const differentIp = "192.0.2.24";

function activationRequest(token = originalLink, ip = salonIp) {
  return new NextRequest(activationUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ token }),
  });
}

function verificationRequest(cookies = "", ip = salonIp) {
  return new NextRequest(activationUrl, {
    headers: { cookie: cookies, "x-forwarded-for": ip },
  });
}

function activationCookies(response: NextResponse) {
  const access = response.cookies.get(tabletCookieName);
  const device = response.cookies.get(tabletDeviceCookieName);
  assert.ok(access && device);
  for (const cookie of [access, device]) {
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.path, "/");
    assert.equal(cookie.sameSite, "lax");
    assert.equal(cookie.secure, process.env.NODE_ENV === "production");
  }
  return {
    accessToken: access.value,
    deviceId: device.value,
    header: `${access.name}=${access.value}; ${device.name}=${device.value}`,
  };
}

function fixture(t: TestContext, options?: { concurrent?: boolean; beforeWrite?: (device: DeviceRow) => void }) {
  const device: DeviceRow = {
    id: "clock-tablet-row",
    device_id: "PB-FIXTURE0",
    status: "BLOCKED",
    enrollment_token_hash: hashTabletToken(originalLink),
    enrollment_expires_at: new Date(Date.now() + 60_000),
    archived_at: null,
    access_token_hash: null,
    registered_ip: null,
    activated_at: null,
  };
  let allowReadsToContinue: (() => void) | undefined;
  const pendingReads = new Promise<void>((resolve) => { allowReadsToContinue = resolve; });
  let reads = 0;
  let lookupError = false;

  function eligible(where: Prisma.DeviceWhereInput) {
    assert.equal(where.archived_at, null);
    const deadline = (where.enrollment_expires_at as Prisma.DateTimeNullableFilter).gt;
    assert.ok(deadline instanceof Date);
    return device.enrollment_token_hash === where.enrollment_token_hash
      && device.archived_at === null
      && Boolean(device.enrollment_expires_at && device.enrollment_expires_at > deadline);
  }

  const findFirst = prisma.device.findFirst;
  const updateMany = prisma.device.updateMany;
  const findUnique = prisma.device.findUnique;
  t.after(() => {
    prisma.device.findFirst = findFirst;
    prisma.device.updateMany = updateMany;
    prisma.device.findUnique = findUnique;
  });
  prisma.device.findFirst = (async ({ where }: { where: Prisma.DeviceWhereInput }) => {
    if (!eligible(where)) return null;
    const snapshot = { ...device };
    if (options?.concurrent) {
      if (++reads === 2) allowReadsToContinue?.();
      await pendingReads;
    }
    return snapshot;
  }) as unknown as typeof findFirst;
  prisma.device.updateMany = (async ({ where, data }: {
    where: Prisma.DeviceWhereInput;
    data: Partial<DeviceRow>;
  }) => {
    options?.beforeWrite?.(device);
    if (where.id !== device.id || !eligible(where)) return { count: 0 };
    Object.assign(device, data);
    return { count: 1 };
  }) as unknown as typeof updateMany;
  prisma.device.findUnique = (async ({ where }: {
    where: Prisma.DeviceWhereUniqueInput;
  }) => {
    if (lookupError) throw new Error("simulated database failure");
    return where.device_id === device.device_id ? { ...device } : null;
  }) as unknown as typeof findUnique;
  return { device, failLookup() { lookupError = true; } };
}

type DeviceRow = {
  id: string;
  device_id: string;
  status: "ACTIVE" | "BLOCKED";
  enrollment_token_hash: string | null;
  enrollment_expires_at: Date | null;
  archived_at: Date | null;
  access_token_hash: string | null;
  registered_ip: string | null;
  activated_at: Date | null;
};

test("activation sets browser credentials and verifies them on the registered network", async (t) => {
  const { device } = fixture(t);
  const response = await POST(activationRequest());
  assert.equal(response.status, 200);
  const cookies = activationCookies(response);
  assert.deepEqual(await response.json(), { deviceId: device.device_id });
  assert.equal(cookies.deviceId, device.device_id);
  assert.equal(device.status, "ACTIVE");
  assert.equal(device.registered_ip, salonIp);
  assert.equal(device.access_token_hash, hashTabletToken(cookies.accessToken));
  assert.equal(device.enrollment_token_hash, null);
  assert.equal(device.enrollment_expires_at, null);

  const verification = await GET(verificationRequest(cookies.header));
  assert.equal(verification.status, 200);
  assert.deepEqual(await verification.json(), { deviceId: device.device_id });
  assert.match(verification.headers.get("cache-control") ?? "", /no-store/i);
  assert.equal((await GET(verificationRequest(cookies.header, differentIp))).status, 403);
});

test("reactivation rotates the access credential and registers the new network", async (t) => {
  const { device } = fixture(t);
  const old = activationCookies(await POST(activationRequest()));
  device.enrollment_token_hash = hashTabletToken(replacementLink);
  device.enrollment_expires_at = new Date(Date.now() + 60_000);
  const updated = activationCookies(await POST(activationRequest(replacementLink, differentIp)));
  assert.notEqual(updated.accessToken, old.accessToken);
  assert.equal(updated.deviceId, old.deviceId);
  assert.equal((await GET(verificationRequest(updated.header, differentIp))).status, 200);
  assert.equal((await GET(verificationRequest(old.header, differentIp))).status, 403);
  assert.equal((await GET(verificationRequest(updated.header))).status, 403);
});

test("verification requires both valid cookies and handles unavailable authorization", async (t) => {
  const { device, failLookup } = fixture(t);
  const cookies = activationCookies(await POST(activationRequest()));
  assert.equal((await GET(verificationRequest())).status, 401);
  assert.equal((await GET(verificationRequest(`${tabletDeviceCookieName}=${device.device_id}`))).status, 401);
  assert.equal((await GET(verificationRequest(`${tabletCookieName}=${cookies.accessToken}`))).status, 401);
  const invalid = `${tabletDeviceCookieName}=${device.device_id}; ${tabletCookieName}=${"c".repeat(64)}`;
  assert.equal((await GET(verificationRequest(invalid))).status, 403);
  device.status = "BLOCKED";
  assert.equal((await GET(verificationRequest(cookies.header))).status, 403);
  device.status = "ACTIVE";
  failLookup();
  assert.equal((await GET(verificationRequest(cookies.header))).status, 503);
});

test("simultaneous activation requests cannot overwrite the winning browser credential", { timeout: 2_000 }, async (t) => {
  const { device } = fixture(t, { concurrent: true });
  const responses = await Promise.all([POST(activationRequest()), POST(activationRequest())]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 410]);
  const winner = activationCookies(responses.find((response) => response.status === 200)!);
  const rejected = responses.find((response) => response.status === 410)!;
  assert.equal(rejected.cookies.get(tabletCookieName), undefined);
  assert.equal(device.access_token_hash, hashTabletToken(winner.accessToken));
  assert.equal((await GET(verificationRequest(winner.header))).status, 200);
});

test("an enrollment expired or replaced after lookup cannot be consumed", async (t) => {
  for (const change of ["expired", "replaced", "archived"] as const) {
    await t.test(change, async (subtest) => {
      const { device } = fixture(subtest, {
        beforeWrite(row) {
          if (change === "expired") row.enrollment_expires_at = new Date(0);
          if (change === "replaced") row.enrollment_token_hash = hashTabletToken(replacementLink);
          if (change === "archived") row.archived_at = new Date();
        },
      });
      const response = await POST(activationRequest());
      assert.equal(response.status, 410);
      assert.equal(response.cookies.get(tabletCookieName), undefined);
      assert.equal(device.status, "BLOCKED");
      assert.equal(device.access_token_hash, null);
    });
  }
});
