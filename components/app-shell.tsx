import Link from "next/link";
import { auth } from "@/lib/auth";
import { brandingCss, getBrandingTheme } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import { roleLabels, routePermissions, visibleForRole, type Role } from "@/lib/roles";
import { normalizeServicePage, servicePages } from "@/lib/service-pages";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";
import { InstantLink } from "@/components/instant-link";
import { SidebarFrame } from "@/components/sidebar-frame";
import { TopControls } from "@/components/top-controls";
import { NotificationWatcher } from "@/components/notification-watcher";
import { MobileMenuDrawer } from "@/components/mobile-menu-drawer";
import { DynamicIcon } from "@/components/dynamic-icon";
import pkg from "@/package.json";

const nav = [
  // Section: Generale
  { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard", roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Generale" },
  { href: "/my-shifts", label: "I miei turni", iconName: "CalendarDays", roles: ["DIPENDENTE"], section: "Generale" },
  { href: "/tasks", label: "TASK", iconName: "CheckSquare", roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Generale" },
  { href: "/notifications", label: "Comunicazioni", iconName: "Bell", roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Generale" },

  // Section: Planning & Saloni
  { href: "/schedules", label: "Planning", iconName: "CalendarDays", roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Planning & Saloni" },
  { href: "/social-calendar", label: "Programmazione Social", iconName: "Share2", roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Planning & Saloni" },
  { href: "/locations", label: "Saloni", iconName: "Building2", roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Planning & Saloni" },
  { href: "/orders", label: "Ordini", iconName: "ShoppingCart", roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Planning & Saloni" },
  { href: "/tablet-clock", label: "Tablet Clock", iconName: "Smartphone", roles: routePermissions["/tablet-clock"], section: "Planning & Saloni" },
  { href: "/settings/forms", label: "Moduli", iconName: "ClipboardList", roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Planning & Saloni" },

  // Section: Gestione Staff
  { href: "/staff", label: "Staff Paradise", iconName: "Users", roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Gestione Staff" },
  { href: "/recruitment", label: "Talent System", iconName: "UserPlus", roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Gestione Staff" },
  { href: "/attendance", label: "Timbrature", iconName: "CalendarCheck", roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Gestione Staff" },
  { href: "/work-hours", label: "Ore staff", iconName: "Calculator", roles: ["SUPER_ADMIN", "ADMIN"], section: "Gestione Staff" },
  { href: "/requests", label: "Ferie e permessi", iconName: "ShieldCheck", roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Gestione Staff" },
  { href: "/documents", label: "Documenti", iconName: "FileText", roles: ["SUPER_ADMIN", "ADMIN", "DIPENDENTE"], section: "Gestione Staff" },
  { href: "/team", label: "Team", iconName: "Users", roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"], section: "Gestione Staff" },

  // Section: Impostazioni
  { href: "/profile", label: "Profilo", iconName: "UserRound", roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"], section: "Impostazioni" },
  { href: "/settings", label: "Impostazioni", iconName: "Settings", roles: ["SUPER_ADMIN", "ADMIN"], section: "Impostazioni" },
] satisfies { href: string; label: string; iconName: string; roles: Role[]; section?: string }[];

export async function AppShell({ children, title, subtitle, role, hideHeader = false, hideMobileHeader = false, hidePageHeaderOnMobile = false }: { children: React.ReactNode; title: string; subtitle?: string; role?: Role; hideHeader?: boolean; hideMobileHeader?: boolean; hidePageHeaderOnMobile?: boolean }) {
  const [session, branding] = await Promise.all([auth(), getBrandingTheme()]);
  const currentRole = (role ?? session?.user?.role ?? "DIPENDENTE") as Role;
  const serviceSetting = currentRole === "DIPENDENTE" && session?.user?.sedeId
    ? await prisma.setting.findUnique({ where: { key: `service_page:${session.user.sedeId}` } }).catch(() => null)
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
    ? (await prisma.serviceForm.findMany({
        where: { active: true },
        select: { notify_user_ids: true, notify_roles: true }
      }).catch(() => [])).some((form) => {
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
    label: "Moduli",
    iconName: "ClipboardList",
    roles: ["DIPENDENTE"] as Role[],
    section: "Generale"
  };

  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, photo_url: true, header_color: true, sidebar_color: true, mansione: true } }).catch(() => null)
    : null;

  const baseItems = visibleForRole(nav, currentRole);
  const userHasSocialAccess = currentUser?.mansione?.toLowerCase().includes("social");

  const items = currentRole === "DIPENDENTE"
    ? [
        ...baseItems.filter((item) => item.href !== "/notifications" && item.href !== "/tasks" && item.href !== "/social-calendar"),
        selectedServiceItem,
        ...(showFormsLinkSeparately ? [formsLinkItem] : []),
        ...(userHasSocialAccess ? [{ href: "/social-calendar", label: "Programmazione Social", iconName: "Share2", roles: ["DIPENDENTE"] as Role[], section: "Planning & Saloni" }] : []),
      ]
    : baseItems;
  const unreadNotifications = session?.user?.id
    ? await prisma.notification.count({ where: { user_id: session.user.id, read: false } }).catch(() => 0)
    : 0;
  const dateLabel = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  }).format(new Date());
  const mobileItems = currentRole === "DIPENDENTE"
    ? [
        { href: "/my-shifts", label: "I miei turni", iconName: "Timer", roles: ["DIPENDENTE"] as Role[] },
        { href: "/requests", label: "Calendario", iconName: "CalendarDays", roles: ["DIPENDENTE"] as Role[] },
        { href: "/dashboard", label: "Timbrature", iconName: "Clock3", roles: ["DIPENDENTE"] as Role[] },
        { href: "/profile", label: "Altro", iconName: "MoreHorizontal", roles: ["DIPENDENTE"] as Role[] },
      ]
    : [];

  const aside = (
      <aside className={cn(
        "z-30 w-full max-w-full border-b-0 border-transparent bg-[color:var(--user-header-color,var(--sidebar))] xl:bg-[color:var(--user-sidebar-color,var(--sidebar))] px-4 py-3 text-[color:var(--sidebar-text)] xl:border-r xl:border-black/5 xl:px-5 xl:py-4 xl:flex xl:h-dvh xl:flex-col xl:overflow-hidden",
        hideMobileHeader && "hidden xl:flex"
      )}>
        {/* Mobile Header (xl:hidden) */}
        {!hideMobileHeader && (
          <div className="relative flex xl:hidden items-center justify-between w-full">
          {/* Hamburger Drawer */}
          <MobileMenuDrawer
            logoUrl={branding.logo_url}
            userName={currentUser?.name ?? session?.user?.name ?? ""}
            userPhoto={currentUser?.photo_url ?? null}
            roleLabel={currentRole === "DIPENDENTE" ? "Collaboratore" : roleLabels[currentRole]}
            unreadNotifications={unreadNotifications}
            logoutButton={
              <LogoutButton className="flex w-full items-center gap-3 rounded-2xl border border-current/10 bg-white/20 px-4 py-3 text-sm font-bold text-[color:var(--sidebar-text)] shadow-sm transition hover:bg-white/30 active:scale-95" />
            }
          >
            {(currentRole === "DIPENDENTE"
              ? [
                  { href: "/dashboard", label: "Home", iconName: "Home" },
                  { href: "/my-shifts", label: "I miei turni", iconName: "Timer" },
                  { href: "/requests", label: "Calendario", iconName: "CalendarDays" },
                  { href: "/documents", label: "Documenti", iconName: "FileText" },
                  ...(servicePageNum === 2
                    ? [{ href: "/tasks", label: "TASK", iconName: "CheckSquare" }]
                    : []),
                  ...(servicePageNum === 3 || hasFormsAccess
                    ? [{ href: "/service-forms", label: "Moduli", iconName: "ClipboardList" }]
                    : []),
                  { href: "/orders", label: "Ordini", iconName: "ShoppingCart" },
                  ...(servicePageNum === 1
                    ? [{ href: "/service-notes", label: "NOTE", iconName: "FilePenLine" }]
                    : []),
                  ...(userHasSocialAccess
                    ? [{ href: "/social-calendar", label: "Programmazione Social", iconName: "Share2" }]
                    : []),
                ]
              : baseItems
            ).map((item) => (
              <InstantLink
                key={item.href}
                href={item.href}
                className="flex items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-bold text-[color:var(--sidebar-text)] opacity-80 transition-all duration-200 hover:bg-white/20 hover:opacity-100"
                activeClassName="bg-white/25 opacity-100 font-extrabold border-l-4 border-[color:var(--sidebar-icon)] pl-3"
              >
                <DynamicIcon name={item.iconName} className="size-5 shrink-0 text-[color:var(--sidebar-icon)]" />
                <span>{item.label}</span>
              </InstantLink>
            ))}
          </MobileMenuDrawer>

          {/* Logo Center */}
          <Link href="/dashboard" className="absolute left-1/2 -translate-x-1/2 select-none flex items-center justify-center max-w-[150px] xs:max-w-[180px] h-8">
            <img src={branding.logo_url || "/logo.png"} alt="Paradise Beauty" className="max-h-full w-auto object-contain dark:invert select-none pointer-events-none" />
          </Link>

          {/* Bell & Profile Photo Right */}
          <div className="flex items-center gap-3.5">
            <InstantLink href="/notifications" className="relative p-1 text-[color:var(--sidebar-icon)] active:scale-95 transition">
              <DynamicIcon name="Bell" className="size-5" />
              {unreadNotifications > 0 && (
                <span className="absolute top-0 right-0 size-2.5 rounded-full bg-[#C66170] ring-2 ring-white dark:ring-black animate-pulse-soft" />
              )}
            </InstantLink>

            <InstantLink href="/profile" className="relative active:scale-95 transition">
              <div className="size-9 rounded-full overflow-hidden border border-black/5 bg-paradise-nude shadow-sm">
                {currentUser?.photo_url ? (
                  <img src={currentUser.photo_url} alt={currentUser.name ?? "User"} className="size-full object-cover rounded-full select-none pointer-events-none" />
                ) : (
                  <div className="size-full flex items-center justify-center font-bold text-xs text-paradise-noir">
                    {currentUser?.name?.slice(0, 1).toUpperCase() ?? "P"}
                  </div>
                )}
              </div>
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-black" />
            </InstantLink>
          </div>
        </div>
      )}

        {/* Desktop Header (hidden xl:block) */}
        <div className="shrink-0 xl:block hidden">
          <div className="flex xl:flex-col xl:items-start xl:gap-2 items-center justify-between">
            <Link href="/dashboard" className="sidebar-brand group flex items-center gap-3" title="Paradise Staff Hub">
              <div className="grid size-11 place-items-center overflow-hidden rounded-full text-lg font-bold text-white shadow-soft transition-all duration-300 group-hover:scale-105 group-hover:shadow-luxury bg-transparent">
                <img src={branding.logo_url || "/logo.png"} alt="Paradise Beauty" className="size-full object-contain dark:invert" />
              </div>
              <div className="sidebar-label">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--sidebar-text)] transition-colors duration-300 group-hover:text-[#B85B68] dark:text-[color:var(--dark-sidebar-text)] dark:group-hover:text-paradise-pink">Paradise</p>
                <p className="sidebar-subtitle text-xs text-[color:var(--sidebar-text)] opacity-55 dark:text-[color:var(--dark-sidebar-text)]">Staff Hub</p>
              </div>
            </Link>
            {currentRole !== "DIPENDENTE" && (
              <div className="flex items-center gap-3 xl:block">
                <div className="sidebar-role rounded-full bg-paradise-softPink px-3 py-1 text-xs font-semibold xl:mt-1 hidden xl:inline-block">
                  {roleLabels[currentRole]}
                </div>
              </div>
            )}
          </div>
          {currentRole === "DIPENDENTE" && (
            <InstantLink href="/notifications" className="sidebar-role relative inline-flex items-center gap-2 rounded-full bg-paradise-softPink px-3 py-1 text-xs font-semibold xl:mt-3 transition-transform duration-300 hover:scale-105">
              <DynamicIcon name="Bell" className="size-3.5" />
              Avvisi
              {unreadNotifications > 0 ? (
                <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-[#C66170] px-1.5 py-0.5 text-center text-[10px] font-bold text-white shadow-[0_0_8px_rgba(198,97,112,0.6)] animate-pulse-soft">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              ) : null}
            </InstantLink>
          )}
        </div>
        <nav className="luxury-scroll mt-5 xl:min-h-0 xl:flex-1 xl:space-y-1 xl:overflow-x-hidden xl:overflow-y-auto hidden xl:block">
          {(() => {
            let lastSection = "";
            return items.map((item) => {
              const showSectionHeader = currentRole !== "DIPENDENTE" && item.section && item.section !== lastSection;
              if (showSectionHeader) {
                lastSection = item.section;
              }

              return (
                <div key={item.href}>
                  {showSectionHeader && (
                    <div className="sidebar-section-header mt-5 mb-2 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--sidebar-text)]/40 dark:text-[color:var(--dark-sidebar-text)]/40 sidebar-label select-none">
                      {item.section}
                    </div>
                  )}
                  <InstantLink
                    href={item.href}
                    title={item.label}
                    className="sidebar-nav-link flex shrink-0 items-center gap-3 rounded-l-none rounded-r-2xl border-l-4 border-transparent pl-3 pr-4 py-3 text-sm font-medium text-[color:var(--sidebar-text)] transition-all duration-300 hover:bg-paradise-nude dark:text-[color:var(--dark-sidebar-text)] dark:hover:bg-white/10 hover:border-l-paradise-pink/40"
                    activeClassName="active bg-gradient-to-r from-paradise-pink/15 to-paradise-softPink/5 border-l-paradise-pink text-paradise-noir shadow-sm dark:from-paradise-pink/10 dark:to-transparent dark:border-paradise-pink dark:text-white"
                  >
                    <DynamicIcon name={item.iconName} className="size-4 text-[color:var(--sidebar-icon)] transition-colors duration-300 dark:text-[color:var(--dark-sidebar-icon)]" />
                    <span className="sidebar-label transition-transform duration-300 hover:translate-x-0.5">{item.label}</span>
                    {item.href === "/notifications" && unreadNotifications > 0 ? (
                      <span className="sidebar-badge ml-auto min-w-5 rounded-full bg-[#C66170] px-1.5 py-0.5 text-center text-[11px] font-bold text-white shadow-[0_0_8px_rgba(198,97,112,0.6)] animate-pulse-soft">
                        {unreadNotifications > 99 ? "99+" : unreadNotifications}
                      </span>
                    ) : null}
                  </InstantLink>
                </div>
              );
            });
          })()}
        </nav>
        <div className="shrink-0 hidden xl:block">
          <LogoutButton />
        </div>
      </aside>
  );
 
  const main = (
      <main className={cn(
        "w-full min-w-0 max-w-full overflow-x-hidden bg-transparent xl:px-10 xl:py-8", 
        hideMobileHeader ? "px-0 py-0" : "px-4 py-5 sm:px-6",
        currentRole === "DIPENDENTE" && (hideMobileHeader ? "pb-0 xl:pb-8" : "pb-28 xl:pb-8")
      )}>
        <div className="mb-5 hidden justify-end xl:flex">
          <TopControls unread={unreadNotifications} name={currentUser?.name ?? session?.user?.name ?? "Paradise"} photoUrl={currentUser?.photo_url ?? null} />
        </div>
        {!hideHeader ? <header className={cn("mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", hidePageHeaderOnMobile && "hidden sm:flex")}>
          <div>
            <p className={cn("text-sm font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/40", currentRole === "DIPENDENTE" && "hidden sm:block")}>Paradise Beauty</p>
            <h1 className={cn("mt-2 font-bold tracking-tight text-[color:var(--text)]", currentRole === "DIPENDENTE" ? "text-3xl sm:text-4xl" : "text-3xl sm:text-4xl")}>
              {typeof title === "string" && title.startsWith("Ciao, ") ? (
                <>
                  Ciao, <span className="luxury-text-gradient">{title.slice(6)}</span>
                </>
              ) : (
                title
              )}
            </h1>
            {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55 dark:text-white/55">{subtitle}</p> : null}
          </div>
          <div className={cn("rounded-full border border-black/5 bg-white px-4 py-2 text-sm shadow-sm", "dark:border-white/10 dark:bg-white/10", currentRole === "DIPENDENTE" && "hidden sm:block")}>
            {dateLabel}
          </div>
        </header> : null}
        <div className="flex-1">
          {children}
        </div>
        <footer className="mt-16 border-t border-black/5 dark:border-white/5 pt-6 pb-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-black/35 dark:text-white/35">
          <span suppressHydrationWarning>© {new Date().getFullYear()} Paradise Beauty. Tutti i diritti riservati.</span>
          <span className="font-medium">Staff Hub v{pkg.version}</span>
        </footer>
      </main>
  );
 
  const mobileNav = null;

  return (
    <SidebarFrame
      aside={aside}
      main={<>{main}<NotificationWatcher initialUnread={unreadNotifications} /></>}
      mobileNav={mobileNav}
      style={{
        ...brandingCss(branding),
        ...(currentUser?.header_color ? { "--user-header-color": currentUser.header_color } : {}),
        ...(currentUser?.sidebar_color ? {
          "--user-sidebar-color": currentUser.sidebar_color,
          "--user-background-color": `color-mix(in srgb, ${currentUser.sidebar_color} 6%, var(--background))`,
        } : {}),
      } as React.CSSProperties}
    />
  );
}
