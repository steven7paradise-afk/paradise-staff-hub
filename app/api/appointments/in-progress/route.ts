import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { appointmentsPcCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { getOperationalUser } from "@/lib/operational-session";
import { prisma } from "@/lib/prisma";
import { appointmentDateKey, appointmentDayBoundaryIso } from "@/lib/appointment-date";
import { liveChanged, liveKey } from "@/lib/salon-live";
import { canAdvanceLiveItem, type LiveItem } from "@/lib/salon-live-policy";
import { getShopifyOrderIdentity } from "@/lib/shopify";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: NextRequest) {
  const pc = await checkPCAuthorization(request.cookies.get(appointmentsPcCookieName)?.value);
  if (!pc) return reply({ error: "PC non autorizzato." }, 401);
  const today = appointmentDateKey();
  const [rows, arrivals] = await Promise.all([
    prisma.setting.findMany({ where: { key: { startsWith: `salon_live:${pc.locationId}:` }, NOT: [{ value: { path: ["state"], equals: "done" } }, { value: { path: ["state"], equals: "cancelled" } }] } }),
    prisma.attendanceLog.findMany({ where: { location_id: pc.locationId, type: "ENTRATA", timestamp: { gte: new Date(appointmentDayBoundaryIso(today)), lte: new Date(appointmentDayBoundaryIso(today, true)) } }, select: { id: true, timestamp: true, user: { select: { name: true } } }, orderBy: { timestamp: "desc" } }),
  ]);
  return reply({ items: rows.map(r => r.value), arrivals: arrivals.map(a => ({ id: a.id, workerName: a.user.name, createdAt: a.timestamp.toISOString() })) });
}
export async function POST(request: NextRequest) {
  const pc = await checkPCAuthorization(request.cookies.get(appointmentsPcCookieName)?.value);
  const user = pc ? await getOperationalUser(request, { requirePcWorker: true }) : null;
  if (!pc || !user) return reply({ error: "Seleziona il tuo profilo alla cassa." }, 401);
  const b = await request.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[a-f0-9-]{36}$/i.test(b.id) || !["claimed", "done", "cancelled"].includes(b.state)) return reply({ error: "Richiesta non valida." }, 400);
  const key = liveKey(pc.locationId, b.id);
  const reference = typeof b.orderReference === "string" ? b.orderReference.trim() : "";
  if (reference && !/^#?\d{3,20}$/.test(reference)) return reply({ error: "Numero ordine non valido." }, 400);
  const order = b.state === "done" && reference ? await getShopifyOrderIdentity(reference) : null;
  if (b.state === "done" && reference && !order) return reply({ error: "Ordine non trovato in Shopify o collegamento non disponibile. La richiesta resta aperta." }, 422);
  try {
    await prisma.$transaction(async tx => {
      const row = await tx.setting.findUnique({ where: { key } });
      if (!row) throw new Error("Richiesta non trovata.");
      const item = row.value as unknown as LiveItem;
      if (item.state === b.state && item.handledBy === user.id) return;
      if (!canAdvanceLiveItem(item, b.state, user.id)) throw new Error("Richiesta già gestita da un altro operatore. Aggiorna la pagina.");
      const orderReference = typeof b.orderReference === "string" ? b.orderReference.trim() : "";
      if (b.state === "done" && ["product", "note"].includes(item.kind) && !/^#?\d{3,20}$/.test(orderReference)) throw new Error("Indica il numero dell’ordine Shopify verificato alla cassa.");
      const updated = { ...item, state: b.state, handledBy: user.id, handledByName: user.name, ...(order ? { orderReference: order.name || reference, orderId: order.id, orderUrl: order.adminUrl } : {}) };
      const changed = await tx.setting.updateMany({ where: { key, value: { equals: row.value as Prisma.InputJsonValue } }, data: { value: updated as Prisma.InputJsonValue } });
      if (changed.count !== 1) throw new Error("Richiesta modificata: aggiorna la pagina.");
      await liveChanged(tx);
    });
    return reply({ success: true });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : "Operazione non riuscita." }, 409); }
}
