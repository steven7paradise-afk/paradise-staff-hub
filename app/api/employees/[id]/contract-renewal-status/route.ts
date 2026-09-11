import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);
const allowedStatuses = new Set(["RINNOVATO", "NON_RINNOVATO"]);

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const status = payload && typeof payload === "object" && "status" in payload
    ? String(payload.status)
    : "";
  if (!allowedStatuses.has(status)) {
    return NextResponse.json({ error: "Stato di rinnovo non valido." }, { status: 400 });
  }

  const { id } = await context.params;
  const employee = await prisma.user.findUnique({
    where: { id },
    select: { workforce_data: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "Dipendente non trovato." }, { status: 404 });
  }

  const decidedAt = new Date().toISOString();
  const workforceData = {
    ...record(employee.workforce_data),
    contractRenewalStatus: status,
    contractRenewalDecisionAt: decidedAt,
    contractRenewalDecisionBy: session.user.id,
  };

  await prisma.user.update({
    where: { id },
    data: {
      workforce_data: workforceData as Prisma.InputJsonValue,
      last_edited_by_id: session.user.id,
      last_edited_at: new Date(),
    },
  });

  return NextResponse.json({ status, decidedAt });
}
