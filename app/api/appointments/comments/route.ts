import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { appendShopifyOrderNote, getShopifyOrderCowlendarText, getShopifyOrderNoteText } from "@/lib/shopify";
import { checkPCAuthorization, appointmentsPcCookieName } from "@/lib/appointments-pc-auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  let isAuthorized = Boolean(session?.user?.id);

  if (!isAuthorized) {
    const cookieStore = await cookies();
    const pcToken = cookieStore.get(appointmentsPcCookieName)?.value;
    const pcAuth = await checkPCAuthorization(pcToken);
    if (pcAuth) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orderName = searchParams.get("orderName");
  const bookingId = searchParams.get("bookingId");

  if (!orderName && !bookingId) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }

  try {
    const [comments, shopifyNote, cowlendarOrderNote] = await Promise.all([
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
    ]);

    return NextResponse.json({
      comments,
      shopifyNote,
      cowlendarOrderNote,
    });
  } catch (error) {
    console.error("Failed to fetch appointment comments:", error);
    return NextResponse.json({ error: "Errore durante il recupero dei commenti" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  let isAuthorized = Boolean(session?.user?.id);
  let sessionUserName = session?.user?.name || session?.user?.email || session?.user?.id || "Staff";
  let sessionUserRole = session?.user?.role || "DIPENDENTE";

  if (!isAuthorized) {
    const cookieStore = await cookies();
    const pcToken = cookieStore.get(appointmentsPcCookieName)?.value;
    const pcAuth = await checkPCAuthorization(pcToken);
    if (pcAuth) {
      isAuthorized = true;
      sessionUserName = pcAuth.name;
      sessionUserRole = "RESPONSABILE";
    }
  }

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

    if (orderName) {
      appendShopifyOrderNote(orderName, authorName, message.trim() + (signedBy ? ` [Cassa: ${sessionUserName}]` : ""))
        .catch((err) => console.error("Failed to sync comment to Shopify note:", err));
    }

    return NextResponse.json(comment);
  } catch (error) {
    console.error("Failed to create appointment comment:", error);
    return NextResponse.json({ error: "Errore durante il salvataggio del commento" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  let isAuthorized = Boolean(session?.user?.id);
  let sessionUserName = session?.user?.name || session?.user?.email || session?.user?.id || "Staff";
  let sessionUserRole = session?.user?.role || "DIPENDENTE";

  if (!isAuthorized) {
    const cookieStore = await cookies();
    const pcToken = cookieStore.get(appointmentsPcCookieName)?.value;
    const pcAuth = await checkPCAuthorization(pcToken);
    if (pcAuth) {
      isAuthorized = true;
      sessionUserName = pcAuth.name;
      sessionUserRole = "RESPONSABILE";
    }
  }

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
