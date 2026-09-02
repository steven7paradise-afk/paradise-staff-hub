import { getShopifyDailyRevenue, getShopifyPaymentRegister } from "@/lib/shopify-payment-register";

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function cleanOrder(value: string) {
  return value.replace(/^#/, "").trim().toLowerCase();
}

function romeOffset(dateKey: string) {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    timeZoneName: "longOffset",
  }).formatToParts(new Date(`${dateKey}T12:00:00Z`))
    .find((part) => part.type === "timeZoneName")?.value || "GMT+01:00";
  return value.replace("GMT", "");
}

function nextDateKey(dateKey: string) {
  const value = new Date(`${dateKey}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function isDeclaredCash(method: string) {
  const normalized = method.trim().toUpperCase();
  return normalized.includes("CASHMATIC") || normalized.includes("CONTANT");
}

export function romeDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isBeforeDailyClosingTime(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));
  return hour < 19;
}

export async function automaticDailyCashSummary(dateKey: string, locationId: string) {
  const endKey = nextDateKey(dateKey);
  const start = new Date(`${dateKey}T00:00:00${romeOffset(dateKey)}`);
  const end = new Date(`${endKey}T00:00:00${romeOffset(endKey)}`);
  const [shopify, controls] = await Promise.all([
    getShopifyDailyRevenue(dateKey),
    getShopifyPaymentRegister({ start, end, locationId }),
  ]);

  const declarations = new Map<string, {
    responseId: string;
    order: string;
    clientName: string;
    declaredAmount: number;
    declaredMethod: string;
  }>();

  for (const control of controls) {
    if (declarations.has(control.responseId)) continue;
    const declaredMethod = control.declaredMethod || control.method;
    if (!isDeclaredCash(declaredMethod)) continue;
    declarations.set(control.responseId, {
      responseId: control.responseId,
      order: control.order,
      clientName: control.clientName,
      declaredAmount: roundMoney(control.declaredAmount),
      declaredMethod,
    });
  }

  const shopifyRowsByOrder = new Map<string, {
    orderId: string;
    orderName: string;
    clientName: string;
    amount: number;
    processedAt: string;
  }>();
  for (const payment of shopify.payments) {
    if (payment.method !== "CONTANTI" && payment.method !== "CASHMATIC") continue;
    const key = cleanOrder(payment.orderName) || payment.orderId;
    const current = shopifyRowsByOrder.get(key);
    if (current) {
      current.amount = roundMoney(current.amount + payment.amount);
      continue;
    }
    shopifyRowsByOrder.set(key, {
      orderId: payment.orderId,
      orderName: payment.orderName,
      clientName: payment.clientName || "Cliente Shopify",
      amount: roundMoney(payment.amount),
      processedAt: payment.processedAt,
    });
  }

  const controlRows = Array.from(declarations.values()).map((declaration) => {
    const shopifyRow = shopifyRowsByOrder.get(cleanOrder(declaration.order));
    return {
      ...declaration,
      shopifyAmount: shopifyRow?.amount ?? null,
    };
  });
  const declaredOrderKeys = new Set(controlRows.map((row) => cleanOrder(row.order)).filter(Boolean));
  const shopifyRows = Array.from(shopifyRowsByOrder.values()).map((row) => ({
    ...row,
    controlDeclaredAmount: controlRows.find((control) => cleanOrder(control.order) === cleanOrder(row.orderName))?.declaredAmount ?? null,
  }));
  const shopifyOnlyRows = shopifyRows.filter((row) => !declaredOrderKeys.has(cleanOrder(row.orderName)));
  const controlDeclaredCash = roundMoney(controlRows.reduce((sum, row) => sum + row.declaredAmount, 0));
  const shopifyCash = roundMoney(shopify.cash);

  return {
    available: shopify.available,
    date: dateKey,
    before19: isBeforeDailyClosingTime(),
    controlDeclaredCash,
    shopifyCash,
    difference: roundMoney(controlDeclaredCash - shopifyCash),
    controlCount: controlRows.length,
    shopifyOrders: shopifyRows.length,
    transactions: shopify.transactions,
    controlRows,
    shopifyRows,
    shopifyOnlyRows,
    cashOrders: controlRows.map((row) => ({
      order: row.order || `Controllo ${row.responseId}`,
      amount: row.declaredAmount,
      clientName: row.clientName,
      declaredMethod: row.declaredMethod,
      controlResponseId: row.responseId,
      shopifyAmount: row.shopifyAmount,
    })),
  };
}
