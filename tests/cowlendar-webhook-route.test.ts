import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { prisma } from "../lib/prisma";
import { POST } from "../app/api/webhooks/cowlendar/route";

test("webhook authenticates before database access and only acknowledges committed events", async (t) => {
  const keys = ["COWLENDAR_WEBHOOK_SECRET", "COWLENDAR_WEBHOOK_SHOP_DOMAIN", "APPOINTMENTS_REALTIME_ENABLED"];
  const previous = keys.map((key) => process.env[key]);
  t.after(() => keys.forEach((key, i) => {
    if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i];
  }));
  process.env.COWLENDAR_WEBHOOK_SECRET = "whsec_test";
  process.env.COWLENDAR_WEBHOOK_SHOP_DOMAIN = "example.myshopify.com";
  process.env.APPOINTMENTS_REALTIME_ENABLED = "true";
  let transactions = 0;
  let duplicate = false;
  let fail = false;
  let notifications = 0;
  let invalidations = 0;
  const originalTransaction = prisma.$transaction;
  t.after(() => { prisma.$transaction = originalTransaction; });
  prisma.$transaction = (async (run: (tx: unknown) => Promise<void>) => {
    transactions++;
    if (fail) throw new Error("offline");
    await run({ setting: {
      createMany: async () => ({ count: duplicate ? 0 : 1 }),
      deleteMany: async () => { invalidations++; },
      upsert: async () => ({}),
    }, $queryRaw: async () => { notifications++; } });
  }) as typeof prisma.$transaction;
  function request(type = "booking.created", shop = "example.myshopify.com", signed = true) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ id: "evt_test", type, shop_domain: shop, data: {} });
    const hash = createHmac("sha256", "whsec_test").update(`${timestamp}.${body}`).digest("hex");
    return new Request("https://localhost/api/webhooks/cowlendar", { method: "POST", body, headers: {
      "x-cowlendar-event-id": "evt_test", "x-cowlendar-event-type": type,
      "x-cowlendar-timestamp": timestamp, "x-cowlendar-signature": signed ? `t=${timestamp},v1=${hash}` : "bad",
    } });
  }
  assert.equal((await POST(request("booking.created", undefined, false))).status, 401);
  assert.equal((await POST(request("booking.created", "other.myshopify.com"))).status, 400);
  assert.equal((await POST(request("webhook.ping"))).status, 200);
  assert.equal((await POST(request("subscription.created"))).status, 200);
  assert.equal(transactions, 0);
  assert.equal((await POST(request())).status, 200);
  assert.equal(notifications, 1);
  assert.equal(invalidations, 1);
  duplicate = true;
  assert.equal((await POST(request())).status, 200);
  assert.equal(notifications, 1);
  fail = true;
  assert.equal((await POST(request())).status, 503);
  process.env.APPOINTMENTS_REALTIME_ENABLED = "false";
  assert.equal((await POST(request())).status, 503);
});
