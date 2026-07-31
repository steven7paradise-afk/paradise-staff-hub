import { AppShell } from "@/components/app-shell";
import { EmployeeManager } from "@/components/employee-manager";
import { prisma } from "@/lib/prisma";
import { normalizeAccessRoutes } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const [employees, locations] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "SUPER_ADMIN" } },
      include: { 
        location: true,
        last_edited_by: {
          select: { name: true }
        }
      },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppShell title="Dipendenti" subtitle="Gestione anagrafiche, assegnazione ai saloni, stato account e ruoli.">
      <EmployeeManager
        initialEmployees={employees.map((employee) => ({
          id: employee.id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          sedeId: employee.sede_id,
          location: employee.location?.name ?? "Nessuna sede",
          active: employee.active,
          hasPin: Boolean(employee.pin_hash),
          birthDate: employee.birth_date?.toISOString().slice(0, 10) ?? "",
          fiscalCode: employee.fiscal_code ?? "",
          contractStart: employee.contract_start?.toISOString().slice(0, 10) ?? "",
          contractEnd: employee.contract_end?.toISOString().slice(0, 10) ?? "",
          photoUrl: employee.photo_url ?? "",
          whatsappPhone: employee.whatsapp_phone ?? "",
          mansione: employee.mansione ?? "",
          googleCalendarId: employee.google_calendar_id ?? "",
          googleCalendarSync: employee.google_calendar_sync,
          iban: employee.iban ?? "",
          hrNotes: employee.hr_notes ?? "",
          managerId: employee.manager_id ?? "",
          accessList: Array.isArray(employee.access_list)
            ? normalizeAccessRoutes(employee.access_list)
            : employee.access_list && typeof employee.access_list === "object" && !Array.isArray(employee.access_list)
              ? normalizeAccessRoutes((employee.access_list as { view?: unknown }).view)
              : [],
          contractHistory: employee.contract_history,
          workforceData: employee.workforce_data && typeof employee.workforce_data === "object" && !Array.isArray(employee.workforce_data) ? employee.workforce_data : {},
          lastEditedByName: employee.last_edited_by?.name ?? null,
          lastEditedAt: employee.last_edited_at?.toISOString() ?? null,
        }))}
        locations={locations.map((location) => ({ id: location.id, name: location.name }))}
      />
    </AppShell>
  );
}
