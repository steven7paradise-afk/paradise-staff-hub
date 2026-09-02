import { NextRequest, NextResponse } from "next/server";
import { getOperationalUser } from "@/lib/operational-session";
import { automaticDailyCashSummary } from "@/lib/daily-cash-closing";

export async function GET(request: NextRequest) {
  const user = await getOperationalUser(request);
  if (!user?.id || !user.sedeId) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const date = String(request.nextUrl.searchParams.get("date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Data non valida" }, { status: 400 });
  }

  const summary = await automaticDailyCashSummary(date, user.sedeId);

  if (!summary.available) {
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

  const rows = summary.shopifyRows.map((row) => ({
    ...row,
    method: "Cashmatic",
    controlResponseId: summary.controlRows.find((control) => control.order.replace(/^#/, "").trim().toLowerCase() === row.orderName.replace(/^#/, "").trim().toLowerCase())?.responseId ?? null,
    controlClientName: summary.controlRows.find((control) => control.order.replace(/^#/, "").trim().toLowerCase() === row.orderName.replace(/^#/, "").trim().toLowerCase())?.clientName ?? null,
  }));

  return NextResponse.json({
    available: true,
    date,
    total: summary.shopifyCash,
    card: 0,
    cash: summary.shopifyCash,
    other: 0,
    orders: rows.length,
    transactions: summary.transactions,
    controlDeclaredCash: summary.controlDeclaredCash,
    difference: summary.difference,
    rows,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
