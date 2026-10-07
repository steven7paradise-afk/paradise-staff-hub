type VisitBooking = {
  id: string; customerEmail?: string | null; customerPhone?: string | null;
  dateKey: string; inferredSalon: string; startDate: string; endDate?: string | null; isCanceled?: boolean;
};
const phone = (value?: string | null) => {
  const digits = (value || "").replace(/\D/g, "").replace(/^00/, "");
  return digits.startsWith("39") && digits.length === 12 ? digits.slice(2) : digits;
};
const email = (value?: string | null) => (value || "").trim().toLowerCase();
/** Keep booking IDs and service actions intact; group only overlapping or consecutive visits. */
export function appointmentVisits<T extends VisitBooking>(bookings: T[]): T[][] {
  const groups: T[][] = [];
  for (const booking of [...bookings].sort((a,b) => Date.parse(a.startDate)-Date.parse(b.startDate))) {
    const start = Date.parse(booking.startDate);
    const match = groups.find(group => !booking.isCanceled && group.every(item => !item.isCanceled) && group.some(item => {
      if (item.dateKey !== booking.dateKey || item.inferredSalon !== booking.inferredSalon || item.inferredSalon === "altro") return false;
      const samePhone = phone(booking.customerPhone).length >= 8 && phone(booking.customerPhone) === phone(item.customerPhone);
      const sameEmail = Boolean(email(booking.customerEmail)) && email(booking.customerEmail) === email(item.customerEmail);
      const end = Date.parse(item.endDate || item.startDate);
      return (samePhone || sameEmail) && Number.isFinite(end) && start <= end;
    }));
    if (match) match.push(booking); else groups.push([booking]);
  }
  return groups;
}

export function appointmentCustomerPhone(customerPhone: string | null | undefined, form: Record<string, unknown> | null | undefined) {
  if (customerPhone?.trim()) return customerPhone;
  for (const [key, value] of Object.entries(form || {})) {
    if (/telefono|phone|cellulare/i.test(key) && typeof value === "string" && phone(value).length >= 8) return value;
  }
  return null;
}
