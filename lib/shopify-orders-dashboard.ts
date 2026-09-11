export type ShopifyDashboardOrder = {
  id: string;
  legacyId: string;
  name: string;
  createdAt: string;
  customerName: string;
  email: string;
  phone: string;
  total: number;
  currency: string;
  financialStatus: string;
  fulfillmentStatus: string;
  sourceName: string;
  itemCount: number;
  items: Array<{ title: string; quantity: number }>;
  note: string;
  destination: string;
};

export type ShopifyOrdersPage = {
  orders: ShopifyDashboardOrder[];
  hasNextPage: boolean;
  endCursor: string | null;
};

export type ShopifyOrderDetail = {
  legacyId: string;
  name: string;
  createdAt: string;
  processedAt: string;
  closedAt: string;
  confirmationNumber: string;
  financialStatus: string;
  fulfillmentStatus: string;
  sourceName: string;
  locationName: string;
  currency: string;
  subtotal: number;
  discounts: number;
  tax: number;
  total: number;
  paid: number;
  outstanding: number;
  taxesIncluded: boolean;
  taxLines: Array<{ title: string; rate: number; price: number }>;
  customer: { name: string; email: string; phone: string };
  shippingAddress: ShopifyOrderAddress | null;
  billingAddress: ShopifyOrderAddress | null;
  note: string;
  noteAttributes: Array<{ name: string; value: string }>;
  tags: string[];
  lineItems: Array<{
    id: string;
    title: string;
    variantTitle: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    fulfillmentStatus: string;
    properties: Array<{ name: string; value: string }>;
    staff: string[];
  }>;
  fulfillments: Array<{
    id: string;
    name: string;
    status: string;
    createdAt: string;
    locationName: string;
    trackingCompany: string;
    trackingNumber: string;
    trackingUrl: string;
  }>;
  transactions: Array<{
    id: string;
    kind: string;
    gateway: string;
    status: string;
    amount: number;
    currency: string;
    createdAt: string;
    paymentMethod: string;
    cardBrand: string;
    last4: string;
  }>;
  metafields: Array<{ id: string; namespace: string; key: string; value: string; type: string }>;
  events: Array<{
    id: string;
    createdAt: string;
    verb: string;
    message: string;
    description: string;
    author: string;
  }>;
  invoices: Array<{ label: string; url: string }>;
};

export type ShopifyOrderAddress = {
  name: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  zip: string;
  country: string;
  phone: string;
};

const SHOPIFY_API_VERSION = "2026-07";

function shopifyConfig() {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!shop || !token) {
    throw new Error("Shopify non è configurato correttamente.");
  }

  return { shop, token };
}

async function shopifyJson(path: string) {
  const { shop, token } = shopifyConfig();
  const response = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}${path}`, {
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Shopify non disponibile (${response.status}).`);
  const payload = await response.json();
  if (payload?.errors) throw new Error(typeof payload.errors === "string" ? payload.errors : "Shopify ha restituito un errore.");
  return payload;
}

function addressOf(address: any): ShopifyOrderAddress | null {
  if (!address) return null;
  return {
    name: String(address.name || [address.first_name, address.last_name].filter(Boolean).join(" ") || ""),
    company: String(address.company || ""),
    address1: String(address.address1 || ""),
    address2: String(address.address2 || ""),
    city: String(address.city || ""),
    province: String(address.province || address.province_code || ""),
    zip: String(address.zip || ""),
    country: String(address.country || address.country_code || ""),
    phone: String(address.phone || ""),
  };
}

export async function fetchShopifyOrderDetail(orderId: string): Promise<ShopifyOrderDetail> {
  const [orderPayload, eventsPayload, metafieldsPayload, transactionsPayload, locationsPayload] = await Promise.all([
    shopifyJson(`/orders/${orderId}.json`),
    shopifyJson(`/orders/${orderId}/events.json?limit=50`).catch(() => ({ events: [] })),
    shopifyJson(`/orders/${orderId}/metafields.json?limit=100`).catch(() => ({ metafields: [] })),
    shopifyJson(`/orders/${orderId}/transactions.json`).catch(() => ({ transactions: [] })),
    shopifyJson("/locations.json").catch(() => ({ locations: [] })),
  ]);
  const order = orderPayload?.order;
  if (!order) throw new Error("Ordine Shopify non trovato.");

  const locations = new Map<string, string>((locationsPayload.locations || []).map((location: any) => [String(location.id), String(location.name || "")]));
  const transactions = Array.isArray(transactionsPayload.transactions) ? transactionsPayload.transactions : [];
  const successfulPaid = transactions
    .filter((transaction: any) => transaction.status === "success" && ["sale", "capture"].includes(transaction.kind))
    .reduce((sum: number, transaction: any) => sum + Number(transaction.amount || 0), 0);
  const successfulRefunds = transactions
    .filter((transaction: any) => transaction.status === "success" && transaction.kind === "refund")
    .reduce((sum: number, transaction: any) => sum + Number(transaction.amount || 0), 0);
  const customerName = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ");
  const locationId = String(order.location_id || order.fulfillments?.[0]?.location_id || "");
  const rawEvents = Array.isArray(eventsPayload.events) ? eventsPayload.events : [];
  const plainEventText = (value: unknown) => String(value || "")
    .replace(/<[^>]*>/g, "")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&#39;", "'");
  const inferredLocation = rawEvents
    .map((event: any) => plainEventText(event.message || event.body || event.description))
    .map((message: string) => message.match(/(?: at | from )([^\.]+)\.?$/i)?.[1]?.trim() || "")
    .find(Boolean) || "";
  const invoices = rawEvents.flatMap((event: any) => {
    const source = String(event.message || event.body || event.description || "");
    const match = source.match(/href=["'](https:\/\/admin\.shopify\.com\/[^"']+tax_invoices[^"']+)["'][^>]*>([^<]+)</i);
    return match ? [{ label: plainEventText(match[2]) || "Fattura IVA", url: match[1] }] : [];
  });

  return {
    legacyId: String(order.id || orderId),
    name: String(order.name || `#${order.order_number || ""}`),
    createdAt: String(order.created_at || ""),
    processedAt: String(order.processed_at || ""),
    closedAt: String(order.closed_at || ""),
    confirmationNumber: String(order.confirmation_number || ""),
    financialStatus: String(order.financial_status || "pending").toUpperCase(),
    fulfillmentStatus: String(order.fulfillment_status || "unfulfilled").toUpperCase(),
    sourceName: String(order.source_name || "web"),
    locationName: locations.get(locationId) || inferredLocation,
    currency: String(order.currency || "EUR"),
    subtotal: Number(order.current_subtotal_price || order.subtotal_price || 0),
    discounts: Number(order.current_total_discounts || order.total_discounts || 0),
    tax: Number(order.current_total_tax || order.total_tax || 0),
    total: Number(order.current_total_price || order.total_price || 0),
    paid: Math.max(0, successfulPaid - successfulRefunds || Number(order.current_total_price || order.total_price || 0) - Number(order.total_outstanding || 0)),
    outstanding: Number(order.total_outstanding || 0),
    taxesIncluded: Boolean(order.taxes_included),
    taxLines: (order.tax_lines || []).map((tax: any) => ({ title: String(tax.title || "Imposta"), rate: Number(tax.rate || 0), price: Number(tax.price || 0) })),
    customer: {
      name: String(customerName || order.billing_address?.name || order.shipping_address?.name || "Nessun cliente"),
      email: String(order.customer?.email || order.email || ""),
      phone: String(order.customer?.phone || order.phone || order.billing_address?.phone || order.shipping_address?.phone || ""),
    },
    shippingAddress: addressOf(order.shipping_address),
    billingAddress: addressOf(order.billing_address),
    note: String(order.note || ""),
    noteAttributes: (order.note_attributes || []).map((attribute: any) => ({ name: String(attribute.name || ""), value: String(attribute.value || "") })),
    tags: String(order.tags || "").split(",").map((tag: string) => tag.trim()).filter(Boolean),
    lineItems: (order.line_items || []).map((item: any) => ({
      id: String(item.id || ""),
      title: String(item.title || item.name || "Articolo"),
      variantTitle: String(item.variant_title || ""),
      sku: String(item.sku || ""),
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.price || 0),
      lineTotal: Number(item.price || 0) * Number(item.quantity || 1),
      fulfillmentStatus: String(item.fulfillment_status || "unfulfilled").toUpperCase(),
      properties: (item.properties || []).filter((property: any) => property?.value).map((property: any) => ({ name: String(property.name || ""), value: String(property.value || "") })),
      staff: (item.attributed_staffs || []).map((entry: any) => String(entry.name || entry.staff_member_name || "")).filter(Boolean),
    })),
    fulfillments: (order.fulfillments || []).map((fulfillment: any) => ({
      id: String(fulfillment.id || ""),
      name: String(fulfillment.name || "Evasione"),
      status: String(fulfillment.status || "").toUpperCase(),
      createdAt: String(fulfillment.created_at || ""),
      locationName: locations.get(String(fulfillment.location_id || "")) || "",
      trackingCompany: String(fulfillment.tracking_company || ""),
      trackingNumber: String(fulfillment.tracking_number || ""),
      trackingUrl: String(fulfillment.tracking_url || ""),
    })),
    transactions: transactions.map((transaction: any) => ({
      id: String(transaction.id || ""),
      kind: String(transaction.kind || ""),
      gateway: String(transaction.gateway || ""),
      status: String(transaction.status || ""),
      amount: Number(transaction.amount || 0),
      currency: String(transaction.currency || order.currency || "EUR"),
      createdAt: String(transaction.processed_at || transaction.created_at || ""),
      paymentMethod: String(transaction.payment_details?.payment_method_name || transaction.receipt?.payment_method || ""),
      cardBrand: String(transaction.payment_details?.credit_card_company || ""),
      last4: String(transaction.payment_details?.credit_card_number || "").slice(-4),
    })),
    metafields: (metafieldsPayload.metafields || []).map((field: any) => ({ id: String(field.id || ""), namespace: String(field.namespace || ""), key: String(field.key || ""), value: String(field.value ?? ""), type: String(field.type || "") })),
    events: rawEvents.map((event: any) => ({
      id: String(event.id || ""),
      createdAt: String(event.created_at || ""),
      verb: String(event.verb || ""),
      message: plainEventText(event.message || event.body || ""),
      description: plainEventText(event.description || ""),
      author: String(event.author || ""),
    })),
    invoices,
  };
}

export async function fetchShopifyOrdersPage({
  after,
  first = 50,
}: {
  after?: string | null;
  first?: number;
} = {}): Promise<ShopifyOrdersPage> {
  const { shop, token } = shopifyConfig();
  const limit = Math.min(Math.max(first, 1), 100);
  const fields = [
    "id", "name", "created_at", "customer", "email", "phone", "note",
    "current_total_price", "total_price", "currency", "financial_status",
    "fulfillment_status", "source_name", "line_items", "shipping_address", "billing_address",
  ].join(",");
  const url = after
    ? `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?limit=${limit}&page_info=${encodeURIComponent(after)}&fields=${fields}`
    : `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?limit=${limit}&status=any&fields=${fields}`;

  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Shopify non disponibile (${response.status}).`);
  }

  const payload = await response.json();
  if (payload?.errors) {
    throw new Error(typeof payload.errors === "string" ? payload.errors : "Shopify ha restituito un errore.");
  }

  const nodes = Array.isArray(payload?.orders) ? payload.orders : [];
  const orders = nodes.map((order: any): ShopifyDashboardOrder => {
    const address = order.shipping_address || order.billing_address;
    const destination = [address?.city, address?.province_code || address?.province || address?.country].filter(Boolean).join(", ");
    const customerName = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ");
    const items = Array.isArray(order.line_items) ? order.line_items : [];

    return {
      id: String(order.id || ""),
      legacyId: String(order.id || ""),
      name: String(order.name || "Ordine"),
      createdAt: String(order.created_at || ""),
      customerName: String(customerName || "Nessun cliente"),
      email: String(order.customer?.email || order.email || ""),
      phone: String(order.customer?.phone || order.phone || address?.phone || ""),
      total: Number(order.current_total_price || order.total_price || 0),
      currency: String(order.currency || "EUR"),
      financialStatus: String(order.financial_status || "pending").toUpperCase(),
      fulfillmentStatus: String(order.fulfillment_status || "unfulfilled").toUpperCase(),
      sourceName: String(order.source_name || "web"),
      itemCount: items.reduce((total: number, item: any) => total + Number(item.quantity || 1), 0),
      items: items.slice(0, 12).map((item: any) => ({ title: String(item.title || "Articolo"), quantity: Number(item.quantity || 1) })),
      note: String(order.note || ""),
      destination,
    };
  });

  const nextLink = response.headers.get("link")
    ?.split(",")
    .find((part) => /rel="next"/.test(part));
  const nextUrl = nextLink?.match(/<([^>]+)>/)?.[1];
  const nextCursor = nextUrl ? new URL(nextUrl).searchParams.get("page_info") : null;

  return {
    orders,
    hasNextPage: Boolean(nextCursor),
    endCursor: nextCursor,
  };
}
