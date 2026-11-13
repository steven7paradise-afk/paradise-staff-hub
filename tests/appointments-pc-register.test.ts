import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/appointments/pc/register/route";
import { appointmentsPcCookieName, type AuthorizedPC } from "../lib/appointments-pc-auth";
import { prisma } from "../lib/prisma";

const activationUrl = "https://staff.example.test/api/appointments/pc/register";
const code = "11111111-1111-4111-a111-111111111111";

function fixture(t: TestContext, options?: { active?: boolean; archived?: boolean }) {
  let records: AuthorizedPC[] = [{
    code,
    name: "PC Cassa",
    locationId: "repubblica-test",
    createdAt: "2026-11-13T10:00:00.000Z",
    activatedAt: null,
    accessTokenHash: null,
    registeredIp: null,
    archivedAt: options?.archived ? "2026-11-13T11:00:00.000Z" : null,
  }];

  const findUniqueSetting = prisma.setting.findUnique;
  const findUniqueLocation = prisma.location.findUnique;
  const updateMany = prisma.setting.updateMany;
  t.after(() => {
    prisma.setting.findUnique = findUniqueSetting;
    prisma.location.findUnique = findUniqueLocation;
    prisma.setting.updateMany = updateMany;
  });

  prisma.setting.findUnique = (async () => ({ key: "appointments_authorized_pcs", value: structuredClone(records) })) as unknown as typeof findUniqueSetting;
  prisma.location.findUnique = (async ({ where }: { where: { id: string } }) => {
    assert.equal(where.id, "repubblica-test");
    return { active: options?.active ?? true, name: "Salone Repubblica" };
  }) as unknown as typeof findUniqueLocation;
  prisma.setting.updateMany = (async ({ where, data }: {
    where: { key: string; value: { equals: AuthorizedPC[] } };
    data: { value: AuthorizedPC[] };
  }) => {
    assert.equal(where.key, "appointments_authorized_pcs");
    if (JSON.stringify(where.value.equals) !== JSON.stringify(records)) return { count: 0 };
    records = data.value;
    return { count: 1 };
  }) as unknown as typeof updateMany;

  return { activated: () => records[0].activatedAt !== null };
}

function request(format: "json" | "form", browserToken?: string) {
  const headers = new Headers();
  if (browserToken) headers.set("Cookie", `${appointmentsPcCookieName}=${browserToken}`);
  if (format === "json") headers.set("Content-Type", "application/json");
  return new NextRequest(activationUrl, {
    method: "POST",
    headers,
    body: format === "form" ? new URLSearchParams({ code }) : JSON.stringify({ code }),
  });
}

test("a native cashier activation opens the PIN chooser for its actual salon", async (t) => {
  const device = fixture(t);
  const response = await POST(request("form", "stale-fixture-cookie"));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/appointments/repubblica?choose=1");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const cookie = response.cookies.get(appointmentsPcCookieName);
  assert.ok(cookie?.httpOnly);
  assert.equal(device.activated(), true);

  const retry = await POST(request("json", cookie.value));
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).alreadyActivated, true);
});

test("simultaneous requests can consume the activation link once", async (t) => {
  fixture(t);
  const responses = await Promise.all([POST(request("json")), POST(request("json"))]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const successful = responses.find((response) => response.status === 200)!;
  assert.equal((await successful.json()).appointmentUrl, "/appointments/repubblica?choose=1");
  assert.equal(responses.find((response) => response.status === 409)?.cookies.get(appointmentsPcCookieName), undefined);
});

test("an unavailable salon or revoked link leaves the code unconsumed", async (t) => {
  await t.test("inactive salon", async (subtest) => {
    const device = fixture(subtest, { active: false });
    const response = await POST(request("form"));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/appointments/register?activation=retry");
    assert.equal(response.cookies.get(appointmentsPcCookieName), undefined);
    assert.equal(device.activated(), false);
  });

  await t.test("revoked link", async (subtest) => {
    const device = fixture(subtest, { archived: true });
    assert.equal((await POST(request("json"))).status, 410);
    assert.equal(device.activated(), false);
  });
});
