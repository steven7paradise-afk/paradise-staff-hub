import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DailyRegister, type RegisterRow } from "@/components/daily-register";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { attendanceActualMinutes, currentRomeMinutes, isClosedSchedule, isRestSchedule, scheduledEntryPolicy } from "@/lib/scheduled-attendance";
import { isAutomaticLateReason } from "@/lib/automatic-late-requests";
import { leaveCoversWholeShift } from "@/lib/register-leave";
import { countedAttendanceTime } from "@/lib/work-hours";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";

export const dynamic = "force-dynamic";
export default async function DailyRegisterPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const viewer = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, mansione: true, access_list: true, sede_id: true } });
  if (!viewer || viewer.role !== "SUPER_ADMIN" || !(await canAccessForUser(prisma, "/registro-giornaliero", viewer))) redirect("/dashboard");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const params = await searchParams;
  const candidate = params.date || today;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(candidate) && !Number.isNaN(Date.parse(candidate)) && new Date(candidate).toISOString().slice(0,10) === candidate;
  const day = valid ? candidate : today;
  const start = new Date(`${day}T00:00:00Z`);
  const end = new Date(start.getTime() + 86400000);
  const [workers, logs, schedules, leaves, clockRules] = await Promise.all([
    prisma.user.findMany({ where: { active: true, role: { notIn: ["ZERO", "SUPER_ADMIN"] } }, include: { location: true }, orderBy: { name: "asc" } }),
    prisma.attendanceLog.findMany({ where: { date: { gte: start, lt: end } }, orderBy: { timestamp: "asc" } }),
    prisma.scheduleEntry.findMany({ where: { date: { gte: start, lt: end } }, include: { category: true, location: true } }),
    prisma.leaveRequest.findMany({ where: { status: "APPROVED", start_date: { lt: end }, end_date: { gte: start } } }),
    prisma.setting.findMany({ where: { key: { startsWith: "clock_rule:" } }, select: { key: true, value: true } }),
  ]);
  const rows: RegisterRow[] = workers.filter(w => !/ex[\s-]*dipendent/i.test(`${w.mansione || ""} ${w.employee_status || ""}`)).map(worker => {
    const schedule = schedules.find(s => s.user_id === worker.id);
    const entries = logs.filter(l => l.user_id === worker.id);
    const state = deriveAttendanceState(entries);
    const entry = state.firstEntry;
    const location = schedule?.location?.name || worker.location?.name || "Sede non indicata";
    const plannedStart = schedule?.start_time || schedule?.category.start_time;
    const plannedEnd = schedule?.end_time || schedule?.category.end_time;
    const policy = scheduledEntryPolicy({ plannedStart, plannedEnd, locationName: location });
    const actual = entry ? attendanceActualMinutes(entry) : null;
    const late = actual !== null && policy.deadlineMinutes !== null ? Math.max(0, actual - policy.deadlineMinutes) : 0;
    const approvedLeaves = leaves.filter(l => l.user_id === worker.id && !l.sickness_unjustified && !isAutomaticLateReason(l.reason));
    const leave = approvedLeaves.find(l => leaveCoversWholeShift(l, plannedStart, plannedEnd));
    const partialLeave = approvedLeaves.some(l => !leaveCoversWholeShift(l, plannedStart, plannedEnd));
    let status: RegisterRow["status"] = "UNPLANNED";
    let detail = "Nessun turno impostato";
    if (entry) { status = policy.deadlineMinutes === null ? "UNPLANNED" : late ? "LATE" : "ON_TIME"; detail = late ? `${late} min oltre la tolleranza` : policy.deadlineMinutes === null ? "Presente · orario da verificare" : state.status === "BREAK" ? "In pausa" : state.status === "IN" ? "Al lavoro" : "Turno terminato"; }
    else if (leave) { status = leave.type === "RIPOSO" ? "REST" : "JUSTIFIED"; detail = leave.type === "MALATTIA" ? "Malattia giustificata" : leave.type === "FERIE" ? "Ferie approvate" : leave.type === "RIPOSO" ? "Riposo" : "Assenza giustificata"; }
    else if (partialLeave) { status = "UNPLANNED"; detail = "Permesso parziale approvato · verifica orari"; }
    else if (schedule && (isRestSchedule(schedule.category.name, schedule.category.code) || isClosedSchedule(schedule.category.name, schedule.category.code))) { status = "REST"; detail = schedule.category.name; }
    else if (policy.deadlineMinutes !== null) { const overdue = day < today || day === today && currentRomeMinutes() > policy.deadlineMinutes; status = overdue ? "ABSENT" : "WAITING"; detail = overdue ? "Nessuna entrata · giustifica non registrata" : "Il turno deve ancora iniziare"; }
    const clock = (minutes: number | null) => minutes === null ? "—" : `${String(Math.floor(minutes / 60)).padStart(2,"0")}:${String(minutes % 60).padStart(2,"0")}`;
    const actualEntry = clock(actual);
    const countedEntry = entry ? countedAttendanceTime(entry) : "—";
    const entryDisplay = actualEntry !== countedEntry ? `${actualEntry}\nConteggiata ${countedEntry}` : actualEntry;
    const pauseRule = state.activePause ? parseClockRule(clockRules.find(rule => rule.key === clockRuleKey(state.activePause!.location_id))?.value) : null;
    const pauseEndsAt = day === today && state.activePause && pauseRule ? new Date(state.activePause.timestamp.getTime() + pauseRule.breakDurationMinutes * 60000).toISOString() : null;
    const pause = state.breaks.map(pair => {
      const from = clock(attendanceActualMinutes(pair.pausa));
      const to = pair.rientro ? clock(attendanceActualMinutes(pair.rientro)) : pair.minutes !== undefined && state.lastExit ? clock(attendanceActualMinutes(state.lastExit)) : null;
      return to ? `${from} – ${to} (${pair.minutes ?? 0} min${pair.rientro ? "" : " · chiusa all’uscita"})` : `${from} · ${day < today ? "Rientro non registrato" : "In corso"}`;
    }).join("\n") || "—";
    return { id: worker.id, name: worker.name, photoUrl: worker.photo_url, location, shift: plannedStart ? `${plannedStart} – ${plannedEnd || "—"}` : "—", entry: entryDisplay, exit: state.lastExit ? new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(state.lastExit.timestamp) : "—", pause, pauseEndsAt, lateMinutes: late, status, detail };
  });
  return <AppShell title="Registro giornaliero" hideHeader><DailyRegister key={day} date={day} rows={rows} updatedAt={new Date().toISOString()} /></AppShell>;
}
