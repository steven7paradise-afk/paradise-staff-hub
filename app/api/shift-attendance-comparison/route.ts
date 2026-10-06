import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { romeDayRange } from "@/lib/shift-reports";
import { deriveAttendanceState } from "@/lib/attendance-state";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role)) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const day = new URL(request.url).searchParams.get("day") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day))) return NextResponse.json({ error: "Data non valida" }, { status: 400 });
  try {
    const { start, end } = romeDayRange(day);
    const date = new Date(`${day}T00:00:00.000Z`);
    const people = await prisma.user.findMany({
      where: { OR: [{ attendance_logs: { some: { timestamp: { gte: start, lt: end } } } }, { schedule_entries: { some: { date } } }] },
      select: { id: true, name: true, attendance_logs: { where: { timestamp: { gte: start, lt: end } }, select: { type: true, timestamp: true, time: true }, orderBy: { timestamp: "asc" } }, schedule_entries: { where: { date }, select: { start_time: true, category: { select: { name: true, start_time: true } } } } },
    });
    const clock = (timestamp: Date) => new Intl.DateTimeFormat("it-IT", {timeZone:"Europe/Rome", hour:"2-digit", minute:"2-digit"}).format(timestamp);
    return NextResponse.json(people.map(person => {
      const state = deriveAttendanceState(person.attendance_logs);
      const entry = state.firstEntry ? clock(state.firstEntry.timestamp) : null;
      const schedule = person.schedule_entries.length === 1 ? person.schedule_entries[0] : null;
      const scheduled = schedule?.start_time || schedule?.category.start_time || null;
      const minutes = (value: string) => { const [h,m] = value.split(":").map(Number); return h*60+m; };
      const nonWorking = /ferie|malattia|riposo|permesso/i.test(schedule?.category.name || "");
      const delay = entry && scheduled && !nonWorking ? Math.max(0, minutes(entry)-minutes(scheduled)) : null;
      return { id:person.id, name:person.name, entry, scheduled, delay, scheduleLabel: schedule?.category.name || null, pauses: state.breaks.map(pause => ({ start:clock(pause.pausa.timestamp), end:pause.rientro ? clock(pause.rientro.timestamp) : null, minutes:pause.minutes ?? null })) };
    }), { headers: { "Cache-Control":"private, no-store" } });
  } catch {
    return NextResponse.json({error:"Timbrature momentaneamente non disponibili"}, {status:503});
  }
}
