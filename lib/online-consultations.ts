import type { CowlendarBooking } from "@/lib/cowlendar";

function normalize(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function collectBookingText(booking: CowlendarBooking | Record<string, any>) {
  const values = [
    booking.serviceTitle,
    booking.service?.title,
    booking.service?.type,
    booking.bookingStr,
    booking.booking_str,
    booking.booking_type,
    booking.notes,
    booking.note,
    booking.internal_note,
    booking.customer_note,
  ];

  if (booking.form_data && typeof booking.form_data === "object") {
    values.push(...Object.values(booking.form_data).map((value) => String(value || "")));
  }

  return normalize(values.filter(Boolean).join(" "));
}

export function isOnlineConsultationBooking(booking: CowlendarBooking | Record<string, any>) {
  const text = collectBookingText(booking);
  if (!text) return false;

  const hasConsultation = text.includes("consulenza") || text.includes("consultation") || text.includes("consulto");
  const hasOnlineSignal =
    text.includes("online") ||
    text.includes("video") ||
    text.includes("zoom") ||
    text.includes("call") ||
    text.includes("telefono") ||
    text.includes("telefonica") ||
    text.includes("whatsapp");

  if (hasConsultation && hasOnlineSignal) return true;

  const inSalonOnly =
    text.includes("riapplicazione") ||
    text.includes("applicazione extension") ||
    text.includes("rimozione") ||
    text.includes("lavaggio") ||
    text.includes("piega") ||
    text.includes("duomo") ||
    text.includes("buenos aires") ||
    text.includes("salone");

  return hasConsultation && !inSalonOnly;
}

export function cowlendarBookingToConsultationEvent(booking: CowlendarBooking | Record<string, any>) {
  const bookingId = String(booking.id || "");
  const name =
    booking.customerName ||
    booking.customer?.name?.trim() ||
    [booking.form_data?.firstname, booking.form_data?.lastname]
      .map((value: unknown) => String(value || "").trim())
      .filter(Boolean)
      .join(" ") ||
    "Cliente";
  const phone = booking.customerPhone || booking.customer?.phone || "Non indicato";
  const order = booking.bookingStr || booking.booking_str || booking.order_id || "Non indicato";
  const service = booking.serviceTitle || booking.service?.title || "Consulenza Online";
  const start = booking.startDate || booking.start_date;
  const end = booking.endDate || booking.end_date || new Date(new Date(start).getTime() + 30 * 60 * 1000).toISOString();

  return {
    uid: `cowlendar-${bookingId}`,
    summary: `Consulenza Online - ${name}`,
    description: [
      `Servizio: ${service}`,
      `Cliente: ${name}`,
      `Telefono: ${phone}`,
      `Ordine Shopify: ${order}`,
      "",
      `[Cowlendar ID: ${bookingId}]`,
    ].join("\n"),
    startDate: new Date(start).toISOString(),
    endDate: new Date(end).toISOString(),
  };
}
