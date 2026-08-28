import { NextRequest, NextResponse } from "next/server";
import { RequestStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { emailTemplates, sendEmail } from "@/lib/email";
import { syncLeaveRequestToGoogleCalendar } from "@/lib/google-calendar";
import { createNotification, createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { syncApprovedLeaveToSchedule, revertApprovedLeaveFromSchedule } from "@/lib/schedule-sync";
import { isAutomaticLateReason } from "@/lib/automatic-late-requests";

const approverRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

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
  const adminNote = payload.adminNote !== undefined ? (payload.adminNote ? String(payload.adminNote).trim() : null) : undefined;
  const acknowledge = payload.acknowledge === true;
  const employeeResponse = payload.employeeResponse !== undefined ? (payload.employeeResponse ? String(payload.employeeResponse).trim() : null) : undefined;
  const medicalCode = payload.medicalCode !== undefined ? (payload.medicalCode ? String(payload.medicalCode).trim() : null) : undefined;
  const sicknessUnjustified = payload.sicknessUnjustified !== undefined ? Boolean(payload.sicknessUnjustified) : undefined;

  const existing = await prisma.leaveRequest.findUnique({ where: { id }, include: { user: true } });
  if (!existing) {
    return NextResponse.json({ error: "Richiesta non trovata" }, { status: 404 });
  }
  const automaticLate = isAutomaticLateReason(existing.reason);

  const isOwnRequest = existing.user_id === session.user.id;
  const isAdmin = approverRoles.has(session.user.role);
  const isResponsabile = session.user.role === "RESPONSABILE";

  if (acknowledge || employeeResponse !== undefined) {
    if (!automaticLate || !isOwnRequest) {
      return NextResponse.json({ error: "Puoi confermare soltanto la presa visione di un tuo ritardo." }, { status: 403 });
    }
    if (!acknowledge) {
      return NextResponse.json({ error: "Conferma la presa visione per inviare la risposta." }, { status: 400 });
    }
  }

  // Check permissions for status change
  if (status !== undefined) {
    if (!Object.values(RequestStatus).includes(status)) {
      return NextResponse.json({ error: "Stato richiesta non valido" }, { status: 400 });
    }
    if (!isAdmin && !(isResponsabile && status === "FLAGGED")) {
      return NextResponse.json({ error: "Operazione non consentita per il ruolo" }, { status: 403 });
    }
    if (status === "REJECTED" && !adminNote) {
      return NextResponse.json({ error: "Scrivi il motivo del rifiuto." }, { status: 400 });
    }
    if (automaticLate && status === "REJECTED") {
      return NextResponse.json({ error: "I ritardi automatici non vengono rifiutati: conferma soltanto la presa visione." }, { status: 400 });
    }
    if (isResponsabile && existing.user.sede_id !== session.user.sedeId) {
      return NextResponse.json({ error: "Richiesta fuori dalla propria sede" }, { status: 403 });
    }
  }

  if (adminNote !== undefined && !isAdmin && !(isResponsabile && status === "FLAGGED")) {
    return NextResponse.json({ error: "Non autorizzato a modificare la nota admin." }, { status: 403 });
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
          ...(status === "APPROVED" ? { approved_by: session.user.id, approved_at: new Date() } : status === "REJECTED" || status === "PENDING" ? { approved_by: null, approved_at: null } : {}),
          ...(adminNote !== undefined ? { admin_note: adminNote } : {}),
          ...(acknowledge ? { employee_acknowledged_at: new Date() } : {}),
          ...(employeeResponse !== undefined ? { employee_response: employeeResponse } : {}),
          ...(medicalCode !== undefined ? { medical_code: medicalCode, sickness_unjustified: !medicalCode } : {}),
          ...(medicalCode === undefined && sicknessUnjustified !== undefined
            ? sicknessUnjustified
              ? { sickness_unjustified: true, medical_code: null }
              : { sickness_unjustified: !existing.medical_code }
            : {}),
        },
        include: { user: true, approver: true },
      });

      let syncResult = null;
      if (status === "APPROVED" && !automaticLate) {
        syncResult = await syncApprovedLeaveToSchedule(tx, updated.id, session.user.id);
      } else if (status !== undefined && existing.status === "APPROVED" && !automaticLate) {
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
    calendarSync = automaticLate
      ? { skipped: true, reason: "I ritardi presi in visione non vengono inseriti nel calendario." }
      : await syncLeaveRequestToGoogleCalendar(leaveRequest.id);
  } catch (error) {
    calendarSync = {
      skipped: true,
      reason: error instanceof Error ? error.message : "Google Calendar non sincronizzato",
    };
  }

  if (status !== undefined) {
    if (!automaticLate) {
      const template = emailTemplates.leaveRequestDecision(
        leaveRequest.user.name,
        status,
        leaveRequest.type,
        leaveRequest.start_date,
        leaveRequest.end_date
      );
      try {
        await sendEmail({ to: leaveRequest.user.email, ...template });
      } catch (error) {
        console.error("Errore nell'invio dell'email per la decisione sulla richiesta:", error);
      }
    }

    // Create notification in database and trigger push/WhatsApp (non-blocking)
    try {
      await createNotification({
        user_id: leaveRequest.user_id,
        title: automaticLate && status === "APPROVED" ? "Ritardo preso in visione" : `Richiesta ${status === "APPROVED" ? "approvata" : status === "REJECTED" ? "rifiutata" : "in verifica"}`,
        message: automaticLate && status === "APPROVED"
          ? `L’amministrazione ha preso visione del ritardo del ${leaveRequest.start_date.toLocaleDateString("it-IT")}${leaveRequest.end_time ? `, ingresso ${leaveRequest.end_time}` : ""}.${leaveRequest.admin_note ? ` Comunicazione: ${leaveRequest.admin_note}` : ""}`
          : `${leaveRequest.type.toLowerCase()} dal ${leaveRequest.start_date.toLocaleDateString("it-IT")} al ${leaveRequest.end_date.toLocaleDateString("it-IT")}${leaveRequest.start_time && leaveRequest.end_time ? `, ${leaveRequest.start_time}-${leaveRequest.end_time}` : ""}: ${status === "APPROVED" ? "approvata." : status === "REJECTED" ? "rifiutata." : "inoltrata all'amministrazione."}${leaveRequest.admin_note ? ` Nota admin: ${leaveRequest.admin_note}` : ""}`,
        type: "RICHIESTA",
        action_url: "/requests",
        read: false,
      });
    } catch (error) {
      console.error("Errore nella creazione della notifica in database:", error);
    }
  }

  if (acknowledge) {
    try {
      const recipients = await prisma.user.findMany({
        where: { active: true, role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] } },
        select: { id: true },
      });
      await createNotifications(recipients.map((recipient) => ({
        user_id: recipient.id,
        title: `Presa visione ritardo: ${leaveRequest.user.name}`,
        message: `${leaveRequest.user.name} ha confermato la presa visione del ritardo del ${leaveRequest.start_date.toLocaleDateString("it-IT")}.${leaveRequest.employee_response ? ` Risposta: ${leaveRequest.employee_response}` : ""}`,
        type: "RICHIESTA",
        action_url: `/requests?request=${encodeURIComponent(leaveRequest.id)}`,
        read: false,
      })));
    } catch (error) {
      console.error("Errore nella notifica di presa visione del dipendente:", error);
    }
  }

  return NextResponse.json({ leaveRequest, scheduleSync, calendarSync });
}
