import { NextRequest, NextResponse } from "next/server";
import { createNotifications } from "@/lib/notifications";
import { getOperationalUser } from "@/lib/operational-session";
import { prisma } from "@/lib/prisma";

const requestRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
const confirmRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

function text(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function POST(request: NextRequest) {
  const actor = await getOperationalUser(request);
  if (!actor?.id || !requestRoles.has(actor.role)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = text(body.action).toUpperCase();
  const orderId = text(body.orderId);

  if (!orderId || !["REQUEST", "CONFIRM"].includes(action)) {
    return NextResponse.json({ error: "Pagamento o azione non validi." }, { status: 400 });
  }

  if (action === "CONFIRM") {
    if (!confirmRoles.has(actor.role)) {
      return NextResponse.json({ error: "Solo un amministratore può confermare il controllo." }, { status: 403 });
    }

    const existing = await prisma.shopifyPaymentReview.findUnique({ where: { order_id: orderId } });
    if (!existing) {
      return NextResponse.json({ error: "Richiesta di controllo non trovata." }, { status: 404 });
    }

    const review = await prisma.shopifyPaymentReview.update({
      where: { order_id: orderId },
      data: {
        status: "CONFIRMED",
        confirmed_by_id: actor.id,
        confirmed_by_name: actor.name || actor.email || actor.id,
        confirmed_at: new Date(),
      },
    });

    if (existing.requested_by_id !== actor.id && existing.requested_by_id !== "PC_CASSA") {
      await createNotifications([{
        user_id: existing.requested_by_id,
        title: "Pagamento controllato",
        message: `${existing.order_name} · ${existing.client_name} è stato confermato manualmente da ${actor.name || "un amministratore"}.`,
        type: "SHOPIFY_PAYMENT_REVIEW_CONFIRMED",
        action_url: `/cash/shopify-payments?status=VERIFICATI&review=${review.id}#payment-${review.id}`,
      }]).catch((error) => console.error("Unable to notify payment requester:", error));
    }

    return NextResponse.json({ ok: true, review });
  }

  const orderName = text(body.orderName) || orderId;
  const clientName = text(body.clientName) || "Cliente Shopify";
  const processedAt = text(body.processedAt);
  const parsedDate = processedAt ? new Date(processedAt) : new Date();
  const dateKey = Number.isFinite(parsedDate.getTime())
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsedDate)
    : "";
  const month = dateKey.slice(0, 7);
  const methods = Array.isArray(body.methods) ? body.methods.map(text).filter(Boolean) : [];

  const review = await prisma.shopifyPaymentReview.upsert({
    where: { order_id: orderId },
    create: {
      order_id: orderId,
      order_name: orderName,
      client_name: clientName,
      amount: money(body.amount),
      methods,
      response_id: text(body.responseId) || null,
      status: "REQUESTED",
      requested_by_id: actor.id,
      requested_by_name: actor.name || actor.email || actor.id,
    },
    update: {
      order_name: orderName,
      client_name: clientName,
      amount: money(body.amount),
      methods,
      response_id: text(body.responseId) || null,
      status: "REQUESTED",
      requested_by_id: actor.id,
      requested_by_name: actor.name || actor.email || actor.id,
      requested_at: new Date(),
      confirmed_by_id: null,
      confirmed_by_name: null,
      confirmed_at: null,
    },
  });

  const administrators = await prisma.user.findMany({
    where: { active: true, role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] } },
    select: { id: true },
  });
  const actionUrl = `/cash/shopify-payments?${month ? `month=${month}&` : ""}${dateKey ? `date=${dateKey}&` : ""}status=DA_CONTROLLARE&review=${review.id}#payment-${review.id}`;
  await createNotifications(
    administrators
      .filter((admin) => admin.id !== actor.id)
      .map((admin) => ({
        user_id: admin.id,
        title: "Pagamento da controllare",
        message: `${orderName} · ${clientName} · € ${money(body.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}. Richiesto da ${actor.name || "reception"}.`,
        type: "SHOPIFY_PAYMENT_REVIEW_REQUESTED",
        action_url: actionUrl,
      })),
  );

  return NextResponse.json({ ok: true, review, notified: administrators.length });
}
