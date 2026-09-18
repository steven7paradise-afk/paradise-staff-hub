import { getCowlendarBookingsForRange } from "../lib/cowlendar";
import { getShopifyOrderNamesBulk } from "../lib/shopify";
import { prisma } from "../lib/prisma";
import {
  isSystemazioneFasceAppointment,
  syncSystemazioneFasceTable,
  type SystemazioneFasceAppointment,
} from "../lib/systemazione-fasce-table";

const startDate = process.argv[2] || "2026-08-01";
const endDate = process.argv[3] || "2026-09-30";

function boundary(date: string, end = false) {
  return `${date}T${end ? "23:59:59.999" : "00:00:00.000"}+02:00`;
}

function teammateName(teammate: { firstname?: string | null; lastname?: string | null }) {
  return `${teammate.firstname ?? ""} ${teammate.lastname ?? ""}`
    .replace(/\|.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const bookings = await getCowlendarBookingsForRange({
    startDate: boundary(startDate),
    endDate: boundary(endDate, true),
    limit: 5000,
    forceRefresh: true,
  });
  const targets = bookings.filter((booking) => (
    !booking.is_canceled && isSystemazioneFasceAppointment(booking.service?.title)
  ));
  const orderNames = await getShopifyOrderNamesBulk(
    targets.map((booking) => booking.order_id).filter((id): id is string => Boolean(id)),
  ).catch(() => new Map<string, string>());

  const appointments: SystemazioneFasceAppointment[] = targets.map((booking) => ({
    id: booking.id,
    customerName: booking.customer?.name?.trim()
      || [booking.form_data?.firstname, booking.form_data?.lastname]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .join(" ")
      || "Cliente",
    customerEmail: booking.customer?.email || String(booking.form_data?.email || "") || null,
    customerPhone: booking.customer?.phone || String(booking.form_data?.phone || "") || null,
    serviceTitle: booking.service?.title || "Sistemazione fasce",
    shopifyOrderId: booking.order_id ? String(booking.order_id) : null,
    bookingStr: booking.order_id
      ? orderNames.get(String(booking.order_id)) || `#${booking.order_id}`
      : null,
    startDate: booking.start_date,
    teammates: (booking.teammates ?? [])
      .map((teammate) => ({ name: teammateName(teammate) }))
      .filter((teammate) => teammate.name),
    notesText: [booking.notes, booking.note, booking.internal_note, booking.customer_note]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join("\n\n") || null,
    isCanceled: Boolean(booking.is_canceled),
  }));

  const result = await syncSystemazioneFasceTable(appointments);
  console.log(JSON.stringify({
    range: { startDate, endDate },
    found: targets.length,
    ...result,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
