import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { StaffFormsViewer } from "@/components/staff-forms-viewer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { requireServicePageAccess } from "@/lib/service-page-access";
import { ensureOrderForm } from "@/lib/order-form";
import { ensureCashClosingForm, isCashClosingFormName } from "@/lib/cash-closing-form";
import { ensureClientControlForm } from "@/lib/client-control-form";
import { ensureItalianInvoiceForm } from "@/lib/italian-invoice-form";
import { authorizedTablet, requestIp, tabletCookieName, tabletDeviceCookieName } from "@/lib/tablet-auth";
import {
  normalizeServiceFormsVisibility,
  SERVICE_FORMS_VISIBILITY_KEY,
} from "@/lib/service-form-visibility";

export const dynamic = "force-dynamic";

export default async function ServiceFormsPage(props: { searchParams: Promise<{ fillId?: string; fill?: string }> }) {
  const searchParams = await props.searchParams;
  const fillId = searchParams.fillId;
  const fill = searchParams.fill;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role as Role;
  await requireServicePageAccess(role, session.user.sedeId, 3, session.user.id);
  await Promise.all([
    ensureOrderForm(session.user.id),
    ensureCashClosingForm(session.user.id),
    ensureClientControlForm(session.user.id),
    ensureItalianInvoiceForm(session.user.id),
  ]);

  const locationId = session.user.sedeId;

  const cookieStore = await cookies();
  const headerStore = await headers();
  const requestedDevice = cookieStore.get(tabletDeviceCookieName)?.value ?? "";
  const tabletDevice = requestedDevice
    ? await authorizedTablet(requestedDevice, cookieStore.get(tabletCookieName)?.value, requestIp(headerStore))
    : null;
  const isVerifiedTabletDevice = Boolean(tabletDevice);
  const isManagementRole = role === "SUPER_ADMIN" || role === "ADMIN" || role === "RESPONSABILE";

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());

  // Retrieve active templates, visibility rules and today's latest clock state.
  const [allActiveForms, visibilitySetting, latestAttendance] = await Promise.all([
    prisma.serviceForm.findMany({
      where: { active: true },
      orderBy: { created_at: "desc" },
    }),
    prisma.setting.findUnique({ where: { key: SERVICE_FORMS_VISIBILITY_KEY } }).catch(() => null),
    prisma.attendanceLog.findFirst({
      where: {
        user_id: session.user.id,
        date: new Date(today),
      },
      orderBy: { timestamp: "desc" },
    }).catch(() => null),
  ]);

  const visibilityRules = normalizeServiceFormsVisibility(visibilitySetting?.value);
  const offShiftHiddenIds = new Set(visibilityRules.hideWhenOffShiftFormIds);
  const isCurrentUserInShift = latestAttendance ? latestAttendance.type !== "USCITA" : false;

  // Filter forms matching the user's role and location
  const allowedForms = allActiveForms.filter((form) => {
    const allowedRoles = form.allowed_roles as string[] | null;
    const allowedLocations = form.allowed_location_ids as string[] | null;
    const isCandidacy = form.name.toUpperCase().includes("CANDIDATURA");
    const isCashClosing = isCashClosingFormName(form.name, form.category);

    if (isCashClosing && !isManagementRole && !isVerifiedTabletDevice) {
      return false;
    }

    if (!isManagementRole && !isCurrentUserInShift && offShiftHiddenIds.has(form.id)) {
      return false;
    }

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
    where: {
      OR: [
        { user_id: session.user.id },
        ...(locationId ? [{ user_location_id: locationId }] : []),
        { status: { not: "ARCHIVED" } },
      ],
    },
    include: {
      user: { select: { id: true, name: true, role: true, photo_url: true, sede_id: true } },
      form: true,
    },
    orderBy: { created_at: "desc" },
    take: 300,
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

  // Retrieve active employees and their real-time presence for client-control forms.
  const [activeEmployees, todayAttendanceLogs] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, sede_id: true, location: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.attendanceLog.findMany({
      where: { date: new Date(today) },
      select: { user_id: true, type: true, timestamp: true, location: { select: { name: true } } },
      orderBy: { timestamp: "desc" },
    }),
  ]);

  const latestLogByUser = new Map<string, (typeof todayAttendanceLogs)[number]>();
  for (const log of todayAttendanceLogs) {
    if (!latestLogByUser.has(log.user_id)) latestLogByUser.set(log.user_id, log);
  }

  const serializedEmployees = activeEmployees.map((emp) => {
    const latestLog = latestLogByUser.get(emp.id);
    return {
      id: emp.id,
      name: emp.name,
      locationId: emp.sede_id,
      locationName: latestLog?.location?.name ?? emp.location?.name ?? null,
      isPresent: Boolean(latestLog && latestLog.type !== "USCITA"),
    };
  });

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
