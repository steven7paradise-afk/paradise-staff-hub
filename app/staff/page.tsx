import { AppShell } from "@/components/app-shell";
import { StaffDirectory } from "@/components/staff-directory";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const currentYear = new Date().getFullYear();
  const sicknessStart = new Date(currentYear, 0, 1);
  const sicknessEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
  const calculateSicknessDays = (start: Date, end: Date) => {
    return Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const [session, staff, locations, managers] = await Promise.all([
    auth(),
    prisma.user.findMany({
      where: {
        role: { not: "SUPER_ADMIN" },
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
        }
      },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        role: { in: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"] },
        active: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

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
            accessList: Array.isArray(user.access_list) ? user.access_list : [],
            iban: user.iban ?? "",
            contractHistory: user.contract_history,
            sicknessStats,
            lastEditedByName: user.last_edited_by?.name ?? null,
            lastEditedAt: user.last_edited_at?.toISOString() ?? null,
          };
        })}
        locations={locations.map((loc) => ({ id: loc.id, name: loc.name }))}
        managers={managers.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
        userRole={session?.user?.role ?? "DIPENDENTE"}
      />
    </AppShell>
  );
}
