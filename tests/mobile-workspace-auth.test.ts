import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { mobileWorkspace } from "../lib/mobile-workspace-auth";

// Deterministic authentication integration tests. No database or real credentials are used.
test("workspace verifies identity, device binding, expiry and revocation", async (t) => {
  const originalSetting = prisma.setting.findUnique;
  const originalSession = prisma.mobileSession.findUnique;
  const originalLocation = prisma.location.findUnique;
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const deviceToken = "fixture-device-token";
  const token = "fixture-mobile-session";
  let active = true;
  let role = "ADMIN";
  let binding: string | null = "ios-salon:fixture-code";
  let expired = false;
  let revoked = false;
  let passwordChange = false;
  try {
    prisma.setting.findUnique = (async ({ where }: { where: { key: string } }) => where.key === "appointments_authorized_pcs"
      ? { value: [{ code: "fixture-code", name: "Fixture", locationId: "salon-1", accessTokenHash: hash(deviceToken), archivedAt: null }] }
      : null) as unknown as typeof originalSetting;
    prisma.location.findUnique = (async () => ({ id: "salon-1", name: "Buenos Aires", active: true })) as unknown as typeof originalLocation;
    prisma.mobileSession.findUnique = (async ({ where }: { where: { token_hash: string } }) => where.token_hash !== hash(token) ? null : ({
      id: "session-1", device_name: binding, expires_at: new Date(Date.now() + (expired ? -1000 : 60_000)),
      revoked_at: revoked ? new Date() : null, last_used_at: new Date(),
      user: { id: "fixture-user", name: "Admin test", active, role, must_change_password: passwordChange, employee_status: "Attivo", location: null },
    })) as unknown as typeof originalSession;
    const request = (device?: string, user?: string) => new Request("https://example.test/api/mobile/workspace", {
      headers: { ...(device ? { "x-paradise-device": device } : {}), ...(user ? { authorization: `Bearer ${user}` } : {}) },
    });
    await t.test("anonymous denied", async () => assert.equal(await mobileWorkspace(request()), null));
    await t.test("device receives only agenda without an identity", async () => {
      const context = await mobileWorkspace(request(deviceToken));
      assert.deepEqual(context?.modules.map((item) => item.id), ["appointments"]);
      assert.equal(context?.auth, null);
    });
    await t.test("invalid bearer never silently falls back to salon", async () => assert.equal(await mobileWorkspace(request(deviceToken, "invalid")), null));
    await t.test("correct binding elevates", async () => assert.equal((await mobileWorkspace(request(deviceToken, token)))?.auth?.user.role, "ADMIN"));
    await t.test("bound session without its device denied", async () => assert.equal(await mobileWorkspace(request(undefined, token)), null));
    await t.test("wrong device denied", async () => assert.equal(await mobileWorkspace(request("other-device", token)), null));
    await t.test("demoted admin denied", async () => {
      role = "DIPENDENTE";
      assert.equal(await mobileWorkspace(request(deviceToken, token)), null);
      role = "ADMIN";
    });
    await t.test("disabled user denied", async () => {
      active = false;
      assert.equal(await mobileWorkspace(request(deviceToken, token)), null);
      active = true;
    });
    await t.test("expired or revoked session denied", async () => {
      expired = true;
      assert.equal(await mobileWorkspace(request(deviceToken, token)), null);
      expired = false; revoked = true;
      assert.equal(await mobileWorkspace(request(deviceToken, token)), null);
      revoked = false;
    });
    await t.test("password change cannot be bypassed", async () => {
      passwordChange = true;
      assert.equal(await mobileWorkspace(request(deviceToken, token)), null);
      passwordChange = false;
    });
    await t.test("personal login cannot be overlaid on a salon", async () => {
      binding = "Personal iPhone";
      assert.equal(await mobileWorkspace(request(deviceToken, token)), null);
      assert.equal((await mobileWorkspace(request(undefined, token)))?.auth?.user.role, "ADMIN");
    });
  } finally {
    prisma.setting.findUnique = originalSetting;
    prisma.mobileSession.findUnique = originalSession;
    prisma.location.findUnique = originalLocation;
  }
});
