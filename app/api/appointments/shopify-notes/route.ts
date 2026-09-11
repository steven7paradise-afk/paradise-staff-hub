import { NextRequest, NextResponse } from "next/server";
import { getOperationalUser } from "@/lib/operational-session";
import { getShopifyOrderNotesBulk } from "@/lib/shopify";
import { prisma } from "@/lib/prisma";

type AppointmentReference = {
  bookingId: string;
  orderId: string;
};

function cleanOrderReference(value: unknown) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  return /^\d{10,}$/.test(clean) ? clean : clean.replace(/^#?/, "#");
}

export async function POST(request: NextRequest) {
  const operationalUser = await getOperationalUser(request);
  if (!operationalUser?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const orderIds = Array.isArray(body?.orderIds) ? body.orderIds : [];
  const cleanOrderIds = orderIds
    .map((value: unknown) => String(value || "").trim())
    .filter((value: string) => /^\d{10,}$/.test(value))
    .slice(0, 200);

  const appointments: AppointmentReference[] = (Array.isArray(body?.appointments) ? body.appointments : [])
    .map((appointment: unknown): AppointmentReference | null => {
      if (!appointment || typeof appointment !== "object") return null;
      const candidate = appointment as Record<string, unknown>;
      const bookingId = String(candidate.bookingId || "").trim();
      const orderId = String(candidate.orderId || "").trim();
      return bookingId ? { bookingId, orderId: /^\d{10,}$/.test(orderId) ? orderId : "" } : null;
    })
    .filter((appointment: AppointmentReference | null): appointment is AppointmentReference => Boolean(appointment))
    .slice(0, 200);

  const bookingIds = new Set(appointments.map((appointment: AppointmentReference) => appointment.bookingId));
  const responses = bookingIds.size
      ? await prisma.serviceFormResponse.findMany({
        orderBy: { updated_at: "desc" },
        take: 500,
        select: { answers: true },
      }).catch(() => [])
    : [];

  const noteOrdersByBooking = new Map<string, string[]>();
  for (const response of responses) {
    const answers = (response.answers || {}) as Record<string, unknown>;
    const bookingId = String(answers.booking_id || "").trim();
    if (!bookingIds.has(bookingId) || noteOrdersByBooking.has(bookingId)) continue;
    const references = [
      answers.shopify_note_order,
      answers.second_shopify_order,
      answers.secondShopifyOrder,
      answers.client_control_shopify_order,
    ]
      .map(cleanOrderReference)
      .filter(Boolean);
    noteOrdersByBooking.set(bookingId, Array.from(new Set(references)));
  }

  const extraOrderReferences = Array.from(noteOrdersByBooking.values()).flat();
  const notes = await getShopifyOrderNotesBulk([...cleanOrderIds, ...extraOrderReferences]);
  const notesByBooking = Object.fromEntries(appointments.map((appointment: AppointmentReference) => {
    const references = [
      appointment.orderId,
      ...(noteOrdersByBooking.get(appointment.bookingId) || []),
    ].filter(Boolean);
    const uniqueNotes = Array.from(new Set(
      references
        .map((reference) => notes.get(cleanOrderReference(reference)) || "")
        .filter(Boolean),
    ));
    return [appointment.bookingId, uniqueNotes.join("\n\n")] as const;
  }).filter((entry) => Boolean(entry[1])));

  return NextResponse.json({ notes: Object.fromEntries(notes), notesByBooking });
}
