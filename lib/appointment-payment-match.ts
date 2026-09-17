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
