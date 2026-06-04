import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StaffFormsViewer } from "@/components/staff-forms-viewer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { requireServicePageAccess } from "@/lib/service-page-access";

export const dynamic = "force-dynamic";

export default async function ServiceFormsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role as Role;
  await requireServicePageAccess(role, session.user.sedeId, 3);

  const locationId = session.user.sedeId;

  // Retrieve active templates
  const allActiveForms = await prisma.serviceForm.findMany({
    where: { active: true },
    orderBy: { created_at: "desc" },
  });

  // Filter forms matching the user's role and location
  const allowedForms = allActiveForms.filter((form) => {
    const allowedRoles = form.allowed_roles as string[] | null;
    const allowedLocations = form.allowed_location_ids as string[] | null;

    const roleMatch = !allowedRoles || allowedRoles.length === 0 || allowedRoles.includes(role);
    const locationMatch = !allowedLocations || allowedLocations.length === 0 || (locationId && allowedLocations.includes(locationId));

    return roleMatch && locationMatch;
  });

  const serializedForms = allowedForms.map((f) => ({
    ...f,
    created_at: f.created_at.toISOString(),
    updated_at: f.updated_at.toISOString(),
  })) as any;

  // Retrieve active employees
  const activeEmployees = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const serializedEmployees = activeEmployees.map((emp) => ({
    id: emp.id,
    name: emp.name,
  }));

  return (
    <AppShell title="Forms" role={role} hideHeader>
      <StaffFormsViewer forms={serializedForms} employees={serializedEmployees} />
    </AppShell>
  );
}
