import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminFormsManager } from "@/components/admin-forms-manager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function SettingsFormsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams;
  const initialTab = (searchParams.tab === "responses" || searchParams.tab === "upcoming") 
    ? searchParams.tab 
    : "templates";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role as Role;
  
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "RESPONSABILE") {
    redirect("/dashboard");
  }

  // Fetch all templates, locations, responses, and active users
  const [forms, locations, responses, users] = await Promise.all([
    prisma.serviceForm.findMany({
      orderBy: { created_at: "desc" },
    }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.serviceFormResponse.findMany({
      where: role === "RESPONSABILE" ? { user: { sede_id: session.user.sedeId ?? undefined } } : {},
      orderBy: { created_at: "desc" },
      include: {
        user: true,
        form: true,
      },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true, mansione: true },
      orderBy: { name: "asc" },
    }),
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

  return (
    <AppShell 
      title="Gestione Moduli" 
      subtitle="Crea, modifica e attiva moduli operativi per il personale e visualizza le risposte ricevute."
      role={role}
      hidePageHeaderOnMobile
    >
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
