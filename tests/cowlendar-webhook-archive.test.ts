import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { applyCowlendarWebhookBooking, parseCowlendarWebhookBooking } from "../lib/cowlendar-webhook-archive";
import { POST } from "../app/api/webhooks/cowlendar/route";
import { prisma } from "../lib/prisma";

const booking = {
  id: "booking-test", booking_str: "COW-1", order_id: null,
  service: { id: "service", title: "Test service", type: "classic-no-checkout" },
  customer: { name: "Test Customer", email: null, phone: null, locale: null },
  price: { amount: 20, currency: "EUR" }, form_data: {}, teammates: [],
  confirmation_status: "confirmed", attendance: "booked", financial_status: null, is_canceled: false,
  updated_at: "2026-11-14T08:10:00Z", start_date: "2026-11-14T11:30:00Z", end_date: "2026-11-14T12:00:00Z",
};

test("only a full booking snapshot can write through, and archive metadata never comes from the event", () => {
  const parsed = parseCowlendarWebhookBooking({
    ...booking, archiveOrderName: "incoming value", archiveWebhookUpdatedAt: 99,
  }, "booking.created");
  assert.ok(parsed);
  assert.equal("archiveOrderName" in parsed, false);
  assert.equal("archiveWebhookUpdatedAt" in parsed, false);
  assert.equal(parseCowlendarWebhookBooking({ ...booking, customer: undefined }, "booking.created"), null);
  assert.equal(parseCowlendarWebhookBooking({ ...booking, updated_at: "yesterday" }, "booking.created"), null);
  assert.equal(parseCowlendarWebhookBooking(booking, "booking.canceled"), null);
  assert.equal(parseCowlendarWebhookBooking({ ...booking, is_canceled: true }, "booking.canceled")?.is_canceled, true);
});

test("write-through notifies after the archive write without invalidating the monthly snapshot", async (t) => {
  const keys = ["COWLENDAR_WEBHOOK_SECRET", "COWLENDAR_WEBHOOK_SHOP_DOMAIN", "APPOINTMENTS_REALTIME_ENABLED"];
  const previous = keys.map((key) => process.env[key]);
  process.env.COWLENDAR_WEBHOOK_SECRET = "whsec_test";
  process.env.COWLENDAR_WEBHOOK_SHOP_DOMAIN = "example.myshopify.com";
  process.env.APPOINTMENTS_REALTIME_ENABLED = "true";
  const originalTransaction = prisma.$transaction;
  t.after(() => {
    prisma.$transaction = originalTransaction;
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  });

  const actions: string[] = [];
  let changed = true;
  prisma.$transaction = (async (run: (tx: unknown) => Promise<void>) => {
    await run({
      setting: {
        createMany: async () => { actions.push("deduplicated"); return { count: 1 }; },
        deleteMany: async () => { actions.push("native-cache"); },
        upsert: async () => { actions.push("revision"); },
      },
      $executeRaw: async (_strings: TemplateStringsArray) => {
        actions.push(_strings.join("").includes("INSERT INTO appointment_archive") ? "booking" : "month");
        return changed ? 1 : 0;
      },
      $queryRaw: async (strings: TemplateStringsArray, channel: string) => {
        if (strings.join("").includes("FOR UPDATE")) {
          actions.push("locked booking");
          return [{ payload: booking }];
        }
        actions.push(channel);
      },
    });
  }) as typeof prisma.$transaction;

  function request() {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ id: "evt_full", type: "booking.created", shop_domain: "example.myshopify.com", data: booking });
    const hash = createHmac("sha256", "whsec_test").update(`${timestamp}.${body}`).digest("hex");
    return new Request("https://localhost/api/webhooks/cowlendar", { method: "POST", body, headers: {
      "x-cowlendar-event-id": "evt_full", "x-cowlendar-event-type": "booking.created",
      "x-cowlendar-timestamp": timestamp, "x-cowlendar-signature": `t=${timestamp},v1=${hash}`,
    } });
  }

  assert.equal((await POST(request())).status, 200);
  assert.deepEqual(actions, ["deduplicated", "booking", "native-cache", "revision", "paradise_appointment_changes"]);
  actions.length = 0;
  changed = false;
  assert.equal((await POST(request())).status, 200);
  assert.deepEqual(actions, ["deduplicated", "booking", "locked booking"]);
});

test("a stale write-through cannot overwrite a newer result from the normal import", async () => {
  const parsed = parseCowlendarWebhookBooking(booking, "booking.created");
  assert.ok(parsed);
  const writes: string[] = [];
  assert.equal(await applyCowlendarWebhookBooking(
    {
      $executeRaw: async (strings: TemplateStringsArray) => { writes.push(strings.join("")); return 0; },
      $queryRaw: async () => [{ payload: { updated_at: "2026-11-14T09:11:00+01:00" } }],
    } as unknown as Parameters<typeof applyCowlendarWebhookBooking>[0],
    parsed, new Date("2026-11-14T09:00:00Z"),
  ), false);
  assert.equal(writes.length, 1);
  assert.match(writes[0], /ON CONFLICT \(id\) DO NOTHING/);
});

test("a newer webhook updates the locked booking and preserves its matching Shopify name", async () => {
  const parsed = parseCowlendarWebhookBooking({ ...booking, order_id: "42" }, "booking.updated");
  assert.ok(parsed);
  const saved = { order_id: "42", archiveOrderName: "#42", updated_at: "invalid date" };
  const actions: string[] = [];
  let updated: Record<string, unknown> | undefined;
  assert.equal(await applyCowlendarWebhookBooking(
    {
      $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        if (strings.join("").includes("ON CONFLICT")) { actions.push("insert"); return 0; }
        actions.push("update");
        assert.match(String(values[1]), /#42/);
        updated = JSON.parse(String(values[2]));
        return 1;
      },
      $queryRaw: async (strings: TemplateStringsArray) => {
        assert.match(strings.join(""), /FOR UPDATE/);
        actions.push("lock");
        return [{ payload: saved }];
      },
    } as unknown as Parameters<typeof applyCowlendarWebhookBooking>[0],
    parsed, new Date("2026-11-14T09:00:00Z"),
  ), true);
  assert.deepEqual(actions, ["insert", "lock", "update"]);
  assert.equal(updated?.archiveOrderName, "#42");
  assert.equal(updated?.archiveWebhookUpdatedAt, Date.parse(booking.updated_at));
});
