import { NextRequest, NextResponse } from "next/server";
import { RequestStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { emailTemplates, sendEmail } from "@/lib/email";
import { syncLeaveRequestToGoogleCalendar } from "@/lib/google-calendar";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { syncApprovedLeaveToSchedule, revertApprovedLeaveFromSchedule } from "@/lib/schedule-sync";

const approverRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await context.params;
  const payload = await request.json();
  const status = payload.status ? (String(payload.status) as RequestStatus) : undefined;
  const medicalCode = payload.medicalCode !== undefined ? (payload.medicalCode ? String(payload.medicalCode).trim() : null) : undefined;
  const sicknessUnjustified = payload.sicknessUnjustified !== undefined ? Boolean(payload.sicknessUnjustified) : undefined;

  const existing = await prisma.leaveRequest.findUnique({ where: { id }, include: { user: true } });
  if (!existing) {
    return NextResponse.json({ error: "Richiesta non trovata" }, { status: 404 });
  }

  const isOwnRequest = existing.user_id === session.user.id;
  const isAdmin = approverRoles.has(session.user.role);
  const isResponsabile = session.user.role === "RESPONSABILE";

  // Check permissions for status change
  if (status !== undefined) {
    if (!Object.values(RequestStatus).includes(status)) {
      return NextResponse.json({ error: "Stato richiesta non valido" }, { status: 400 });
    }
    if (!isAdmin && !(isResponsabile && status === "FLAGGED")) {
      return NextResponse.json({ error: "Operazione non consentita per il ruolo" }, { status: 403 });
    }
    if (isResponsabile && existing.user.sede_id !== session.user.sedeId) {
      return NextResponse.json({ error: "Richiesta fuori dalla propria sede" }, { status: 403 });
    }
  }

  // Check permissions for sickness justification changes
  if (medicalCode !== undefined || sicknessUnjustified !== undefined) {
    const canUpdateCode = isOwnRequest || isAdmin || (isResponsabile && existing.user.sede_id === session.user.sedeId);
    if (!canUpdateCode) {
      return NextResponse.json({ error: "Non autorizzato a modificare la giustificazione della malattia" }, { status: 403 });
    }
    if (existing.type !== "MALATTIA") {
      return NextResponse.json({ error: "La giustificazione si applica solo alle malattie." }, { status: 400 });
    }
  }

  let leaveRequest;
  let scheduleSync: { syncedDays: number; categoryCode: string } | null = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id },
        data: {
          ...(status !== undefined ? { status } : {}),
          ...(status === "APPROVED" ? { approved_by: session.user.id } : status === "REJECTED" || status === "PENDING" ? { approved_by: null } : {}),
          ...(medicalCode !== undefined ? { medical_code: medicalCode, sickness_unjustified: false } : {}),
          ...(sicknessUnjustified !== undefined ? { sickness_unjustified: sicknessUnjustified, ...(sicknessUnjustified ? { medical_code: null } : {}) } : {}),
        },
        include: { user: true },
      });

      let syncResult = null;
      if (status === "APPROVED") {
        syncResult = await syncApprovedLeaveToSchedule(tx, updated.id, session.user.id);
      } else if (status !== undefined && existing.status === "APPROVED") {
        await revertApprovedLeaveFromSchedule(tx, updated.id);
      }

      return { updated, syncResult };
    });

    leaveRequest = result.updated;
    scheduleSync = result.syncResult;
  } catch (error) {
    console.error("Errore durante l'aggiornamento e la sincronizzazione della richiesta:", error);
    return NextResponse.json(
      { error: "Errore durante il salvataggio dello stato o la sincronizzazione nel planning." },
      { status: 500 }
    );
  }

  // Always update Google Calendar status sync (both to update details or delete if rejected)
  let calendarSync = null;
  try {
    calendarSync = await syncLeaveRequestToGoogleCalendar(leaveRequest.id);
  } catch (error) {
    calendarSync = {
      skipped: true,
      reason: error instanceof Error ? error.message : "Google Calendar non sincronizzato",
    };
  }

  if (status !== undefined) {
    const template = emailTemplates.leaveRequestDecision(
      leaveRequest.user.name,
      status,
      leaveRequest.type,
      leaveRequest.start_date,
      leaveRequest.end_date
    );

    // Send email (non-blocking, failure won't rollback or crash HTTP response)
    try {
      await sendEmail({ to: leaveRequest.user.email, ...template });
    } catch (error) {
      console.error("Errore nell'invio dell'email per la decisione sulla richiesta:", error);
    }

    // Create notification in database and trigger push/WhatsApp (non-blocking)
    try {
      await createNotification({
        user_id: leaveRequest.user_id,
        title: `Richiesta ${status === "APPROVED" ? "approvata" : status === "REJECTED" ? "rifiutata" : "in verifica"}`,
        message: `${leaveRequest.type.toLowerCase()} dal ${leaveRequest.start_date.toLocaleDateString("it-IT")} al ${leaveRequest.end_date.toLocaleDateString("it-IT")}${leaveRequest.start_time && leaveRequest.end_time ? `, ${leaveRequest.start_time}-${leaveRequest.end_time}` : ""}: ${status === "APPROVED" ? "approvata." : status === "REJECTED" ? "rifiutata." : "inoltrata all'amministrazione."}`,
        type: "RICHIESTA",
        action_url: "/requests",
        read: false,
      });
    } catch (error) {
      console.error("Errore nella creazione della notifica in database:", error);
    }
  }

  return NextResponse.json({ leaveRequest, scheduleSync, calendarSync });
}
