import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ClientControlDashboard } from "@/app/client-control/client-control-dashboard";
import { auth } from "@/lib/auth";
import { ensureClientControlForm, isClientControlFormName, CLIENT_CONTROL_FIELD_IDS } from "@/lib/client-control-form";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

const allowedRoles = new Set<Role>(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export default async function ClientControlPage({ searchParams }: { searchParams: Promise<{ date?: string; hour?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true }
  });

  const role = session.user.role as Role;
  const canAccessPage = accessUser
    ? await canAccessForUser(prisma, "/client-control", accessUser)
    : allowedRoles.has(role);

  if (!canAccessPage) {
    redirect("/dashboard");
  }

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
          ...(role === "RESPONSABILE" && !canAccessPage && session.user.sedeId ? { user_location_id: session.user.sedeId } : {}),
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
      role: { notIn: ["ZERO", "SUPER_ADMIN"] },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

  const filteredResponses = responses.filter((response) => {
    const answers = response.answers as Record<string, unknown> | null;
    if (!answers) return true;
    const correctness = String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] || answers.client_control_correctness || "").trim().toLowerCase();
    return correctness !== "finito";
  });

  const serializedResponses = filteredResponses.map((response) => ({
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
        dashboardDateFilter={params.date === "today" ? "today" : null}
        dashboardHourFilter={/^([01]\d|2[0-3])$/.test(params.hour || "") ? params.hour! : null}
      />
    </AppShell>
  );
}
