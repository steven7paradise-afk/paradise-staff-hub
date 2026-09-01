import { NextRequest, NextResponse } from "next/server";
import { updateCowlendarBookingStatus, type CowlendarAppointmentStatus } from "@/lib/cowlendar";
import { prisma } from "@/lib/prisma";
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
  return value as Record<string, {
    status?: string;
    updatedAt?: string;
    updatedBy?: string;
    startedAt?: string | null;
    stoppedAt?: string | null;
    elapsedSeconds?: number;
  }>;
}

function formatElapsedTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
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
    const transitionAt = new Date();

    if (!bookingId || !allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Stato appuntamento non valido." }, { status: 400 });
    }

    const currentSetting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    const currentMap = normalizeStatusMap(currentSetting?.value);
    const previousEntry = currentMap[bookingId] || {};
    const previousStatus = previousEntry.status;
    if (previousStatus === "COMPLETATO" && status !== "COMPLETATO") {
      return NextResponse.json(
        { error: "Un appuntamento completato non può più essere modificato." },
        { status: 409 },
      );
    }
    const signedBy = String(body?.signedBy || "").trim();
    const updatedBy = signedBy ? signedBy : sessionUserName;

    let startedAt = previousEntry.startedAt ?? null;
    let stoppedAt = previousEntry.stoppedAt ?? null;
    let elapsedSeconds = Number(previousEntry.elapsedSeconds || 0);

    if (status === "INIZIATO" && (previousStatus !== "INIZIATO" || !startedAt)) {
      startedAt = transitionAt.toISOString();
      stoppedAt = null;
      elapsedSeconds = 0;
    } else if (status !== "INIZIATO" && previousStatus === "INIZIATO" && startedAt) {
      const startedAtMs = new Date(startedAt).getTime();
      if (Number.isFinite(startedAtMs)) {
        elapsedSeconds = Math.max(0, Math.floor((transitionAt.getTime() - startedAtMs) / 1000));
      }
      stoppedAt = transitionAt.toISOString();
    }

    const updatedMap = {
      ...currentMap,
      [bookingId]: {
        status,
        updatedAt: transitionAt.toISOString(),
        updatedBy: signedBy ? `${signedBy} (Cassa: ${sessionUserName})` : updatedBy,
        startedAt,
        stoppedAt,
        elapsedSeconds,
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
    const elapsedNote = previousStatus === "INIZIATO" && status !== "INIZIATO"
      ? ` Tempo trascorso: ${formatElapsedTime(elapsedSeconds)}.`
      : "";
    // The local override is the source used by the appointments UI. Notes and
    // the external Cowlendar sync are useful audit/integration work, but they
    // must never make an already persisted status look as if it failed.
    let statusComment = null;
    try {
      statusComment = await prisma.shopifyOrderComment.create({
        data: {
          order_name: bookingId,
          user_name: updatedBy,
          user_role: sessionUserRole,
          message: previousLabel && previousLabel !== nextLabel
            ? `Stato appuntamento cambiato da ${previousLabel} a ${nextLabel}.${elapsedNote}${signedBy ? ` [Tramite cassa: ${sessionUserName}]` : ""}`
            : `Stato appuntamento impostato su ${nextLabel}.${elapsedNote}${signedBy ? ` [Tramite cassa: ${sessionUserName}]` : ""}`,
        },
      });
    } catch (error) {
      console.error("Appointment status saved, but audit note creation failed:", error);
    }

    let cowlendarSync:
      | Awaited<ReturnType<typeof updateCowlendarBookingStatus>>
      | { ok: false; error: string };
    try {
      cowlendarSync = await Promise.race([
        updateCowlendarBookingStatus(bookingId, status as CowlendarAppointmentStatus),
        new Promise<{ ok: false; error: string }>((resolve) => {
          setTimeout(
            () => resolve({ ok: false, error: "Sincronizzazione Cowlendar in attesa." }),
            3500,
          );
        }),
      ]);
    } catch (error) {
      console.error("Appointment status saved, but Cowlendar sync failed:", error);
      cowlendarSync = {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Cowlendar non ha accettato l'aggiornamento dello stato.",
      };
    }

    return NextResponse.json({ success: true, status: updatedMap[bookingId], statusComment, cowlendarSync });
  } catch (error) {
    console.error("Failed to update appointment status:", error);
    return NextResponse.json({ error: "Errore durante il salvataggio dello stato." }, { status: 500 });
  }
}
