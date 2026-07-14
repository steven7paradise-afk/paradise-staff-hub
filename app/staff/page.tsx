import { AppShell } from "@/components/app-shell";
import { StaffDirectory } from "@/components/staff-directory";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const [session, staff, locations, managers] = await Promise.all([
    auth(),
    prisma.user.findMany({
      where: {
        role: { not: "SUPER_ADMIN" },
      },
      include: {
        location: true,
        manager: true,
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
    <AppShell title="Staff Paradise" subtitle="Elenco anagrafiche dipendenti, ruoli, accessi attivi e note amministrative.">
      <StaffDirectory
        initialStaff={staff.map((user) => ({
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
          accessList: (user.access_list as string[]) ?? [],
          iban: user.iban ?? "",
        }))}
        locations={locations.map((loc) => ({ id: loc.id, name: loc.name }))}
        managers={managers.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
        userRole={session?.user?.role ?? "DIPENDENTE"}
      />
    </AppShell>
  );
}
