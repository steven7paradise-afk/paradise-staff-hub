"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search, MapPin, Bell } from "lucide-react";
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
  userName: string;
  userPhoto: string | null;
  roleLabel: string;
  currentRole: string;
  unreadNotifications: number;
  items: MenuItem[];
  sidebarConfig: SidebarFolder[] | null;
};

export function DesktopSidebarNav({
  userName,
  userPhoto,
  roleLabel,
  currentRole,
  unreadNotifications,
  items,
  sidebarConfig,
}: DesktopSidebarNavProps) {
  const [searchQuery, setSearchQuery] = useState("");
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

  return (
    <div className="flex flex-col h-full">
      {/* 👤 LUXURY USER PROFILE CARD (TOP OF SIDEBAR) */}
      <div className="sidebar-profile-card flex items-center gap-3 px-3 py-3.5 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 shrink-0 mx-1">
        <div className="relative shrink-0 select-none">
          <div className="size-10 overflow-hidden rounded-full border border-black/5 dark:border-white/10 bg-zinc-100 flex items-center justify-center text-xs font-black text-zinc-800 shadow-xs">
            {userPhoto ? (
              <img
                src={resolveDrivePhotoUrl(userPhoto)}
                alt={userName}
                className="size-full object-cover rounded-full select-none pointer-events-none"
              />
            ) : (
              userName.slice(0, 2).toUpperCase()
            )}
          </div>
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900" />
        </div>

        <div className="sidebar-label text-left min-w-0 flex-1">
          <p className="truncate text-xs font-black uppercase tracking-wide text-[color:var(--sidebar-text)] leading-tight">
            {userName}
          </p>
          <p className="text-[9px] font-black text-[#B85B68] dark:text-paradise-pink uppercase tracking-wider mt-0.5">
            {roleLabel}
          </p>
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

      {/* 🗺️ SCROLLABLE NAVIGATION LINKS */}
      <nav className="no-scrollbar mt-4 flex-1 space-y-4 overflow-y-auto">
        {sections.map((sec) => (
          <div key={sec.id} className="space-y-0.5">
            <div className="sidebar-section-header mb-1.5 px-3.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--sidebar-text)] opacity-40 sidebar-label select-none">
              {sec.title}
            </div>

            {sec.items.map((item) => {
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
        ))}
      </nav>
    </div>
  );
}
