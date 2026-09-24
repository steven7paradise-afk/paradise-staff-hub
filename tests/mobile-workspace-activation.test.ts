import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { POST } from "../app/api/mobile/workspace/activate/route";

test("native enrollment is single-use and does not mutate the compare-and-swap snapshot", async () => {
  const code = "f05d0120-4145-4e61-8425-fbc3959d1794";
  const originalRead = prisma.setting.findUnique;
  const originalWrite = prisma.setting.updateMany;
  const originalLocation = prisma.location.findUnique;
  let records = [{ code, name: "iPhone test", locationId: "salon-1", activatedAt: null as string | null, archivedAt: null, accessTokenHash: null as string | null }];
  let activeLocation = true;
  const request = (value: string) => new Request("https://example.test/api/mobile/workspace/activate", {
    method: "POST", body: JSON.stringify({ code: value }), headers: { "Content-Type": "application/json" },
  });
  try {
    prisma.setting.findUnique = (async () => ({ value: structuredClone(records) })) as unknown as typeof originalRead;
    prisma.location.findUnique = (async () => ({ id: "salon-1", name: "Buenos Aires", active: activeLocation })) as unknown as typeof originalLocation;
    prisma.setting.updateMany = (async ({ where, data }: { where: { value: { equals: unknown } }; data: { value: typeof records } }) => {
      if (JSON.stringify(where.value.equals) !== JSON.stringify(records)) return { count: 0 };
      records = structuredClone(data.value);
      return { count: 1 };
    }) as unknown as typeof originalWrite;
    assert.equal((await POST(request("bad"))).status, 400);
    activeLocation = false;
    assert.equal((await POST(request(code))).status, 400);
    assert.equal(records[0].activatedAt, null);
    activeLocation = true;
    const responses = await Promise.all([POST(request(code)), POST(request(code))]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 410]);
    const body = await responses.find((response) => response.status === 200)!.json();
    assert.equal(records[0].accessTokenHash, createHash("sha256").update(body.token).digest("hex"));
    assert.notEqual(records[0].activatedAt, null);
    assert.equal((await POST(request(code))).status, 410);
  } finally {
    prisma.setting.findUnique = originalRead;
    prisma.setting.updateMany = originalWrite;
    prisma.location.findUnique = originalLocation;
  }
});
