import { NextRequest, NextResponse } from "next/server";
import { getOperationalUser } from "@/lib/operational-session";
import { prisma } from "@/lib/prisma";
import { canManageAppointmentOfficeNotes } from "@/lib/appointment-office-note-access";

const NOTE_KEY_PREFIX = "appointment_office_note:";

export async function POST(request: NextRequest) {
  const operationalUser = await getOperationalUser(request);
  if (!operationalUser?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const userAccess = operationalUser.id === "PC_CASSA"
    ? null
    : await prisma.user.findUnique({
        where: { id: operationalUser.id },
        select: { mansione: true, location: { select: { name: true } } },
      }).catch(() => null);
  if (!canManageAppointmentOfficeNotes({
    role: operationalUser.role,
    mansione: userAccess?.mansione,
    locationName: userAccess?.location?.name,
    isPC: operationalUser.isPC,
  })) {
    return NextResponse.json({ error: "Solo l'ufficio può modificare questa nota" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const bookingId = String(body?.bookingId || "").trim();
    const text = String(body?.text || "").trim();

    if (!bookingId || bookingId.length > 200 || !text) {
      return NextResponse.json({ error: "Dati incompleti" }, { status: 400 });
    }
    if (text.length > 1000) {
      return NextResponse.json({ error: "La nota può contenere al massimo 1000 caratteri" }, { status: 400 });
    }

    await prisma.setting.upsert({
      where: { key: `${NOTE_KEY_PREFIX}${bookingId}` },
      create: { key: `${NOTE_KEY_PREFIX}${bookingId}`, value: { text } },
      update: { value: { text } },
    });

    return NextResponse.json({ bookingId, text });
  } catch (error) {
    console.error("Failed to save office appointment note:", error);
    return NextResponse.json({ error: "Errore durante il salvataggio della nota" }, { status: 500 });
  }
}
