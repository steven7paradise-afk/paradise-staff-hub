import { NextRequest, NextResponse } from "next/server";
import { saveAppointmentStatus } from "@/lib/appointment-status-store";
import { updateCowlendarBookingStatus, type CowlendarAppointmentStatus } from "@/lib/cowlendar";
import { prisma } from "@/lib/prisma";
import { getOperationalUser } from "@/lib/operational-session";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { visibleAgendaRange } from "@/lib/appointment-range-revision";
import { canRecordEarlyAppointmentArrival, isAppointmentArrivalStatus, isBeforeSalonOpening } from "@/lib/appointment-arrival-access";
import { appointmentDateKey } from "@/lib/appointment-date";
import { appointmentStatusContext, hasPresentAppointmentWorker } from "@/lib/appointment-status-access";
import { normalizeAppointmentStatus } from "@/lib/appointment-status";
import { canAccessForUser } from "@/lib/roles";

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

class ArrivalStateConflict extends Error {}

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
  try {
    const body = await request.json();
    const bookingId = String(body?.bookingId || "").trim();
    const status = String(body?.status || "").trim().toUpperCase();
    const transitionAt = new Date();
    const isArrival = isAppointmentArrivalStatus(status);
    const isStartingService = status === "INIZIATO";
    const operationalUser = await getOperationalUser(request, {
      requirePcWorker: true,
      preferAuthenticatedAdmin: true,
      allowReceptionArrival: isArrival,
    });
    if (!operationalUser) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    const sessionUserName = operationalUser.name || operationalUser.email || operationalUser.id;
    const sessionUserRole = operationalUser.role;

    if (!bookingId || !allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Stato appuntamento non valido." }, { status: 400 });
    }

    const bookingContext = isArrival || isStartingService ? await appointmentStatusContext(bookingId) : null;
    if ((isArrival || isStartingService) && !bookingContext) {
      return NextResponse.json({ error: "Appuntamento non disponibile." }, { status: 404 });
    }
    if (bookingContext && operationalUser.isPC && operationalUser.sedeId &&
      !bookingContext.eligibleLocationIds.includes(operationalUser.sedeId)) {
      return NextResponse.json({ error: "Questo appuntamento appartiene a un’altra sede." }, { status: 403 });
    }
    if (operationalUser.arrivalOnly && bookingContext) {
      if ((!operationalUser.isPC && !await canAccessForUser(prisma, "/appointments", operationalUser)) ||
        bookingContext.salon !== "repubblica" ||
        !operationalUser.sedeId || !bookingContext.eligibleLocationIds.includes(operationalUser.sedeId) ||
        appointmentDateKey(bookingContext.scheduledAt) !== appointmentDateKey(transitionAt)) {
        return NextResponse.json({ error: "Puoi segnare l’arrivo solo per gli appuntamenti di oggi a Repubblica." }, { status: 403 });
      }
    }
    if (isArrival && bookingContext) {
      const opening = bookingContext.location?.opening_time || (bookingContext.salon === "repubblica" ? "10:00" : null);
      const beforeOpening = isBeforeSalonOpening(transitionAt, opening);
      if (beforeOpening && (
        !canRecordEarlyAppointmentArrival(operationalUser) ||
        (operationalUser.isPC && bookingContext.salon === "repubblica" && !operationalUser.hasVerifiedPcArrivalSession)
      )) {
        return NextResponse.json({
          code: "EARLY_ARRIVAL_REQUIRES_RECEPTION",
          error: "Prima dell’apertura solo Reception e amministratori possono segnare l’arrivo. Sul PC Cassa usa il PIN completo.",
        }, { status: 403 });
      }
    }
    if (isStartingService && bookingContext) {
      const { workers, eligibleLocationIds, scheduledAt } = bookingContext;
      const authorizedOperator = canRecordEarlyAppointmentArrival(operationalUser) ||
        await hasPresentAppointmentWorker([operationalUser.id], eligibleLocationIds, transitionAt);
      if (!authorizedOperator || appointmentDateKey(scheduledAt) !== appointmentDateKey(transitionAt) ||
        !await hasPresentAppointmentWorker(workers.map(worker => worker.id), eligibleLocationIds, transitionAt)) {
        return NextResponse.json({
          code: "ATTENDANCE_REQUIRED",
          error: "Per iniziare il servizio, una lavoratrice assegnata deve avere timbrato l’ingresso in questa sede.",
        }, { status: 403 });
      }
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

    const signedBy = operationalUser.isPC || isArrival ? "" : String(body?.signedBy || "").trim();
    const updatedBy = signedBy || sessionUserName;
    const { previousStatus, entry, agendaRevision } = await saveAppointmentStatus(bookingId, {
      status,
      transitionAt,
      updatedBy: signedBy ? `${signedBy} (Cassa: ${sessionUserName})` : updatedBy,
      trackServiceTime: true,
      agendaRange: visibleAgendaRange(body.range),
      validatePrevious: operationalUser.arrivalOnly ? previous => {
        const effectiveStatus = normalizeAppointmentStatus(previous?.status) ||
          normalizeAppointmentStatus(bookingContext?.sheetStatus) ||
          normalizeAppointmentStatus(bookingContext?.booking.attendance) ||
          normalizeAppointmentStatus(bookingContext?.booking.confirmation_status) || "PRENOTATO";
        if (effectiveStatus !== "PRENOTATO" && effectiveStatus !== "IN_ATTESA") {
          throw new ArrivalStateConflict("L’appuntamento non è più in attesa di arrivo.");
        }
      } : undefined,
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
    if (error instanceof ArrivalStateConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Failed to update appointment status:", error);
    return NextResponse.json({ error: "Errore durante il salvataggio dello stato." }, { status: 500 });
  }
}
