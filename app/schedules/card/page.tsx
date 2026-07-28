import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ScheduleCardViewer } from "@/components/schedule-card-viewer";
import { coerceEmployeeScheduleMonth } from "@/lib/schedule-visibility";
import { normalizePlanningAccess, PLANNING_ACCESS_KEY } from "@/lib/planning-access";

export const dynamic = "force-dynamic";

export default async function ScheduleCardPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; month?: string; year?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const values = await searchParams;
  const currentUserId = session.user.id;
  const currentUserRole = session.user.role;
  const currentUserSedeId = session.user.sedeId;

  // Security: DIPENDENTE can only view their own shifts card
  let targetUserId = values.userId || currentUserId;
  if (currentUserRole === "DIPENDENTE") {
    targetUserId = currentUserId;
  }

  // Fetch target user and their location details
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { location: true },
  });

  if (!targetUser) {
    redirect("/dashboard");
  }

  // Security: RESPONSABILE can only view employees in their own location
  if (currentUserRole === "RESPONSABILE" && targetUser.sede_id !== currentUserSedeId) {
    redirect("/dashboard");
  }

  // Parse requested month and year (e.g. month: 1 to 12)
  const today = new Date();
  const requestedMonth = Number(values.month);
  const requestedYear = Number(values.year);
  const parsedMonth = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth - 1 : today.getMonth();
  const parsedYear = Number.isInteger(requestedYear) && requestedYear >= 2020 && requestedYear <= 2100 ? requestedYear : today.getFullYear();
  const planningAccessSetting = currentUserRole === "DIPENDENTE" ? await prisma.setting.findUnique({ where: { key: PLANNING_ACCESS_KEY } }) : null;
  const planningAccess = normalizePlanningAccess(planningAccessSetting?.value);
  const selectedMonth = currentUserRole === "DIPENDENTE" ? coerceEmployeeScheduleMonth(parsedMonth, parsedYear, today, planningAccess.nextMonthVisible) : { month: parsedMonth, year: parsedYear };
  const month = selectedMonth.month;
  const year = selectedMonth.year;

  // Load shifts (ScheduleEntry) for the target month
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));

  const [schedules, branding, dbLocations] = await Promise.all([
    prisma.scheduleEntry.findMany({
      where: { user_id: targetUserId, date: { gte: start, lt: end } },
      include: { category: true },
      orderBy: { date: "asc" },
    }),
    prisma.brandingSetting.findFirst(),
    currentUserRole !== "DIPENDENTE"
      ? prisma.location.findMany({
          where: {
            active: true,
            ...(currentUserRole === "RESPONSABILE" ? { id: currentUserSedeId || "" } : {}),
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // Load all active employees if target viewer is admin/super_admin/responsabile to populate switcher
  let allEmployees: Array<{ id: string; name: string; role: string; sede_id: string | null; whatsapp_phone: string | null }> = [];
  if (currentUserRole !== "DIPENDENTE") {
    allEmployees = await prisma.user.findMany({
      where: {
        active: true,
        role: { not: "SUPER_ADMIN" },
        NOT: {
          OR: [
            {
              mansione: {
                in: ["exdipendenti", "ex dipendente", "ex dipendenti", "ex-dipendente", "ex-dipendenti"],
                mode: "insensitive"
              }
            },
            {
              employee_status: {
                in: ["ex dipendente", "exdipendenti", "ex dipendenti", "ex-dipendente", "ex-dipendenti"],
                mode: "insensitive"
              }
            }
          ]
        },
        ...(currentUserRole === "RESPONSABILE" ? { sede_id: currentUserSedeId } : {}),
      },
      select: {
        id: true,
        name: true,
        role: true,
        sede_id: true,
        whatsapp_phone: true,
      },
      orderBy: { name: "asc" },
    });
  }

  // Map categories used this month for the legend
  const uniqueCategoriesMap = new Map();
  schedules.forEach((s) => {
    if (s.category && s.category.active) {
      uniqueCategoriesMap.set(s.category.id, {
        id: s.category.id,
        name: s.category.name,
        code: s.category.code,
        color: s.category.color,
        textColor: s.category.text_color,
        startTime: s.category.start_time,
        endTime: s.category.end_time,
      });
    }
  });
  const uniqueCategories = Array.from(uniqueCategoriesMap.values());

  // Calculate calendar days & offset (Monday-start)
  const startDayOfWeek = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1
  const dayOffset = (startDayOfWeek + 6) % 7; // Monday=0, ..., Sunday=6
  const totalDays = new Date(year, month + 1, 0).getDate();

  const cells = [];
  // Offset empty boxes
  for (let i = 0; i < dayOffset; i++) {
    cells.push({});
  }
  // Days of the month
  for (let d = 1; d <= totalDays; d++) {
    const dayEntry = schedules.find((s) => {
      const entryDate = new Date(s.date);
      return entryDate.getUTCDate() === d;
    });

    cells.push({
      day: d,
      entry: dayEntry
        ? {
            id: dayEntry.id,
            date: dayEntry.date.toISOString(),
            startTime: dayEntry.start_time,
            endTime: dayEntry.end_time,
            category: {
              id: dayEntry.category.id,
              name: dayEntry.category.name,
              code: dayEntry.category.code,
              color: dayEntry.category.color,
              textColor: dayEntry.category.text_color,
            },
          }
        : undefined,
    });
  }

  return (
    <main className="min-h-screen bg-[#FAF8F6] py-10 px-4">
      <ScheduleCardViewer
        user={{
          id: targetUser.id,
          name: targetUser.name,
          role: targetUser.role,
          sede_id: targetUser.sede_id,
          whatsapp_phone: targetUser.whatsapp_phone,
          location: targetUser.location ? { name: targetUser.location.name } : null,
        }}
        month={month}
        year={year}
        cells={cells}
        uniqueCategories={uniqueCategories}
        brandingLogoUrl={branding?.logo_url ?? null}
        allEmployees={allEmployees}
        allLocations={dbLocations.map((loc) => ({ id: loc.id, name: loc.name, active: loc.active }))}
        currentUserRole={currentUserRole}
      />
    </main>
  );
}
