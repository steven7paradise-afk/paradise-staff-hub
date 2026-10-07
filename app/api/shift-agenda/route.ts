import { resolveShiftResponsible } from "@/lib/shift-responsible-selection-data";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompleteCowlendarBookingsForRange, hasCowlendarToken } from "@/lib/cowlendar";
import { isClientControlFormName } from "@/lib/client-control-form";
import { romeDayRange } from "@/lib/shift-reports";
import { AGENDA_OUTCOMES, WAIT_REASONS, buildAgendaReport, emptyAgendaNotes, romeAgendaDate, type AgendaNotes } from "@/lib/shift-agenda";
import { emptyShiftAccessDay, hasShiftWriteAccess, normalizeShiftResponsibleAccess, SHIFT_RESPONSIBLE_ACCESS_KEY } from "@/lib/shift-responsible-access";
import { normalizeShiftResponsibleAssignments, WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY } from "@/lib/weekly-shift-responsibles";
const roles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
async function load(day: string) {
  if (!hasCowlendarToken()) throw new Error("Calendario non collegato");
  const { start, end } = romeDayRange(day);
  const [bookings, forms, statuses, teams, saved] = await Promise.all([
    getCompleteCowlendarBookingsForRange(start.toISOString(), new Date(end.getTime() - 1).toISOString()),
    prisma.serviceForm.findMany({ select: { id: true, name: true, category: true } }),
    prisma.setting.findUnique({ where: { key: "appointment_status_overrides" } }),
    prisma.setting.findUnique({ where: { key: "appointment_team_overrides" } }),
    prisma.setting.findUnique({ where: { key: `shift_agenda_${day}` } }),
  ]);
  const ids = [...new Set(bookings.map(b => String(b.id)))];
  const formIds = forms.filter(f => isClientControlFormName(f.name, f.category)).map(f => f.id);
  const controls = ids.length && formIds.length ? await prisma.serviceFormResponse.findMany({ where: { form_id: { in: formIds }, OR: ids.map(id => ({ answers: { path: ["booking_id"], equals: id } })) }, select: { answers: true, updated_at: true } }) : [];
  const value = saved?.value as { notes?: AgendaNotes; version?: string } | null;
  const notes = value?.notes || emptyAgendaNotes();
  return { ...buildAgendaReport(day, bookings, controls, (statuses?.value || {}) as Record<string, { status?: string }>, (teams?.value || {}) as Record<string, { teammates?: Array<{ name?: string }> }>, notes), notes, version: value?.version || null, updatedAt: new Date().toISOString() };
}
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !roles.has(session.user.role)) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const day = request.nextUrl.searchParams.get("day");
  if (day !== romeAgendaDate(new Date())) return NextResponse.json({ error: "Giorno non valido" }, { status: 400 });
  try { return NextResponse.json(await load(day), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ error: "Calendario o schede non disponibili. Riprova: i conteggi non sono stati sostituiti con zero." }, { status: 502 }); }
}
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !roles.has(session.user.role)) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || body.day !== romeAgendaDate(new Date())) return NextResponse.json({ error: "Giorno non valido" }, { status: 400 });
  const [access, assignment] = await Promise.all([prisma.setting.findUnique({ where: { key: SHIFT_RESPONSIBLE_ACCESS_KEY } }), prisma.setting.findUnique({ where: { key: WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY } })]);
  if (!hasShiftWriteAccess(normalizeShiftResponsibleAccess(access?.value)[body.day] || emptyShiftAccessDay(), session.user.id, await resolveShiftResponsible(body.day, normalizeShiftResponsibleAssignments(assignment?.value)[body.day]))) return NextResponse.json({ error: "Serve la presa visione e il permesso di compilare il turno." }, { status: 403 });
  try {
    const report = await load(body.day);
    if (body.version !== report.version) return NextResponse.json({ error: "Agenda aggiornata da un’altra persona. Aggiorna i dati prima di salvare." }, { status: 409 });
    const ids = new Set(report.appointments.map(a => a.id));
    const notes = body.notes;
    if (!notes || !notes.outcomes || typeof notes.outcomes !== "object" || Array.isArray(notes.outcomes) || !Array.isArray(notes.waits) || notes.waits.length > 100) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    for (const [id, outcome] of Object.entries(notes.outcomes)) if (!ids.has(id) || !AGENDA_OUTCOMES.includes(outcome as typeof AGENDA_OUTCOMES[number])) return NextResponse.json({ error: "Esito non valido" }, { status: 400 });
    for (const wait of notes.waits) if (!ids.has(wait.bookingId) || !Number.isInteger(wait.minutes) || wait.minutes <= 10 || wait.minutes > 600 || !WAIT_REASONS.includes(wait.reason) || typeof wait.note !== "string" || wait.note.length > 1000 || (wait.reason === "Altro" && !wait.note.trim())) return NextResponse.json({ error: "Indica cliente, attesa oltre 10 minuti e motivo. Per Altro aggiungi una nota." }, { status: 400 });
    const key = `shift_agenda_${body.day}`;
    const version = crypto.randomUUID();
    const value = { notes, version, updatedBy: session.user.id, updatedAt: new Date().toISOString() };
    if (report.version === null) {
      const result = await prisma.setting.createMany({ data: [{ key, value }], skipDuplicates: true });
      if (!result.count) return NextResponse.json({ error: "Dati aggiornati nel frattempo. Aggiorna e riprova." }, { status: 409 });
    } else {
      const result = await prisma.setting.updateMany({ where: { key, value: { path: ["version"], equals: report.version } }, data: { value } });
      if (!result.count) return NextResponse.json({ error: "Dati aggiornati nel frattempo. Aggiorna e riprova." }, { status: 409 });
    }
    return NextResponse.json({ version });
  } catch { return NextResponse.json({ error: "Agenda non salvata. Riprova." }, { status: 500 }); }
}
