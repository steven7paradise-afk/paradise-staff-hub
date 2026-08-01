import type { CowlendarBooking } from "@/lib/cowlendar";

export function normalizeConsultationText(value?: string | null) {
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

  return normalizeConsultationText(values.filter(Boolean).join(" "));
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

export function cowlendarIdFromConsultationDescription(description?: string | null) {
  const match = String(description || "").match(/\[Cowlendar ID:\s*([^\]\s]+)\]/);
  return match?.[1] || null;
}

function normalizeEventDate(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

export function consultationEventDedupeKey(event: {
  summary?: string | null;
  description?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
}) {
  const description = String(event.description || "");
  const clientMatch = description.match(/^Cliente:\s*(.+)$/im);
  const customerName =
    clientMatch?.[1]?.trim() ||
    String(event.summary || "")
      .replace(/^Consulenza\s+Online\s*-\s*/i, "")
      .trim();
  const start = event.startDate || event.start?.dateTime || event.start?.date || null;
  const end = event.endDate || event.end?.dateTime || event.end?.date || null;

  const normalizedCustomer = normalizeConsultationText(customerName);
  const normalizedStart = normalizeEventDate(start);
  const normalizedEnd = normalizeEventDate(end);

  if (!normalizedCustomer || !normalizedStart) return "";
  return [normalizedCustomer, normalizedStart, normalizedEnd].join("|");
}
