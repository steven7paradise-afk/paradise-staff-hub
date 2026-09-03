import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { prisma } from "@/lib/prisma";
import { romeDayRange } from "@/lib/shift-reports";
import { emptyShiftAccessDay, hasShiftWriteAccess, normalizeShiftResponsibleAccess, SHIFT_RESPONSIBLE_ACCESS_KEY } from "@/lib/shift-responsible-access";
import { normalizeShiftResponsibleAssignments, WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY } from "@/lib/weekly-shift-responsibles";

const allowedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date()); }

async function requesterNames(dayAccess: ReturnType<typeof emptyShiftAccessDay>) {
  const ids = Object.keys(dayAccess.permissions);
  if (!ids.length) return {};
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return Object.fromEntries(users.map((user) => [user.id, user.name]));
}

async function context(userId: string, day: string) {
  const [accessSetting, assignmentSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: SHIFT_RESPONSIBLE_ACCESS_KEY } }),
    prisma.setting.findUnique({ where: { key: WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY } }),
  ]);
  const access = normalizeShiftResponsibleAccess(accessSetting?.value);
  const dayAccess = access[day] ?? emptyShiftAccessDay();
  const selectedResponsibleId = normalizeShiftResponsibleAssignments(assignmentSetting?.value)[day];
  return { access, dayAccess, selectedResponsibleId, canEdit: hasShiftWriteAccess(dayAccess, userId, selectedResponsibleId) };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const day = request.nextUrl.searchParams.get("day") || today();
  if (day !== today()) return NextResponse.json({ error: "Giorno non valido" }, { status: 400 });
  const value = await context(session.user.id, day);
  return NextResponse.json({ dayAccess: value.dayAccess, selectedResponsibleId: value.selectedResponsibleId, canEdit: value.canEdit, currentUserId: session.user.id, requesterNames: await requesterNames(value.dayAccess) });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: string; day?: string; requesterId?: string; decision?: string } | null;
  const day = body?.day || today();
  if (day !== today()) return NextResponse.json({ error: "La presa visione è disponibile soltanto per oggi" }, { status: 400 });
  const value = await context(session.user.id, day);
  const now = new Date().toISOString();

  if (body?.action === "ACKNOWLEDGE") {
    const { start, end } = romeDayRange(day);
    const logs = await prisma.attendanceLog.findMany({ where: { user_id: session.user.id, date: { gte: start, lt: end } }, select: { type: true, timestamp: true, time: true }, orderBy: { timestamp: "asc" } });
    const state = deriveAttendanceState(logs);
    const labels = { IN: "In turno", BREAK: "In pausa", OUT: state.firstEntry ? "Turno terminato" : "Non timbrato" } as const;
    value.dayAccess.acknowledgements[session.user.id] = { at: now, clockIn: state.firstEntry?.time ?? null, shiftStatus: labels[state.status] };
  } else if (body?.action === "REQUEST") {
    if (session.user.id === value.selectedResponsibleId) return NextResponse.json({ error: "Sei già il responsabile del turno" }, { status: 400 });
    value.dayAccess.permissions[session.user.id] = { status: "PENDING", requestedAt: now };
    if (value.selectedResponsibleId) await prisma.notification.create({ data: { user_id: value.selectedResponsibleId, title: "Richiesta modifica turno", message: `${session.user.name || "Un responsabile"} chiede il permesso di modificare il controllo di oggi.`, type: "TURNO", action_url: "/responsabile-di-turno" } });
  } else if (body?.action === "DECIDE") {
    if (session.user.id !== value.selectedResponsibleId || !body.requesterId || !["APPROVED", "DENIED"].includes(body.decision || "")) return NextResponse.json({ error: "Non puoi gestire questa richiesta" }, { status: 403 });
    const pending = value.dayAccess.permissions[body.requesterId];
    if (!pending) return NextResponse.json({ error: "Richiesta non trovata" }, { status: 404 });
    value.dayAccess.permissions[body.requesterId] = { ...pending, status: body.decision as "APPROVED" | "DENIED", decidedAt: now, decidedBy: session.user.id };
    await prisma.notification.create({ data: { user_id: body.requesterId, title: body.decision === "APPROVED" ? "Permesso approvato" : "Permesso non approvato", message: body.decision === "APPROVED" ? "Puoi modificare il controllo del responsabile dopo la presa visione." : "Il responsabile di turno non ha approvato la richiesta.", type: "TURNO", action_url: "/responsabile-di-turno" } });
  } else return NextResponse.json({ error: "Azione non valida" }, { status: 400 });

  value.access[day] = value.dayAccess;
  await prisma.setting.upsert({ where: { key: SHIFT_RESPONSIBLE_ACCESS_KEY }, create: { key: SHIFT_RESPONSIBLE_ACCESS_KEY, value: value.access }, update: { value: value.access } });
  return NextResponse.json({ dayAccess: value.dayAccess, selectedResponsibleId: value.selectedResponsibleId, canEdit: hasShiftWriteAccess(value.dayAccess, session.user.id, value.selectedResponsibleId), currentUserId: session.user.id, requesterNames: await requesterNames(value.dayAccess) });
}
