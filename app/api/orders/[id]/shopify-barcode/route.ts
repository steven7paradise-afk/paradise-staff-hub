import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getShopifyOrderIdentity } from "@/lib/shopify";
import { getOperationalUser } from "@/lib/operational-session";

type RouteParams = { params: Promise<{ id: string }> };
type OrderField = { id: string; label?: string | null };
type OrderForBarcode = {
  id: string;
  answers: unknown;
  form?: { fields?: unknown } | null;
};

function answersRecord(order: OrderForBarcode) {
  return order.answers && typeof order.answers === "object" && !Array.isArray(order.answers)
    ? (order.answers as Record<string, unknown>)
    : {};
}

function formFields(order: OrderForBarcode): OrderField[] {
  return Array.isArray(order.form?.fields) ? (order.form.fields as OrderField[]) : [];
}

function answerById(order: OrderForBarcode, id: string) {
  const value = answersRecord(order)[id];
  return typeof value === "string" ? value.trim() : "";
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
}

function fieldValue(order: OrderForBarcode, includes: string[]) {
  const fields = formFields(order);
  const match = fields.find((field) => {
    const label = (field.label || "").toLowerCase();
    return includes.some((item) => label.includes(item));
  });
  return match ? displayValue(answersRecord(order)[match.id]) : "";
}

function orderNumber(order: OrderForBarcode) {
  return (
    answerById(order, "order_title") ||
    fieldValue(order, ["numero ordine", "ordine shopify", "codice ordine", "ordine"]) ||
    order.id.slice(0, 8)
  );
}

function shopifyUrlOrderId(order: OrderForBarcode) {
  const fields = formFields(order);
  const haystack = [
    JSON.stringify(answersRecord(order)),
    ...fields.map((field) => displayValue(answersRecord(order)[field.id])),
  ].join(" ");
  const match = haystack.match(/admin\.shopify\.com\/store\/[^/\s]+\/orders\/(\d+)/i);
  return match?.[1] ?? null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getOperationalUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const response = await prisma.serviceFormResponse.findUnique({
      where: { id },
      select: { id: true, answers: true, form: { select: { fields: true } } },
    });

    if (!response) {
      return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 });
    }

    const visibleOrderNumber = orderNumber(response);
    const orderIdFromUrl = shopifyUrlOrderId(response);
    const identity = await getShopifyOrderIdentity(orderIdFromUrl || visibleOrderNumber);
    const fallback = (orderIdFromUrl || visibleOrderNumber).replace(/^#/, "").trim() || response.id;

    return NextResponse.json({
      barcodeValue: identity?.id || fallback,
      shopifyOrderId: identity?.id || null,
      shopifyOrderName: identity?.name || visibleOrderNumber,
      shopifyAdminUrl: identity?.adminUrl || `https://admin.shopify.com/store/c1uzax-u0/orders/${fallback}`,
    });
  } catch (error) {
    console.error("Failed to resolve Shopify barcode:", error);
    return NextResponse.json({ error: "Errore durante la lettura del codice Shopify." }, { status: 500 });
  }
}
