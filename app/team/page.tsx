import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Activity, AlertTriangle, BadgeCheck, BarChart3, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, Mail, MapPin, PieChart, Star, Timer, UserRound, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AutoRefresh } from "@/components/auto-refresh";
import { TaskEvaluationActions } from "@/components/task-evaluation-actions";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { resolveCanonicalStaffName } from "@/lib/client-control-normalize";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";
import { calculateClockHours } from "@/lib/work-hours";
import { isClosedSchedule } from "@/lib/scheduled-attendance";

export const dynamic = "force-dynamic";
const PAUSE_LATENESS_START_KEY = "2026-08-26";

type CompletionFile = { name: string; url?: string | null };

function Avatar({ name, photoUrl, size = "size-24" }: { name: string; photoUrl: string | null; size?: string }) {
  return (
    <div className={`${size} grid shrink-0 place-items-center overflow-hidden rounded-full bg-paradise-softPink text-2xl font-bold`}>
      {photoUrl ? <img src={resolveDrivePhotoUrl(photoUrl)} alt={name} className="size-full object-cover" /> : name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function DashboardStat({
  icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  detail?: string;
  tone?: "neutral" | "green" | "pink" | "gold" | "violet";
}) {
  const tones = {
    neutral: "bg-[#F7F4F5] text-black dark:bg-white/[0.07] dark:text-white",
    green: "bg-emerald-50 text-emerald-950 dark:bg-emerald-400/10 dark:text-emerald-100",
    pink: "bg-[#FFF0F5] text-[#5B2632] dark:bg-[#C66170]/15 dark:text-[#FFDCE6]",
    gold: "bg-amber-50 text-amber-950 dark:bg-amber-400/10 dark:text-amber-100",
    violet: "bg-[#F4F0FF] text-[#302752] dark:bg-[#8064D8]/15 dark:text-[#E6DEFF]",
  };

  return (
    <div className={`min-w-0 rounded-[22px] p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.13em] opacity-55">{label}</p>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/70 shadow-sm dark:bg-white/10">{icon}</span>
      </div>
      <p className="mt-4 truncate text-3xl font-black tracking-[-0.04em]">{value}</p>
      {detail ? <p className="mt-1 truncate text-xs font-semibold opacity-55">{detail}</p> : null}
    </div>
  );
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "Non impostata";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(value);
}

function formatTimer(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function renderTextWithLinks(text: string) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (part.match(/^https?:\/\//i)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#8064D8] hover:underline break-all font-semibold"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function weekStart(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay() || 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day + 1);
  return start;
}

function normalizeFiles(value: unknown): CompletionFile[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return { name: item };
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      return { name: String(record.name ?? "file"), url: record.url ? String(record.url) : null };
    }
    return { name: "file" };
  });
}

function isImage(url?: string | null) {
  return Boolean(url && /^data:image\//i.test(url));
}

function evaluationPoints(value: string | null) {
  if (value === "LIKE") return 5;
  if (value === "OK") return 3;
  if (value === "DISLIKE") return 1;
  return null;
}

function parseMinutes(value?: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function categoryDuration(start: string | null | undefined, end: string | null | undefined) {
  const startMinutes = parseMinutes(start);
  const endMinutes = parseMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  return Math.max(0, (endMinutes - startMinutes) / 60);
}

function isWorkCategory(category?: { code: string; name: string } | null) {
  if (!category) return false;
  const code = category.code.toUpperCase();
  const name = category.name.toLowerCase();
  if (
    code === "R" || code === "RI" || code === "R3" ||
    code === "F" || code === "FE" ||
    code === "P" || code === "PE" ||
    code === "M" || code === "MA" || code === "ML" ||
    code === "A" || code === "AI" || code === "NL" || code === "ND" || code === "NLA" ||
    code === "C" || code === "CH" || code === "C3" ||
    name.includes("riposo") ||
    name.includes("ferie") ||
    name.includes("permesso") ||
    name.includes("malattia") ||
    name.includes("assenza") ||
    name.includes("chiuso") ||
    name.includes("non lavora") ||
    name.includes("no lavoro")
  ) {
    return false;
  }
  return true;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatHours(value: number) {
  return `${Math.round(value * 10) / 10} h`;
}

function pauseDelayMinutes(logs: { type: string; timestamp: Date }[], breakLimitMinutes: number) {
  const ordered = [...logs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let pausedAt: Date | null = null;
  let totalDelay = 0;

  ordered.forEach((log) => {
    if (log.type === "PAUSA") {
      pausedAt = log.timestamp;
    }
    if (log.type === "RIENTRO" && pausedAt) {
      const duration = Math.round((log.timestamp.getTime() - pausedAt.getTime()) / 60000);
      totalDelay += Math.max(0, duration - breakLimitMinutes);
      pausedAt = null;
    }
    if ((log.type === "ENTRATA" || log.type === "USCITA") && pausedAt) {
      pausedAt = null;
    }
  });

  return totalDelay;
}

function truthyCheck(value: unknown) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  return ["true", "si", "sì", "yes", "1", "on", "fatto"].includes(text);
}

function namesFromAnswer(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(namesFromAnswer);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return namesFromAnswer(record.name ?? record.label ?? record.value ?? "");
  }
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default async function TeamPage({ searchParams }: { searchParams?: Promise<{ user?: string; task?: string; year?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  
  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true }
  });

  const role = session.user.role as Role;
  const canAccessPage = accessUser
    ? await canAccessForUser(prisma, "/team", accessUser)
    : ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(role);

  if (!canAccessPage) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const where: Prisma.UserWhereInput = role === "RESPONSABILE"
    ? { active: true, sede_id: session.user.sedeId ?? undefined, role: { notIn: ["ZERO", "SUPER_ADMIN"] } }
    : { active: true, role: { notIn: ["ZERO", "SUPER_ADMIN"] } };

  const workers = await prisma.user.findMany({ where, include: { location: true }, orderBy: [{ location: { name: "asc" } }, { name: "asc" }] });
  const selectedId = params?.user ?? workers[0]?.id;
  const selected = workers.find((worker) => worker.id === selectedId) ?? workers[0];
  const start = weekStart();
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const yearParam = params?.year ? String(params.year) : null;
  let year: number;
  if (yearParam && /^\d{4}$/.test(yearParam)) {
    year = parseInt(yearParam, 10);
  } else {
    year = new Date().getFullYear();
  }

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const [tasks, attendanceLogs, planningEntries, monthAttendanceLogs, clientControlResponses, leaveRequests, workHourRecords, clockRuleSettings] = selected
    ? await Promise.all([
        prisma.staffTask.findMany({
          where: role === "RESPONSABILE" ? { assignees: { some: { id: selected.id } }, location_id: session.user.sedeId ?? undefined } : { assignees: { some: { id: selected.id } } },
          include: { created_by: true, assignees: true },
          orderBy: { updated_at: "desc" },
        }),
        prisma.attendanceLog.findMany({
          where: { user_id: selected.id },
          orderBy: { timestamp: "desc" },
          take: 6,
        }),
        prisma.scheduleEntry.findMany({
          where: { user_id: selected.id, date: { gte: yearStart, lte: yearEnd } },
          include: { category: true, location: true },
          orderBy: { date: "asc" },
        }),
        prisma.attendanceLog.findMany({
          where: { user_id: selected.id, date: { gte: yearStart, lte: yearEnd } },
          orderBy: { timestamp: "asc" },
        }),
        prisma.serviceFormResponse.findMany({
          where: { created_at: { gte: yearStart, lte: yearEnd } },
          include: { form: true, user: true },
          orderBy: { created_at: "desc" },
        }),
        prisma.leaveRequest.findMany({
          where: {
            user_id: selected.id,
            start_date: { lte: yearEnd },
            end_date: { gte: yearStart },
          },
          orderBy: { start_date: "asc" },
        }),
        prisma.workHourRecord.findMany({
          where: { user_id: selected.id, date: { gte: yearStart, lte: yearEnd } },
        }),
        prisma.setting.findMany({ where: { key: { startsWith: "clock_rule:" } } }),
      ])
    : [[], [], [], [], [], [], [], []];

  const selectedTask = tasks.find((task) => task.id === params?.task) ?? null;
  const completed = tasks.filter((task) => task.status === "COMPLETED");
  const active = tasks.filter((task) => task.status === "ACTIVE");
  const newTasks = tasks.filter((task) => task.status === "NEW");
  const completedWeek = completed.filter((task) => task.completed_at && task.completed_at >= start && task.completed_at < end);
  const createdWeek = tasks.filter((task) => task.created_at >= start && task.created_at < end);
  const evaluated = completed.map((task) => evaluationPoints(task.evaluation)).filter((value): value is 1 | 3 | 5 => value !== null);
  const avgRating = evaluated.length ? evaluated.reduce((total, value) => total + value, 0) / evaluated.length : 0;
  const dueCompleted = completed.filter((task) => task.due_date && task.completed_at);
  const punctuality = dueCompleted.length ? Math.round((dueCompleted.filter((task) => task.completed_at! <= task.due_date!).length / dueCompleted.length) * 100) : 100;
  const timedCompleted = completed.filter((task) => task.timer_seconds > 0);
  const averageSeconds = timedCompleted.length ? Math.round(timedCompleted.reduce((total, task) => total + task.timer_seconds, 0) / timedCompleted.length) : 0;
  const speedLabel = averageSeconds === 0 ? "Nessun tempo" : averageSeconds <= 3600 ? "Ottimo" : averageSeconds <= 7200 ? "Da seguire" : "Lento";
  const totalPie = Math.max(1, completedWeek.length + active.length + newTasks.length);
  const completedDeg = (completedWeek.length / totalPie) * 360;
  const activeDeg = completedDeg + (active.length / totalPie) * 360;
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    const assigned = createdWeek.filter((task) => task.created_at.toDateString() === day.toDateString()).length;
    const done = completedWeek.filter((task) => task.completed_at?.toDateString() === day.toDateString()).length;
    return { label: new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(day), assigned, done };
  });
  const maxWeek = Math.max(1, ...weekdays.flatMap((day) => [day.assigned, day.done]));
  const now = new Date();
  const selectedCanonicalName = selected ? resolveCanonicalStaffName(selected.name, workers.map((worker) => worker.name)) : "";
  const workPlanningEntries = planningEntries.filter((entry) => isWorkCategory(entry.category));
  const breakLimitForEntry = (locationId?: string | null) => {
    const key = clockRuleKey(locationId || selected.sede_id || "");
    return parseClockRule(clockRuleSettings.find((setting) => setting.key === key)?.value).breakDurationMinutes;
  };
  const approvedLeaveRequests = leaveRequests.filter((request) => request.status === "APPROVED");
  const pendingLeaveRequests = leaveRequests.filter((request) => request.status === "PENDING" || request.status === "FLAGGED");
  const isCoveredByApprovedLeave = (date: Date) => {
    const current = startOfDay(date).getTime();
    return approvedLeaveRequests.some((request) => current >= startOfDay(request.start_date).getTime() && current <= startOfDay(request.end_date).getTime());
  };
  const planningByDay = workPlanningEntries.map((entry) => {
    const key = dayKey(entry.date);
    const dayLogs = monthAttendanceLogs.filter((log) => dayKey(log.date) === key);
    const firstIn = dayLogs.find((log) => log.type === "ENTRATA");
    const plannedStart = parseMinutes(entry.start_time || entry.category?.start_time);
    const actualStart = firstIn ? firstIn.timestamp.getHours() * 60 + firstIn.timestamp.getMinutes() : null;
    const lateMinutes = plannedStart !== null && actualStart !== null ? Math.max(0, actualStart - plannedStart) : 0;
    const breakLimit = breakLimitForEntry(entry.location_id);
    const pauseLateMinutes = key >= PAUSE_LATENESS_START_KEY ? pauseDelayMinutes(dayLogs, breakLimit) : 0;
    const isPast = entry.date < now && entry.date.toDateString() !== now.toDateString();
    const noShow = isPast && !firstIn;
    const justifiedAbsence = noShow && isCoveredByApprovedLeave(entry.date);

    return {
      key,
      entry,
      firstIn,
      lateMinutes,
      pauseLateMinutes,
      breakLimit,
      noShow,
      justifiedAbsence,
    };
  });
  const lateDays = planningByDay.filter((day) => day.lateMinutes > 10);
  const pauseLateDays = planningByDay.filter((day) => day.pauseLateMinutes > 0);
  const noShowDays = planningByDay.filter((day) => day.noShow);
  const justifiedAbsenceDays = planningByDay.filter((day) => day.justifiedAbsence);
  const unjustifiedAbsenceDays = planningByDay.filter((day) => day.noShow && !day.justifiedAbsence);
  const respectedPlanning = planningByDay.length
    ? Math.round(((planningByDay.length - lateDays.length - pauseLateDays.length - unjustifiedAbsenceDays.length) / planningByDay.length) * 100)
    : 100;
  const totalLateMinutes = lateDays.reduce((sum, day) => sum + day.lateMinutes, 0);
  const totalPauseLateMinutes = pauseLateDays.reduce((sum, day) => sum + day.pauseLateMinutes, 0);
  const logsByDay = new Map<string, typeof monthAttendanceLogs>();
  monthAttendanceLogs.forEach((log) => {
    const key = dayKey(log.date);
    logsByDay.set(key, [...(logsByDay.get(key) ?? []), log]);
  });
  const recordsByDay = new Map(workHourRecords.map((record) => [dayKey(record.date), record]));
  const overtimeSummary = workPlanningEntries.reduce(
    (summary, entry) => {
      const key = dayKey(entry.date);
      const record = recordsByDay.get(key);
      const clock = calculateClockHours(logsByDay.get(key) ?? []);
      const plannedStart = entry.start_time ?? entry.category?.start_time;
      const plannedEnd = entry.end_time ?? entry.category?.end_time;
      const scheduledHours = entry.category?.paid_hours ?? categoryDuration(plannedStart, plannedEnd);
      const automaticHours = record?.paid_break ? clock.grossHours : clock.netHours;
      const paidClosedHours = isClosedSchedule(entry.category?.name, entry.category?.code) ? scheduledHours : 0;
      const workedHours = record?.manual_override ? record.hours : Math.max(automaticHours, paidClosedHours);
      const delta = workedHours - scheduledHours;
      if (delta > 0) summary.overtime += delta;
      if (delta < 0) summary.missing += Math.abs(delta);
      summary.worked += workedHours;
      summary.scheduled += scheduledHours;
      return summary;
    },
    { overtime: 0, missing: 0, worked: 0, scheduled: 0 }
  );
  const overdueTasks = tasks.filter((task) => task.status !== "COMPLETED" && task.due_date && task.due_date < now);
  const clientControls = clientControlResponses
    .filter((response) => isClientControlFormName(response.form?.name, response.form?.category))
    .filter((response) => {
      const answers = response.answers as Record<string, unknown>;
      const selectedStaff = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
      const fallbackOwner = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
      const names = (selectedStaff.length > 0 ? selectedStaff : fallbackOwner)
        .map((name) => resolveCanonicalStaffName(name, workers.map((worker) => worker.name)));
      return names.includes(selectedCanonicalName);
    });
  const clientStats = clientControls.reduce(
    (stats, response) => {
      const answers = response.answers as Record<string, unknown>;
      const salon = String(answers[CLIENT_CONTROL_FIELD_IDS.location] || response.user_location_name || "Senza sede");
      stats.clients += 1;
      stats.notePhoto += truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.notes]) ? 1 : 0;
      stats.notePhoto += truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.beforeMedia]) ? 1 : 0;
      stats.notePhoto += truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.afterMedia]) ? 1 : 0;
      stats.products += truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.products]) ? 1 : 0;
      stats.reviews += truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.review]) ? 1 : 0;
      stats.salons.set(salon, (stats.salons.get(salon) ?? 0) + 1);
      return stats;
    },
    { clients: 0, notePhoto: 0, products: 0, reviews: 0, salons: new Map<string, number>() }
  );
  const salonBreakdown = Array.from(clientStats.salons.entries())
    .map(([salon, count]) => ({ salon, count }))
    .sort((a, b) => b.count - a.count || a.salon.localeCompare(b.salon));
  const behaviorScore = Math.max(
    0,
    Math.min(
      100,
      Math.round((punctuality * 0.3) + (respectedPlanning * 0.35) + (Math.max(0, 100 - unjustifiedAbsenceDays.length * 18) * 0.15) + (Math.min(100, clientStats.clients * 10) * 0.12) + (avgRating ? (avgRating / 5) * 8 : 6))
    )
  );

  return (
    <AppShell title="Team" subtitle="Panoramica personale e stato task aggiornato in tempo reale." role={role}>
      <AutoRefresh interval={12000} />
      <div className="grid items-start gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
        <Card className="bg-white p-4 xl:sticky xl:top-5 dark:bg-[#17151A]">
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40 dark:text-white/45">Personale</p>
              <p className="mt-1 text-sm font-semibold text-black/55 dark:text-white/60">Seleziona un profilo</p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-[#F8EEF2] text-sm font-black text-[#A9475A] dark:bg-white/10 dark:text-white">{workers.length}</span>
          </div>
          <div className="grid max-h-[calc(100dvh-230px)] gap-1.5 overflow-y-auto pr-1">
            {workers.map((worker) => (
              <Link key={worker.id} href={`/team?user=${worker.id}&year=${year}`} className={`flex min-h-16 items-center gap-3 rounded-[20px] border p-2.5 transition ${selected?.id === worker.id ? "border-[#C66170]/35 bg-[#FFF0F5] shadow-sm dark:bg-[#C66170]/15" : "border-transparent hover:border-black/5 hover:bg-[#FBF7F9] dark:hover:bg-white/[0.06]"}`}>
                <Avatar name={worker.name} photoUrl={worker.photo_url} size="size-11" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{worker.name}</p>
                  <p className="mt-0.5 truncate text-xs text-black/45 dark:text-white/45">{worker.location?.name ?? "Senza salone"}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {selected ? (
          <div className="space-y-5">
            {/* Year Selector */}
            <div className="flex items-center justify-between gap-4 bg-white rounded-3xl p-4 border border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-black/45">Filtro Periodo:</span>
                <span className="rounded-xl bg-paradise-softPink/65 px-3 py-1 text-xs font-black text-black">
                  Anno {year}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/team?user=${selected.id}&year=${year - 1}${params?.task ? `&task=${params.task}` : ""}`}
                  className="inline-flex size-8 items-center justify-center rounded-xl border border-black/10 bg-transparent text-black transition hover:bg-black/5 active:scale-95"
                >
                  <ChevronLeft className="size-4" />
                </Link>
                <span className="text-xs font-black min-w-[32px] text-center">{year}</span>
                <Link
                  href={`/team?user=${selected.id}&year=${year + 1}${params?.task ? `&task=${params.task}` : ""}`}
                  className="inline-flex size-8 items-center justify-center rounded-xl border border-black/10 bg-transparent text-black transition hover:bg-black/5 active:scale-95"
                >
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            </div>

            <Card className="overflow-hidden border-white/80 bg-white/80 p-5 dark:bg-[#17151A]/90">
              <div className="grid gap-5 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,2.2fr)] lg:items-center">
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar name={selected.name} photoUrl={selected.photo_url} size="size-24" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-2xl font-black tracking-[-0.03em]">{selected.name}</h2>
                      <BadgeCheck className="size-5 shrink-0 fill-emerald-500 text-white" />
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-black/50 dark:text-white/50">{selected.location?.name ?? "Senza salone"}</p>
                    <p className="mt-2 flex items-center gap-2 truncate text-xs text-black/45 dark:text-white/45"><Mail className="size-3.5 shrink-0" /> {selected.email}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <DashboardStat icon={<CheckCircle2 className="size-4 text-emerald-600" />} label="Task completate" value={completed.length} tone="green" />
                  <DashboardStat icon={<Clock3 className="size-4 text-[#8064D8]" />} label="Task in corso" value={active.length} tone="violet" />
                  <DashboardStat icon={<Timer className="size-4 text-amber-600" />} label="Puntualità" value={`${punctuality}%`} tone="gold" />
                  <DashboardStat icon={<Star className="size-4 text-[#C66170]" />} label="Valutazione" value={avgRating ? avgRating.toFixed(1) : "—"} tone="pink" />
                </div>
              </div>
            </Card>

            <div className="grid items-start gap-5 xl:grid-cols-2">
              <Card className="bg-white p-5 dark:bg-[#17151A]">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-[#A9475A]">Performance</p>
                    <h3 className="mt-1 text-xl font-black">Qualità operativa</h3>
                  </div>
                  <BarChart3 className="size-5 text-[#8064D8]" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <DashboardStat icon={<BarChart3 className="size-4 text-[#8064D8]" />} label="Comportamento" value={`${behaviorScore}%`} tone="violet" />
                  <DashboardStat icon={<CalendarDays className="size-4 text-amber-600" />} label="Planning" value={`${respectedPlanning}%`} tone="gold" />
                  <DashboardStat icon={<ClipboardCheck className="size-4 text-emerald-600" />} label="Clienti" value={clientStats.clients} detail="controlli registrati" tone="green" />
                  <DashboardStat icon={<AlertTriangle className="size-4 text-[#C66170]" />} label="Task scadute" value={overdueTasks.length} detail="ancora aperte" tone="pink" />
                  <DashboardStat icon={<Users className="size-4" />} label="Team" value={workers.length} detail="dipendenti attivi" />
                </div>
              </Card>

              <Card className="bg-white p-5 dark:bg-[#17151A]">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-[#A9475A]">Presenze</p>
                    <h3 className="mt-1 text-xl font-black">Assenze, ritardi e ore</h3>
                  </div>
                  <Clock3 className="size-5 text-[#C66170]" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <DashboardStat icon={<Timer className="size-4 text-orange-500" />} label="Ingressi tardi" value={lateDays.length} detail={formatTimer(totalLateMinutes * 60)} tone="gold" />
                  <DashboardStat icon={<BadgeCheck className="size-4 text-emerald-600" />} label="Giustificate" value={justifiedAbsenceDays.length} tone="green" />
                  <DashboardStat icon={<AlertTriangle className="size-4 text-[#C66170]" />} label="Non giustificate" value={unjustifiedAbsenceDays.length} tone="pink" />
                  <DashboardStat icon={<Clock3 className="size-4 text-amber-600" />} label="Rientri tardi" value={pauseLateDays.length} detail={formatTimer(totalPauseLateMinutes * 60)} tone="gold" />
                  <DashboardStat icon={<Timer className="size-4 text-[#8064D8]" />} label="Straordinari" value={formatHours(overtimeSummary.overtime)} tone="violet" />
                  <DashboardStat icon={<Clock3 className="size-4 text-orange-500" />} label="Ore mancanti" value={formatHours(overtimeSummary.missing)} tone="pink" />
                </div>
              </Card>
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <Card className="bg-white dark:bg-[#17151A]">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Planning, ritardi e presenza</h3>
                  <Badge tone={respectedPlanning >= 90 ? "green" : respectedPlanning >= 70 ? "gold" : "pink"}>{respectedPlanning}% rispettato</Badge>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-5">
                  <div className="rounded-2xl bg-[#FBF7F9] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Turni anno</p>
                    <p className="mt-2 text-2xl font-semibold">{planningByDay.length}</p>
                  </div>
                  <div className="rounded-2xl bg-[#FBF7F9] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Ingressi &gt; 10 min</p>
                    <p className="mt-2 text-2xl font-semibold">{lateDays.length}</p>
                  </div>
                  <div className="rounded-2xl bg-[#FBF7F9] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Rientri pausa tardi</p>
                    <p className="mt-2 text-2xl font-semibold">{pauseLateDays.length}</p>
                  </div>
                  <div className="rounded-2xl bg-[#FBF7F9] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Mancate timbrature</p>
                    <p className="mt-2 text-2xl font-semibold">{noShowDays.length}</p>
                  </div>
                  <div className="rounded-2xl bg-[#FBF7F9] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Richieste aperte</p>
                    <p className="mt-2 text-2xl font-semibold">{pendingLeaveRequests.length}</p>
                  </div>
                </div>
                <div className="mt-5 max-h-[390px] divide-y divide-black/5 overflow-y-auto pr-2 dark:divide-white/10">
                  {planningByDay.filter((day) => day.lateMinutes > 10 || day.pauseLateMinutes > 0 || day.noShow).slice(0, 6).map((day) => (
                    <div key={day.key} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div>
                        <p className="font-semibold">
                          {new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "short" }).format(day.entry.date)}
                        </p>
                        <p className="text-xs text-black/45">
                          {day.entry.location?.name ?? selected.location?.name ?? "Sede non indicata"} · turno {day.entry.start_time || day.entry.category?.start_time || "--"}-{day.entry.end_time || day.entry.category?.end_time || "--"}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {day.noShow ? (
                          <Badge tone={day.justifiedAbsence ? "green" : "pink"}>
                            {day.justifiedAbsence ? "Assenza giustificata" : "Assenza non giustificata"}
                          </Badge>
                        ) : null}
                        {!day.noShow && day.lateMinutes > 10 ? <Badge tone="gold">Ingresso +{day.lateMinutes} min</Badge> : null}
                        {!day.noShow && day.pauseLateMinutes > 0 ? <Badge tone="pink">Pausa +{day.pauseLateMinutes} min</Badge> : null}
                      </div>
                    </div>
                  ))}
                  {planningByDay.filter((day) => day.lateMinutes > 10 || day.pauseLateMinutes > 0 || day.noShow).length === 0 ? (
                    <p className="py-4 text-sm text-black/45">Nessun ritardo importante, rientro pausa tardivo o mancata entrata nell'anno.</p>
                  ) : null}
                </div>
              </Card>

              <Card className="self-start bg-white dark:bg-[#17151A]">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Controllo clienti</h3>
                  <MapPin className="size-5 text-black/35" />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-[#FBF7F9] p-3">
                    <p className="text-2xl font-semibold">{clientStats.notePhoto}</p>
                    <p className="text-xs text-black/45">Note/foto</p>
                  </div>
                  <div className="rounded-2xl bg-[#FBF7F9] p-3">
                    <p className="text-2xl font-semibold">{clientStats.products}</p>
                    <p className="text-xs text-black/45">Prodotti</p>
                  </div>
                  <div className="rounded-2xl bg-[#FBF7F9] p-3">
                    <p className="text-2xl font-semibold">{clientStats.reviews}</p>
                    <p className="text-xs text-black/45">Recensioni</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {salonBreakdown.map((item) => (
                    <div key={item.salon} className="rounded-2xl bg-[#FBF7F9] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{item.salon}</p>
                        <Badge tone="pink">{item.count} clienti</Badge>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
                        <div className="h-full rounded-full bg-[#C66170]" style={{ width: `${Math.max(8, (item.count / Math.max(1, clientStats.clients)) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                  {salonBreakdown.length === 0 ? (
                    <p className="py-4 text-sm text-black/45">Nessun cliente associato a questo lavoratore nell'anno corrente.</p>
                  ) : null}
                </div>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <Card className="bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Riepilogo settimana</h3>
                  <Badge tone="pink">{completedWeek.length} completate</Badge>
                </div>
                <div className="mt-6 flex h-40 items-end gap-3 border-b border-black/10 pb-2">
                  {weekdays.map((day) => (
                    <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-28 items-end gap-1">
                        <span className="w-3 rounded-t-full bg-[#8B78D6]" style={{ height: `${Math.max(4, (day.done / maxWeek) * 100)}%` }} />
                        <span className="w-3 rounded-t-full bg-black/15" style={{ height: `${Math.max(4, (day.assigned / maxWeek) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-semibold capitalize text-black/45">{day.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-4 text-xs font-semibold text-black/50">
                  <span className="inline-flex items-center gap-2"><span className="size-3 rounded bg-[#8B78D6]" /> Completate</span>
                  <span className="inline-flex items-center gap-2"><span className="size-3 rounded bg-black/15" /> Assegnate</span>
                </div>
              </Card>

              <Card className="bg-white">
                <h3 className="font-semibold">Task</h3>
                <div className="mt-6 flex items-center gap-6">
                  <div className="grid size-36 place-items-center rounded-full" style={{ background: `conic-gradient(#42A85E 0deg ${completedDeg}deg, #8B78D6 ${completedDeg}deg ${activeDeg}deg, #E2B719 ${activeDeg}deg 360deg)` }}>
                    <div className="grid size-20 place-items-center rounded-full bg-white text-center">
                      <span className="text-2xl font-semibold">{completedWeek.length + active.length + newTasks.length}</span>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm font-semibold">
                    <p><span className="mr-2 inline-block size-3 rounded-full bg-[#42A85E]" /> Completate settimana {completedWeek.length}</p>
                    <p><span className="mr-2 inline-block size-3 rounded-full bg-[#8B78D6]" /> In corso {active.length}</p>
                    <p><span className="mr-2 inline-block size-3 rounded-full bg-[#E2B719]" /> Da fare {newTasks.length}</p>
                  </div>
                </div>
              </Card>

              <Card className="bg-white">
                <h3 className="font-semibold">Puntualita</h3>
                <p className="mt-6 text-5xl font-semibold">{punctuality}%</p>
                <p className="mt-2 text-sm text-black/50">Regola: completata entro scadenza.</p>
                <div className="mt-6 rounded-2xl bg-[#FBF7F9] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Tempo medio</p>
                  <p className="mt-2 text-2xl font-semibold">{averageSeconds ? formatTimer(averageSeconds) : "--"}</p>
                  <Badge tone={speedLabel === "Ottimo" ? "green" : speedLabel === "Da seguire" ? "gold" : "pink"}>{speedLabel}</Badge>
                </div>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
              <Card className="bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Ultime task</h3>
                  <PieChart className="size-5 text-black/35" />
                </div>
                <div className="mt-4 divide-y divide-black/5">
                  {tasks.slice(0, 7).map((task) => (
                    <Link key={task.id} href={`/team?user=${selected.id}&task=${task.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
                      <span className="grid size-8 place-items-center rounded-full bg-[#F4F0FF]"><UserRound className="size-4" /></span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{task.title}</p>
                        <p className="text-xs text-black/45">Da {task.created_by.name} · {formatDate(task.due_date)} · {task.timer_seconds ? formatTimer(task.timer_seconds) : "timer non avviato"}</p>
                      </div>
                      <Badge tone={task.status === "COMPLETED" ? "green" : task.status === "ACTIVE" ? "gold" : "pink"}>{task.status === "COMPLETED" ? "Completata" : task.status === "ACTIVE" ? "In corso" : "Da iniziare"}</Badge>
                    </Link>
                  ))}
                  {tasks.length === 0 ? <p className="py-4 text-sm text-black/45">Nessuna task presente.</p> : null}
                </div>
              </Card>

              <Card className="bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Attivita recente</h3>
                  <Activity className="size-5 text-black/35" />
                </div>
                <div className="mt-4 space-y-3">
                  {tasks.slice(0, 4).map((task) => (
                    <div key={task.id} className="rounded-2xl bg-[#FBF7F9] p-4">
                      <p className="text-sm font-semibold">{task.status === "COMPLETED" ? "Ha completato" : "Ha ricevuto"} la task “{task.title}”</p>
                      <p className="mt-1 text-xs text-black/45">{formatDate(task.updated_at)}</p>
                    </div>
                  ))}
                  {attendanceLogs.map((log) => (
                    <div key={log.id} className="rounded-2xl bg-[#FBF7F9] p-4">
                      <p className="text-sm font-semibold">Timbratura {log.type.toLowerCase()}</p>
                      <p className="mt-1 text-xs text-black/45">{formatDate(log.timestamp)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {selectedTask ? (
              <Card className="bg-white">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Dettaglio task</p>
                    <h3 className="mt-2 text-3xl font-semibold">{selectedTask.title}</h3>
                    <p className="mt-3 max-w-3xl leading-7 text-black/55 whitespace-pre-wrap">{renderTextWithLinks(selectedTask.description)}</p>
                  </div>
                  <Badge tone={selectedTask.status === "COMPLETED" ? "green" : selectedTask.status === "ACTIVE" ? "gold" : "pink"}>{selectedTask.status === "COMPLETED" ? "Completata" : selectedTask.status === "ACTIVE" ? "In corso" : "Da iniziare"}</Badge>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-[#FBF7F9] p-4"><p className="text-xs text-black/40">Richiesto da</p><p className="font-semibold">{selectedTask.created_by.name}</p></div>
                  <div className="rounded-2xl bg-[#FBF7F9] p-4"><p className="text-xs text-black/40">Scadenza</p><p className="font-semibold">{formatDate(selectedTask.due_date)}</p></div>
                  <div className="rounded-2xl bg-[#FBF7F9] p-4"><p className="text-xs text-black/40">Tempo impiegato</p><p className="font-semibold">{selectedTask.timer_seconds ? formatTimer(selectedTask.timer_seconds) : "--"}</p></div>
                </div>
                {(selectedTask.completion_note || selectedTask.completion_files || selectedTask.completion_links) ? (
                  <div className="mt-6 rounded-[24px] border border-black/5 p-4">
                    <h4 className="font-semibold">Cosa ha finito</h4>
                    {selectedTask.completion_note ? <p className="mt-3 leading-7 text-black/55 whitespace-pre-wrap">{renderTextWithLinks(selectedTask.completion_note)}</p> : null}
                    <div className="mt-4 grid gap-3">
                      {normalizeFiles(selectedTask.completion_files).map((file, index) => (
                        <div key={`${file.name}-${index}`} className="rounded-2xl bg-[#FAF7F9] p-3">
                          {isImage(file.url) ? <img src={file.url!} alt={file.name} className="max-h-96 w-full rounded-xl object-contain" /> : null}
                          <p className="mt-2 text-sm font-semibold text-black/60">{file.name}</p>
                        </div>
                      ))}
                      {Array.isArray(selectedTask.completion_links) ? selectedTask.completion_links.map((link) => <a key={String(link)} href={String(link)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#8064D8]">{String(link)}</a>) : null}
                    </div>
                  </div>
                ) : null}
                <div className="mt-6">
                  <p className="mb-3 text-sm font-semibold">Valutazione responsabile</p>
                  <TaskEvaluationActions taskId={selectedTask.id} initialValue={selectedTask.evaluation} />
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
