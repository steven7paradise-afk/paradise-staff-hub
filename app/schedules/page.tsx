import { AppShell } from "@/components/app-shell";
import { MonthlySchedulePlanner } from "@/components/monthly-schedule-planner";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SchedulesPage() {
  const session = await auth();
  const [employees, locations, categories, entries] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.scheduleCategory.findMany({
      where: { active: true },
      orderBy: { created_at: "asc" },
    }),
    prisma.scheduleEntry.findMany({
      where: {
        date: {
          gte: new Date("2026-01-01T00:00:00.000Z"),
          lt: new Date("2027-01-01T00:00:00.000Z"),
        },
      },
    }),
  ]);

  return (
    <AppShell
      title="Planning mensile"
      subtitle="Organizza i turni come un foglio mensile: dipendenti sulle righe, giorni sulle colonne, categorie colorate e stampa PDF."
    >
      <MonthlySchedulePlanner
        employees={employees.map((employee) => ({
          id: employee.id,
          name: employee.name,
          active: employee.active,
          role: employee.role,
          locationId: employee.sede_id,
        }))}
        locations={locations.map((location) => ({
          id: location.id,
          name: location.name,
          active: location.active,
        }))}
        savedCategories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          code: category.code,
          color: category.color,
          textColor: category.text_color,
          startTime: category.start_time ?? undefined,
          endTime: category.end_time ?? undefined,
          locationId: category.location_id,
        }))}
        entries={entries.map((entry) => ({
          userId: entry.user_id,
          categoryId: entry.category_id,
          date: entry.date.toISOString(),
        }))}
        canManageCategories={session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN"}
      />
    </AppShell>
  );
}
