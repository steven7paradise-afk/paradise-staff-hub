import { NextRequest, NextResponse } from "next/server";
import { saveAppointmentStatus } from "@/lib/appointment-status-store";
import { updateCowlendarBookingStatus, type CowlendarAppointmentStatus } from "@/lib/cowlendar";
import { prisma } from "@/lib/prisma";
import { getOperationalUser } from "@/lib/operational-session";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { appointmentsRealtimeEnabled } from "@/lib/appointment-realtime";
import { addAppointmentDays, isAppointmentDateKey } from "@/lib/appointment-date";

function visibleAgendaRange(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const { from, to } = value as { from?: unknown; to?: unknown };
  if (!isAppointmentDateKey(from) || !isAppointmentDateKey(to) || from > to || to > addAppointmentDays(from, 31)) return undefined;
  return { from, to };
}

const allowedStatuses = new Set([
  "PRENOTATO",
  "NON_PRESENTATO",
  "RIPROGRAMMATO",
  "INIZIATO",
  "IN_ATTESA",
  "COMPLETATO",
  "ARRIVATO_IN_RITARDO",
  "PAGATO",
]);

const statusLabels: Record<CowlendarAppointmentStatus | "RIPROGRAMMATO", string> = {
  PRENOTATO: "Confermato",
  NON_PRESENTATO: "Non presentato",
  RIPROGRAMMATO: "Riprogrammato",
  INIZIATO: "In lavorazione",
  IN_ATTESA: "In attesa",
  COMPLETATO: "Completato",
  ARRIVATO_IN_RITARDO: "Arrivato in ritardo",
  PAGATO: "Pagato",
};

function formatElapsedTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

async function hasConfirmedClientControl(bookingId: string) {
  const forms = await prisma.serviceForm.findMany({
    where: { active: true },
    select: { id: true, name: true, category: true },
  });
  const formIds = forms
    .filter((form) => isClientControlFormName(form.name, form.category))
    .map((form) => form.id);
  if (!formIds.length) return false;

  const response = await prisma.serviceFormResponse.findFirst({
    where: {
      form_id: { in: formIds },
      answers: { path: ["booking_id"], equals: bookingId },
    },
    orderBy: { updated_at: "desc" },
    select: { answers: true },
  });
  const answers = (response?.answers || {}) as Record<string, unknown>;
  return Boolean(
    response &&
      answers.client_control_is_draft !== true &&
      String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] || "")
        .trim()
        .toLowerCase() === "controllato",
  );
}

export async function POST(request: NextRequest) {
  const operationalUser = await getOperationalUser(request, {
    requirePcWorker: true,
    preferAuthenticatedAdmin: true,
  });
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

    if (status === "COMPLETATO" && !(await hasConfirmedClientControl(bookingId))) {
      return NextResponse.json(
        {
          code: "CLIENT_CONTROL_REQUIRED",
          error: "Prima di completare l’appuntamento devi confermare il Controllo Cliente.",
        },
        { status: 409 },
      );
    }

    const signedBy = operationalUser?.isPC ? "" : String(body?.signedBy || "").trim();
    const updatedBy = signedBy || sessionUserName;
    const { previousStatus, entry, agendaRevision } = await saveAppointmentStatus(bookingId, {
      status,
      transitionAt,
      updatedBy: signedBy ? `${signedBy} (Cassa: ${sessionUserName})` : updatedBy,
      trackServiceTime: true,
      agendaRange: appointmentsRealtimeEnabled() ? visibleAgendaRange(body.range) : undefined,
    });

    const previousLabel = previousStatus && allowedStatuses.has(previousStatus)
      ? statusLabels[previousStatus as CowlendarAppointmentStatus]
      : null;
    const nextLabel = statusLabels[status as CowlendarAppointmentStatus];
    const elapsedNote = previousStatus === "INIZIATO" && status !== "INIZIATO"
      ? ` Tempo trascorso: ${formatElapsedTime(entry.elapsedSeconds)}.`
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
      | { ok: false; error: string }
      | { ok: true; skipped: true };
    try {
      cowlendarSync = status === "RIPROGRAMMATO" ? {ok:true,skipped:true} : await Promise.race([
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

    return NextResponse.json({ success: true, status: entry, statusComment, cowlendarSync, agendaRevision });
  } catch (error) {
    console.error("Failed to update appointment status:", error);
    return NextResponse.json({ error: "Errore durante il salvataggio dello stato." }, { status: 500 });
  }
}
