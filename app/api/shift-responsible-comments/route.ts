import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { emptyShiftAccessDay, normalizeShiftResponsibleAccess, SHIFT_RESPONSIBLE_ACCESS_KEY } from "@/lib/shift-responsible-access";
import { normalizeShiftResponsibleAssignments, WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY } from "@/lib/weekly-shift-responsibles";

const allowedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const body = await request.json().catch(() => null) as { day?: unknown; text?: unknown } | null;
  const day = typeof body?.day === "string" ? body.day : "";
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !text) return NextResponse.json({ error: "Scrivi un commento prima di inviare" }, { status: 400 });

  const [accessSetting, assignmentSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: SHIFT_RESPONSIBLE_ACCESS_KEY } }),
    prisma.setting.findUnique({ where: { key: WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY } }),
  ]);
  const assignedId = normalizeShiftResponsibleAssignments(assignmentSetting?.value)[day];
  if (session.user.role === "RESPONSABILE" && assignedId !== session.user.id) {
    return NextResponse.json({ error: "Puoi commentare soltanto le tue giornate" }, { status: 403 });
  }

  const access = normalizeShiftResponsibleAccess(accessSetting?.value);
  const dayAccess = access[day] ?? emptyShiftAccessDay();
  const comment = {
    id: crypto.randomUUID(),
    authorId: session.user.id,
    authorName: session.user.name || "Utente",
    text,
    at: new Date().toISOString(),
  };
  dayAccess.comments = [...dayAccess.comments, comment].slice(-200);
  access[day] = dayAccess;
  await prisma.setting.upsert({
    where: { key: SHIFT_RESPONSIBLE_ACCESS_KEY },
    create: { key: SHIFT_RESPONSIBLE_ACCESS_KEY, value: access },
    update: { value: access },
  });

  if (assignedId && assignedId !== session.user.id) {
    await createNotification({
      user_id: assignedId,
      title: "Nuovo commento sul controllo turno",
      message: `${comment.authorName}: ${text.slice(0, 240)}`,
      type: "TURNO",
      action_url: "/responsabile-di-turno",
    }).catch((error) => console.error("Shift responsible comment notification failed:", error));
  }

  return NextResponse.json({ comment });
}
