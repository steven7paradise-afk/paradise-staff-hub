import { NextRequest, NextResponse } from "next/server";
import { LeaveType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { emailTemplates, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const payload = await request.json();
  const type = String(payload.type ?? "FERIE") as LeaveType;
  const startDate = new Date(String(payload.startDate));
  const endDate = new Date(String(payload.endDate));

  if (!Object.values(LeaveType).includes(type) || Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || endDate < startDate) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      user_id: session.user.id,
      type,
      start_date: startDate,
      end_date: endDate,
      reason: payload.reason ? String(payload.reason) : null,
    },
    include: { user: true },
  });

  const admins = await prisma.user.findMany({
    where: { active: true, role: { in: ["SUPER_ADMIN", "ADMIN"] } },
    select: { email: true },
  });

  const template = emailTemplates.leaveRequestReceived(leaveRequest.user.name);
  await Promise.allSettled(admins.map((admin) => sendEmail({ to: admin.email, ...template })));

  return NextResponse.json(leaveRequest);
}
