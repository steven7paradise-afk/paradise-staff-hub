import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { prisma } from "@/lib/prisma";
import { classifyShopifyPaymentMethod } from "@/lib/shopify";

export type ShopifyPaymentRegisterRow = {
  id: string;
  responseId: string;
  createdAt: Date;
  locationName: string | null;
  method: string;
  verified: boolean;
  amount: number;
  order: string;
  clientName: string;
  gateway: string;
  status: string;
  reference: string;
  declaredAmount: number;
  declaredMethod: string;
};

export type ShopifyDailyRevenue = {
  total: number;
  card: number;
  cash: number;
  cashmatic: number;
  unclassified: number;
  transactions: number;
  available: boolean;
  payments: Array<{
    id: string;
    orderId: string;
    orderName: string;
    clientName: string;
    amount: number;
    method: "CARTA" | "CASHMATIC" | "CONTANTI" | "DA_VERIFICARE";
    provider: string;
    gateway: string;
    processedAt: string;
  }>;
};

export type ShopifyRevenuePayment = ShopifyDailyRevenue["payments"][number];

function moneyValue(value: unknown) {
  const amount = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(amount) ? amount : 0;
}

function paymentDate(value: unknown, fallback: Date) {
  const parsed = value ? new Date(String(value)) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : fallback;
}

function romeDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function romeOffset(dateKey: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    timeZoneName: "longOffset",
  });
  const value = formatter.formatToParts(new Date(`${dateKey}T12:00:00Z`))
    .find((part) => part.type === "timeZoneName")?.value || "GMT+01:00";
  return value.replace("GMT", "");
}

function paymentProvider(gateway: unknown, method: string) {
  const value = String(gateway ?? "").trim().toLowerCase();
  if (value.includes("scalapay")) return "SCALAPAY";
  if (value.includes("klarna")) return "KLARNA";
  if (value.includes("satispay")) return "SATISPAY";
  if (value.includes("paypal")) return "PAYPAL";
  if (value.includes("shopify payments") || value.includes("shopify_payments")) return "SHOPIFY_PAYMENTS";
  if (method === "CONTANTI") return "CONTANTI";
  if (method === "CASHMATIC") return "CONTANTI";
  if (method === "CARTA") return "CARTA";
  return "ALTRO";
}

/**
 * Reads the successful Shopify transactions for one Rome calendar day.
 * This source is independent from client-control forms, so a paid POS order
 * is counted even before staff complete the operational control.
 */
export async function getShopifyRevenueRange(startDateKey: string, endDateKey: string): Promise<ShopifyDailyRevenue> {
  const empty: ShopifyDailyRevenue = { total: 0, card: 0, cash: 0, cashmatic: 0, unclassified: 0, transactions: 0, available: false, payments: [] };
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shop || !token || !/^\d{4}-\d{2}-\d{2}$/.test(startDateKey) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateKey)) return empty;

  const start = new Date(`${startDateKey}T00:00:00${romeOffset(startDateKey)}`);
  const end = new Date(`${endDateKey}T00:00:00${romeOffset(endDateKey)}`);
  const headers = { "X-Shopify-Access-Token": token, "Content-Type": "application/json" };
  const initialUrl = new URL(`https://${shop}/admin/api/2024-04/orders.json`);
  initialUrl.searchParams.set("status", "any");
  initialUrl.searchParams.set("limit", "250");
  initialUrl.searchParams.set("updated_at_min", start.toISOString());
  initialUrl.searchParams.set("updated_at_max", end.toISOString());
  initialUrl.searchParams.set("fields", "id,name,customer,email,updated_at");

  try {
    const orders: Array<{
      id: string | number;
      name?: string;
      customer?: { first_name?: string; last_name?: string; email?: string } | null;
      email?: string;
    }> = [];
    let nextUrl: string | null = initialUrl.toString();
    for (let page = 0; nextUrl && page < 20; page += 1) {
      const response: Response = await fetch(nextUrl, { headers, signal: AbortSignal.timeout(12000), next: { revalidate: 300 } });
      if (!response.ok) throw new Error(`Shopify orders ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data?.orders)) orders.push(...data.orders);
      nextUrl = response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/i)?.[1] || null;
    }

    const transactionGroups: Array<{ order: (typeof orders)[number]; transactions: any[] }> = [];
    for (let index = 0; index < orders.length; index += 8) {
      const batch = orders.slice(index, index + 8);
      const results = await Promise.all(batch.map(async (order) => {
        const response = await fetch(`https://${shop}/admin/api/2024-04/orders/${order.id}/transactions.json`, {
          headers,
          signal: AbortSignal.timeout(12000),
          next: { revalidate: 300 },
        });
        if (!response.ok) return { order, transactions: [] };
        const data = await response.json();
        return { order, transactions: Array.isArray(data?.transactions) ? data.transactions : [] };
      }));
      transactionGroups.push(...results);
    }

    const seen = new Set<string>();
    const totals = { ...empty, available: true };
    for (const group of transactionGroups) {
      for (const transaction of group.transactions) {
      const id = String(transaction?.id || transaction?.authorization || "");
      const processedAt = paymentDate(transaction?.processed_at || transaction?.created_at, new Date(0));
      if (!id || seen.has(id) || processedAt < start || processedAt >= end) continue;
      if (String(transaction?.status).toLowerCase() !== "success") continue;
      if (!["sale", "capture"].includes(String(transaction?.kind).toLowerCase())) continue;
      const amount = moneyValue(transaction?.amount);
      if (amount <= 0) continue;
      seen.add(id);
      const method = classifyShopifyPaymentMethod([String(transaction?.gateway || "")]);
      totals.total += amount;
      totals.transactions += 1;
      if (method === "CARTA") totals.card += amount;
      else if (method === "CONTANTI") totals.cash += amount;
      else if (method === "CASHMATIC") totals.cash += amount;
      else totals.unclassified += amount;
      const firstName = String(group.order.customer?.first_name || "").trim();
      const lastName = String(group.order.customer?.last_name || "").trim();
      totals.payments.push({
        id,
        orderId: String(group.order.id),
        orderName: String(group.order.name || group.order.id),
        clientName: [firstName, lastName].filter(Boolean).join(" ") || "Cliente Shopify",
        amount,
        method,
        provider: paymentProvider(transaction?.gateway, method),
        gateway: String(transaction?.gateway || ""),
        processedAt: processedAt.toISOString(),
      });
      }
    }
    totals.payments.sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime());
    return totals;
  } catch (error) {
    console.error("Unable to load Shopify daily revenue:", error);
    return empty;
  }
}

export async function getShopifyDailyRevenue(dateKey: string): Promise<ShopifyDailyRevenue> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { total: 0, card: 0, cash: 0, cashmatic: 0, unclassified: 0, transactions: 0, available: false, payments: [] };
  }
  const end = new Date(`${dateKey}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const endKey = end.toISOString().slice(0, 10);
  return getShopifyRevenueRange(dateKey, endKey);
}

export async function getShopifyPaymentRegister(options: {
  start: Date;
  end: Date;
  locationId?: string | null;
}) {
  const forms = await prisma.serviceForm.findMany({
    where: { active: true },
    select: { id: true, name: true, category: true },
  });
  const formIds = forms
    .filter((form) => isClientControlFormName(form.name, form.category))
    .map((form) => form.id);

  if (!formIds.length) return [];

  const responses = await prisma.serviceFormResponse.findMany({
    where: {
      form_id: { in: formIds },
      created_at: { gte: options.start, lt: options.end },
      ...(options.locationId ? { user_location_id: options.locationId } : {}),
    },
    select: {
      id: true,
      created_at: true,
      user_location_name: true,
      answers: true,
    },
    orderBy: { created_at: "desc" },
  });

  return responses
    .flatMap((response): ShopifyPaymentRegisterRow[] => {
      const answers = response.answers as Record<string, unknown>;
      const storedMethod = String(answers[CLIENT_CONTROL_FIELD_IDS.paymentMethod] || "DA_VERIFICARE").toUpperCase();
      const gateway = String(answers[CLIENT_CONTROL_FIELD_IDS.paymentGateway] || "");
      // Cashmatic is cash for reporting, filtering and reconciliation.
      // This also normalizes historical responses already stored as CASHMATIC.
      const method = storedMethod === "CASHMATIC" ? "CONTANTI" : storedMethod;
      const legacyDeclaredMethod = gateway.match(/Dichiarato manualmente:\s*([^·,]+)/i)?.[1]?.trim() || "";
      const baseRow = {
        id: response.id,
        responseId: response.id,
        // A payment belongs to the day in which Shopify processed the
        // transaction, not to the day in which staff submitted the form.
        createdAt: paymentDate(answers[CLIENT_CONTROL_FIELD_IDS.paymentProcessedAt], response.created_at),
        locationName: response.user_location_name,
        method,
        verified: answers[CLIENT_CONTROL_FIELD_IDS.paymentVerified] === true,
        amount: moneyValue(answers[CLIENT_CONTROL_FIELD_IDS.paid]),
        order: String(answers.second_shopify_order || answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder] || ""),
        clientName: String(answers[CLIENT_CONTROL_FIELD_IDS.clientName] || "Cliente"),
        gateway,
        status: String(answers[CLIENT_CONTROL_FIELD_IDS.paymentStatus] || ""),
        reference: String(answers[CLIENT_CONTROL_FIELD_IDS.paymentReference] || ""),
        declaredAmount: moneyValue(answers.client_control_declared_paid ?? answers[CLIENT_CONTROL_FIELD_IDS.paid]),
        declaredMethod: String(answers.client_control_declared_payment_method || legacyDeclaredMethod || storedMethod || ""),
      };
      const breakdown = Array.isArray(answers.client_control_payment_breakdown)
        ? answers.client_control_payment_breakdown.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        : [];
      // Once Shopify has returned its transaction breakdown, that is the
      // authoritative source for amount, method and processed date. This also
      // prevents a declared form total from being counted a second time.
      if (breakdown.length > 0) {
        return breakdown.map((item, index) => ({
          ...baseRow,
          id: `${response.id}:${index}`,
          createdAt: paymentDate(item.processedAt, baseRow.createdAt),
          method: String(item.method || "DA_VERIFICARE").toUpperCase(),
          amount: moneyValue(item.amount),
          gateway: String(item.gateway || ""),
          reference: String(item.reference || ""),
        }));
      }
      return [baseRow];
    })
    .filter((payment) => Boolean(payment.order) || payment.verified || payment.method !== "DA_VERIFICARE");
}
