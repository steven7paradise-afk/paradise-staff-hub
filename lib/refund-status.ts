export const REFUND_STATUS_LABELS: Record<string, string> = {
  NEW: "Da approvare",
  APPROVED: "Approvato",
  REJECTED: "Rifiutato",
};
export const REFUND_PAYMENT_LABELS: Record<string, string> = {
  PENDING: "Da eseguire", IN_PROGRESS: "In lavorazione", REFUNDED: "Rimborsato",
};

export function refundStates(status: string, notes: unknown) {
  const metadata = notes && typeof notes === "object" && !Array.isArray(notes)
    ? notes as Record<string, unknown> : {};
  const legacyPayment = status === "IN_PROGRESS" || status === "REFUNDED" ? status : "PENDING";
  const payment = typeof metadata.refundPaymentStatus === "string" && Object.hasOwn(REFUND_PAYMENT_LABELS, metadata.refundPaymentStatus)
    ? metadata.refundPaymentStatus : legacyPayment;
  return { approval: status === "IN_PROGRESS" || status === "REFUNDED" ? "APPROVED" : status, payment };
}

export function validRefundStates(approval: string, payment: string) {
  return Object.hasOwn(REFUND_STATUS_LABELS, approval) && Object.hasOwn(REFUND_PAYMENT_LABELS, payment) &&
    (payment === "PENDING" || approval === "APPROVED");
}

export type RefundStatusEvent = { to: string; by: string; at: string; type: string };
export function refundStatusHistory(value: unknown): RefundStatusEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || !["STATUS_CHANGE", "REFUND_PAYMENT_CHANGE"].includes(entry.type) ||
        typeof entry.to !== "string" || typeof entry.by !== "string" ||
        typeof entry.at !== "string" || !Number.isFinite(Date.parse(entry.at))) return [];
    return [{ to: entry.to, by: entry.by, at: entry.at, type: entry.type }];
  });
}
