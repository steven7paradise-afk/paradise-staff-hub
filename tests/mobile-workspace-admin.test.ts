import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { POST } from "../app/api/mobile/workspace/admin/route";

test("salon admin requires full PIN and issues a short, device-bound session", async () => {
  const originalTransaction = prisma.$transaction;
  const originalSetting = prisma.setting.findUnique;
  const originalDelete = prisma.setting.deleteMany;
  const originalUser = prisma.user.findFirst;
  const originalCreate = prisma.mobileSession.create;
  const fixtureDevice = "admin-test-device";
  let attempts: { count: number; until: number } | null = null;
  let issued: { device_name?: string | null; expires_at: Date; token_hash: string } | null = null;
  let mustChangePassword = false;
  const pinHash = await bcrypt.hash("654321", 4);
  const request = (pin: string, device = fixtureDevice) => new Request("https://example.test/api/mobile/workspace/admin", {
    method: "POST", headers: { "Content-Type": "application/json", "x-paradise-device": device }, body: JSON.stringify({ pin }),
  });
  try {
    prisma.setting.findUnique = (async () => ({ value: [{ code: "admin-fixture-code", name: "iPhone test", locationId: "salon-1", archivedAt: null,
      accessTokenHash: createHash("sha256").update(fixtureDevice).digest("hex") }] })) as unknown as typeof originalSetting;
    prisma.$transaction = (async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: async () => [],
      setting: {
        findUnique: async () => attempts ? { value: attempts } : null,
        upsert: async ({ update }: { update: { value: typeof attempts } }) => { attempts = update.value; },
      },
    })) as unknown as typeof originalTransaction;
    prisma.setting.deleteMany = (async () => { attempts = null; return { count: 1 }; }) as unknown as typeof originalDelete;
    prisma.user.findFirst = (async () => ({ id: "admin-fixture-user", pin_hash: pinHash, must_change_password: mustChangePassword })) as unknown as typeof originalUser;
    prisma.mobileSession.create = (async ({ data }: { data: typeof issued }) => { issued = data; return data; }) as unknown as typeof originalCreate;
    assert.equal((await POST(request("654321", "unknown-device"))).status, 401);
    assert.equal((await POST(request("65"))).status, 400);
    assert.equal((await POST(request("111111"))).status, 403);
    const before = Date.now();
    const success = await POST(request("654321"));
    assert.equal(success.status, 200);
    const grant = await success.json();
    assert.equal(typeof grant.token, "string");
    const session = issued as unknown as { device_name: string; expires_at: Date; token_hash: string };
    assert.equal(session.device_name, "ios-salon:admin-fixture-code");
    assert.ok(session.expires_at.getTime() >= before + 14 * 60_000);
    assert.ok(session.expires_at.getTime() <= Date.now() + 15 * 60_000);
    assert.equal(session.token_hash, createHash("sha256").update(grant.token).digest("hex"));
    assert.equal(attempts, null);
    mustChangePassword = true;
    assert.equal((await POST(request("654321"))).status, 403);
    mustChangePassword = false;
    for (let index = 0; index < 4; index++) assert.equal((await POST(request("111111"))).status, 403);
    assert.equal((await POST(request("654321"))).status, 429);
  } finally {
    prisma.$transaction = originalTransaction;
    prisma.setting.findUnique = originalSetting;
    prisma.setting.deleteMany = originalDelete;
    prisma.user.findFirst = originalUser;
    prisma.mobileSession.create = originalCreate;
  }
});
