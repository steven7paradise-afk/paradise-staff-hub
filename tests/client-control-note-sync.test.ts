import test from "node:test";
import assert from "node:assert/strict";
import { syncClientControlNotes } from "../lib/client-control-note-sync";
import { getShopifyAppointmentDayPayments } from "../lib/shopify";

test("writes the same confirmation to all unique destinations and awaits metadata", async () => {
  const calls: string[] = [];
  const result = await syncClientControlNotes(["1", "2", "3", "2"],
    async order => { calls.push(`note:${order}`); return true; },
    async order => { calls.push(`fields:${order}`); return true; });
  assert.deepEqual(result, { succeeded: ["1", "2", "3"], failed: [] });
  assert.deepEqual(calls, ["note:1", "fields:1", "note:2", "fields:2", "note:3", "fields:3"]);
});

test("explicit selection only writes that order; empty targets write nothing", async () => {
  const calls: string[] = [];
  const writer = async (order: string) => { calls.push(order); return true; };
  await syncClientControlNotes(["2"], writer, async () => true);
  await syncClientControlNotes([], writer, writer);
  assert.deepEqual(calls, ["2"]);
});

test("partial errors are reported and do not hide or skip other payments", async () => {
  const result = await syncClientControlNotes(["1", "2", "3", "4"],
    async order => { if (order === "3") throw new Error("offline"); return order !== "1"; },
    async order => order !== "2");
  assert.deepEqual(result, { succeeded: ["4"], failed: ["1", "2", "3"] });
});

test("server re-reads paid orders and isolates the booking customer/day across pages", async () => {
  const originalFetch = globalThis.fetch;
  const originalShop = process.env.SHOPIFY_SHOP_DOMAIN;
  const originalToken = process.env.SHOPIFY_ACCESS_TOKEN;
  process.env.SHOPIFY_SHOP_DOMAIN = "example.myshopify.com";
  process.env.SHOPIFY_ACCESS_TOKEN = "test-only";
  const order = (id: number, day = "01", customer = 7, status = "paid") => ({
    id, name: `#${id}`, created_at: `2026-10-${day}T10:00:00+02:00`,
    financial_status: status, customer: { id: customer, email: "client@gmail.com" },
  });
  let requests = 0;
  globalThis.fetch = (async () => {
    requests++;
    if (requests === 1) return Response.json({ orders: [order(100, "01")] });
    if (requests === 2) return Response.json({ orders: [order(101), order(102), order(103, "02"), order(104, "01", 9), order(105, "01", 7, "pending")] },
      { headers: { link: '<https://example.myshopify.com/admin/api/2024-04/orders.json?page_info=next>; rel="next"' } });
    return Response.json({ orders: [order(106), order(101)] });
  }) as typeof fetch;
  try {
    const found = await getShopifyAppointmentDayPayments("100", "2026-10-01T10:00:00+02:00", { email: "client@gmai.com" });
    assert.deepEqual(found.map(item => item.orderName).sort(), ["#100", "#101", "#102", "#106"]);
    assert.equal(requests, 3);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalShop === undefined) delete process.env.SHOPIFY_SHOP_DOMAIN; else process.env.SHOPIFY_SHOP_DOMAIN = originalShop;
    if (originalToken === undefined) delete process.env.SHOPIFY_ACCESS_TOKEN; else process.env.SHOPIFY_ACCESS_TOKEN = originalToken;
  }
});
