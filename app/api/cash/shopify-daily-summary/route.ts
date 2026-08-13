import { NextRequest, NextResponse } from "next/server";
import { getOperationalUser } from "@/lib/operational-session";
import { getShopifyDailyRevenue, getShopifyPaymentRegister } from "@/lib/shopify-payment-register";

const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

function cleanOrder(value: string) {
  return value.replace(/^#/, "").trim().toLowerCase();
}

function providerLabel(value: string) {
  return ({
    SHOPIFY_PAYMENTS: "Carta / Shopify Payments",
    SCALAPAY: "Scalapay",
    KLARNA: "Klarna",
    SATISPAY: "Satispay",
    PAYPAL: "PayPal",
    CONTANTI: "Contanti",
    CASHMATIC: "Contanti",
    CARTA: "Carta / POS",
    ALTRO: "Da classificare",
  } as Record<string, string>)[value] || value;
}

export async function GET(request: NextRequest) {
  const user = await getOperationalUser(request);
  if (!user?.id || (!user.isPC && !managementRoles.has(user.role))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const date = String(request.nextUrl.searchParams.get("date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Data non valida" }, { status: 400 });
  }

  const monthStart = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  const [shopify, controls] = await Promise.all([
    getShopifyDailyRevenue(date),
    getShopifyPaymentRegister({
      start: monthStart,
      end: monthEnd,
      locationId: user.sedeId || null,
    }),
  ]);

  if (!shopify.available) {
    return NextResponse.json({
      available: false,
      date,
      total: 0,
      card: 0,
      cash: 0,
      other: 0,
      orders: 0,
      rows: [],
      message: "Shopify non è disponibile in questo momento.",
    });
  }

  const controlsByOrder = new Map<string, typeof controls>();
  for (const control of controls) {
    const key = cleanOrder(control.order);
    if (!key) continue;
    controlsByOrder.set(key, [...(controlsByOrder.get(key) || []), control]);
  }

  const grouped = new Map<string, {
    orderId: string;
    orderName: string;
    clientName: string;
    amount: number;
    providers: string[];
    processedAt: string;
  }>();

  for (const payment of shopify.payments) {
    const current = grouped.get(payment.orderId);
    if (current) {
      current.amount += payment.amount;
      current.providers = [...new Set([...current.providers, payment.provider])];
      continue;
    }
    const control = controlsByOrder.get(cleanOrder(payment.orderName))?.[0];
    grouped.set(payment.orderId, {
      orderId: payment.orderId,
      orderName: payment.orderName,
      clientName: control?.clientName || payment.clientName || "Cliente Shopify",
      amount: payment.amount,
      providers: [payment.provider],
      processedAt: payment.processedAt,
    });
  }

  const rows = Array.from(grouped.values())
    .map((row) => ({
      ...row,
      method: row.providers.map(providerLabel).join(" + "),
    }))
    .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime());

  return NextResponse.json({
    available: true,
    date,
    total: shopify.total,
    card: shopify.card,
    cash: shopify.cash,
    other: shopify.unclassified,
    orders: rows.length,
    transactions: shopify.transactions,
    rows,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
