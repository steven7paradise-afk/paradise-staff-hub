import Link from "next/link";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  Calculator,
  CheckSquare,
  ClipboardList,
  FileText,
  Building2,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
} from "lucide-react";
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

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"] },
  { href: "/my-shifts", label: "I miei turni", icon: CalendarDays, roles: ["DIPENDENTE"] },
  { href: "/employees", label: "Dipendenti", icon: Users, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/attendance", label: "Timbrature", icon: CalendarCheck, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"] },
  { href: "/work-hours", label: "Ore staff", icon: Calculator, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/schedules", label: "Planning", icon: CalendarDays, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"] },
  { href: "/locations", label: "Saloni", icon: Building2, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"] },
  { href: "/tablet-clock", label: "Tablet Clock", icon: Smartphone, roles: routePermissions["/tablet-clock"] },
  { href: "/requests", label: "Ferie e permessi", icon: ShieldCheck, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"] },
  { href: "/documents", label: "Documenti", icon: FileText, roles: ["SUPER_ADMIN", "ADMIN", "DIPENDENTE"] },
  { href: "/settings/forms", label: "Moduli", icon: ClipboardList, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"] },
  { href: "/tasks", label: "TASK", icon: CheckSquare, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"] },
  { href: "/team", label: "Team", icon: Users, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"] },
  { href: "/notifications", label: "Comunicazioni", icon: Bell, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"] },
  { href: "/profile", label: "Profilo", icon: UserRound, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"] },
  { href: "/settings", label: "Impostazioni", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN"] },
] satisfies { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: Role[] }[];

export async function AppShell({ children, title, subtitle, role, hideHeader = false }: { children: React.ReactNode; title: string; subtitle?: string; role?: Role; hideHeader?: boolean }) {
  const [session, branding] = await Promise.all([auth(), getBrandingTheme()]);
  const currentRole = (role ?? session?.user?.role ?? "DIPENDENTE") as Role;
  const serviceSetting = currentRole === "DIPENDENTE" && session?.user?.sedeId
    ? await prisma.setting.findUnique({ where: { key: `service_page:${session.user.sedeId}` } })
    : null;
  const servicePage = servicePages[normalizeServicePage(String(serviceSetting?.value ?? 1))];
  const selectedServiceItem = { href: servicePage.href, label: servicePage.label, icon: servicePage.icon, roles: ["DIPENDENTE"] as Role[] };
  const baseItems = visibleForRole(nav, currentRole);
  const items = currentRole === "DIPENDENTE"
    ? [
        ...baseItems.filter((item) => item.href !== "/notifications" && item.href !== "/tasks"),
        selectedServiceItem,
      ]
    : baseItems;
  const unreadNotifications = session?.user?.id
    ? await prisma.notification.count({ where: { user_id: session.user.id, read: false } })
    : 0;
  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, photo_url: true } })
    : null;
  const dateLabel = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  }).format(new Date());
  const mobileItems = currentRole === "DIPENDENTE"
    ? [
        items.find((item) => item.href === "/dashboard"),
        items.find((item) => item.href === "/my-shifts"),
        items.find((item) => item.href === "/requests"),
        selectedServiceItem,
        items.find((item) => item.href === "/profile"),
      ].filter(Boolean) as typeof items
    : [];

  const aside = (
      <aside className="z-30 w-full max-w-full border-b border-black/5 bg-[color:var(--sidebar)] px-4 py-3 xl:flex xl:h-dvh xl:flex-col xl:overflow-hidden xl:border-b-0 xl:border-r xl:px-5 xl:py-4">
        <div className="shrink-0 flex items-center justify-between xl:block">
          <Link href="/dashboard" className="sidebar-brand group flex items-center gap-3">
            <div className="grid size-11 place-items-center overflow-hidden rounded-2xl text-lg font-bold text-white shadow-soft transition-all duration-300 group-hover:scale-105 group-hover:shadow-luxury bg-transparent">
              <img src={branding.logo_url || "/logo.png"} alt="Paradise Beauty" className="size-full object-contain dark:invert" />
            </div>
            <div className="sidebar-label">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--sidebar-text)] transition-colors duration-300 group-hover:text-[#B85B68] dark:text-[color:var(--dark-sidebar-text)] dark:group-hover:text-paradise-pink">Paradise</p>
              <p className="sidebar-subtitle text-xs text-[color:var(--sidebar-text)] opacity-55 dark:text-[color:var(--dark-sidebar-text)]">Staff Hub</p>
            </div>
          </Link>
          {currentRole === "DIPENDENTE" ? (
            <InstantLink href="/notifications" className="sidebar-role relative inline-flex items-center gap-2 rounded-full bg-paradise-softPink px-3 py-1 text-xs font-semibold xl:mt-5 transition-transform duration-300 hover:scale-105">
              <Bell className="size-3.5" />
              Avvisi
              {unreadNotifications > 0 ? (
                <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-[#C66170] px-1.5 py-0.5 text-center text-[10px] font-bold text-white shadow-[0_0_8px_rgba(198,97,112,0.6)] animate-pulse-soft">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              ) : null}
            </InstantLink>
          ) : (
            <div className="flex items-center gap-3 xl:block">
              <div className="sidebar-role rounded-full bg-paradise-softPink px-3 py-1 text-xs font-semibold xl:mt-5 hidden xl:inline-block">
                {roleLabels[currentRole]}
              </div>
              <MobileMenuDrawer
                logoUrl={branding.logo_url}
                roleLabel={roleLabels[currentRole]}
                unreadNotifications={unreadNotifications}
                logoutButton={<LogoutButton />}
              >
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <InstantLink
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--sidebar-text)] dark:text-[color:var(--dark-sidebar-text)] hover:bg-paradise-nude dark:hover:bg-white/10 transition-all duration-200"
                      activeClassName="bg-paradise-softPink/60 text-[#C66170] font-bold dark:bg-white/20 dark:text-white"
                    >
                      <Icon className="size-4 text-[color:var(--sidebar-icon)] dark:text-[color:var(--dark-sidebar-icon)]" />
                      <span>{item.label}</span>
                      {item.href === "/notifications" && unreadNotifications > 0 ? (
                        <span className="ml-auto min-w-5 rounded-full bg-[#C66170] px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                          {unreadNotifications > 99 ? "99+" : unreadNotifications}
                        </span>
                      ) : null}
                    </InstantLink>
                  );
                })}
              </MobileMenuDrawer>
            </div>
          )}
        </div>
        <nav className="luxury-scroll mt-5 xl:min-h-0 xl:flex-1 xl:space-y-1 xl:overflow-x-hidden xl:overflow-y-auto hidden xl:block">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <InstantLink
                key={item.href}
                href={item.href}
                className="sidebar-nav-link flex shrink-0 items-center gap-3 rounded-l-none rounded-r-2xl border-l-4 border-transparent pl-3 pr-4 py-3 text-sm font-medium text-[color:var(--sidebar-text)] transition-all duration-300 hover:bg-paradise-nude dark:text-[color:var(--dark-sidebar-text)] dark:hover:bg-white/10 hover:border-l-paradise-pink/40"
                activeClassName="active bg-gradient-to-r from-paradise-pink/15 to-paradise-softPink/5 border-l-paradise-pink text-paradise-noir shadow-sm dark:from-paradise-pink/10 dark:to-transparent dark:border-paradise-pink dark:text-white"
              >
                <Icon className="size-4 text-[color:var(--sidebar-icon)] transition-colors duration-300 dark:text-[color:var(--dark-sidebar-icon)]" />
                <span className="sidebar-label transition-transform duration-300 hover:translate-x-0.5">{item.label}</span>
                {item.href === "/notifications" && unreadNotifications > 0 ? (
                  <span className="sidebar-badge ml-auto min-w-5 rounded-full bg-[#C66170] px-1.5 py-0.5 text-center text-[11px] font-bold text-white shadow-[0_0_8px_rgba(198,97,112,0.6)] animate-pulse-soft">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                ) : null}
              </InstantLink>
            );
          })}
        </nav>
        <div className="shrink-0 hidden xl:block">
          <LogoutButton />
        </div>
      </aside>
  );
 
  const main = (
      <main className={cn("w-full min-w-0 max-w-full overflow-x-hidden bg-[color:var(--background)] px-4 py-5 sm:px-6 xl:px-10 xl:py-8", currentRole === "DIPENDENTE" && "pb-28 xl:pb-8")}>
        <div className="mb-5 hidden justify-end xl:flex">
          <TopControls unread={unreadNotifications} name={currentUser?.name ?? session?.user?.name ?? "Paradise"} photoUrl={currentUser?.photo_url ?? null} />
        </div>
        {!hideHeader ? <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
          <span className="font-medium">Staff Hub v1.0.0</span>
        </footer>
      </main>
  );
 
  const mobileNav = currentRole === "DIPENDENTE" ? (
        <nav className="fixed inset-x-4 bottom-4 z-40 flex justify-around rounded-3xl border border-black/5 bg-white/80 px-2 py-2.5 shadow-luxury backdrop-blur-lg dark:border-white/10 dark:bg-black/75 xl:hidden">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <InstantLink
                key={item.href}
                href={item.href}
                className="relative flex min-w-14 flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[10px] font-semibold text-black/65 transition-all duration-300 active:scale-95 dark:text-white/70"
                activeClassName="bg-paradise-softPink/60 text-paradise-noir shadow-[0_0_12px_rgba(255,214,234,0.4)] dark:bg-white/20 dark:text-white"
              >
                <div className="relative">
                  <Icon className="size-5 transition-transform duration-300 hover:scale-110" />
                  {item.href === "/notifications" && unreadNotifications > 0 ? (
                    <span className="absolute -right-3 -top-2 min-w-4 rounded-full bg-[#C66170] px-1 text-center text-[10px] font-bold leading-4 text-white shadow-[0_0_6px_rgba(198,97,112,0.4)] animate-pulse-soft">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  ) : null}
                </div>
                {item.href === "/dashboard" ? "Home" : item.href === "/my-shifts" ? "Turni" : item.label}
              </InstantLink>
            );
          })}
        </nav>
      ) : null;

  return (
    <SidebarFrame
      aside={aside}
      main={<>{main}<NotificationWatcher initialUnread={unreadNotifications} /></>}
      mobileNav={mobileNav}
      style={brandingCss(branding)}
    />
  );
}
