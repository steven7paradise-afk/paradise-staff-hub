import { AppShell } from "@/components/app-shell";
import { StaffDirectory } from "@/components/staff-directory";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { normalizeAccessRoutes } from "@/lib/roles";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { compareScheduledClock } from "@/lib/scheduled-attendance";
import { ensureAutomaticLateRequests } from "@/lib/automatic-late-requests";

export const dynamic = "force-dynamic";

function romeCalendarDate() {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  return new Date(`${day}T00:00:00.000Z`);
}

function romeClock(date: Date | null | undefined) {
  if (!date) return null;
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams?: Promise<{ employee?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const currentYear = new Date().getFullYear();
  const sicknessStart = new Date(currentYear, 0, 1);
  const sicknessEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
  const today = romeCalendarDate();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const calculateSicknessDays = (start: Date, end: Date) => {
    return Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const [session, staff, locations, managers, todaySchedules, todayAttendanceLogs, approvedLeavesToday] = await Promise.all([
    auth(),
    prisma.user.findMany({
      where: {
        role: { notIn: ["ZERO", "SUPER_ADMIN"] },
      },
      include: {
        location: true,
        manager: true,
        leave_requests: {
          where: {
            type: "MALATTIA",
            start_date: { lte: sicknessEnd },
            end_date: { gte: sicknessStart },
          },
          select: {
            start_date: true,
            end_date: true,
            medical_code: true,
          },
        },
        last_edited_by: {
          select: { name: true }
        },
        documents: {
          orderBy: [{ document_date: "desc" }, { created_at: "desc" }],
          select: {
            id: true,
            title: true,
            type: true,
            file_url: true,
            storage_path: true,
            document_date: true,
            created_at: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"] },
        active: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.scheduleEntry.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      include: { category: true },
    }),
    prisma.attendanceLog.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      orderBy: { timestamp: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        type: { in: ["FERIE", "MALATTIA", "RIPOSO", "PERMESSO"] },
        start_date: { lt: tomorrow },
        end_date: { gte: today },
      },
      select: { user_id: true },
    }),
  ]);

  if (session?.user?.role && ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    await ensureAutomaticLateRequests(today).catch((error) => console.error("Automatic late requests unavailable:", error));
  }

  const scheduleByUser = new Map(todaySchedules.map((entry) => [entry.user_id, entry]));
  const attendanceByUser = new Map<string, typeof todayAttendanceLogs>();
  for (const log of todayAttendanceLogs) {
    const rows = attendanceByUser.get(log.user_id) || [];
    rows.push(log);
    attendanceByUser.set(log.user_id, rows);
  }
  const approvedLeaveUserIds = new Set(approvedLeavesToday.map((request) => request.user_id));

  return (
    <AppShell
      title="Staff Paradise"
      subtitle="Elenco anagrafiche dipendenti, ruoli, accessi attivi e note amministrative."
      transparentMain
    >
      <StaffDirectory
        initialStaff={staff.map((user) => {
          const sicknessStats = user.leave_requests.reduce(
            (acc, request) => {
              const days = calculateSicknessDays(request.start_date, request.end_date);
              acc.totalDays += days;
              if (request.medical_code) {
                acc.justifiedDays += days;
              } else {
                acc.unjustifiedDays += days;
              }
              return acc;
            },
            { totalDays: 0, justifiedDays: 0, unjustifiedDays: 0 }
          );

          const workforceData = user.workforce_data && typeof user.workforce_data === "object" && !Array.isArray(user.workforce_data)
            ? user.workforce_data as Record<string, unknown>
            : {};
          const schedule = scheduleByUser.get(user.id);
          const attendanceState = deriveAttendanceState(attendanceByUser.get(user.id) || []);
          const plannedStart = schedule?.start_time || schedule?.category.start_time || null;
          const plannedEnd = schedule?.end_time || schedule?.category.end_time || null;
          const comparison = compareScheduledClock({
            plannedStart,
            plannedEnd,
            locationName: user.location?.name,
            categoryName: schedule?.category.name,
            categoryCode: schedule?.category.code,
            hasClockEntry: Boolean(attendanceState.firstEntry),
            hasApprovedLeave: approvedLeaveUserIds.has(user.id),
          });
          const attendanceStatus = !schedule
            ? "NESSUN_TURNO"
            : comparison.rest
              ? "RIPOSO"
              : comparison.closed
                ? "GIUSTIFICATO"
              : approvedLeaveUserIds.has(user.id)
                ? "GIUSTIFICATO"
                : attendanceState.status === "IN"
                  ? "PRESENTE"
                  : attendanceState.status === "BREAK"
                    ? "IN_PAUSA"
                    : attendanceState.firstEntry
                      ? "USCITO"
                      : comparison.absent
                        ? "ASSENTE"
                        : "ATTESO";

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            sedeId: user.sede_id,
            location: user.location?.name ?? "Nessuna sede",
            active: user.active,
            hasPin: Boolean(user.pin_hash),
            birthDate: user.birth_date?.toISOString().slice(0, 10) ?? "",
            fiscalCode: user.fiscal_code ?? "",
            contractStart: user.contract_start?.toISOString().slice(0, 10) ?? "",
            contractEnd: user.contract_end?.toISOString().slice(0, 10) ?? "",
            photoUrl: user.photo_url ?? "",
            whatsappPhone: user.whatsapp_phone ?? "",
            mansione: user.mansione ?? "",
            employeeStatus: user.employee_status,
            managerId: user.manager_id,
            managerName: user.manager?.name ?? "",
            hrNotes: user.hr_notes ?? "",
            accessList: Array.isArray(user.access_list)
              ? normalizeAccessRoutes(user.access_list)
              : user.access_list && typeof user.access_list === "object" && !Array.isArray(user.access_list)
                ? normalizeAccessRoutes((user.access_list as { view?: unknown }).view)
                : [],
            iban: user.iban ?? "",
            contractType: typeof workforceData.contractType === "string" ? workforceData.contractType : "",
            contractRenewalStatus: typeof workforceData.contractRenewalStatus === "string" ? workforceData.contractRenewalStatus : "DA_VALUTARE",
            contractHistory: Array.isArray(user.contract_history) ? user.contract_history as any[] : [],
            documents: user.documents.map((document) => ({
              id: document.id,
              title: document.title,
              type: document.type,
              fileUrl: document.file_url,
              storagePath: document.storage_path,
              documentDate: document.document_date?.toISOString().slice(0, 10) ?? "",
              createdAt: document.created_at.toISOString(),
            })),
            sicknessStats,
            lastEditedByName: user.last_edited_by?.name ?? null,
            lastEditedAt: user.last_edited_at?.toISOString() ?? null,
            attendanceToday: {
              status: attendanceStatus,
              absent: comparison.absent,
              plannedStart,
              plannedEnd,
              firstEntry: romeClock(attendanceState.firstEntry?.timestamp ? new Date(attendanceState.firstEntry.timestamp) : null),
              elapsedMinutes: comparison.elapsedMinutes,
            },
          };
        })}
        locations={locations.map((loc) => ({ id: loc.id, name: loc.name }))}
        managers={managers.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
        userRole={session?.user?.role ?? "DIPENDENTE"}
        focusEmployeeId={params.employee ?? null}
      />
    </AppShell>
  );
}
