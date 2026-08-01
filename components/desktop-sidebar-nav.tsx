"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
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
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
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
  const isItemActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const activeSectionId = sections.find((section) => section.items.some((item) => isItemActive(item.href)))?.id;

  useEffect(() => {
    setOpenSectionId((current) => current ?? activeSectionId ?? sections[0]?.id ?? null);
  }, [activeSectionId, sections]);

  return (
    <div className="flex h-full flex-col font-[family-name:var(--sidebar-font)] [--sidebar-icon:var(--dark-sidebar-icon)] [--sidebar-text:var(--dark-sidebar-text)]">
      {/* 🌸 BRAND LOGO */}
      <div className="flex items-center gap-3 px-3 py-3 shrink-0 mx-1">
        <div className="size-10 shrink-0 overflow-hidden rounded-full bg-white/8 flex items-center justify-center ring-1 ring-white/10">
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
          className="w-full rounded-xl border border-white/10 bg-white/[0.055] py-1.5 pl-9 pr-4 text-xs font-bold text-white outline-none placeholder:text-slate-500 focus:border-white/25 focus:bg-white/[0.075]"
        />
      </div>

      <nav className="no-scrollbar mt-4 flex-1 overflow-y-auto">
        <div className="space-y-5 px-1 pb-4">
          {sections.map((section) => (
            <div key={section.id} className="space-y-1.5">
              <button
                type="button"
                onClick={() => setOpenSectionId((current) => current === section.id ? null : section.id)}
                className="sidebar-label flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-1.5 text-left transition hover:bg-white/[0.055]"
              >
                <p className="truncate text-[9px] font-black uppercase tracking-[0.18em] text-[color:var(--sidebar-text)] opacity-40">
                  {section.title}
                </p>
                <ChevronDown className={cn("size-3.5 shrink-0 text-[color:var(--sidebar-text)] opacity-35 transition-transform", openSectionId === section.id && "rotate-180")} />
              </button>

              {openSectionId === section.id || searchQuery.trim() ? (
                <div className="space-y-1.5">
                  {section.items.map((item) => {
                    const isActive = isItemActive(item.href);
                    const displayLabel = getSidebarLabel(item.href, item.label);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={displayLabel}
                        className={cn(
                          "sidebar-nav-link group flex shrink-0 items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-[13px] font-bold tracking-tight transition-all duration-200",
                          isActive
                            ? "active border-white/12 bg-[color:var(--sidebar-active-bg)] text-[color:var(--sidebar-active-text)] shadow-none"
                            : "text-[color:var(--sidebar-text)] opacity-82 hover:bg-white/[0.065] hover:opacity-100"
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-xl transition",
                            isActive ? "bg-white/[0.12] text-[color:var(--sidebar-active-icon)]" : "bg-white/[0.055] text-[color:var(--sidebar-icon)] group-hover:bg-white/[0.08]"
                          )}
                        >
                          <DynamicIcon name={item.iconName} className="size-4 shrink-0" />
                        </span>
                        <span className="sidebar-label min-w-0 flex-1 truncate">{displayLabel}</span>

                        {item.href === "/notifications" && unreadNotifications > 0 ? (
                          <span className="sidebar-badge ml-auto min-w-5 rounded-full bg-[#C66170] px-1.5 py-0.5 text-center text-[10px] font-black text-white shadow-[0_0_8px_rgba(198,97,112,0.35)]">
                            {unreadNotifications > 99 ? "99+" : unreadNotifications}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}

          {sections.length === 0 ? (
            <div className="sidebar-label rounded-2xl border border-dashed border-black/10 px-3 py-4 text-center text-xs font-bold text-[color:var(--sidebar-text)] opacity-50">
              Nessuna pagina trovata.
            </div>
          ) : null}
        </div>
      </nav>
    </div>
  );
}
