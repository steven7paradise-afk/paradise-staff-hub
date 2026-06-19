import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StaffFormsViewer } from "@/components/staff-forms-viewer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { requireServicePageAccess } from "@/lib/service-page-access";
import { ensureOrderForm } from "@/lib/order-form";

export const dynamic = "force-dynamic";

export default async function ServiceFormsPage(props: { searchParams: Promise<{ fillId?: string; fill?: string }> }) {
  const searchParams = await props.searchParams;
  const fillId = searchParams.fillId;
  const fill = searchParams.fill;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role as Role;
  await requireServicePageAccess(role, session.user.sedeId, 3, session.user.id);
  await ensureOrderForm(session.user.id);

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
    const isCandidacy = form.name.toUpperCase().includes("CANDIDATURA");

    const roleMatch = !allowedRoles || allowedRoles.length === 0 || allowedRoles.includes(role);
    const locationMatch = 
      role === "SUPER_ADMIN" || 
      role === "ADMIN" ||
      isCandidacy ||
      !allowedLocations || 
      allowedLocations.length === 0 || 
      (locationId && allowedLocations.includes(locationId));

    return roleMatch && locationMatch;
  });

  // Fetch all responses that this employee can see (their own, their salon's, or those they are notified about, including archived ones where nominated)
  const responses = await prisma.serviceFormResponse.findMany({
    include: {
      user: true,
      form: true,
    },
    orderBy: { created_at: "desc" },
  });

  const allowedResponses = responses.filter((r) => {
    const notifyUserIds = r.form?.notify_user_ids as string[] | null;
    const notifyRoles = r.form?.notify_roles as string[] | null;

    const isUserNotified = notifyUserIds && Array.isArray(notifyUserIds) && notifyUserIds.includes(session.user.id);
    const isRoleNotified = notifyRoles && Array.isArray(notifyRoles) && notifyRoles.includes(role);
    const isNominated = isUserNotified || isRoleNotified;

    if (r.status === "ARCHIVED") {
      // For archived ones: only see own submission or where explicitly nominated
      return r.user_id === session.user.id || isNominated;
    }

    // For active ones:
    // 1. Own submission
    if (r.user_id === session.user.id) return true;
    
    // 2. Same salon
    if (locationId && r.user_location_id === locationId) return true;
    
    // 3. Nominated
    if (isNominated) return true;

    return false;
  });

  const serializedForms = allowedForms.map((f) => ({
    ...f,
    created_at: f.created_at.toISOString(),
    updated_at: f.updated_at.toISOString(),
  })) as any;

  const serializedResponses = allowedResponses.map((r) => ({
    ...r,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  }));

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
      <StaffFormsViewer 
        forms={serializedForms} 
        employees={serializedEmployees} 
        initialResponses={serializedResponses}
        currentUserId={session.user.id}
        currentUserName={session.user.name || "Dipendente"}
        currentUserRole={role}
        autoFillFormId={fillId}
        autoFillFormName={fill}
      />
    </AppShell>
  );
}
