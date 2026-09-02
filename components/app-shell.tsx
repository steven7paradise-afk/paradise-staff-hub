import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { canAccessSalonShiftModules, isSalonCollaborator } from "@/lib/salon-shift-access";
import { brandingCss, getBrandingTheme } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import { MANSIONI_PERMISSIONS_SETTING_KEY, ROLE_PERMISSIONS_SETTING_KEY, mergePermissionSets, normalizeMansionePermissions, normalizeRolePermissions, roleLabels, routePermissions, visibleForRole, type PermissionSet, type Role } from "@/lib/roles";
import { normalizeServicePage, servicePages } from "@/lib/service-pages";
import { ASSISTANCE_TABLES_ACCESS_KEY, canUseAssistanceTables, normalizeAssistanceTablesAccess } from "@/lib/assistance-tables";
import { canViewPlanning, normalizePlanningAccess, PLANNING_ACCESS_KEY } from "@/lib/planning-access";
import { hasTaskAccess } from "@/lib/task-access";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";
import { InstantLink } from "@/components/instant-link";
import { SidebarFrame } from "@/components/sidebar-frame";
import { TopControls } from "@/components/top-controls";
import { NotificationWatcher } from "@/components/notification-watcher";
import { MobileMenuDrawer } from "@/components/mobile-menu-drawer";
import { DesktopSidebarNav } from "@/components/desktop-sidebar-nav";
import { DynamicIcon } from "@/components/dynamic-icon";
import { NotificationsPopover } from "@/components/notifications-popover";
import { AdminAssistant } from "@/components/admin-assistant";
import pkg from "@/package.json";
import { redirect } from "next/navigation";
import { FORMER_EMPLOYEE_STATUS, formerEmployeeAccessDates } from "@/lib/former-employee";

function getContrastYIQ(hexcolor: string) {
  const hex = hexcolor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "dark";
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "dark" : "light";
}

const nav = [
  // Section: Generale
  { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO", "DIPENDENTE"], section: "Generale" },
  { href: "/hub", label: "Magazzino Paradise", iconName: "PanelsTopLeft", roles: routePermissions["/hub"], section: "Generale" },
  { href: "/my-shifts", label: "I miei turni", iconName: "CalendarDays", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Generale" },
  { href: "/tasks", label: "Task", iconName: "CheckSquare", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Generale" },
  { href: "/notifications", label: "Comunicazioni", iconName: "Bell", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Generale" },

  // Section: Planning & Saloni
  { href: "/schedules", label: "Planning", iconName: "CalendarDays", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Planning & Saloni" },
  { href: "/social-calendar", label: "Programmazione Social", iconName: "Share2", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Planning & Saloni" },
  { href: "/locations", label: "Saloni", iconName: "Building2", roles: ["ZERO", "SUPER_ADMIN", "ADMIN"], section: "Planning & Saloni" },
  { href: "/orders", label: "Ordini", iconName: "ShoppingCart", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Planning & Saloni" },
  { href: "/shipping", label: "Spedizioni", iconName: "Truck", roles: routePermissions["/shipping"], section: "Planning & Saloni" },
  { href: "/appointments", label: "Appuntamenti", iconName: "CalendarDays", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Planning & Saloni" },
  { href: "/consulenza-online", label: "Consulenza Online", iconName: "Video", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Planning & Saloni" },
  { href: "/cash", label: "Cassa", iconName: "DollarSign", roles: ["ZERO", "SUPER_ADMIN", "ADMIN"], section: "Planning & Saloni" },
  { href: "/invoices", label: "Fatture", iconName: "ReceiptText", roles: ["ZERO", "SUPER_ADMIN", "ADMIN"], section: "Planning & Saloni" },
  { href: "/refunds", label: "Rimborsi", iconName: "RotateCcw", roles: ["ZERO", "SUPER_ADMIN", "ADMIN"], section: "Planning & Saloni" },
  { href: "/client-control", label: "Controllo Cliente", iconName: "BarChart3", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Planning & Saloni" },
  { href: "/tables", label: "Tabelle", iconName: "Table2", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "DIPENDENTE"], section: "Planning & Saloni" },
  { href: "/points", label: "Punti", iconName: "Award", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Planning & Saloni" },
  { href: "/tablet-clock", label: "Tablet Clock", iconName: "Smartphone", roles: routePermissions["/tablet-clock"], section: "Planning & Saloni" },
  { href: "/settings/forms", label: "Moduli", iconName: "ClipboardList", roles: ["ZERO", "SUPER_ADMIN", "ADMIN"], section: "Planning & Saloni" },
  { href: "/service-forms", label: "Moduli", iconName: "ClipboardList", roles: ["RESPONSABILE"], section: "Planning & Saloni" },

  // Section: Gestione Staff
  { href: "/staff", label: "Staff Paradise", iconName: "Users", roles: ["ZERO", "SUPER_ADMIN", "ADMIN"], section: "Gestione Staff" },
  { href: "/recruitment", label: "Talent System", iconName: "UserPlus", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Gestione Staff" },
  { href: "/attendance", label: "Timbrature", iconName: "CalendarCheck", roles: ["ZERO", "SUPER_ADMIN", "ADMIN"], section: "Gestione Staff" },
  { href: "/work-hours", label: "Ore staff", iconName: "Calculator", roles: ["ZERO", "SUPER_ADMIN", "ADMIN"], section: "Gestione Staff" },
  { href: "/requests", label: "Ferie e permessi", iconName: "ShieldCheck", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Gestione Staff" },
  { href: "/documents", label: "Documenti", iconName: "FileText", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Gestione Staff" },
  { href: "/cedolini", label: "Cedolini", iconName: "FileCheck2", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Gestione Staff" },
  { href: "/malattie", label: "Malattie", iconName: "Heart", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Gestione Staff" },
  { href: "/team", label: "Team", iconName: "Users", roles: ["ZERO", "SUPER_ADMIN", "ADMIN"], section: "Gestione Staff" },

  // Section: Impostazioni
  { href: "/profile", label: "Profilo", iconName: "UserRound", roles: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Impostazioni" },
  { href: "/settings", label: "Impostazioni", iconName: "Settings", roles: ["ZERO", "SUPER_ADMIN", "ADMIN"], section: "Impostazioni" },
] satisfies { href: string; label: string; iconName: string; roles: Role[]; section?: string }[];

const permissionMenuOverrides = [
  { href: "/service-notes", label: "NOTE", iconName: "FilePenLine", section: "Generale" },
  { href: "/service-forms", label: "Moduli operativi", iconName: "ReceiptText", section: "Planning & Saloni" },
] satisfies { href: string; label: string; iconName: string; section?: string }[];

type SidebarFolder = { id: string; title: string; routes: string[]; labels?: Record<string, string> };

function normalizeSidebarFolders(value: unknown): SidebarFolder[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((folder): folder is { id?: unknown; title?: unknown; routes?: unknown; labels?: unknown } => Boolean(folder) && typeof folder === "object")
    .map((folder) => ({
      id: typeof folder.id === "string" ? folder.id : "folder",
      title: typeof folder.title === "string" ? folder.title : "Menu",
      routes: Array.isArray(folder.routes) ? folder.routes.filter((route): route is string => typeof route === "string") : [],
      labels: folder.labels && typeof folder.labels === "object" && !Array.isArray(folder.labels)
        ? Object.fromEntries(
            Object.entries(folder.labels as Record<string, unknown>)
              .filter(([route, label]) => typeof route === "string" && typeof label === "string")
          ) as Record<string, string>
        : {},
    }));
}

function resolveSidebarConfig(value: unknown, role: Role, mansione?: string | null): SidebarFolder[] | null {
  if (Array.isArray(value)) return normalizeSidebarFolders(value);

  if (value && typeof value === "object") {
    const raw = value as { default?: unknown; targets?: unknown };
    const targets = raw.targets && typeof raw.targets === "object" && !Array.isArray(raw.targets)
      ? raw.targets as Record<string, unknown>
      : {};
    
    // Ignore mansione layouts for system roles so they always get the full admin layout.
    const isSystemAdmin = role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN";
    const cleanMansione = !isSystemAdmin && mansione?.trim().toLowerCase();
    
    const targetLayout = cleanMansione && targets[cleanMansione]
      ? targets[cleanMansione]
      : targets[role];
    const folders = normalizeSidebarFolders(targetLayout || raw.default);
    return folders.length > 0 ? folders : null;
  }

  return null;
}

function uniqueMenuItemsForAccess(role: Role) {
  const items = [
    ...nav.map((item) => ({ ...item, roles: [role] as Role[] })),
    ...permissionMenuOverrides.map((item) => ({ ...item, roles: [role] as Role[] })),
  ];
  return dedupeMenuItems(items);
}

function dedupeMenuItems<T extends { href: string }>(items: T[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

export async function AppShell({ children, title, subtitle, role, hideHeader = false, hideMobileHeader = false, hidePageHeaderOnMobile = false, transparentMain = false, transparentMobileHeader = false, pcMode = false, pcDisplayUser = null, edgeToEdgeMain = false, hideDesktopControls = false, compactDarkSidebar = false, hideDesktopSidebar = false, hideAdminAssistant = false }: { children: React.ReactNode; title: string; subtitle?: string; role?: Role; hideHeader?: boolean; hideMobileHeader?: boolean; hidePageHeaderOnMobile?: boolean; transparentMain?: boolean; transparentMobileHeader?: boolean; pcMode?: boolean; pcDisplayUser?: { name: string; photo_url?: string | null } | null; edgeToEdgeMain?: boolean; hideDesktopControls?: boolean; compactDarkSidebar?: boolean; hideDesktopSidebar?: boolean; hideAdminAssistant?: boolean }) {
  const [session, branding] = await Promise.all([auth(), getBrandingTheme()]);
  const isPcCassa = pcMode;
  if (!session?.user?.id && !isPcCassa) redirect("/login");
  const pcProfileChooserHref = "/appointments/buenos-aires?choose=1";
  const currentRole = (role ?? session?.user?.role ?? "DIPENDENTE") as Role;

  const settingsKeys = [
    ASSISTANCE_TABLES_ACCESS_KEY,
    PLANNING_ACCESS_KEY,
    ROLE_PERMISSIONS_SETTING_KEY,
    MANSIONI_PERMISSIONS_SETTING_KEY,
    "sidebar_configuration",
  ];
  if (currentRole === "DIPENDENTE" && session?.user?.sedeId) {
    settingsKeys.push(`service_page:${session.user.sedeId}`);
  }

  const settingsPromise = prisma.setting.findMany({
    where: { key: { in: settingsKeys } }
  }).catch(() => []);

  const formsAccessPromise = currentRole === "DIPENDENTE" && session?.user?.id
    ? prisma.serviceForm.findMany({
        where: { active: true },
        select: { notify_user_ids: true, notify_roles: true }
      }).catch(() => [])
    : Promise.resolve([]);

  const currentUserPromise = session?.user?.id
    ? prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          role: true,
          name: true,
          photo_url: true,
          header_color: true,
          sidebar_color: true,
          mansione: true,
          employee_status: true,
          workforce_data: true,
          last_edited_at: true,
          location: { select: { name: true } },
        },
      }).catch(() => null)
    : Promise.resolve(null);
  const unreadNotificationsPromise = session?.user?.id
    ? prisma.notification.count({ where: { user_id: session.user.id, read: false } }).catch(() => 0)
    : Promise.resolve(0);

  const requestScope: Prisma.LeaveRequestWhereInput = currentRole === "DIPENDENTE" && session?.user?.id
    ? { user_id: session.user.id }
    : currentRole === "RESPONSABILE" && session?.user?.sedeId
      ? { user: { sede_id: session.user.sedeId } }
      : {};
  const requestActionsPromise = session?.user?.id && ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"].includes(currentRole)
    ? prisma.leaveRequest.count({
        where: {
          ...requestScope,
          NOT: { admin_note: { contains: "[ELIMINATA_DA_MALATTIE]" } },
          OR: [
            { status: "PENDING" },
            { type: "MALATTIA", medical_code: null },
            {
              reason: { startsWith: "RITARDO AUTOMATICO — " },
              employee_viewed_at: null,
              employee_acknowledged_at: null,
            },
          ],
        },
      }).catch(() => 0)
    : Promise.resolve(0);

  const [settingsList, formsAccessSettings, currentUser, unreadNotifications, requestActions] = await Promise.all([
    settingsPromise,
    formsAccessPromise,
    currentUserPromise,
    unreadNotificationsPromise,
    requestActionsPromise,
  ]);
  const displayUser = isPcCassa && pcDisplayUser ? pcDisplayUser : currentUser;
  const isFormerEmployee = currentUser?.employee_status === FORMER_EMPLOYEE_STATUS;
  if (isFormerEmployee && formerEmployeeAccessDates(currentUser.workforce_data, currentUser.last_edited_at).until.getTime() < Date.now()) {
    redirect("/login?documentAccessExpired=1");
  }
  const salonShiftModulesEnabled = isPcCassa || !currentUser || !isSalonCollaborator(currentUser)
    ? true
    : await canAccessSalonShiftModules(currentUser).catch(() => false);

  const settingsMap = new Map(settingsList.map((s) => [s.key, s]));
  const sidebarConfigSetting = settingsMap.get("sidebar_configuration") || null;
  const rolePermissionsSetting = settingsMap.get(ROLE_PERMISSIONS_SETTING_KEY) || null;
  const mansionePermissionsSetting = settingsMap.get(MANSIONI_PERMISSIONS_SETTING_KEY) || null;
  const planningAccessSetting = settingsMap.get(PLANNING_ACCESS_KEY) || null;
  const tablesAccessSetting = settingsMap.get(ASSISTANCE_TABLES_ACCESS_KEY) || null;
  const serviceSetting = currentRole === "DIPENDENTE" && session?.user?.sedeId
    ? settingsMap.get(`service_page:${session.user.sedeId}`) || null
    : null;

  let servicePageNum = 1;
  let customLabel = "";
  let customIcon = "";

  if (serviceSetting?.value) {
    if (typeof serviceSetting.value === "object" && serviceSetting.value !== null && !Array.isArray(serviceSetting.value)) {
      const valObj = serviceSetting.value as any;
      servicePageNum = Number(valObj.page) || 1;
      customLabel = String(valObj.customName || "");
      customIcon = String(valObj.customIcon || "");
    } else {
      servicePageNum = Number(serviceSetting.value) || 1;
    }
  }

  const servicePage = servicePages[normalizeServicePage(servicePageNum)];
  const selectedServiceItem = {
    href: servicePage.href,
    label: customLabel || servicePage.label,
    iconName: customIcon || servicePage.iconName,
    roles: ["DIPENDENTE"] as Role[],
    section: "Generale"
  };

  const hasFormsAccess = currentRole === "DIPENDENTE" && session?.user?.id
    ? formsAccessSettings.some((form) => {
        const notifyUserIds = form.notify_user_ids as string[] | null;
        const notifyRoles = form.notify_roles as string[] | null;
        return (
          (notifyUserIds && Array.isArray(notifyUserIds) && notifyUserIds.includes(session.user.id)) ||
          (notifyRoles && Array.isArray(notifyRoles) && notifyRoles.includes(currentRole))
        );
      })
    : false;

  const showFormsLinkSeparately = hasFormsAccess && servicePageNum !== 3;

  const formsLinkItem = {
    href: "/service-forms",
    label: "Cassa",
    iconName: "ReceiptText",
    roles: ["DIPENDENTE"] as Role[],
    section: "Generale"
  };

  const userHasSocialAccess = currentUser?.mansione?.toLowerCase().includes("social");
  const userHasAppointmentsAccess = currentUser?.mansione?.toLowerCase().includes("assistenza");
  const userHasOnlineConsultationsAccess = currentUser?.mansione?.toLowerCase().includes("assistenza");
  const userHasTaskAccess = hasTaskAccess(currentRole, currentUser?.mansione, currentUser?.location?.name);
  const tablesAccess = normalizeAssistanceTablesAccess(tablesAccessSetting?.value);
  const userHasTablesAccess = canUseAssistanceTables(currentRole, currentUser?.mansione, session?.user?.id, tablesAccess);
  const planningAccess = normalizePlanningAccess(planningAccessSetting?.value);
  const userHasPlanningAccess = canViewPlanning(currentRole, session?.user?.id, planningAccess);
  const rolePermissionMap = normalizeRolePermissions(rolePermissionsSetting?.value);
  const mansionePermissionMap = normalizeMansionePermissions(mansionePermissionsSetting?.value);
  const cleanMansione = currentUser?.mansione?.trim().toLowerCase();
  const effectivePermissionSet: PermissionSet | null = currentRole === "ZERO"
    ? null
    : mergePermissionSets(rolePermissionMap[currentRole], cleanMansione ? mansionePermissionMap[cleanMansione] : null);
  const taskNavItem = { href: "/tasks", label: "Task", iconName: "CheckSquare", roles: [currentRole] as Role[], section: "Generale" };
  const tablesNavItem = { href: "/tables", label: "Tabelle", iconName: "Table2", roles: [currentRole] as Role[], section: "Generale" };
  let baseItems = visibleForRole(nav, currentRole)
    .filter((item) => item.href !== "/schedules" || userHasPlanningAccess)
    .filter((item) => item.href !== "/tables" || userHasTablesAccess)
    .filter((item) => item.href !== "/tasks" || userHasTaskAccess);

  const sidebarConfig = resolveSidebarConfig(sidebarConfigSetting?.value, currentRole, currentUser?.mansione);
  const getSidebarLabel = (href: string, fallback: string) => {
    const folder = sidebarConfig?.find((sec) => sec.routes.includes(href));
    return folder?.labels?.[href] || fallback;
  };

  const getStructuredMenuItems = <T extends { href: string }>(flatList: T[]): T[] => {
    if (!sidebarConfig || !Array.isArray(sidebarConfig) || sidebarConfig.length === 0) {
      return flatList;
    }
    const ordered: T[] = [];
    const addedHrefs = new Set<string>();

    sidebarConfig.forEach(sec => {
      const matched = flatList.filter(item => sec.routes.includes(item.href))
        .sort((a, b) => sec.routes.indexOf(a.href) - sec.routes.indexOf(b.href));
      
      matched.forEach(item => {
        if (!addedHrefs.has(item.href)) {
          ordered.push(item);
          addedHrefs.add(item.href);
        }
      });
    });

    return ordered;
  };

  const roleBasedItems = currentRole === "DIPENDENTE"
    ? [
        ...baseItems.filter((item) => item.href !== "/notifications" && item.href !== "/tasks" && item.href !== "/social-calendar" && item.href !== "/cash"),
        ...(selectedServiceItem.href === "/tasks" ? [] : [selectedServiceItem]),
        ...(showFormsLinkSeparately ? [formsLinkItem] : []),
        ...(userHasTaskAccess ? [taskNavItem] : []),
        ...(userHasSocialAccess ? [{ href: "/social-calendar", label: "Programmazione Social", iconName: "Share2", roles: ["DIPENDENTE"] as Role[], section: "Planning & Saloni" }] : []),
        ...(userHasAppointmentsAccess ? [
          { href: "/appointments", label: "Appuntamenti", iconName: "CalendarDays", roles: ["DIPENDENTE"] as Role[], section: "Planning & Saloni" }
        ] : []),
        ...(userHasOnlineConsultationsAccess ? [
          { href: "/consulenza-online", label: "Consulenza Online", iconName: "Video", roles: ["DIPENDENTE"] as Role[], section: "Planning & Saloni" }
        ] : []),
        ...(userHasTablesAccess ? [tablesNavItem] : []),
      ]
    : baseItems;

  const permissionCandidates = uniqueMenuItemsForAccess(currentRole);
  const rawItems = effectivePermissionSet
    ? [
        ...permissionCandidates,
        ...(selectedServiceItem.href === "/tasks" ? [] : [selectedServiceItem]),
        ...(showFormsLinkSeparately ? [formsLinkItem] : []),
      ]
    : roleBasedItems;
  const allowedRoutes = new Set(effectivePermissionSet?.view ?? []);
  const items = effectivePermissionSet
    ? rawItems.filter((item) => {
        const route = Object.keys(routePermissions)
          .sort((a, b) => b.length - a.length)
          .find((candidate) => item.href === candidate || item.href.startsWith(`${candidate}/`));
        return route ? allowedRoutes.has(route) : true;
      })
    : rawItems;
  let sidebarItems = getStructuredMenuItems(dedupeMenuItems(items)).map((item: any) => ({
    href: item.href,
    label: getSidebarLabel(item.href, item.label),
    iconName: item.iconName,
    section: item.section,
    badge: item.href === "/requests" ? requestActions : undefined,
  }));
  let effectiveSidebarConfig = sidebarConfig;
  if (isFormerEmployee) {
    sidebarItems = sidebarItems.filter((item) => item.href === "/documents");
    effectiveSidebarConfig = [{ id: "ex-dipendente", title: "Documenti disponibili", routes: ["/documents"] }];
  }
  if (!salonShiftModulesEnabled) {
    sidebarItems = sidebarItems.filter(
      (item) => item.href !== "/appointments" && item.href !== "/service-forms",
    );
  }
  if (isPcCassa) {
    // Il PC Cassa deve avere sempre il proprio menu operativo. Non eredita il
    // layout personalizzato dei dipendenti, che potrebbe non contenere queste
    // pagine e lasciare quindi visibile una sidebar completamente vuota.
    sidebarItems = [
      { href: "/appointments/buenos-aires", label: "Appuntamenti", iconName: "CalendarDays", section: "", badge: undefined },
      { href: "/service-forms", label: "Cassa", iconName: "ReceiptText", section: "", badge: undefined },
      { href: "/orders", label: "Ordini", iconName: "ShoppingCart", section: "", badge: undefined },
    ];
    effectiveSidebarConfig = [{ id: "pc-cassa", title: "", routes: ["/appointments/buenos-aires", "/service-forms", "/orders"] }];
  }
  const aside = (
      <aside className={cn(
        "z-30 w-full max-w-full border-b-0 border-transparent text-[color:var(--sidebar-text)] xl:border-r xl:border-black/5 xl:px-5 xl:py-4 xl:flex xl:h-dvh xl:flex-col xl:overflow-hidden xl:bg-[color:var(--user-sidebar-color,var(--sidebar))]",
        transparentMobileHeader 
          ? "absolute top-0 left-0 right-0 bg-transparent shadow-none px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-3" 
          : "bg-[color:var(--user-header-color,var(--sidebar))] px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-3",
        hideMobileHeader && "hidden xl:flex"
      )}>
        {/* Mobile Header (xl:hidden) */}
        {!hideMobileHeader && (
          <div className="relative flex min-h-11 w-full items-center justify-between xl:hidden">
          {/* Hamburger Drawer */}
          <MobileMenuDrawer
            logoUrl={branding.logo_url}
            userName={displayUser?.name ?? session?.user?.name ?? "PC Cassa"}
            userPhoto={displayUser?.photo_url ? resolveDrivePhotoUrl(displayUser.photo_url) : null}
            roleLabel={isPcCassa ? "PC Cassa" : currentRole === "DIPENDENTE" ? "Collaboratore" : roleLabels[currentRole]}
            unreadNotifications={unreadNotifications}
            items={sidebarItems}
            sidebarConfig={effectiveSidebarConfig}
            logoutButton={
              <LogoutButton
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3.5 text-sm font-black uppercase tracking-[0.14em] text-slate-300 shadow-inner transition-all duration-200 hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200"
                redirectTo={isPcCassa ? pcProfileChooserHref : undefined}
                skipSignOut={isPcCassa}
                label={isPcCassa ? "Cambia profilo" : "Esci"}
                title={isPcCassa ? "Torna alla selezione profilo" : "Esci"}
              />
            }
          />

          {/* Logo Center */}
          <Link href={isFormerEmployee ? "/documents" : "/dashboard"} className="absolute left-1/2 -translate-x-1/2 select-none flex items-center justify-center max-w-[150px] xs:max-w-[180px] h-8">
            <img src={branding.logo_url || "/logo.png"} alt="Paradise Beauty" className="max-h-full w-auto object-contain dark:invert select-none pointer-events-none" />
          </Link>

          {/* Bell & Profile Photo Right */}
          {!isFormerEmployee ? <div className="flex items-center gap-3.5">
            <NotificationsPopover initialUnread={unreadNotifications} />

            <InstantLink href="/profile" className="relative active:scale-95 transition">
              <div className="size-9 rounded-full overflow-hidden border border-black/5 bg-paradise-nude shadow-sm">
                {currentUser?.photo_url ? (
                  <img src={resolveDrivePhotoUrl(currentUser.photo_url)} alt={currentUser.name ?? "User"} className="size-full object-cover rounded-full select-none pointer-events-none" />
                ) : (
                  <div className="size-full flex items-center justify-center font-bold text-xs text-paradise-noir">
                    {currentUser?.name?.slice(0, 1).toUpperCase() ?? "P"}
                  </div>
                )}
              </div>
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-black" />
            </InstantLink>
          </div> : <div className="w-9" aria-hidden="true" />}
        </div>
      )}

        {/* Desktop Header & Nav Menu */}
        <div className="flex-1 min-h-0 flex flex-col hidden xl:flex">
          <DesktopSidebarNav
            logoUrl={branding.logo_url}
            userName={displayUser?.name ?? session?.user?.name ?? "PC Cassa"}
            userPhoto={displayUser?.photo_url ?? null}
            roleLabel={isPcCassa ? "PC Cassa" : currentRole === "DIPENDENTE" ? "Collaboratore" : roleLabels[currentRole]}
            currentRole={currentRole}
            unreadNotifications={unreadNotifications}
            items={sidebarItems}
            sidebarConfig={effectiveSidebarConfig}
          />
        </div>

        <div className="mt-auto hidden shrink-0 pt-3 xl:block">
          <LogoutButton
            className="sidebar-logout flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[color:var(--dark-sidebar-text)] transition hover:border-red-400/25 hover:bg-red-500/15 hover:text-red-200"
            redirectTo={isPcCassa ? pcProfileChooserHref : undefined}
            skipSignOut={isPcCassa}
            label={isPcCassa ? "Cambia profilo" : "Esci"}
            title={isPcCassa ? "Torna alla selezione profilo" : "Esci"}
          />
        </div>
      </aside>
  );
 
  const main = (
      <main className={cn(
        "app-liquid-canvas relative w-full min-w-0 max-w-full overflow-x-hidden bg-transparent",
        edgeToEdgeMain ? "p-0" : "xl:px-10 xl:py-8",
        !edgeToEdgeMain && (hideMobileHeader ? "px-0 py-0" : "px-4 py-5 sm:px-6"),
        transparentMobileHeader && !hideMobileHeader && "pt-[calc(env(safe-area-inset-top)+72px)] xl:pt-8",
        currentRole === "DIPENDENTE" && (hideMobileHeader ? "pb-0 xl:pb-8" : "pb-28 xl:pb-8")
      )}>
        {!isFormerEmployee && !hideDesktopControls ? <div className={cn("hidden justify-end xl:flex", edgeToEdgeMain ? "absolute right-6 top-6 z-30" : "mb-5")}>
          <TopControls
            unread={unreadNotifications}
            name={displayUser?.name ?? session?.user?.name ?? "Paradise"}
            photoUrl={displayUser?.photo_url ? resolveDrivePhotoUrl(displayUser.photo_url) : null}
            userId={isPcCassa ? "PC_CASSA" : session?.user?.id || ""}
            profileHref={isPcCassa ? "/appointments/buenos-aires?choose=1" : "/profile"}
          />
        </div> : null}
        <div className="sr-only">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="flex-1">
          {children}
        </div>
        <footer className={cn("mt-16 border-t border-black/5 dark:border-white/5 pt-6 pb-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-black/35 dark:text-white/35", edgeToEdgeMain && "hidden")}>
          <span suppressHydrationWarning>© {new Date().getFullYear()} Paradise Beauty. Tutti i diritti riservati.</span>
          <span className="font-medium">Staff Hub v{pkg.version}</span>
        </footer>
      </main>
  );
 
  const mobileNav = null;

  return (
    <SidebarFrame
      aside={aside}
      main={<>{main}{!isFormerEmployee ? <NotificationWatcher initialUnread={unreadNotifications} /> : null}{!hideAdminAssistant && !isPcCassa && !isFormerEmployee && ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(currentRole) ? <AdminAssistant /> : null}</>}
      mobileNav={mobileNav}
      style={{
        ...brandingCss(branding),
        "--sidebar-text": branding.sidebar_text_color || (getContrastYIQ(branding.sidebar_color || "#FFFFFF") === "dark" ? "#1F1F1F" : "#FFFFFF"),
        "--sidebar-icon": branding.sidebar_icon_color || (getContrastYIQ(branding.sidebar_color || "#FFFFFF") === "dark" ? "#1F1F1F" : "#FFFFFF"),
        "--dark-sidebar-text": branding.dark_sidebar_text_color || (getContrastYIQ(branding.dark_sidebar_color || "#1B1A1F") === "dark" ? "#1F1F1F" : "#FFFFFF"),
        "--dark-sidebar-icon": branding.dark_sidebar_icon_color || (getContrastYIQ(branding.dark_sidebar_color || "#1B1A1F") === "dark" ? "#1F1F1F" : "#FFFFFF"),
        ...(compactDarkSidebar ? {
          "--user-sidebar-color": "#211E20",
          "--sidebar-gradient-from": "#292528",
          "--sidebar-gradient-mid": "#1D1A1C",
          "--sidebar-gradient-to": "#111011",
          "--sidebar-text": "#FFFFFF",
          "--sidebar-icon": "#FFFFFF",
          "--sidebar-active-bg": "rgba(255,255,255,0.14)",
          "--sidebar-active-text": "#FFFFFF",
          "--sidebar-active-icon": "#F49BC4",
        } : {}),
      } as React.CSSProperties}
      transparentMain={transparentMain}
      forceCollapsed={isPcCassa || compactDarkSidebar}
      hideDesktopSidebar={hideDesktopSidebar}
    />
  );
}
