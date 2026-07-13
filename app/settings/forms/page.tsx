import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminFormsManager } from "@/components/admin-forms-manager";
import { ServiceFormsVisibilitySettings } from "@/components/service-forms-visibility-settings";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";
import { ensureCashClosingForm } from "@/lib/cash-closing-form";
import { ensureOrderForm } from "@/lib/order-form";
import {
  normalizeServiceFormsVisibility,
  SERVICE_FORMS_VISIBILITY_KEY,
} from "@/lib/service-form-visibility";

export const dynamic = "force-dynamic";

export default async function SettingsFormsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams;
  const initialTab = (searchParams.tab === "responses" || searchParams.tab === "upcoming") 
    ? searchParams.tab 
    : "templates";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true }
  });

  const role = session.user.role as Role;
  const canAccessPage = accessUser
    ? await canAccessForUser(prisma, "/settings/forms", accessUser)
    : (role === "SUPER_ADMIN" || role === "ADMIN" || role === "RESPONSABILE");

  if (!canAccessPage) {
    redirect("/dashboard");
  }

  await Promise.all([
    ensureOrderForm(session.user.id),
    ensureCashClosingForm(session.user.id),
  ]);

  // Fetch all templates, locations, responses, and active users
  const [forms, locations, responses, users, visibilitySetting] = await Promise.all([
    prisma.serviceForm.findMany({
      orderBy: { created_at: "desc" },
    }).catch((error) => {
      console.error("Forms list unavailable:", error);
      return [];
    }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }).catch((error) => {
      console.error("Locations list unavailable:", error);
      return [];
    }),
    prisma.serviceFormResponse.findMany({
      where: role === "RESPONSABILE" ? { user: { sede_id: session.user.sedeId ?? undefined } } : {},
      orderBy: { created_at: "desc" },
      include: {
        user: true,
        form: true,
      },
    }).catch((error) => {
      console.error("Form responses unavailable:", error);
      return [];
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true, mansione: true },
      orderBy: { name: "asc" },
    }).catch((error) => {
      console.error("Users list unavailable:", error);
      return [];
    }),
    prisma.setting.findUnique({ where: { key: SERVICE_FORMS_VISIBILITY_KEY } }).catch(() => null),
  ]);

  // Clean data types for serialization
  const serializedForms = forms.map((f) => ({
    ...f,
    created_at: f.created_at.toISOString(),
    updated_at: f.updated_at.toISOString(),
  }));

  const serializedLocations = locations.map((l) => ({
    id: l.id,
    name: l.name,
  }));

  const serializedResponses = responses.map((r) => ({
    ...r,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  }));

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    mansione: u.mansione,
  }));

  const visibilityForms = forms.map((form) => ({
    id: form.id,
    name: form.name,
    category: form.category,
    active: form.active,
  }));

  return (
    <AppShell 
      title="Gestione Moduli" 
      subtitle="Crea, modifica e attiva moduli operativi per il personale e visualizza le risposte ricevute."
      role={role}
      hidePageHeaderOnMobile
    >
      <ServiceFormsVisibilitySettings
        forms={visibilityForms}
        initialVisibility={normalizeServiceFormsVisibility(visibilitySetting?.value)}
      />
      <AdminFormsManager
        role={role}
        initialForms={serializedForms}
        locations={serializedLocations}
        initialResponses={serializedResponses}
        users={serializedUsers}
        initialTab={initialTab}
        currentUserName={session?.user?.name || "Direzione"}
      />
    </AppShell>
  );
}
