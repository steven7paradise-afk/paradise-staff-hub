import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PAYMENT_EVENTS_CHANNEL, PAYMENT_REVISION_KEY, verifyShopifyPaymentSignature } from "@/lib/shopify-payment-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_PAYMENTS_WEBHOOK_SECRET;
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  if (!secret || !shop || process.env.APPOINTMENTS_REALTIME_ENABLED !== "true") {
    return Response.json({ error: "Webhook non configurato" }, { status: 503 });
  }
  if (request.headers.get("x-shopify-shop-domain")?.toLowerCase() !== shop.toLowerCase()) return new Response(null, { status: 401 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024 * 1024) { await reader.cancel(); return new Response(null, { status: 413 }); }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks);
  if (!verifyShopifyPaymentSignature(raw, request.headers.get("x-shopify-hmac-sha256") || "", secret)) return new Response(null, { status: 401 });
  if (request.headers.get("x-shopify-topic") !== "orders/paid") return Response.json({ ignored: true });
  const delivery = request.headers.get("x-shopify-webhook-id") || "";
  if (!/^[a-zA-Z0-9-]{1,160}$/.test(delivery)) return new Response(null, { status: 400 });
  let order;
  try { order = JSON.parse(raw.toString("utf8")); } catch { return new Response(null, { status: 400 }); }
  if (!order?.id || order.financial_status !== "paid") return Response.json({ ignored: true });
  try {
    await prisma.$transaction(async tx => {
      const inserted = await tx.setting.createMany({ data: [{ key: `shopify_payment_event:${delivery}`, value: { receivedAt: new Date().toISOString() } }], skipDuplicates: true });
      if (!inserted.count) return;
      const revision = randomUUID();
      await tx.setting.upsert({ where: { key: PAYMENT_REVISION_KEY }, create: { key: PAYMENT_REVISION_KEY, value: revision }, update: { value: revision } });
      // No customer/payment data is broadcast. Each authenticated screen rechecks Shopify.
      await tx.$queryRaw`SELECT pg_notify(${PAYMENT_EVENTS_CHANNEL}, ${revision})::text`;
    }, { maxWait: 1000, timeout: 3000 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Notifica non acquisita" }, { status: 503 }); }
}
