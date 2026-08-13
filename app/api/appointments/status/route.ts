import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { updateCowlendarBookingStatus, type CowlendarAppointmentStatus } from "@/lib/cowlendar";
import { prisma } from "@/lib/prisma";
import { checkPCAuthorization, appointmentsPcCookieName } from "@/lib/appointments-pc-auth";
import { getOperationalUser } from "@/lib/operational-session";

const SETTING_KEY = "appointment_status_overrides";

const allowedStatuses = new Set([
  "PRENOTATO",
  "NON_PRESENTATO",
  "INIZIATO",
  "IN_ATTESA",
  "COMPLETATO",
  "ARRIVATO_IN_RITARDO",
  "PAGATO",
]);

const statusLabels: Record<CowlendarAppointmentStatus, string> = {
  PRENOTATO: "Confermato",
  NON_PRESENTATO: "Non presentato",
  INIZIATO: "Iniziato",
  IN_ATTESA: "In attesa",
  COMPLETATO: "Completato",
  ARRIVATO_IN_RITARDO: "Arrivato in ritardo",
  PAGATO: "Pagato",
};

function normalizeStatusMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, { status?: string; updatedAt?: string; updatedBy?: string }>;
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
    const bookingId = String(body?.bookingId || "").trim();
    const status = String(body?.status || "").trim().toUpperCase();

    if (!bookingId || !allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Stato appuntamento non valido." }, { status: 400 });
    }

    let cowlendarSync:
      | Awaited<ReturnType<typeof updateCowlendarBookingStatus>>
      | { ok: false; error: string }
      | undefined;
    try {
      cowlendarSync = await updateCowlendarBookingStatus(bookingId, status as CowlendarAppointmentStatus);
    } catch (error) {
      console.error("Failed to sync appointment status with Cowlendar:", error);
      cowlendarSync = {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Cowlendar non ha accettato l'aggiornamento dello stato.",
      };
    }

    const currentSetting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    const currentMap = normalizeStatusMap(currentSetting?.value);
    const previousStatus = currentMap[bookingId]?.status;
    const signedBy = String(body?.signedBy || "").trim();
    const updatedBy = signedBy ? signedBy : sessionUserName;

    const updatedMap = {
      ...currentMap,
      [bookingId]: {
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: signedBy ? `${signedBy} (Cassa: ${sessionUserName})` : updatedBy,
      },
    };

    await prisma.setting.upsert({
      where: { key: SETTING_KEY },
      update: { value: updatedMap },
      create: { key: SETTING_KEY, value: updatedMap },
    });

    const previousLabel = previousStatus && allowedStatuses.has(previousStatus)
      ? statusLabels[previousStatus as CowlendarAppointmentStatus]
      : null;
    const nextLabel = statusLabels[status as CowlendarAppointmentStatus];
    const statusComment = await prisma.shopifyOrderComment.create({
      data: {
        order_name: bookingId,
        user_name: updatedBy,
        user_role: sessionUserRole,
        message: previousLabel && previousLabel !== nextLabel
          ? `Stato appuntamento cambiato da ${previousLabel} a ${nextLabel}.${signedBy ? ` [Tramite cassa: ${sessionUserName}]` : ""}`
          : `Stato appuntamento impostato su ${nextLabel}.${signedBy ? ` [Tramite cassa: ${sessionUserName}]` : ""}`,
      },
    });

    return NextResponse.json({ success: true, status: updatedMap[bookingId], statusComment, cowlendarSync });
  } catch (error) {
    console.error("Failed to update appointment status:", error);
    return NextResponse.json({ error: "Errore durante il salvataggio dello stato." }, { status: 500 });
  }
}
