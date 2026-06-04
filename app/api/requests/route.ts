import { NextRequest, NextResponse } from "next/server";
import { LeaveType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { emailTemplates, sendEmail } from "@/lib/email";
import { syncLeaveRequestToGoogleCalendar } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

const managementRoles = new Set(["SUPER_ADMIN", "ADMIN"]);
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) ? null : date;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const payload = await request.json();
  const type = String(payload.type ?? "FERIE") as LeaveType;
  const startDate = dateOnly(String(payload.startDate ?? ""));
  const endDate = dateOnly(String(payload.endDate ?? ""));
  const startTime = payload.startTime ? String(payload.startTime) : null;
  const endTime = payload.endTime ? String(payload.endTime) : null;
  const requestedUserId = payload.userId ? String(payload.userId) : session.user.id;

  if (!Object.values(LeaveType).includes(type) || !startDate || !endDate || endDate < startDate) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }
  if ((startTime || endTime) && (!startTime || !endTime || !timePattern.test(startTime) || !timePattern.test(endTime))) {
    return NextResponse.json({ error: "Inserisci ora e minuti nel formato corretto." }, { status: 400 });
  }
  if (startDate.getTime() === endDate.getTime() && startTime && endTime && endTime <= startTime) {
    return NextResponse.json({ error: "L'orario finale deve essere dopo l'orario iniziale." }, { status: 400 });
  }
  if (requestedUserId !== session.user.id && !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non puoi creare richieste per un altro lavoratore." }, { status: 403 });
  }

  const requestUser = await prisma.user.findUnique({ where: { id: requestedUserId } });
  if (!requestUser?.active) {
    return NextResponse.json({ error: "Lavoratore non valido." }, { status: 400 });
  }

  let leaveRequest;
  let scheduleSync: { syncedDays: number; categoryCode: string } | null = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.leaveRequest.create({
        data: {
          user_id: requestedUserId,
          type,
          start_date: startDate,
          end_date: endDate,
          start_time: startTime,
          end_time: endTime,
          reason: payload.reason ? String(payload.reason) : null,
          status: managementRoles.has(session.user.role) && payload.approveNow === true ? "APPROVED" : "PENDING",
          approved_by: managementRoles.has(session.user.role) && payload.approveNow === true ? session.user.id : null,
        },
        include: { user: true },
      });

      let syncResult = null;
      if (created.status === "APPROVED") {
        const { syncApprovedLeaveToSchedule } = await import("@/lib/schedule-sync");
        syncResult = await syncApprovedLeaveToSchedule(tx, created.id, session.user.id);
      }

      return { created, syncResult };
    });

    leaveRequest = result.created;
    scheduleSync = result.syncResult;
  } catch (error) {
    console.error("Errore durante la creazione e sincronizzazione della richiesta:", error);
    return NextResponse.json(
      { error: "Errore durante il salvataggio o la sincronizzazione nel planning." },
      { status: 500 }
    );
  }

  // Always sync to Google Calendar on creation (whether PENDING or APPROVED)
  let calendarSync = null;
  try {
    calendarSync = await syncLeaveRequestToGoogleCalendar(leaveRequest.id);
  } catch (error) {
    calendarSync = {
      skipped: true,
      reason: error instanceof Error ? error.message : "Google Calendar non sincronizzato",
    };
  }

  // Handle Notifications & Emails
  if (leaveRequest.status === "PENDING") {
    try {
      const admins = await prisma.user.findMany({
        where: { active: true, role: { in: ["SUPER_ADMIN", "ADMIN"] } },
        select: { email: true },
      });
      const template = emailTemplates.leaveRequestReceived(
        leaveRequest.user.name,
        leaveRequest.type,
        leaveRequest.start_date,
        leaveRequest.end_date,
        leaveRequest.reason
      );
      await Promise.allSettled(admins.map((admin) => sendEmail({ to: admin.email, ...template })));
    } catch (error) {
      console.error("Errore durante l'invio delle notifiche e-mail per nuova richiesta agli amministratori:", error);
    }
  } else if (leaveRequest.status === "APPROVED") {
    // If approved immediately by management on creation, notify the employee immediately
    try {
      const template = emailTemplates.leaveRequestDecision(
        leaveRequest.user.name,
        "APPROVED",
        leaveRequest.type,
        leaveRequest.start_date,
        leaveRequest.end_date
      );
      const { createNotification } = await import("@/lib/notifications");
      await Promise.allSettled([
        sendEmail({ to: leaveRequest.user.email, ...template }),
        createNotification({
          user_id: leaveRequest.user_id,
          title: `Richiesta approvata`,
          message: `${leaveRequest.type.toLowerCase()} dal ${leaveRequest.start_date.toLocaleDateString("it-IT")} al ${leaveRequest.end_date.toLocaleDateString("it-IT")}${leaveRequest.start_time && leaveRequest.end_time ? `, ${leaveRequest.start_time}-${leaveRequest.end_time}` : ""}: approvata dall'amministrazione.`,
          type: "RICHIESTA",
          action_url: "/requests",
          read: false,
        }),
      ]);
    } catch (error) {
      console.error("Errore durante l'invio delle notifiche e-mail per richiesta approvata al lavoratore:", error);
    }
  }

  return NextResponse.json({ leaveRequest, scheduleSync, calendarSync });
}
