import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateCowlendarBookingTeam } from "@/lib/cowlendar";
import { checkPCAuthorization, appointmentsPcCookieName } from "@/lib/appointments-pc-auth";
import { getOperationalUser } from "@/lib/operational-session";

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
    const bookingId = String(body?.bookingId || "").trim();
    const teammateIds = Array.isArray(body?.teammateIds)
      ? body.teammateIds.map((value: unknown) => String(value || "").trim()).filter(Boolean)
      : [];
    const signedBy = String(body?.signedBy || "").trim();

    if (!bookingId || !teammateIds.length) {
      return NextResponse.json({ error: "Appuntamento o collaboratrice mancante." }, { status: 400 });
    }

    const cowlendarSync = await updateCowlendarBookingTeam(bookingId, teammateIds);

    // Fetch teammate names for logs
    const teammates = await prisma.user.findMany({
      where: { id: { in: teammateIds } },
      select: { name: true },
    });
    const teammateNames = teammates.map((t) => t.name).join(", ");
    
    const updatedBy = signedBy ? signedBy : sessionUserName;

    // Log comment
    const teamComment = await prisma.shopifyOrderComment.create({
      data: {
        order_name: bookingId,
        user_name: updatedBy,
        user_role: sessionUserRole,
        message: `Collaboratrici modificate in: ${teammateNames || teammateIds.join(", ")}.${signedBy ? ` [Tramite cassa: ${sessionUserName}]` : ""}`,
      },
    });

    return NextResponse.json({ success: true, teammateIds, cowlendarSync, teamComment });
  } catch (error) {
    console.error("Failed to sync appointment team with Cowlendar:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Cowlendar non ha accettato l'aggiornamento del team.",
      },
      { status: 502 },
    );
  }
}
