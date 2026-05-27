import { NextRequest, NextResponse } from "next/server";
import { RequestStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { emailTemplates, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { syncApprovedLeaveToSchedule } from "@/lib/schedule-sync";

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
  const status = String(payload.status ?? "") as RequestStatus;

  if (!Object.values(RequestStatus).includes(status)) {
    return NextResponse.json({ error: "Stato richiesta non valido" }, { status: 400 });
  }
  if (!approverRoles.has(session.user.role) && !(session.user.role === "RESPONSABILE" && status === "FLAGGED")) {
    return NextResponse.json({ error: "Operazione non consentita per il ruolo" }, { status: 403 });
  }

  const existing = await prisma.leaveRequest.findUnique({ where: { id }, include: { user: true } });
  if (!existing) {
    return NextResponse.json({ error: "Richiesta non trovata" }, { status: 404 });
  }
  if (session.user.role === "RESPONSABILE" && existing.user.sede_id !== session.user.sedeId) {
    return NextResponse.json({ error: "Richiesta fuori dalla propria sede" }, { status: 403 });
  }

  const leaveRequest = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status,
      approved_by: status === "APPROVED" ? session.user.id : null,
    },
    include: { user: true },
  });

  let scheduleSync: { syncedDays: number; categoryCode: string } | null = null;
  if (status === "APPROVED") {
    scheduleSync = await syncApprovedLeaveToSchedule(prisma, leaveRequest.id, session.user.id);
  }

  const template = emailTemplates.leaveRequestDecision(status);
  await Promise.all([
    sendEmail({ to: leaveRequest.user.email, ...template }),
    prisma.notification.create({
      data: {
        user_id: leaveRequest.user_id,
        title: `Richiesta ${status === "APPROVED" ? "approvata" : status === "REJECTED" ? "rifiutata" : "in verifica"}`,
        message: `${leaveRequest.type.toLowerCase()} dal ${leaveRequest.start_date.toLocaleDateString("it-IT")} al ${leaveRequest.end_date.toLocaleDateString("it-IT")}: ${status === "APPROVED" ? "approvata." : status === "REJECTED" ? "rifiutata." : "inoltrata all'amministrazione."}`,
        type: "RICHIESTA",
        read: false,
      },
    }),
  ]);

  return NextResponse.json({ leaveRequest, scheduleSync });
}
