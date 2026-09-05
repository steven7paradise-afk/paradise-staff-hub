import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendShopifyOrderNote, getShopifyOrderCowlendarText, getShopifyOrderNoteText, extractShopifyOrderCodes } from "@/lib/shopify";
import { getOperationalUser } from "@/lib/operational-session";

export async function GET(request: NextRequest) {
  const operationalUser = await getOperationalUser(request);
  const isAuthorized = Boolean(operationalUser?.id);

  if (!isAuthorized) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orderName = searchParams.get("orderName");
  const bookingId = searchParams.get("bookingId");
  const clientNameParam = searchParams.get("clientName");
  const cleanOrder = orderName ? orderName.replace(/^#/, "").trim() : "";
  const cleanBookingId = bookingId ? bookingId.trim() : "";
  const cleanClientName = clientNameParam ? clientNameParam.trim().toLowerCase() : "";
  const appointmentDateParam = searchParams.get("appointmentDate");
  const appointmentDate = appointmentDateParam ? new Date(appointmentDateParam) : null;
  const appointmentTimestamp = appointmentDate && Number.isFinite(appointmentDate.getTime())
    ? appointmentDate.getTime()
    : Number.POSITIVE_INFINITY;

  try {
    const [comments, shopifyNote, cowlendarOrderNote, responseByBooking, rawResponses] = await Promise.all([
      prisma.shopifyOrderComment.findMany({
        where: {
          OR: [
            ...(orderName ? [{ order_name: orderName }] : []),
            ...(bookingId ? [{ order_name: bookingId }] : []),
          ],
        },
        orderBy: { created_at: "asc" },
      }),
      orderName ? getShopifyOrderNoteText(orderName) : Promise.resolve(null),
      orderName ? getShopifyOrderCowlendarText(orderName) : Promise.resolve(null),
      cleanBookingId
        ? prisma.serviceFormResponse.findFirst({
            where: {
              answers: { path: ["booking_id"], equals: cleanBookingId },
            },
            orderBy: { updated_at: "desc" },
            select: { id: true, answers: true, created_at: true },
          })
        : Promise.resolve(null),
      prisma.serviceFormResponse.findMany({
        orderBy: { created_at: "desc" },
        take: 250,
        select: { id: true, answers: true, created_at: true },
      }),
    ]);

    const responseByOrder = rawResponses.find((r) => {
      const ans = (r.answers || {}) as Record<string, any>;
      const rBookingId = String(ans.booking_id || "").trim();
      const rOrder = String(ans.client_control_shopify_order || "").replace(/^#/, "").trim();

      if (cleanBookingId && rBookingId === cleanBookingId) return true;
      if (cleanOrder && rOrder === cleanOrder) return true;
      return false;
    });
    const existingControl = responseByBooking || responseByOrder || null;
    const lastVisit = cleanClientName
      ? rawResponses.find((response) => {
          if (response.id === existingControl?.id) return false;
          const answers = (response.answers || {}) as Record<string, any>;
          const responseClientName = String(answers.client_control_client_name || "").trim().toLowerCase();
          const isDraft = Boolean(answers.client_control_is_draft);
          const correctness = String(answers.client_control_correctness || "");
          return responseClientName === cleanClientName
            && !isDraft
            && !/no\s*show|non presentat/i.test(correctness)
            && response.created_at.getTime() < appointmentTimestamp;
        })
      : null;

    return NextResponse.json({
      comments,
      shopifyNote,
      cowlendarOrderNote,
      existingControl: existingControl ? { id: existingControl.id, answers: existingControl.answers } : null,
      lastVisitAt: lastVisit?.created_at.toISOString() || null,
    });
  } catch (error) {
    console.error("Failed to fetch appointment comments:", error);
    return NextResponse.json({ error: "Errore durante il recupero dei commenti" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const operationalUser = await getOperationalUser(request);
  const isAuthorized = Boolean(operationalUser?.id);
  const sessionUserName = operationalUser?.name || operationalUser?.email || operationalUser?.id || "Staff";
  const sessionUserRole = operationalUser?.role || "DIPENDENTE";

  if (!isAuthorized) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orderName, bookingId, message, signedBy } = body;

    if (!message?.trim() || (!orderName && !bookingId)) {
      return NextResponse.json({ error: "Dati incompleti" }, { status: 400 });
    }

    const key = orderName || bookingId;
    const authorName = signedBy ? signedBy : sessionUserName;
    
    const comment = await prisma.shopifyOrderComment.create({
      data: {
        order_name: key,
        user_name: authorName,
        user_role: sessionUserRole,
        message: message.trim() + (signedBy ? ` [Tramite cassa: ${sessionUserName}]` : ""),
      },
    });

    const targetOrderCodes = extractShopifyOrderCodes(orderName);
    for (const code of targetOrderCodes) {
      appendShopifyOrderNote(code, authorName, message.trim() + (signedBy ? ` [Cassa: ${sessionUserName}]` : ""))
        .catch((err) => console.error(`Failed to sync comment to Shopify order ${code}:`, err));
    }

    return NextResponse.json(comment);
  } catch (error) {
    console.error("Failed to create appointment comment:", error);
    return NextResponse.json({ error: "Errore durante il salvataggio del commento" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const operationalUser = await getOperationalUser(request);
  const isAuthorized = Boolean(operationalUser?.id);
  const sessionUserName = operationalUser?.name || operationalUser?.email || operationalUser?.id || "Staff";
  const sessionUserRole = operationalUser?.role || "DIPENDENTE";

  if (!isAuthorized) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID mancante" }, { status: 400 });
  }

  try {
    const comment = await prisma.shopifyOrderComment.findUnique({
      where: { id },
    });

    if (!comment) {
      return NextResponse.json({ error: "Commento non trovato" }, { status: 404 });
    }

    const isAdmin = sessionUserRole === "ZERO" || sessionUserRole === "SUPER_ADMIN" || sessionUserRole === "ADMIN" || sessionUserRole === "RESPONSABILE";
    if (!isAdmin && comment.user_name !== sessionUserName) {
      return NextResponse.json({ error: "Non autorizzato a eliminare questo commento" }, { status: 403 });
    }

    await prisma.shopifyOrderComment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete comment:", error);
    return NextResponse.json({ error: "Errore durante l'eliminazione del commento" }, { status: 500 });
  }
}
