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

test("signed booking variants can omit optional fields without injecting archive metadata", () => {
  const parsed = parseCowlendarWebhookBooking({
    ...booking, archiveOrderName: "incoming value", archiveWebhookUpdatedAt: 99, archiveDayUpdatedAt: 100,
  }, "booking.created");
  assert.ok(parsed);
  assert.equal("archiveOrderName" in parsed.booking, false);
  assert.equal("archiveWebhookUpdatedAt" in parsed.booking, false);
  assert.equal("archiveDayUpdatedAt" in parsed.booking, false);
  assert.equal(parseCowlendarWebhookBooking({ ...booking, customer: undefined }, "booking.created")?.booking.customer, undefined);
  assert.equal(parseCowlendarWebhookBooking({ ...booking, updated_at: "yesterday" }, "booking.created"), null);
  assert.equal(parseCowlendarWebhookBooking({ ...booking, end_date: "2026-11-14T11:29:00Z" }, "booking.created"), null);
  assert.equal(parseCowlendarWebhookBooking({ ...booking, start_date: "2026-11-31T11:29:00Z", end_date: null }, "booking.created"), null);
  assert.equal(parseCowlendarWebhookBooking(booking, "booking.canceled"), null);
  assert.equal(parseCowlendarWebhookBooking({ ...booking, is_canceled: undefined }, "booking.canceled")?.booking.is_canceled, true);
  assert.equal(parseCowlendarWebhookBooking({ ...booking, is_canceled: true }, "booking.canceled")?.booking.is_canceled, true);
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

  function request(data: unknown = booking, id = "evt_full", validSignature = true) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ id, type: "booking.created", shop_domain: "example.myshopify.com", created_at: booking.updated_at, data });
    const hash = createHmac("sha256", "whsec_test").update(`${timestamp}.${body}`).digest("hex");
    return new Request("https://localhost/api/webhooks/cowlendar", { method: "POST", body, headers: {
      "x-cowlendar-event-id": id, "x-cowlendar-event-type": "booking.created",
      "x-cowlendar-timestamp": timestamp, "x-cowlendar-signature": `t=${timestamp},v1=${validSignature ? hash : "0".repeat(64)}`,
    } });
  }

  assert.equal((await POST(request())).status, 200);
  assert.deepEqual(actions, ["deduplicated", "booking", "native-cache", "revision", "paradise_appointment_changes"]);
  actions.length = 0;
  changed = false;
  assert.equal((await POST(request())).status, 200);
  assert.deepEqual(actions, ["deduplicated", "booking", "locked booking"]);
  actions.length = 0;
  changed = true;
  const shortened = { id: booking.id, service: booking.service, start_date: booking.start_date,
    end_date: booking.end_date, form_data: { firstname: "Test", lastname: "Customer" } };
  assert.equal((await POST(request(shortened, "evt_short"))).status, 200);
  assert.deepEqual(actions, ["deduplicated", "booking", "native-cache", "revision", "paradise_appointment_changes"]);
  actions.length = 0;
  assert.equal((await POST(request(shortened, "evt_bad_signature", false))).status, 401);
  assert.deepEqual(actions, []);
});

test("only a signed event creation timestamp can fill a missing creation version, for insertion only", async () => {
  const data = { ...booking, updated_at: undefined };
  const parsed = parseCowlendarWebhookBooking(data, "booking.created", booking.updated_at);
  assert.ok(parsed?.insertOnly);
  assert.equal(parsed.sourceVersion, Date.parse(booking.updated_at));
  assert.equal(parsed.booking.updated_at, undefined);
  assert.equal(parseCowlendarWebhookBooking(data, "booking.created"), null);
  assert.equal(parseCowlendarWebhookBooking(data, "booking.created", "invalid"), null);
  assert.equal(parseCowlendarWebhookBooking(data, "booking.confirmed", booking.updated_at), null);
  const writes: string[] = [];
  assert.equal(await applyCowlendarWebhookBooking({
    $executeRaw: async (strings: TemplateStringsArray) => { writes.push(strings.join("")); return 0; },
    $queryRaw: async () => [{ payload: { ...booking, updated_at: "2026-11-14T07:00:00Z" } }],
  } as unknown as Parameters<typeof applyCowlendarWebhookBooking>[0], parsed, new Date()), false);
  assert.equal(writes.length, 1);
  assert.match(writes[0], /ON CONFLICT \(id\) DO NOTHING/);
});

test("a stale write-through cannot overwrite a newer result from recovery even with an older webhook marker", async () => {
  const parsed = parseCowlendarWebhookBooking(booking, "booking.created");
  assert.ok(parsed);
  const writes: string[] = [];
  assert.equal(await applyCowlendarWebhookBooking(
    {
      $executeRaw: async (strings: TemplateStringsArray) => { writes.push(strings.join("")); return 0; },
      $queryRaw: async () => [{ payload: {
        updated_at: "2026-11-14T09:11:00+01:00",
        archiveWebhookUpdatedAt: Date.parse("2026-11-14T08:09:00Z"),
      } }],
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

test("partial updates preserve cancellation, contact, service, payment, form answers and searchable saved fields", async () => {
  const parsed = parseCowlendarWebhookBooking({
    id: booking.id, start_date: booking.start_date, updated_at: "2026-11-14T09:00:00Z",
    is_canceled: false, confirmation_status: "confirmed", attendance: "booked",
    service: { id: "service", image_url: "https://example.com/image.png" },
    customer: { locale: "it" }, form_data: { another: "New answer" }, price: { currency: "EUR" }, teammates: [{ id: "staff" }],
  }, "booking.confirmed");
  assert.ok(parsed);
  const saved = { ...booking, order_id: "42", archiveOrderName: "#42", form_data: { sede: "Repubblica" },
    customer: { ...booking.customer, email: "customer@example.com" }, teammates: [{ id: "staff", firstname: "Worker" }],
    is_canceled: true, confirmation_status: "declined" };
  let updated: Record<string, unknown> | undefined;
  assert.equal(await applyCowlendarWebhookBooking({
    $queryRaw: async () => [{ payload: saved }],
    $executeRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      assert.match(String(values[1]), /#42.*test customer.*customer@example\.com.*repubblica.*new answer/);
      updated = JSON.parse(String(values[2]));
      return 1;
    },
  } as unknown as Parameters<typeof applyCowlendarWebhookBooking>[0], parsed, new Date()), true);
  assert.equal(updated?.is_canceled, true);
  assert.equal(updated?.confirmation_status, "declined");
  assert.deepEqual(updated?.service, { ...booking.service, image_url: "https://example.com/image.png" });
  assert.deepEqual(updated?.customer, { ...saved.customer, locale: "it" });
  assert.deepEqual(updated?.price, booking.price);
  assert.equal(updated?.order_id, "42");
  assert.equal(updated?.end_date, booking.end_date);
  assert.deepEqual(updated?.form_data, { sede: "Repubblica", another: "New answer" });
  assert.deepEqual(updated?.teammates, saved.teammates);
});

test("unsafe short records trigger reconciliation when creating or moving a booking", async () => {
  const parsed = parseCowlendarWebhookBooking({
    id: booking.id, start_date: "2026-11-15T12:00:00Z", updated_at: "2026-11-14T09:00:00Z",
  }, "booking.rescheduled");
  assert.ok(parsed);
  for (const rows of [[], [{ payload: booking }]]) {
    assert.equal(await applyCowlendarWebhookBooking({
      $queryRaw: async () => rows,
      $executeRaw: async () => assert.fail("an unsafe record must not be saved"),
    } as unknown as Parameters<typeof applyCowlendarWebhookBooking>[0], parsed, new Date()), null);
  }
});
