import { appointmentDateKey } from "./appointment-date";

type PaymentOrder = {
  id: string;
  orderName: string;
  createdAt: string;
  financialStatus?: string | null;
};

/** Orders must already be filtered to the appointment's customer. */
export function closestAppointmentPayment<T extends PaymentOrder>(
  orders: T[],
  appointmentStart: string | undefined,
  depositOrder = "",
): T | null {
  const start = new Date(appointmentStart || "");
  if (!Number.isFinite(start.getTime())) return null;
  const day = appointmentDateKey(start);
  const deposit = depositOrder.trim().replace(/^#/, "");
  return orders
    .filter((order) => {
      const date = new Date(order.createdAt);
      return String(order.financialStatus || "").toLowerCase() === "paid"
        && Number.isFinite(date.getTime())
        && appointmentDateKey(date) === day
        && (!deposit || order.orderName.replace(/^#/, "") !== deposit);
    })
    .sort((a, b) => {
      const left = new Date(a.createdAt).getTime();
      const right = new Date(b.createdAt).getTime();
      return Math.abs(left - start.getTime()) - Math.abs(right - start.getTime())
        || right - left || a.id.localeCompare(b.id);
    })[0] ?? null;
}

export function canCorrectAppointmentClient(role?: string | null) {
  return ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(role || "");
}

type CustomerContact = { email?: string | null; phone?: string | null };
/** Automatic financial links never use fuzzy names/emails or short phone suffixes. */
export function exactPaymentCustomer(a: CustomerContact, b: CustomerContact) {
  const email = (value?: string | null) => {
    const normalized = (value || "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : "";
  };
  const phone = (value?: string | null) => {
    const digits = (value || "").replace(/\D/g, "").replace(/^00/, "");
    return digits.length >= 8 ? digits : "";
  };
  const ae = email(a.email), be = email(b.email), ap = phone(a.phone), bp = phone(b.phone);
  // Conflicting populated contacts require manual verification, even if one matches.
  if (ae && be && ae !== be) return false;
  if (ap && bp && ap !== bp) return false;
  return Boolean((ae && be && ae === be) || (ap && bp && ap === bp));
}

export function uniqueAppointmentPayment<T extends PaymentOrder & CustomerContact>(orders: T[], customer: CustomerContact, start?: string, deposit = ""): T | null {
  const candidates = orders.filter(order => exactPaymentCustomer(customer, order) && closestAppointmentPayment([order], start, deposit));
  const unique = new Map(candidates.map(order => [order.id, order]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}

/** Display all paid orders for the day; this never selects or links an order.
 * The original booking order can establish Shopify identity despite a contact typo.
 * Names and fuzzy contacts alone cannot establish that identity.
 */
export function appointmentDayPayments<T extends PaymentOrder & CustomerContact & { customerId?: string | null }>(
  orders: T[], customer: CustomerContact, start?: string, bookingOrder = "",
): T[] {
  const date = new Date(start || "");
  if (!Number.isFinite(date.getTime())) return [];
  const day = appointmentDateKey(date);
  const reference = bookingOrder.trim().replace(/^#/, "");
  const anchors = new Set(orders.filter(order => reference && order.orderName.replace(/^#/, "") === reference)
    .map(order => order.customerId).filter((id): id is string => Boolean(id)));
  if (anchors.size > 1) return [];
  const anchor = anchors.size === 1 ? [...anchors][0] : null;
  const matches = orders.filter(order => {
    const time = new Date(order.createdAt);
    return String(order.financialStatus || "").toLowerCase() === "paid"
      && Number.isFinite(time.getTime()) && appointmentDateKey(time) === day
      && (anchor ? order.customerId === anchor : exactPaymentCustomer(customer, order));
  });
  return [...new Map(matches.map(order => [order.id, order])).values()]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.id.localeCompare(b.id));
}
