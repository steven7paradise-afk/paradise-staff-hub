import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { StaffFormsViewer } from "@/components/staff-forms-viewer";
import { auth } from "@/lib/auth";
import { requiresBuenosAiresPcCassa } from "@/lib/pc-cassa-access";
import { canAccessSalonShiftModules } from "@/lib/salon-shift-access";
import { prisma } from "@/lib/prisma";
import { checkPCAuthorization, appointmentsPcCookieName, appointmentsPcWorkerCookieName } from "@/lib/appointments-pc-auth";
import type { Role } from "@/lib/roles";
import { requireServicePageAccess } from "@/lib/service-page-access";
import { ensureOrderForm } from "@/lib/order-form";
import { ensureCashClosingForm } from "@/lib/cash-closing-form";
import { ensureClientControlForm } from "@/lib/client-control-form";
import { ensureItalianInvoiceForm } from "@/lib/italian-invoice-form";
import { ensureRefundForm } from "@/lib/refund-form";
import {
  normalizeServiceFormsVisibility,
  SERVICE_FORMS_VISIBILITY_KEY,
} from "@/lib/service-form-visibility";

export const dynamic = "force-dynamic";

function isInternalFotoOrderForm(form?: { name?: string | null; category?: string | null } | null) {
  const name = (form?.name ?? "").toUpperCase().trim();
  const category = (form?.category ?? "").toUpperCase().trim();
  return name === "FOTO ORDINI" || (category === "FOTO" && name.includes("FOTO"));
}

export default async function ServiceFormsPage(props: { searchParams: Promise<{ fillId?: string; fill?: string }> }) {
  const searchParams = await props.searchParams;
  const fillId = searchParams.fillId;
  const fill = searchParams.fill;
  const session = await auth();
  let sessionUser = session?.user;
  let isPC = false;
  let pcLocationId = "";
  let pcDisplayUser: { name: string; photo_url?: string | null } | null = null;
  const cookieStore = await cookies();

  const pcToken = cookieStore.get(appointmentsPcCookieName)?.value;
  const pcAuth = await checkPCAuthorization(pcToken);
  if (pcAuth) {
      isPC = true;
      pcLocationId = pcAuth.locationId;
      sessionUser = {
        id: "PC_CASSA",
        name: pcAuth.name,
        email: "cassa@paradise.tech",
        role: "RESPONSABILE",
        sedeId: pcAuth.locationId,
      } as any;
      const selectedWorkerIdentity = cookieStore.get(appointmentsPcWorkerCookieName)?.value
        ? decodeURIComponent(cookieStore.get(appointmentsPcWorkerCookieName)?.value || "")
        : "";
      if (selectedWorkerIdentity) {
        const selectedWorker = await prisma.user.findFirst({
          where: {
            active: true,
            sede_id: pcAuth.locationId,
            OR: [{ id: selectedWorkerIdentity }, { name: selectedWorkerIdentity }],
          },
          select: { id: true, name: true, email: true, role: true, sede_id: true, photo_url: true },
        }).catch(() => null);
        if (selectedWorker) {
          sessionUser = {
            id: selectedWorker.id,
            name: selectedWorker.name,
            email: selectedWorker.email,
            role: selectedWorker.role,
            sedeId: selectedWorker.sede_id,
          } as any;
          pcDisplayUser = { name: selectedWorker.name, photo_url: selectedWorker.photo_url };
        }
      }
  }

  if (!sessionUser) redirect("/login");
  if (!isPC && sessionUser.id) {
    const accessUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, role: true, location: { select: { name: true } } },
    });
    if (accessUser && !(await canAccessSalonShiftModules(accessUser))) {
      redirect("/dashboard?accesso=fuori-turno");
    }
    if (
      accessUser?.role !== "DIPENDENTE" &&
      accessUser &&
      requiresBuenosAiresPcCassa(accessUser.role, accessUser.location?.name)
    ) {
      redirect("/pc-non-autorizzato");
    }
  }
  const role = sessionUser.role as Role;
  const targetUserIdForSetup = sessionUser.id === "PC_CASSA" ? "u-super-admin" : sessionUser.id;

  await requireServicePageAccess(role, sessionUser.sedeId, 3, targetUserIdForSetup);
  await Promise.all([
    ensureOrderForm(targetUserIdForSetup),
    ensureCashClosingForm(targetUserIdForSetup),
    ensureClientControlForm(targetUserIdForSetup),
    ensureItalianInvoiceForm(targetUserIdForSetup),
    ensureRefundForm(targetUserIdForSetup),
  ]);

  const locationId = sessionUser.sedeId;

  const isManagementRole = role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN" || role === "RESPONSABILE";

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());

  // Retrieve active templates, visibility rules and today's latest clock state.
  const [allActiveForms, visibilitySetting, latestAttendance] = await Promise.all([
    prisma.serviceForm.findMany({
      where: { active: true },
      orderBy: { created_at: "desc" },
    }),
    prisma.setting.findUnique({ where: { key: SERVICE_FORMS_VISIBILITY_KEY } }).catch(() => null),
    isPC
      ? Promise.resolve(null)
      : prisma.attendanceLog.findFirst({
          where: {
            user_id: sessionUser.id,
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
    if (isInternalFotoOrderForm(form)) return false;

    const allowedRoles = form.allowed_roles as string[] | null;
    const allowedLocations = form.allowed_location_ids as string[] | null;
    const isCandidacy = form.name.toUpperCase().includes("CANDIDATURA");

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
        { user_id: sessionUser.id },
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
    if (isInternalFotoOrderForm(r.form)) return false;

    const notifyUserIds = r.form?.notify_user_ids as string[] | null;
    const notifyRoles = r.form?.notify_roles as string[] | null;

    const isUserNotified = notifyUserIds && Array.isArray(notifyUserIds) && notifyUserIds.includes(sessionUser.id);
    const isRoleNotified = notifyRoles && Array.isArray(notifyRoles) && notifyRoles.includes(role);
    const isNominated = isUserNotified || isRoleNotified;

    if (r.status === "ARCHIVED") {
      // For archived ones: only see own submission or where explicitly nominated
      return r.user_id === sessionUser.id || isNominated;
    }

    // For active ones:
    // 1. Own submission
    if (r.user_id === sessionUser.id) return true;
    
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
  const [activeEmployees, todayAttendanceLogs, pastInvoiceResponses] = await Promise.all([
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
    prisma.serviceFormResponse.findMany({
      where: {
        form: {
          name: { contains: "fattura", mode: "insensitive" }
        }
      },
      select: {
        answers: true,
      },
      orderBy: { created_at: "desc" },
      take: 400
    }),
  ]);

  // Extract unique past customers from responses
  const pastCustomersMap = new Map<string, any>();
  for (const resp of pastInvoiceResponses) {
    const ans = resp.answers as Record<string, any> | null;
    if (!ans) continue;
    const name = String(ans.invoice_client_name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!pastCustomersMap.has(key)) {
      pastCustomersMap.set(key, {
        name,
        type: ans.invoice_client_type || "Privato (Codice Fiscale)",
        fiscalCode: ans.invoice_fiscal_code || "",
        vatNumber: ans.invoice_vat_number || "",
        sdiCode: ans.invoice_sdi_code || "",
        pec: ans.invoice_pec || "",
        address: ans.invoice_address || "",
      });
    }
  }
  const pastCustomers = Array.from(pastCustomersMap.values());

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
    <AppShell title="Forms" role={role} hideHeader pcMode={isPC} pcDisplayUser={pcDisplayUser}>
      <StaffFormsViewer 
        forms={serializedForms} 
        employees={serializedEmployees} 
        initialResponses={serializedResponses}
        currentUserId={sessionUser.id}
        currentUserName={pcDisplayUser?.name || sessionUser.name || "Dipendente"}
        currentUserRole={role}
        autoFillFormId={fillId}
        autoFillFormName={fill}
        pastCustomers={pastCustomers}
      />
    </AppShell>
  );
}
