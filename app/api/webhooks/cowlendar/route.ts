import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { BOOKING_EVENTS, verifyCowlendarSignature } from "@/lib/cowlendar-webhook";
import { applyCowlendarWebhookBooking, parseCowlendarWebhookBooking } from "@/lib/cowlendar-webhook-archive";
import { APPOINTMENT_ARCHIVE_INVALIDATION_CHANNEL, APPOINTMENT_ARCHIVE_INVALIDATION_KEY, publishAppointmentChange } from "@/lib/appointment-realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.COWLENDAR_WEBHOOK_SECRET;
  const shop = process.env.COWLENDAR_WEBHOOK_SHOP_DOMAIN;
  if (!secret || !shop || process.env.APPOINTMENTS_REALTIME_ENABLED !== "true") {
    return Response.json({ error: "Webhook non configurato" }, { status: 503 });
  }
  // Bound memory before parsing the untrusted body.
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
  if (!verifyCowlendarSignature(raw, request.headers.get("x-cowlendar-timestamp") || "", request.headers.get("x-cowlendar-signature") || "", secret)) {
    return new Response(null, { status: 401 });
  }
  let event;
  try { event = JSON.parse(raw.toString("utf8")); } catch { return new Response(null, { status: 400 }); }
  if (!event || event.shop_domain !== shop || typeof event.id !== "string" || event.id.length > 160 || !event.id ||
      event.id !== request.headers.get("x-cowlendar-event-id") || event.type !== request.headers.get("x-cowlendar-event-type")) {
    return new Response(null, { status: 400 });
  }
  if (event.type === "webhook.ping") return Response.json({ ok: true });
  if (typeof event.type !== "string" || !event.type.startsWith("booking.")) {
    return Response.json({ ignored: true });
  }
  const booking = BOOKING_EVENTS.has(event.type) ? parseCowlendarWebhookBooking(event.data, event.type) : null;
  try {
    await prisma.$transaction(async (tx) => {
      // Atomic deduplication across replicas. Store no customer data.
      const inserted = await tx.setting.createMany({ data: [{
        key: `cowlendar_event:${event.id}`, value: { receivedAt: new Date().toISOString() },
      }], skipDuplicates: true });
      if (!inserted.count) return;
      if (booking && !await applyCowlendarWebhookBooking(tx, booking, new Date())) return;

      await tx.setting.deleteMany({ where: { OR: [
        { key: { startsWith: "cowlendar_cache_bookings_" } },
        { key: { startsWith: "cowlendar_cache_range_" } },
      ] } });
      if (booking) {
        await publishAppointmentChange(tx);
        return;
      }

      // Preserve active leases and the archive. Lock their rows before changing
      // the invalidation revision so an in-flight import cannot publish stale data.
      const now = new Date();
      await tx.$executeRaw`
        UPDATE appointment_archive_sync
        SET lease_until = CASE WHEN lease_until > ${now} THEN lease_until ELSE ${new Date(0)} END
      `;
      const revision = randomUUID();
      await tx.setting.upsert({
        where: { key: APPOINTMENT_ARCHIVE_INVALIDATION_KEY },
        create: { key: APPOINTMENT_ARCHIVE_INVALIDATION_KEY, value: revision },
        update: { value: revision },
      });
      await tx.$queryRaw`SELECT pg_notify(${APPOINTMENT_ARCHIVE_INVALIDATION_CHANNEL}, ${revision})::text`;
      await publishAppointmentChange(tx);
    }, { timeout: 8000 });
    return Response.json({ ok: true });
  } catch {
    // Cowlendar retries 5xx; don't acknowledge a failed transaction.
    return Response.json({ error: "Notifica non acquisita" }, { status: 503 });
  }
}
