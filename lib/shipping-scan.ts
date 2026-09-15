export type ScannableLineItem = {
  id: string;
  title: string;
  quantity: number;
  barcode?: string;
  sku?: string;
  variantId?: string;
  imageUrl?: string | null;
};

export function normalizeShippingScan(value: string) {
  return value.trim().replace(/[\r\n\t]/g, "").toUpperCase();
}

export function scanKey(item: ScannableLineItem) {
  return normalizeShippingScan(item.barcode || item.sku || item.variantId || item.id);
}

export function verifiedQuantity(item: ScannableLineItem, verifiedCodes: string[]) {
  const key = scanKey(item);
  return Math.min(item.quantity, verifiedCodes.filter((code) => normalizeShippingScan(code) === key).length);
}

export function resolveShippingScan(items: ScannableLineItem[], verifiedCodes: string[], rawCode: string) {
  const code = normalizeShippingScan(rawCode);
  if (!code) return { outcome: "EMPTY" as const, code };

  const matching = items.filter((item) =>
    [item.barcode, item.sku, item.variantId, item.id]
      .filter(Boolean)
      .some((candidate) => normalizeShippingScan(candidate || "") === code),
  );
  if (!matching.length) return { outcome: "UNKNOWN" as const, code };

  const item = matching.find((candidate) => verifiedQuantity(candidate, verifiedCodes) < candidate.quantity);
  if (!item) return { outcome: "COMPLETE" as const, code, item: matching[0] };

  const key = scanKey(item);
  return {
    outcome: "MATCH" as const,
    code,
    item,
    key,
    nextQuantity: verifiedQuantity(item, verifiedCodes) + 1,
  };
}
