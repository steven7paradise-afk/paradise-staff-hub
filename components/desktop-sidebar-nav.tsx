"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, Search, X } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";
import { DynamicIcon } from "./dynamic-icon";

type MenuItem = {
  href: string;
  label: string;
  iconName: string;
  section?: string;
};

type SidebarFolder = {
  id: string;
  title: string;
  routes: string[];
  labels?: Record<string, string>;
};

type DesktopSidebarNavProps = {
  logoUrl: string | null;
  userName: string;
  userPhoto: string | null;
  roleLabel: string;
  currentRole: string;
  unreadNotifications: number;
  items: MenuItem[];
  sidebarConfig: SidebarFolder[] | null;
};

export function DesktopSidebarNav({
  logoUrl,
  userName,
  userPhoto,
  roleLabel,
  currentRole,
  unreadNotifications,
  items,
  sidebarConfig,
}: DesktopSidebarNavProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const getSidebarLabel = (href: string, fallback: string) => {
    const folder = sidebarConfig?.find((sec) => sec.routes.includes(href));
    return folder?.labels?.[href] || fallback;
  };

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group items by Section or Config Folders
  const getRenderSections = () => {
    if (sidebarConfig && Array.isArray(sidebarConfig) && sidebarConfig.length > 0) {
      const renderedHrefs = new Set<string>();
      const sectionsToRender = sidebarConfig.map((sec) => {
        const matchedItems = filteredItems
          .filter((item) => {
            const match = sec.routes.includes(item.href);
            if (match) renderedHrefs.add(item.href);
            return match;
          })
          .sort((a, b) => sec.routes.indexOf(a.href) - sec.routes.indexOf(b.href));

        return {
          id: sec.id,
          title: sec.title,
          items: matchedItems,
        };
      });

      const unassignedItems = filteredItems.filter((item) => !renderedHrefs.has(item.href));

      return [
        ...sectionsToRender.filter((s) => s.items.length > 0),
        ...(unassignedItems.length > 0
          ? [{ id: "fallback-unassigned", title: "Altre Pagine", items: unassignedItems }]
          : []),
      ];
    }

    // Default grouping by item.section
    const sectionsMap: Record<string, MenuItem[]> = {};
    filteredItems.forEach((item) => {
      const sec = currentRole !== "DIPENDENTE" ? (item.section || "Generale") : "Generale";
      if (!sectionsMap[sec]) sectionsMap[sec] = [];
      sectionsMap[sec].push(item);
    });

    return Object.entries(sectionsMap).map(([title, sectionItems]) => ({
      id: title,
      title,
      items: sectionItems,
    }));
  };

  const sections = getRenderSections();
  const priorityRoutes = ["/dashboard", "/tasks", "/schedules", "/orders", "/appointments", "/cash", "/client-control", "/staff", "/requests", "/profile"];
  const quickItems = priorityRoutes
    .map((href) => items.find((item) => item.href === href))
    .filter((item): item is MenuItem => Boolean(item));
  const activeItem = items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const visibleQuickItems = activeItem && !quickItems.some((item) => item.href === activeItem.href)
    ? [activeItem, ...quickItems].slice(0, 9)
    : quickItems.slice(0, 9);

  return (
    <div className="flex flex-col h-full">
      {/* 🌸 BRAND LOGO */}
      <div className="flex items-center gap-3 px-3 py-3 shrink-0 mx-1">
        <div className="size-10 shrink-0 overflow-hidden rounded-full bg-transparent flex items-center justify-center">
          <img src={logoUrl || "/logo.png"} alt="Paradise Beauty" className="max-h-full w-auto object-contain dark:invert select-none pointer-events-none" />
        </div>
        <div className="sidebar-label text-left min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--sidebar-text)]">Paradise</p>
          <p className="text-[10px] text-[color:var(--sidebar-text)] opacity-55">Staff Hub</p>
        </div>
      </div>

      {/* 🔍 SEARCH FIELD */}
      <div className="relative mt-4 mx-1 sidebar-label shrink-0">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
          <Search size={13} className="opacity-75" />
        </span>
        <input
          type="text"
          placeholder="Cerca..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-xs font-bold text-[color:var(--sidebar-text)] rounded-xl py-1.5 pl-9 pr-4 focus:outline-none focus:border-black/15 placeholder-zinc-400 dark:placeholder-zinc-500"
        />
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        className="sidebar-label mt-4 mx-1 flex items-center gap-3 rounded-2xl bg-[#C66170] px-3.5 py-2.5 text-left text-[13px] font-black text-white shadow-sm transition hover:bg-[#A74758]"
      >
        <LayoutGrid className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">Menu completo</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{items.length}</span>
      </button>

      <nav className="no-scrollbar mt-4 flex-1 overflow-y-auto">
        <div className="space-y-1.5 px-1">
          <p className="sidebar-label px-3 text-[9px] font-black uppercase tracking-[0.18em] text-[color:var(--sidebar-text)] opacity-35">
            Accesso rapido
          </p>

          {(searchQuery.trim() ? filteredItems : visibleQuickItems).map((item) => {
              const isActive = pathname === item.href;
              const displayLabel = getSidebarLabel(item.href, item.label);
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={displayLabel}
                  className={cn(
                    "sidebar-nav-link flex shrink-0 items-center gap-3 rounded-l-none rounded-r-2xl border-l-4 border-transparent pl-3 pr-4 py-2.5 text-[13px] font-semibold tracking-tight transition-all duration-200",
                    isActive
                      ? "active bg-black/5 dark:bg-white/10 border-l-pink-500 text-[color:var(--sidebar-text)] shadow-xs"
                      : "text-[color:var(--sidebar-text)] opacity-75 hover:bg-black/5 dark:hover:bg-white/5 hover:text-[color:var(--sidebar-text)] hover:opacity-100"
                  )}
                >
                  <DynamicIcon
                    name={item.iconName}
                    className="size-4 shrink-0 text-[color:var(--sidebar-icon)] transition-colors duration-250"
                  />
                  <span className="sidebar-label transition-transform duration-200 hover:translate-x-0.5">
                    {displayLabel}
                  </span>

                  {item.href === "/notifications" && unreadNotifications > 0 ? (
                    <span className="sidebar-badge ml-auto min-w-5 rounded-full bg-[#C66170] px-1.5 py-0.5 text-center text-[10px] font-black text-white shadow-[0_0_8px_rgba(198,97,112,0.6)] animate-pulse-soft">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  ) : null}
                </Link>
              );
          })}
        </div>
      </nav>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 bg-black/35 p-6 backdrop-blur-sm" onClick={() => setMenuOpen(false)}>
          <div
            className="ml-[260px] flex max-h-[calc(100vh-48px)] max-w-5xl flex-col overflow-hidden rounded-[28px] border border-black/10 bg-white text-slate-950 shadow-2xl dark:bg-[#111827] dark:text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-black/10 px-6 py-5 dark:border-white/10">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#C66170]">Paradise Hub</p>
                <h2 className="mt-1 text-2xl font-black">Menu completo</h2>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white"
                aria-label="Chiudi menu completo"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="no-scrollbar grid flex-1 gap-4 overflow-y-auto p-6 md:grid-cols-2 xl:grid-cols-3">
              {sections.map((section) => (
                <div key={section.id} className="rounded-3xl border border-black/5 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black">{section.title}</h3>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-500 dark:bg-black/20 dark:text-white/60">{section.items.length}</span>
                  </div>
                  <div className="mt-3 space-y-1">
                    {section.items.map((item) => {
                      const displayLabel = getSidebarLabel(item.href, item.label);
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-bold transition",
                            isActive ? "bg-[#C66170] text-white" : "text-slate-650 hover:bg-white hover:text-slate-950 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                          )}
                        >
                          <DynamicIcon name={item.iconName} className="size-4 shrink-0" />
                          <span className="truncate">{displayLabel}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
