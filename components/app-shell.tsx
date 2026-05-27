import Link from "next/link";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  Calculator,
  Download,
  FileText,
  Building2,
  LayoutDashboard,
  Mail,
  Palette,
  Settings,
  ShieldCheck,
  Smartphone,
  Table2,
  UserRound,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { brandingCss, getBrandingTheme } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import { roleLabels, visibleForRole, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"] },
  { href: "/my-shifts", label: "I miei turni", icon: CalendarDays, roles: ["DIPENDENTE"] },
  { href: "/employees", label: "Dipendenti", icon: Users, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/attendance", label: "Timbrature", icon: CalendarCheck, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"] },
  { href: "/work-hours", label: "Ore staff", icon: Calculator, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/schedules", label: "Planning", icon: CalendarDays, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"] },
  { href: "/locations", label: "Saloni", icon: Building2, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"] },
  { href: "/tablet-clock", label: "Tablet Clock", icon: Smartphone, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"] },
  { href: "/requests", label: "Ferie e permessi", icon: ShieldCheck, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"] },
  { href: "/documents", label: "Documenti", icon: FileText, roles: ["SUPER_ADMIN", "ADMIN", "DIPENDENTE"] },
  { href: "/notifications", label: "Comunicazioni", icon: Bell, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"] },
  { href: "/profile", label: "Profilo", icon: UserRound, roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"] },
  { href: "/settings", label: "Impostazioni", icon: Settings, roles: ["SUPER_ADMIN"] },
] satisfies { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: Role[] }[];

const settingsNav = [
  { href: "/settings/branding", label: "Branding", icon: Palette },
  { href: "/settings/devices", label: "Dispositivi", icon: Smartphone },
  { href: "/settings/google-sheet", label: "Google Sheet", icon: Table2 },
  { href: "/settings/email", label: "Email", icon: Mail },
  { href: "/settings/roles", label: "Ruoli", icon: ShieldCheck },
  { href: "/settings/app", label: "App Android", icon: Download },
];

export async function AppShell({ children, title, subtitle, role }: { children: React.ReactNode; title: string; subtitle?: string; role?: Role }) {
  const [session, branding] = await Promise.all([auth(), getBrandingTheme()]);
  const currentRole = (role ?? session?.user?.role ?? "DIPENDENTE") as Role;
  const items = visibleForRole(nav, currentRole);
  const unreadNotifications = session?.user?.id
    ? await prisma.notification.count({ where: { user_id: session.user.id, read: false } })
    : 0;
  const dateLabel = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  }).format(new Date());

  return (
    <div className="min-h-screen overflow-x-hidden xl:grid xl:grid-cols-[280px_1fr]" style={brandingCss(branding)}>
      <aside className="sticky top-0 z-30 w-full max-w-full border-b border-black/5 bg-[color:var(--sidebar)] px-4 py-3 xl:h-screen xl:border-b-0 xl:border-r xl:px-5 xl:py-4">
        <div className="flex items-center justify-between xl:block">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="grid size-11 place-items-center overflow-hidden rounded-2xl bg-paradise-noir text-lg font-bold text-white shadow-soft">
              {branding.logo_url ? <img src={branding.logo_url} alt="Paradise Beauty" className="size-full object-cover" /> : "P"}
            </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em]">Paradise</p>
            <p className="text-xs text-black/50 dark:text-white/50">Staff Hub</p>
            </div>
          </Link>
          <div className="rounded-full bg-paradise-softPink px-3 py-1 text-xs font-semibold xl:mt-5 xl:inline-block">
            {roleLabels[currentRole]}
          </div>
        </div>
        <nav className={cn("luxury-scroll mt-5 gap-2 overflow-x-auto pb-2 xl:block xl:space-y-1 xl:overflow-visible", currentRole === "DIPENDENTE" ? "hidden xl:block" : "flex")}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex shrink-0 items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-black/68 transition hover:bg-paradise-nude hover:text-paradise-noir dark:text-white/70 dark:hover:bg-white/10"
              >
                <Icon className="size-4" />
                {item.label}
                {item.href === "/notifications" && unreadNotifications > 0 ? (
                  <span className="ml-auto min-w-5 rounded-full bg-[#C66170] px-1.5 py-0.5 text-center text-[11px] font-bold text-white">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className={cn(currentRole === "DIPENDENTE" && "hidden xl:block")}>
          <LogoutButton />
        </div>
        {currentRole === "SUPER_ADMIN" ? (
          <div className="mt-8 hidden xl:block">
            <p className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.16em] text-black/35">Sistema</p>
            <div className="space-y-1">
              {settingsNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-black/58 hover:bg-white dark:text-white/60">
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </aside>
      <main className={cn("w-full min-w-0 max-w-full overflow-x-hidden px-4 py-5 sm:px-6 xl:px-10 xl:py-8", currentRole === "DIPENDENTE" && "pb-24 xl:pb-8")}>
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={cn("text-sm font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/40", currentRole === "DIPENDENTE" && "hidden sm:block")}>Paradise Beauty</p>
            <h1 className={cn("mt-2 font-semibold tracking-tight text-[color:var(--text)]", currentRole === "DIPENDENTE" ? "text-3xl sm:text-4xl" : "text-3xl sm:text-4xl")}>{title}</h1>
            {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55 dark:text-white/55">{subtitle}</p> : null}
          </div>
          <div className={cn("rounded-full border border-black/5 bg-white px-4 py-2 text-sm shadow-sm", "dark:border-white/10 dark:bg-white/10", currentRole === "DIPENDENTE" && "hidden sm:block")}>
            {dateLabel}
          </div>
        </header>
        {children}
      </main>
      {currentRole === "DIPENDENTE" ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-black/5 bg-white px-2 py-2 xl:hidden">
          {items.filter((item) => ["/dashboard", "/my-shifts", "/requests", "/notifications", "/profile"].includes(item.href)).map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="relative flex min-w-14 flex-col items-center gap-1 px-1 py-1 text-[10px] font-medium text-black/65">
                <div className="relative">
                  <Icon className="size-5" />
                  {item.href === "/notifications" && unreadNotifications > 0 ? (
                    <span className="absolute -right-3 -top-2 min-w-4 rounded-full bg-[#C66170] px-1 text-center text-[10px] font-bold leading-4 text-white">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  ) : null}
                </div>
                {item.href === "/dashboard" ? "Home" : item.href === "/my-shifts" ? "Turni" : item.href === "/notifications" ? "Avvisi" : item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
