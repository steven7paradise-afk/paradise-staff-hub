import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FormBuilder } from "@/components/form-builder";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function SettingsFormEditPage(props: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const params = await props.params;
  const id = params.id;
  const searchParams = await props.searchParams;
  const template = searchParams.template || "";

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true }
  });

  const role = session.user.role as Role;
  const canAccessPage = accessUser
    ? await canAccessForUser(prisma, "/settings/forms", accessUser)
    : (role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN" || role === "RESPONSABILE");

  if (!canAccessPage) {
    redirect("/dashboard");
  }

  // Fetch form template if editing an existing one
  let initialForm = null;
  if (id !== "new") {
    try {
      const form = await prisma.serviceForm.findUnique({
        where: { id },
      });
      if (form) {
        initialForm = {
          ...form,
          created_at: form.created_at.toISOString(),
          updated_at: form.updated_at.toISOString(),
        };
      } else {
        redirect("/settings/forms?tab=templates");
      }
    } catch (error) {
      console.error("Error fetching service form for edit:", error);
      redirect("/settings/forms?tab=templates");
    }
  }

  // Fetch locations and users for configuration
  const [locations, users] = await Promise.all([
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }).catch(() => []),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true, mansione: true },
      orderBy: { name: "asc" },
    }).catch(() => []),
  ]);

  const serializedLocations = locations.map((l) => ({
    id: l.id,
    name: l.name,
  }));

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    mansione: u.mansione,
  }));

  return (
    <AppShell 
      title={id === "new" ? "Nuovo Modulo" : `Modifica Modulo`} 
      subtitle="Definisci le domande, configura il flusso condizionale e decidi notifiche e autorizzazioni."
      role={role}
      hidePageHeaderOnMobile
    >
      <FormBuilder
        initialForm={initialForm}
        locations={serializedLocations}
        users={serializedUsers}
        template={template}
      />
    </AppShell>
  );
}
