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

  const leaveRequest = await prisma.leaveRequest.create({
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

  let scheduleSync: { syncedDays: number; categoryCode: string } | null = null;
  if (leaveRequest.status === "APPROVED") {
    const { syncApprovedLeaveToSchedule } = await import("@/lib/schedule-sync");
    scheduleSync = await syncApprovedLeaveToSchedule(prisma, leaveRequest.id, session.user.id);
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

  const admins = await prisma.user.findMany({
    where: { active: true, role: { in: ["SUPER_ADMIN", "ADMIN"] } },
    select: { email: true },
  });

  if (leaveRequest.status === "PENDING") {
    const template = emailTemplates.leaveRequestReceived(
      leaveRequest.user.name,
      leaveRequest.type,
      leaveRequest.start_date,
      leaveRequest.end_date,
      leaveRequest.reason
    );
    await Promise.allSettled(admins.map((admin) => sendEmail({ to: admin.email, ...template })));
  }

  return NextResponse.json({ leaveRequest, scheduleSync, calendarSync });
}
