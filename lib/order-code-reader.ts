function cleanReference(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^PB-/i, "")
    .replace(/^#/, "")
    .toLowerCase();
}

function referenceFromUrl(value: string) {
  try {
    const url = new URL(value);
    const shortReference = url.pathname.match(/^\/o\/([^/]+)\/?$/i)?.[1];
    const directReference = url.pathname.match(/^\/ordine\/([^/]+)\/?$/i)?.[1];
    const shopifyOrderId = url.pathname.match(/\/orders\/(\d+)(?:\/|$)/i)?.[1];
    const reference = (
      url.searchParams.get("ordine") ||
      url.searchParams.get("order") ||
      url.searchParams.get("orderId") ||
      shortReference ||
      directReference ||
      shopifyOrderId ||
      value
    );
    try {
      return decodeURIComponent(reference);
    } catch {
      return reference;
    }
  } catch {
    return value;
  }
}

export function normalizeScannedOrderReference(value: unknown) {
  const raw = String(value ?? "").trim();
  const gidOrderId = raw.match(/gid:\/\/shopify\/Order\/(\d+)/i)?.[1];
  return cleanReference(gidOrderId || referenceFromUrl(raw));
}

export function orderCodeCandidates(options: {
  responseId: string;
  visibleOrderNumber?: string | null;
  answers?: Record<string, unknown> | null;
}) {
  const candidates = new Set<string>();
  const add = (value: unknown) => {
    const normalized = normalizeScannedOrderReference(value);
    if (normalized) candidates.add(normalized);
  };

  add(options.responseId);
  add(options.visibleOrderNumber);

  const answers = options.answers ?? {};
  [
    "order_shopify_order",
    "field_1782221517924",
    "shopify_order_id",
    "shopifyOrderId",
    "shopify_admin_url",
    "shopifyAdminUrl",
    "order_url",
  ].forEach((key) => add(answers[key]));

  const serialized = JSON.stringify(answers);
  for (const match of serialized.matchAll(/(?:gid:\/\/shopify\/Order\/|\/orders\/)(\d+)/gi)) {
    add(match[1]);
  }

  return candidates;
}
