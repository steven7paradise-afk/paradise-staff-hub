import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ShiftResponsibleWorkspace } from "@/components/shift-responsible-workspace";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { auth } from "@/lib/auth";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { prisma } from "@/lib/prisma";
import { romeDayRange } from "@/lib/shift-reports";
import { getShiftAppointmentClients } from "@/lib/shift-responsible-appointments";
import { taskWorkerWhere } from "@/lib/task-access";
import { emptyShiftAccessDay, hasShiftWriteAccess, normalizeShiftResponsibleAccess, SHIFT_RESPONSIBLE_ACCESS_KEY } from "@/lib/shift-responsible-access";
import {
  normalizeShiftResponsibleAnswers,
  normalizeShiftResponsibleQuestions,
  SHIFT_RESPONSIBLE_ANSWERS_KEY,
  SHIFT_RESPONSIBLE_QUESTIONS_KEY,
} from "@/lib/shift-responsible-questions";
import {
  normalizeShiftResponsibleAssignments,
  WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY,
} from "@/lib/weekly-shift-responsibles";

export const dynamic = "force-dynamic";

const allowedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

function roleLabel(mansione: string | null) {
  return mansione?.toLocaleLowerCase("it-IT").includes("vice responsabile")
    ? "Vice responsabile"
    : "Responsabile";
}

export default async function ResponsabileDiTurnoPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (!allowedRoles.has(session.user.role)) redirect("/dashboard");

  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const { date, start, end } = romeDayRange(day);

  const [people, shiftStaffRows, appointmentClients, taskAssigneeRows, setting, questionsSetting, answersSetting, accessSetting] = await Promise.all([
    prisma.user.findMany({
      where: {
        active: true,
        employee_status: { not: "Ex dipendente" },
        ...(session.user.role === "RESPONSABILE" && session.user.sedeId
          ? { sede_id: session.user.sedeId }
          : {}),
        mansione: { contains: "responsabile salone", mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        photo_url: true,
        mansione: true,
        schedule_entries: {
          where: { date },
          take: 1,
          select: {
            start_time: true,
            end_time: true,
            category: {
              select: { name: true, start_time: true, end_time: true },
            },
          },
        },
        attendance_logs: {
          where: { timestamp: { gte: start, lt: end } },
          orderBy: { timestamp: "asc" },
          select: { type: true, timestamp: true, time: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        active: true,
        employee_status: { not: "Ex dipendente" },
        ...(session.user.role === "RESPONSABILE" && session.user.sedeId ? { sede_id: session.user.sedeId } : {}),
        schedule_entries: {
          some: {
            date,
            location: { name: { contains: "Buenos Aires", mode: "insensitive" } },
          },
        },
        leave_requests: {
          none: {
            status: "APPROVED",
            type: "FERIE",
            start_date: { lt: end },
            end_date: { gte: start },
          },
        },
      },
      select: {
        id: true,
        name: true,
        photo_url: true,
        mansione: true,
        schedule_entries: {
          where: {
            date,
            location: { name: { contains: "Buenos Aires", mode: "insensitive" } },
          },
          take: 1,
          select: { start_time: true, end_time: true, category: { select: { name: true, start_time: true, end_time: true } } },
        },
        attendance_logs: {
          where: { timestamp: { gte: start, lt: end } },
          orderBy: { timestamp: "asc" },
          select: { type: true, timestamp: true, time: true },
        },
        leave_requests: {
          where: {
            status: "APPROVED",
            type: "FERIE",
            start_date: { lt: end },
            end_date: { gte: start },
          },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    getShiftAppointmentClients(day).catch(() => []),
    prisma.user.findMany({
      where: taskWorkerWhere(),
      select: { id: true, name: true, mansione: true, location: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.setting.findUnique({ where: { key: WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY } }),
    prisma.setting.findUnique({ where: { key: SHIFT_RESPONSIBLE_QUESTIONS_KEY } }),
    prisma.setting.findUnique({ where: { key: SHIFT_RESPONSIBLE_ANSWERS_KEY } }),
    prisma.setting.findUnique({ where: { key: SHIFT_RESPONSIBLE_ACCESS_KEY } }),
  ]);

  const responsabili = people
    .sort((a, b) => {
      const roleOrder = Number(roleLabel(a.mansione) === "Vice responsabile") - Number(roleLabel(b.mansione) === "Vice responsabile");
      return roleOrder || a.name.localeCompare(b.name, "it");
    })
    .slice(0, 4);
  const assignments = normalizeShiftResponsibleAssignments(setting?.value);
  const selectedResponsibleId = assignments[day] || responsabili[0]?.id;
  const questions = normalizeShiftResponsibleQuestions(questionsSetting?.value);
  const answers = normalizeShiftResponsibleAnswers(answersSetting?.value);
  const access = normalizeShiftResponsibleAccess(accessSetting?.value);
  const dayAccess = access[day] ?? emptyShiftAccessDay();
  const shiftStaff = shiftStaffRows.flatMap((person) => {
    const schedule = person.schedule_entries[0];
    const startTime = schedule?.start_time || schedule?.category.start_time;
    const endTime = schedule?.end_time || schedule?.category.end_time;
    if (!startTime || !endTime) return [];

    const categoryName = (schedule?.category.name || "").toLowerCase();
    const isFerie = categoryName.includes("ferie");
    const isMalattia = categoryName.includes("malattia");
    const isRiposo = categoryName.includes("riposo") || categoryName.includes("permesso");
    if (isFerie || person.leave_requests.length > 0) return [];

    const attendance = deriveAttendanceState(person.attendance_logs);
    const clockIn = attendance.firstEntry?.time
      ? attendance.firstEntry.time
      : attendance.firstEntry?.timestamp
        ? new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(attendance.firstEntry.timestamp))
        : null;

    let delayMinutes: number | null = null;
    if (clockIn && startTime) {
      const [schedH, schedM] = startTime.split(":").map(Number);
      const [clockH, clockM] = clockIn.split(":").map(Number);
      if (Number.isFinite(schedH) && Number.isFinite(schedM) && Number.isFinite(clockH) && Number.isFinite(clockM)) {
        delayMinutes = (clockH * 60 + clockM) - (schedH * 60 + schedM);
      }
    }

    let pauseSummary: string | null = null;
    if (attendance.status === "BREAK" && attendance.activePause) {
      const pauseTime = attendance.activePause.time || new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(attendance.activePause.timestamp));
      pauseSummary = `In pausa dalle ${pauseTime}`;
    } else if (attendance.breaks.length > 0) {
      pauseSummary = attendance.breaks
        .map((b) => {
          const tPausa = b.pausa.time || new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(b.pausa.timestamp));
          const tRientro = b.rientro
            ? (b.rientro.time || new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(b.rientro.timestamp)))
            : "…";
          return `${tPausa}–${tRientro} (${b.minutes ?? 0}m)`;
        })
        .join(", ");
    }

    let workedHoursFormatted: string | null = null;
    if (attendance.firstEntry) {
      const totalPauseMs = attendance.breaks.reduce((acc, b) => acc + (b.minutes || 0) * 60_000, 0);
      const endMs = attendance.lastExit
        ? new Date(attendance.lastExit.timestamp).getTime()
        : Date.now();
      const startMs = new Date(attendance.firstEntry.timestamp).getTime();
      const totalMs = Math.max(0, endMs - startMs);
      const activeMs = Math.max(0, totalMs - totalPauseMs);
      const totalMins = Math.floor(activeMs / 60_000);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      workedHoursFormatted = `${h}h ${m.toString().padStart(2, "0")}m`;
    }

    const attendanceStatus: "IN" | "BREAK" | "OUT" | "NOT_CLOCKED" | "FERIE" | "MALATTIA" | "RIPOSO" = isFerie
      ? "FERIE"
      : isMalattia
        ? "MALATTIA"
        : isRiposo
          ? "RIPOSO"
          : attendance.status === "OUT" && !attendance.firstEntry
            ? "NOT_CLOCKED"
            : attendance.status;

    return [{
      id: person.id,
      name: person.name,
      role: person.mansione || "Staff",
      photoUrl: person.photo_url ? resolveDrivePhotoUrl(person.photo_url) : null,
      shiftTime: `${startTime} – ${endTime}`,
      clockIn,
      delayMinutes,
      attendanceStatus,
      pauseSummary,
      workedHoursFormatted,
    }];
  });
  const workspacePeople = responsabili.map((person) => {
    const schedule = person.schedule_entries[0];
    const shiftStart = schedule?.start_time || schedule?.category.start_time;
    const shiftEnd = schedule?.end_time || schedule?.category.end_time;
    const attendance = deriveAttendanceState(person.attendance_logs);
    const attendanceStatus = attendance.status === "IN" ? "In turno" : attendance.status === "BREAK" ? "In pausa" : attendance.firstEntry ? "Turno terminato" : "Non timbrato";
    return {
      id: person.id,
      name: person.name,
      photoUrl: person.photo_url ? resolveDrivePhotoUrl(person.photo_url) : null,
      shiftTime: shiftStart && shiftEnd ? `${shiftStart} – ${shiftEnd}` : schedule?.category.name || "Turno non programmato",
      attendanceStatus,
      clockIn: attendance.firstEntry?.time ?? null,
    };
  });

  return (
    <AppShell title="Responsabile di turno" role={session.user.role} edgeToEdgeMain>
      <div className="shift-responsible-page min-h-screen bg-white px-3 pb-32 pt-5 sm:px-6 sm:pb-24 sm:pt-8 xl:px-10 xl:pb-16 xl:pt-24">
        <ShiftResponsibleWorkspace
          day={day}
          currentUserId={session.user.id}
          currentUserName={session.user.name || "Utente"}
          selectedResponsibleId={selectedResponsibleId}
          people={workspacePeople}
          questions={questions}
          shiftStaff={shiftStaff}
          appointmentClients={appointmentClients}
          taskAssignees={taskAssigneeRows.map((person) => ({
            id: person.id,
            name: person.name,
            group: person.mansione?.toLocaleLowerCase("it").includes("ufficio") || person.location?.name.toLocaleLowerCase("it").includes("ufficio") ? "Ufficio" : "Responsabile",
          }))}
          initialAnswers={answers[day] ?? {}}
          initialAccess={dayAccess}
          initialCanEdit={hasShiftWriteAccess(dayAccess, session.user.id, selectedResponsibleId)}
        />
      </div>
    </AppShell>
  );
}
