export const REFUND_STATUS_LABELS: Record<string, string> = {
  NEW: "Da approvare",
  APPROVED: "Approvato",
  IN_PROGRESS: "In lavorazione",
  REFUNDED: "Rimborsato",
  REJECTED: "Rifiutato",
};

export function canChangeRefundStatus(from: string, to: string) {
  if (!Object.hasOwn(REFUND_STATUS_LABELS, to)) return false;
  if (from === to) return true;
  if (to === "IN_PROGRESS") return from === "APPROVED";
  if (to === "REFUNDED") return from === "APPROVED" || from === "IN_PROGRESS";
  // Completed refunds are historical records, not requests to reopen silently.
  if (from === "REFUNDED") return false;
  return to === "NEW" || to === "APPROVED" || to === "REJECTED";
}

export type RefundStatusEvent = { to: string; by: string; at: string };
export function refundStatusHistory(value: unknown): RefundStatusEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || entry.type !== "STATUS_CHANGE" ||
        typeof entry.to !== "string" || typeof entry.by !== "string" ||
        typeof entry.at !== "string" || !Number.isFinite(Date.parse(entry.at))) return [];
    return [{ to: entry.to, by: entry.by, at: entry.at }];
  });
}
