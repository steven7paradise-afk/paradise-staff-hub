import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  normalizeShiftResponsibleAssignments,
  WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY,
} from "@/lib/weekly-shift-responsibles";

const adminRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !adminRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const incoming = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as { assignments?: unknown }).assignments
    : null;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const rawAssignments = incoming as Record<string, unknown>;
  const datedEntries = Object.entries(rawAssignments).filter(([day]) => /^\d{4}-\d{2}-\d{2}$/.test(day));
  const requestedUserIds = Array.from(new Set(
    datedEntries.map(([, userId]) => typeof userId === "string" ? userId.trim() : "").filter(Boolean),
  ));
  const eligibleUsers = requestedUserIds.length > 0
    ? await prisma.user.findMany({
        where: {
          id: { in: requestedUserIds },
          active: true,
          mansione: { contains: "responsabile salone", mode: "insensitive" },
        },
        select: { id: true },
      })
    : [];
  const eligibleIds = new Set(eligibleUsers.map((user) => user.id));

  if (requestedUserIds.some((userId) => !eligibleIds.has(userId))) {
    return NextResponse.json({ error: "Responsabile non valido" }, { status: 400 });
  }

  const currentSetting = await prisma.setting.findUnique({
    where: { key: WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY },
  });
  const next = normalizeShiftResponsibleAssignments(currentSetting?.value);

  datedEntries.forEach(([day, userId]) => {
    const cleanUserId = typeof userId === "string" ? userId.trim() : "";
    if (cleanUserId) next[day] = cleanUserId;
    else delete next[day];
  });

  await prisma.setting.upsert({
    where: { key: WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY },
    create: { key: WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY, value: next },
    update: { value: next },
  });

  revalidatePath("/responsabile-di-turno");
  revalidatePath("/programmazione-responsabile-di-turno");
  return NextResponse.json(next);
}
