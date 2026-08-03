import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateCowlendarBookingTeam } from "@/lib/cowlendar";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const bookingId = String(body?.bookingId || "").trim();
    const teammateIds = Array.isArray(body?.teammateIds)
      ? body.teammateIds.map((value: unknown) => String(value || "").trim()).filter(Boolean)
      : [];

    if (!bookingId || !teammateIds.length) {
      return NextResponse.json({ error: "Appuntamento o collaboratrice mancante." }, { status: 400 });
    }

    const cowlendarSync = await updateCowlendarBookingTeam(bookingId, teammateIds);
    return NextResponse.json({ success: true, teammateIds, cowlendarSync });
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
