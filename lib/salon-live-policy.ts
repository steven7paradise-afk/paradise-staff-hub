export const liveKinds = ["coffee", "water", "help", "note", "product"] as const;
export type LiveKind = typeof liveKinds[number];
export type LiveItem = {
  id: string; locationId: string; bookingId: string; customerName: string;
  workerId: string; workerName: string; kind: LiveKind | "assignment"; text: string;
  createdAt: string; state: "open" | "claimed" | "done" | "cancelled"; handledBy?: string;
  product?: { variantId: string; title: string; barcode: string; price: string; currency: string; quantity: number };
  orderReference?: string;
};
export function validLiveInput(b: unknown): b is { id: string; bookingId: string; date: string; kind: LiveKind; text?: string; barcode?: string; quantity?: number } {
  if (!b || typeof b !== "object") return false;
  const v = b as Record<string, unknown>;
  return typeof v.id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v.id)
    && typeof v.bookingId === "string" && v.bookingId.length > 0 && v.bookingId.length < 200
    && liveKinds.includes(v.kind as LiveKind)
    && (v.text === undefined || (typeof v.text === "string" && v.text.length <= 2000))
    && (v.kind !== "note" || (typeof v.text === "string" && v.text.trim().length > 0))
    && (v.kind !== "product" || (typeof v.barcode === "string" && /^[\w.\/-]{1,100}$/.test(v.barcode)
      && Number.isInteger(v.quantity) && Number(v.quantity) >= 1 && Number(v.quantity) <= 99));
}
export function canAdvanceLiveItem(item: LiveItem, state: string, actor: string) {
  if (item.kind === "assignment") return false;
  return item.state === "open" && state === "claimed"
    || item.state === "claimed" && ["done", "cancelled"].includes(state) && item.handledBy === actor;
}
