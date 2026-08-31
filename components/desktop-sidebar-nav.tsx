"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Search, X } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";
import { DynamicIcon } from "./dynamic-icon";

type MenuItem = {
  href: string;
  label: string;
  iconName: string;
  section?: string;
  badge?: number;
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

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) =>
    getSidebarLabel(item.href, item.label).toLowerCase().includes(normalizedSearch)
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
    if (activeSectionId) {
      setOpenSectionId(activeSectionId);
      return;
    }
    setOpenSectionId((current) => current ?? sections[0]?.id ?? null);
  }, [activeSectionId, pathname]);

  return (
    <div className="app-liquid-sidebar-nav flex h-full flex-col font-[family-name:var(--sidebar-font)]">
      <div className="sidebar-brand mx-1 flex shrink-0 items-center gap-3 border-b border-white/10 px-2 pb-5 pt-2">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/8">
          <img src={logoUrl || "/logo.png"} alt="Paradise Beauty" className="max-h-full w-auto object-contain dark:invert select-none pointer-events-none" />
        </div>
        <div className="sidebar-label text-left min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--sidebar-text)]">Paradise</p>
          <p className="text-[10px] text-[color:var(--sidebar-text)] opacity-55">Staff Hub</p>
        </div>
      </div>

      <div className="sidebar-label relative mx-1 mt-4 shrink-0">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
          <Search size={13} className="opacity-75" />
        </span>
        <input
          type="text"
          placeholder="Cerca una pagina"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-11 w-full rounded-xl border border-white/12 bg-white/[0.07] py-2 pl-9 pr-11 text-xs font-bold text-white outline-none backdrop-blur-xl transition placeholder:text-slate-400 focus:border-white/30 focus:bg-white/[0.11]"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-white/55 transition hover:text-white"
            aria-label="Cancella ricerca"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <nav className="no-scrollbar mt-4 flex-1 overflow-y-auto" aria-label="Navigazione principale">
        <div className="space-y-4 px-1 pb-4">
          {sections.map((section) => (
            <div key={section.id} className="space-y-1">
              {section.title ? (
                <button
                  type="button"
                  onClick={() => setOpenSectionId((current) => current === section.id ? null : section.id)}
                  className="sidebar-label flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.075]"
                  aria-expanded={openSectionId === section.id}
                >
                  <p className="truncate text-[9px] font-black uppercase tracking-[0.18em] text-[color:var(--sidebar-text)] opacity-40">
                    {section.title}
                  </p>
                  <ChevronDown className={cn("size-3.5 shrink-0 text-[color:var(--sidebar-text)] opacity-35 transition-transform", openSectionId === section.id && "rotate-180")} />
                </button>
              ) : null}

              {openSectionId === section.id || !section.title || searchQuery.trim() ? (
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = isItemActive(item.href);
                    const displayLabel = getSidebarLabel(item.href, item.label);
                    const itemBadge = item.href === "/notifications" ? unreadNotifications : item.badge ?? 0;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={displayLabel}
                        className={cn(
                          "sidebar-nav-link group relative flex min-h-11 shrink-0 items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-[13px] font-bold tracking-tight transition-all duration-200",
                          isActive
                            ? "active border-white/12 bg-[color:var(--sidebar-active-bg)] text-[color:var(--sidebar-active-text)] shadow-none"
                            : "text-[color:var(--sidebar-text)] opacity-82 hover:bg-white/[0.065] hover:opacity-100"
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-md transition",
                            isActive ? "bg-white/[0.12] text-[color:var(--sidebar-active-icon)]" : "text-[color:var(--sidebar-icon)] group-hover:bg-white/[0.06]"
                          )}
                        >
                          <DynamicIcon name={item.iconName} className="size-4 shrink-0" />
                        </span>
                        <span className="sidebar-label min-w-0 flex-1 truncate">{displayLabel}</span>

                        {itemBadge > 0 ? (
                          <span className="sidebar-badge ml-auto min-w-5 rounded-full bg-[#C66170] px-1.5 py-0.5 text-center text-[10px] font-black text-white shadow-[0_0_8px_rgba(198,97,112,0.35)]">
                            {itemBadge > 99 ? "99+" : itemBadge}
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
            <div className="sidebar-label rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs font-bold text-[color:var(--sidebar-text)] opacity-50">
              Nessuna pagina trovata.
            </div>
          ) : null}
        </div>
      </nav>

      <Link
        href="/profile"
        title={`${userName} - ${roleLabel}`}
        className="sidebar-profile mx-1 mt-2 flex shrink-0 items-center gap-3 border-t border-white/10 px-2 pt-4 text-[color:var(--sidebar-text)] transition hover:opacity-80"
      >
        <span className="relative size-9 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/10">
          {userPhoto ? (
            <img src={resolveDrivePhotoUrl(userPhoto)} alt={userName} className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-[11px] font-black">
              {userName.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-[color:var(--user-sidebar-color,var(--sidebar))] bg-emerald-400" />
        </span>
        <span className="sidebar-label min-w-0 text-left">
          <span className="block truncate text-xs font-black">{userName}</span>
          <span className="sidebar-role mt-0.5 block truncate text-[9px] font-bold uppercase tracking-[0.15em] opacity-50">{roleLabel}</span>
        </span>
      </Link>
    </div>
  );
}
