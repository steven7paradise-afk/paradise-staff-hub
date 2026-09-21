import { NextRequest, NextResponse } from "next/server";
import { mobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import { normalizePlanningAccess, PLANNING_ACCESS_KEY } from "@/lib/planning-access";
import { employeeScheduleWindow } from "@/lib/schedule-visibility";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await mobileUser(request);
  if (!auth) return NextResponse.json({ error: "Sessione scaduta. Accedi di nuovo." }, { status: 401 });
  const { user } = auth;
  const now = new Date();
  const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
  const today = new Date(`${localDay}T00:00:00.000Z`);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const planningSetting = await prisma.setting.findUnique({ where: { key: PLANNING_ACCESS_KEY } }).catch(() => null);
  const planning = normalizePlanningAccess(planningSetting?.value);
  const window = employeeScheduleWindow(now, planning.nextMonthVisible);

  const [schedules, logs, notifications, documents, tasks, clockRuleSetting] = await Promise.all([
    prisma.scheduleEntry.findMany({
      where: { user_id: user.id, date: { gte: window.start, lt: window.end } },
      include: { category: true, location: true },
      orderBy: { date: "asc" },
    }),
    prisma.attendanceLog.findMany({
      where: { user_id: user.id, date: { gte: today, lt: tomorrow } },
      select: { id: true, type: true, timestamp: true, time: true },
      orderBy: { timestamp: "asc" },
    }),
    prisma.notification.findMany({
      where: { user_id: user.id },
      select: { id: true, title: true, message: true, type: true, read: true, created_at: true },
      orderBy: { created_at: "desc" },
      take: 50,
    }),
    prisma.document.findMany({
      where: { user_id: user.id },
      select: { id: true, title: true, type: true, month: true, year: true, document_date: true, created_at: true },
      orderBy: { created_at: "desc" },
    }),
    prisma.staffTask.findMany({
      where: { assignees: { some: { id: user.id } } },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        category: true,
        checklist: true,
        due_date: true,
        started_at: true,
        completed_at: true,
        created_at: true,
        updated_at: true,
        created_by: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: [{ due_date: "asc" }, { updated_at: "desc" }],
      take: 80,
    }),
    user.sede_id
      ? prisma.setting.findUnique({ where: { key: clockRuleKey(user.sede_id) } }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const breakDurationMinutes = parseClockRule(clockRuleSetting?.value).breakDurationMinutes;
  return NextResponse.json({
    requiresPasswordChange: user.must_change_password,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      jobTitle: user.mansione,
      locationName: user.location?.name ?? null,
      photoURL: user.photo_url,
    },
    breakDurationMinutes,
    shifts: schedules.map((entry) => ({
      id: entry.id,
      date: entry.date.toISOString().slice(0, 10),
      startTime: entry.start_time ?? entry.category.start_time,
      endTime: entry.end_time ?? entry.category.end_time,
      locationName: entry.location?.name ?? user.location?.name ?? "Paradise Beauty",
      role: user.mansione ?? entry.category.name,
      categoryName: entry.category.name,
      categoryCode: entry.category.code,
      note: entry.note,
    })),
    todayAttendance: logs.map((log) => ({
      id: log.id,
      type: log.type,
      timestamp: log.timestamp.toISOString(),
      time: log.time,
    })),
    communications: notifications.map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      type: item.type,
      createdAt: item.created_at.toISOString(),
      read: item.read,
    })),
    documents: documents.map((document) => ({
      id: document.id,
      title: document.title,
      type: document.type,
      month: document.month,
      year: document.year,
      documentDate: document.document_date?.toISOString() ?? null,
      createdAt: document.created_at.toISOString(),
      downloadPath: `/api/mobile/documents/${document.id}/download`,
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      category: task.category,
      checklist: task.checklist,
      dueDate: task.due_date?.toISOString() ?? null,
      startedAt: task.started_at?.toISOString() ?? null,
      completedAt: task.completed_at?.toISOString() ?? null,
      createdAt: task.created_at.toISOString(),
      updatedAt: task.updated_at.toISOString(),
      createdByName: task.created_by.name,
      locationName: task.location.name,
    })),
  });
}
