import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ClientControlDashboard } from "@/app/client-control/client-control-dashboard";
import { auth } from "@/lib/auth";
import { ensureClientControlForm, isClientControlFormName } from "@/lib/client-control-form";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

const allowedRoles = new Set<Role>(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export default async function ClientControlPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = session.user.role as Role;
  if (!allowedRoles.has(role)) redirect("/dashboard");

  await ensureClientControlForm(session.user.id);

  const forms = await prisma.serviceForm.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      category: true,
      fields: true,
    },
  });

  const clientControlFormIds = forms
    .filter((form) => isClientControlFormName(form.name, form.category))
    .map((form) => form.id);

  const responses = clientControlFormIds.length
    ? await prisma.serviceFormResponse.findMany({
        where: {
          form_id: { in: clientControlFormIds },
          ...(role === "RESPONSABILE" && session.user.sedeId ? { user_location_id: session.user.sedeId } : {}),
        },
        include: {
          user: { select: { id: true, name: true, role: true, photo_url: true } },
          form: { select: { id: true, name: true, fields: true } },
        },
        orderBy: { created_at: "desc" },
        take: 1000,
      })
    : [];

  const activeStaff = await prisma.user.findMany({
    where: {
      active: true,
      role: { not: "SUPER_ADMIN" },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

  const serializedResponses = responses.map((response) => ({
    id: response.id,
    created_at: response.created_at.toISOString(),
    updated_at: response.updated_at.toISOString(),
    status: response.status,
    answers: response.answers as Record<string, unknown>,
    user_location_name: response.user_location_name,
    user: response.user,
    form: {
      id: response.form.id,
      name: response.form.name,
      fields: response.form.fields as any[],
    },
  }));

  return (
    <AppShell
      title="Controllo Cliente"
      subtitle="Analytics e cronologia completa dei moduli cliente."
      role={role}
      hideHeader
    >
      <ClientControlDashboard
        initialResponses={serializedResponses as any}
        canDelete={allowedRoles.has(role)}
        employeeNames={activeStaff.map((employee) => employee.name).filter((name): name is string => Boolean(name?.trim()))}
      />
    </AppShell>
  );
}
