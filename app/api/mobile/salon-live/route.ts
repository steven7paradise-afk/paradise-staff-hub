import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { mobileUser } from "@/lib/mobile-auth";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";
import { assignedClientBookings } from "@/lib/mobile-client-control";
import { isAppointmentDateKey } from "@/lib/appointment-date";
import { prisma } from "@/lib/prisma";
import { bookingDeskLocation, SalonLiveError, liveChanged, liveKey, productByBarcode } from "@/lib/salon-live";
import { type LiveItem, validLiveInput } from "@/lib/salon-live-policy";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
async function worker(request: Request) {
  const a = await mobileUser(request);
  return a && !a.user.must_change_password && a.user.employee_status !== FORMER_EMPLOYEE_STATUS && !a.session.device_name?.startsWith("ios-salon:") && a.user.sede_id ? a.user : null;
}
export async function GET(request: NextRequest) {
  const user = await worker(request);
  if (!user) return reply({ error: "Accedi con il tuo account personale e una sede assegnata." }, 401);
  const date = request.nextUrl.searchParams.get("date") ?? "";
  const bookingId = request.nextUrl.searchParams.get("bookingId") ?? "";
  if (!isAppointmentDateKey(date)) return reply({ error: "Data non valida." }, 400);
  const assigned = (await assignedClientBookings(user.id, date)).find(b => b.booking.id === bookingId);
  if (!assigned) return reply({ error: "Cliente non assegnata a te." }, 403);
  const locationId = await bookingDeskLocation(assigned.booking.service?.title ?? "", user.sede_id!);
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: `salon_live:${locationId}:` }, value: { path: ["bookingId"], equals: bookingId } } });
  return reply({ items: rows.map(r => r.value) });
}
export async function POST(request: NextRequest) {
  const user = await worker(request);
  if (!user) return reply({ error: "Accedi con il tuo account personale e una sede assegnata." }, 401);
  const body = await request.json().catch(() => null);
  if (!validLiveInput(body) || !isAppointmentDateKey(body.date)) return reply({ error: "Richiesta non valida." }, 400);
  const assigned = (await assignedClientBookings(user.id, body.date)).find(b => b.booking.id === body.bookingId);
  if (!assigned || !["INIZIATO", "IN_ATTESA", "ARRIVATO_IN_RITARDO"].includes(assigned.status)) return reply({ error: "La cliente deve essere assegnata a te e risultare arrivata o in lavorazione." }, 403);
  const locationId = await bookingDeskLocation(assigned.booking.service?.title ?? "", user.sede_id!);
  const key = liveKey(locationId, body.id);
  const existing = await prisma.setting.findUnique({ where: { key } });
  if (existing) {
    const old = existing.value as unknown as LiveItem;
    return old.workerId === user.id && old.bookingId === body.bookingId ? reply({ item: old }) : reply({ error: "Identificativo già utilizzato." }, 409);
  }
  try {
    const product = body.kind === "product" ? { ...await productByBarcode(body.barcode!), quantity: body.quantity! } : undefined;
    const b = assigned.booking;
    const item: LiveItem = { id: body.id, locationId, bookingId: b.id, customerName: b.customer?.name || [b.form_data?.firstname, b.form_data?.lastname].filter(Boolean).join(" ") || "Cliente", workerId: user.id, workerName: user.name, kind: body.kind, text: body.text?.trim() ?? "", createdAt: new Date().toISOString(), state: "open", ...(product ? { product } : {}) };
    const saved = await prisma.$transaction(async tx => {
      const saved = await tx.setting.upsert({ where: { key }, create: { key, value: item as unknown as Prisma.InputJsonValue }, update: {} });
      const stored = saved.value as unknown as LiveItem;
      if (stored.workerId !== user.id || stored.bookingId !== b.id) throw new SalonLiveError("Identificativo già utilizzato.");
      await liveChanged(tx);
      return saved.value;
    });
    return reply({ item: saved });
  } catch (error) {
    return reply({ error: error instanceof SalonLiveError ? error.message : "Invio non riuscito. Riprova: non verrà duplicato." }, 502);
  }
}
