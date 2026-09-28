import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { prisma } from "../lib/prisma";
import { POST } from "../app/api/webhooks/shopify/payments/route";
import { verifyShopifyPaymentSignature } from "../lib/shopify-payment-webhook";
import { exactPaymentCustomer, uniqueAppointmentPayment } from "../lib/appointment-payment-match";

test("signature authenticates the original bytes, rejecting tampering and malformed hashes", () => {
  const raw = Buffer.from('{"id":123}');
  const signature = createHmac("sha256", "test-only").update(raw).digest("base64");
  assert.equal(verifyShopifyPaymentSignature(raw, signature, "test-only"), true);
  assert.equal(verifyShopifyPaymentSignature(Buffer.from("{}"), signature, "test-only"), false);
  for (const invalid of ["", "a", "0".repeat(64)]) assert.equal(verifyShopifyPaymentSignature(raw, invalid, "test-only"), false);
});

test("automatic match requires exact contacts, no conflicting contacts, one paid same-day non-deposit order", () => {
  const customer = { email: "client@example.com", phone: "+393331234567" };
  assert.equal(exactPaymentCustomer(customer, { email: "CLIENT@example.com" }), true);
  assert.equal(exactPaymentCustomer(customer, { phone: "0039 333 1234567" }), true);
  for (const other of [{}, { email: "clienx@example.com" }, { phone: "4567" }, { email: customer.email, phone: "393339999999" }]) assert.equal(exactPaymentCustomer(customer, other), false);
  const paid = { id: "1", orderName: "#1", createdAt: "2026-09-28T10:00:00Z", financialStatus: "paid", ...customer };
  const start = "2026-09-28T09:00:00Z";
  assert.equal(uniqueAppointmentPayment([paid], customer, start)?.id, "1");
  assert.equal(uniqueAppointmentPayment([paid, paid], customer, start)?.id, "1");
  assert.equal(uniqueAppointmentPayment([paid, {...paid,id:"2",orderName:"#2"}], customer, start), null);
  assert.equal(uniqueAppointmentPayment([paid], customer, start, "#1"), null);
  assert.equal(uniqueAppointmentPayment([paid], customer, "2026-09-27T09:00:00Z"), null);
  assert.equal(uniqueAppointmentPayment([{...paid,financialStatus:"pending"}], customer, start), null);
  assert.equal(uniqueAppointmentPayment([paid], {email:"other@example.com"}, start), null);
});

test("webhook rejects wrong shop/signature, ignores unpaid orders, deduplicates, retries database failures", async t => {
  const keys = ["SHOPIFY_PAYMENTS_WEBHOOK_SECRET", "SHOPIFY_SHOP_DOMAIN", "APPOINTMENTS_REALTIME_ENABLED"];
  const old = keys.map(key => process.env[key]);
  t.after(() => keys.forEach((key,i) => { if (old[i] === undefined) delete process.env[key]; else process.env[key] = old[i]; }));
  process.env.SHOPIFY_PAYMENTS_WEBHOOK_SECRET = "test-only";
  process.env.SHOPIFY_SHOP_DOMAIN = "example.myshopify.com";
  process.env.APPOINTMENTS_REALTIME_ENABLED = "true";
  let calls=0, notifications=0, duplicate=false, fail=false;
  const original = prisma.$transaction;
  t.after(() => { prisma.$transaction = original; });
  prisma.$transaction = (async (run: (tx: unknown) => Promise<void>) => {
    calls++;
    if (fail) throw Error("offline");
    await run({ setting: { createMany: async () => ({ count: duplicate ? 0 : 1 }), upsert: async () => ({}) }, $queryRaw: async () => { notifications++; } });
  }) as typeof prisma.$transaction;
  const request = (overrides: Record<string,string> = {}, status = "paid") => {
    const body = JSON.stringify({ id: 123, financial_status: status });
    return new Request("https://localhost/api/webhooks/shopify/payments", { method:"POST", body, headers: {
      "x-shopify-shop-domain":"example.myshopify.com", "x-shopify-topic":"orders/paid", "x-shopify-webhook-id":"test-event",
      "x-shopify-hmac-sha256":createHmac("sha256","test-only").update(body).digest("base64"), ...overrides,
    } });
  };
  assert.equal((await POST(request({"x-shopify-shop-domain":"wrong.myshopify.com"}))).status,401);
  assert.equal((await POST(request({"x-shopify-hmac-sha256":"bad"}))).status,401);
  assert.equal((await POST(request({},"pending"))).status,200);
  assert.equal((await POST(request({"x-shopify-topic":"orders/create"}))).status,200);
  assert.equal(calls,0);
  assert.equal((await POST(request())).status,200);
  assert.equal(notifications,1);
  duplicate=true;
  assert.equal((await POST(request())).status,200);
  assert.equal(notifications,1);
  fail=true;
  assert.equal((await POST(request())).status,503);
});
