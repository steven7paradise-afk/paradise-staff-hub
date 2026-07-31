"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
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
  const [selectedSectionId, setSelectedSectionId] = useState("");
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
  const activeSection = sections.find((section) =>
    section.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  );
  const selectedSection = sections.find((section) => section.id === selectedSectionId) || activeSection || sections[0];
  const isSearching = searchQuery.trim().length > 0;

  useEffect(() => {
    if (!selectedSectionId && activeSection?.id) {
      setSelectedSectionId(activeSection.id);
    }
  }, [activeSection?.id, selectedSectionId]);

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

      {/* 🗺️ Professional two-level navigation */}
      <nav className="no-scrollbar mt-4 flex-1 overflow-y-auto">
        {!isSearching ? (
          <div className="space-y-1.5 px-1">
            <p className="sidebar-label px-3 text-[9px] font-black uppercase tracking-[0.18em] text-[color:var(--sidebar-text)] opacity-35">
              Menu
            </p>
            {sections.map((section) => {
              const isSelected = selectedSection?.id === section.id;
              const hasActiveItem = section.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setSelectedSectionId(section.id)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[13px] font-black tracking-tight text-[color:var(--sidebar-text)] transition",
                    isSelected
                      ? "bg-black/8 opacity-100 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:bg-white/10"
                      : "opacity-65 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5"
                  )}
                >
                  <span className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-xl text-[10px] font-black",
                    isSelected || hasActiveItem ? "bg-[#C66170] text-white" : "bg-black/5 text-[color:var(--sidebar-text)] dark:bg-white/10"
                  )}>
                    {section.title.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="sidebar-label min-w-0 flex-1 truncate">{section.title}</span>
                  <span className="sidebar-label rounded-full bg-black/5 px-2 py-0.5 text-[10px] opacity-70 dark:bg-white/10">{section.items.length}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-5 space-y-1.5 px-1">
          <p className="sidebar-label px-3 text-[9px] font-black uppercase tracking-[0.18em] text-[color:var(--sidebar-text)] opacity-35">
            {isSearching ? "Risultati" : selectedSection?.title || "Pagine"}
          </p>

          {(isSearching ? filteredItems : selectedSection?.items || []).map((item) => {
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
    </div>
  );
}
