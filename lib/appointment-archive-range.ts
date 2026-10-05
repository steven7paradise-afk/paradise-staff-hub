import { appointmentMonthRange, isAppointmentDateKey } from "./appointment-date";

export function archiveMonths(start: string, end: string) {
  if (!isAppointmentDateKey(start) || !isAppointmentDateKey(end) || start > end) throw new Error("Periodo non valido");
  const months: string[] = [];
  let focus = `${start.slice(0, 7)}-01`;
  while (focus <= end) {
    months.push(focus.slice(0, 7));
    if (months.length > 12) throw new Error("Seleziona un periodo di massimo 12 mesi");
    const last = appointmentMonthRange(focus).end;
    const next = new Date(`${last}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    focus = next.toISOString().slice(0, 10);
  }
  return months;
}

export function archiveSearchText(booking: Record<string, any>, orderName = "") {
  return [booking.id, booking.order_id, orderName, booking.booking_str, booking.customer?.name,
    booking.customer?.email, booking.customer?.phone, ...Object.values(booking.form_data || {})]
    .filter(value => typeof value === "string" || typeof value === "number").join(" ").toLowerCase();
}
