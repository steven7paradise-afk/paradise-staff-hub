import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { prisma } from "@/lib/prisma";
import { getShopifyDailyRevenue, getShopifyPaymentRegister, shopifyOrderMatchKeys } from "@/lib/shopify-payment-register";

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
  const [shopify, controls, clientControlForms] = await Promise.all([
    getShopifyDailyRevenue(dateKey),
    getShopifyPaymentRegister({ start, end, locationId }),
    prisma.serviceForm.findMany({
      where: { active: true },
      select: { id: true, name: true, category: true },
    }),
  ]);

  const clientControlFormIds = clientControlForms
    .filter((form) => isClientControlFormName(form.name, form.category))
    .map((form) => form.id);
  const rawCompletedControls = clientControlFormIds.length
    ? await prisma.serviceFormResponse.findMany({
        where: {
          form_id: { in: clientControlFormIds },
          user_location_id: locationId,
          OR: [
            { created_at: { gte: start, lt: end } },
            { updated_at: { gte: start, lt: end } },
          ],
        },
        select: { id: true, answers: true, created_at: true, updated_at: true },
        orderBy: { updated_at: "desc" },
      })
    : [];
  const todayControlRows = rawCompletedControls
    .map((response) => {
      const answers = response.answers as Record<string, unknown>;
      return {
        responseId: response.id,
        clientName: String(answers[CLIENT_CONTROL_FIELD_IDS.clientName] || "Cliente").trim() || "Cliente",
        order: String(answers.second_shopify_order || answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder] || "").trim(),
        result: String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] || "Completato").trim() || "Completato",
        completedAt: response.updated_at.toISOString(),
        completed: answers.client_control_is_draft !== true
          && String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] || "").trim().toLowerCase() !== "bozza",
      };
    });
  const allCompletedControlRows = todayControlRows
    .filter((row) => row.completed)
    .map((row) => ({
      responseId: row.responseId,
      clientName: row.clientName,
      order: row.order,
      result: row.result,
      completedAt: row.completedAt,
    }));

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
    const shopifyRow = shopifyOrderMatchKeys(declaration.order)
      .map((key) => shopifyRowsByOrder.get(key))
      .find(Boolean);
    return {
      ...declaration,
      shopifyAmount: shopifyRow?.amount ?? null,
    };
  }).filter((row) => row.shopifyAmount != null);
  const shopifyCashOrderKeys = new Set(shopifyRowsByOrder.keys());
  const completedControlRows = allCompletedControlRows.filter((row) => (
    shopifyOrderMatchKeys(row.order).some((key) => shopifyCashOrderKeys.has(key))
  ));
  const completedControlOrderKeys = new Set(completedControlRows.flatMap((row) => shopifyOrderMatchKeys(row.order)));
  const declaredOrderKeys = new Set(controlRows.flatMap((row) => shopifyOrderMatchKeys(row.order)));
  const shopifyRows = Array.from(shopifyRowsByOrder.values()).map((row) => ({
    ...row,
    controlDeclaredAmount: controlRows.find((control) => (
      shopifyOrderMatchKeys(control.order).some((key) => key === cleanOrder(row.orderName))
    ))?.declaredAmount ?? null,
  }));
  const missingControlRows = shopifyRows
    .filter((row) => !shopifyOrderMatchKeys(row.orderName).some((key) => completedControlOrderKeys.has(key)))
    .map((row) => {
      const startedToday = todayControlRows.find((control) => (
        shopifyOrderMatchKeys(control.order).some((key) => key === cleanOrder(row.orderName))
      ));
      const linkedControl = controlRows.find((control) => (
        shopifyOrderMatchKeys(control.order).some((key) => key === cleanOrder(row.orderName))
      ));
      const startedControl = startedToday || linkedControl;
      return {
        orderId: row.orderId,
        order: row.orderName || row.orderId,
        clientName: startedControl?.clientName || row.clientName,
        amount: row.amount,
        state: startedControl ? "INCOMPLETA" as const : "MANCANTE" as const,
        controlResponseId: startedControl?.responseId || null,
      };
    });
  const shopifyOnlyRows = shopifyRows.filter((row) => !declaredOrderKeys.has(cleanOrder(row.orderName)));
  const controlDeclaredCash = roundMoney(controlRows.reduce((sum, row) => sum + row.declaredAmount, 0));
  const controlShopifyCash = roundMoney(controlRows.reduce((sum, row) => sum + (row.shopifyAmount || 0), 0));
  const shopifyCash = roundMoney(shopify.cash);
  const matchedControlDifference = roundMoney(controlRows.reduce((sum, row) => (
    row.shopifyAmount == null ? sum : sum + row.declaredAmount - row.shopifyAmount
  ), 0));

  return {
    available: shopify.available,
    date: dateKey,
    before19: isBeforeDailyClosingTime(),
    controlDeclaredCash,
    controlShopifyCash,
    shopifyCash,
    difference: matchedControlDifference,
    controlCount: controlRows.length,
    completedControlCount: completedControlRows.length,
    completedControlRows,
    missingControlCount: missingControlRows.length,
    missingControlCash: roundMoney(missingControlRows.reduce((sum, row) => sum + row.amount, 0)),
    missingControlRows,
    shopifyOrders: shopifyRows.length,
    transactions: shopify.transactions,
    controlRows,
    shopifyRows,
    shopifyOnlyRows,
    cashOrders: shopifyRows.map((row) => ({
      order: row.orderName || row.orderId,
      amount: row.amount,
      clientName: controlRows.find((control) => (
        shopifyOrderMatchKeys(control.order).some((key) => key === cleanOrder(row.orderName))
      ))?.clientName || row.clientName,
      declaredMethod: "Contanti · rilevati automaticamente da Shopify",
      controlResponseId: controlRows.find((control) => (
        shopifyOrderMatchKeys(control.order).some((key) => key === cleanOrder(row.orderName))
      ))?.responseId || null,
      shopifyAmount: row.amount,
    })),
  };
}
