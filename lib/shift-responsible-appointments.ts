import { getCowlendarBookingsForRange, hasCowlendarToken, type CowlendarBooking } from "@/lib/cowlendar";
import { romeDayRange } from "@/lib/shift-reports";

export type ShiftAppointmentClient = {
  id: string;
  name: string;
  time: string;
  service: string;
};

function customerName(booking: CowlendarBooking) {
  const firstName = String(booking.form_data?.firstname ?? "").trim();
  const lastName = String(booking.form_data?.lastname ?? "").trim();
  return booking.customer?.name?.trim()
    || [firstName, lastName].filter(Boolean).join(" ")
    || booking.booking_str?.trim()
    || "Cliente senza nome";
}

function appointmentTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Orario non indicato";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function toShiftAppointmentClient(booking: CowlendarBooking): ShiftAppointmentClient | null {
  const appointmentContext = [booking.service?.title, booking.booking_str, booking.form_data?.sede, booking.form_data?.salone]
    .map((value) => String(value || "").toLocaleLowerCase("it"))
    .join(" ");
  if (!booking.id || booking.is_canceled === true || booking.isCanceled === true || !appointmentContext.includes("buenos aires")) return null;
  return {
    id: String(booking.id),
    name: customerName(booking).slice(0, 160),
    time: appointmentTime(booking.start_date),
    service: String(booking.service?.title || "Servizio non indicato").trim().slice(0, 160),
  };
}

export async function getShiftAppointmentClients(day: string): Promise<ShiftAppointmentClient[]> {
  if (!hasCowlendarToken()) return [];
  const { start, end } = romeDayRange(day);
  const bookings = await getCowlendarBookingsForRange({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    limit: 500,
  });
  const clients = bookings.flatMap((booking) => {
    const client = toShiftAppointmentClient(booking);
    return client ? [client] : [];
  });
  return [...new Map(clients.map((client) => [client.id, client])).values()]
    .sort((a, b) => a.time.localeCompare(b.time, "it") || a.name.localeCompare(b.name, "it"));
}
