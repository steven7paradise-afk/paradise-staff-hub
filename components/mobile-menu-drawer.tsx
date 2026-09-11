"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BriefcaseBusiness, Search, ChevronDown, Menu, UserRound, X } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";
import { DynamicIcon } from "./dynamic-icon";
import { ThemeToggleButton } from "./top-controls";

type MobileMenuDrawerProps = {
  logoUrl?: string | null;
  userName: string;
  userPhoto?: string | null;
  roleLabel: string;
  unreadNotifications: number;
  colleagues?: Array<{ id: string; name: string; photo_url: string | null }>;
  items: Array<{ href: string; label: string; iconName: string; section?: string; badge?: number }>;
  sidebarConfig?: Array<{ id: string; title: string; routes: string[]; labels?: Record<string, string>; area?: "LAVORO" | "PERSONALE" }> | null;
  logoutButton: ReactNode;
  homeHref?: string;
  profileHref?: string;
};

export function MobileMenuDrawer({
  logoUrl,
  userName,
  userPhoto,
  roleLabel,
  unreadNotifications,
  colleagues = [],
  items,
  sidebarConfig = null,
  logoutButton,
  homeHref = "/dashboard",
  profileHref = "/profile",
}: MobileMenuDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [activeArea, setActiveArea] = useState<"LAVORO" | "PERSONALE">("LAVORO");
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  function openDrawer() {
    setIsOpen(true);
  }

  const getSidebarLabel = (href: string, fallback: string) => {
    const folder = sidebarConfig?.find((sec) => sec.routes.includes(href));
    return folder?.labels?.[href] || fallback;
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) =>
    getSidebarLabel(item.href, item.label).toLowerCase().includes(normalizedSearch)
  );
  const hasAreaSwitch = sidebarConfig !== null
    && !sidebarConfig.some((folder) => folder.id === "pc-cassa" || folder.id === "ex-dipendente");
  const activePageArea = sidebarConfig?.find((folder) =>
    folder.routes.some((href) => pathname === href || pathname.startsWith(`${href}/`))
  )?.area ?? "LAVORO";

  const getRenderSections = () => {
    if (sidebarConfig !== null) {
      const configured = sidebarConfig
        .filter((sec) => !hasAreaSwitch || (sec.area ?? "LAVORO") === activeArea)
        .map((sec) => {
        const sectionItems = filteredItems
          .filter((item) => sec.routes.includes(item.href))
          .sort((a, b) => sec.routes.indexOf(a.href) - sec.routes.indexOf(b.href));
        return { id: sec.id, title: sec.title, items: sectionItems };
      });
      return configured.filter((section) => section.items.length > 0);
    }

    const grouped: Record<string, typeof filteredItems> = {};
    filteredItems.forEach((item) => {
      const section = item.section || "Generale";
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(item);
    });
    return Object.entries(grouped).map(([title, sectionItems]) => ({ id: title, title, items: sectionItems }));
  };

  const sections = getRenderSections();
  const isItemActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const activeSectionId = sections.find((section) => section.items.some((item) => isItemActive(item.href)))?.id;

  useEffect(() => {
    if (hasAreaSwitch) setActiveArea(activePageArea);
  }, [activePageArea, hasAreaSwitch, pathname]);

  useEffect(() => {
    if (!isOpen) return;
    if (activeSectionId) {
      setOpenSectionId(activeSectionId);
      return;
    }
    setOpenSectionId((current) => sections.some((section) => section.id === current) ? current : sections[0]?.id ?? null);
  }, [activeArea, activeSectionId, isOpen, pathname]);

  return (
    <div className="xl:hidden">
      <div className="fixed inset-x-0 top-0 z-40 bg-[color:var(--user-background-color,var(--background))]">
        <div className="flex min-h-[calc(env(safe-area-inset-top)+76px)] items-end gap-3 border-b border-black/[0.06] bg-white px-5 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] dark:border-white/[0.08] dark:bg-[#171719]">
          <Link href={homeHref} className="flex min-w-0 items-center gap-3" aria-label="Vai alla dashboard">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden">
              <img src="/favicon.png" alt="" className="size-10 rounded-xl object-contain" aria-hidden="true" />
            </span>
            <span className="hidden min-w-0 text-left min-[380px]:block">
              <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-black/85 dark:text-white">Paradise</span>
              <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.14em] text-black/40 dark:text-white/45">Staff Hub</span>
            </span>
          </Link>
          <span className="min-w-0 flex-1" aria-hidden="true" />
          <div className="relative size-11 shrink-0">
            <Link href={profileHref} className="block size-11 overflow-hidden rounded-full border border-black/10 bg-[#f8edf2] dark:border-white/15" aria-label={`Apri il profilo di ${userName}`}>
              {userPhoto ? <img src={resolveDrivePhotoUrl(userPhoto)} alt={userName} className="size-full object-cover" /> : <span className="grid size-full place-items-center text-xs font-black text-[#8c3f60]">{userName.slice(0, 2).toUpperCase()}</span>}
            </Link>
            <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-400 dark:border-[#1d1d22]" aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={openDrawer}
            className="relative grid size-11 shrink-0 place-items-center rounded-2xl text-black transition hover:bg-black/[0.05] active:scale-95 dark:text-white dark:hover:bg-white/10"
            aria-label="Apri menu"
          >
            <Menu className="size-5" />
            {unreadNotifications > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C66170] opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-[#C66170]" />
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Overlay backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsOpen(false)}
      />

      <div
        className={cn(
          "mobile-liquid-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(88vw,332px)] flex-col justify-between overflow-hidden rounded-r-[26px] border-r p-3.5 pb-[max(.875rem,env(safe-area-inset-bottom))] pt-[max(.875rem,env(safe-area-inset-top))] font-[family-name:var(--sidebar-font)] transition-[transform,box-shadow] duration-300 ease-out will-change-transform sm:p-4",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          
          {/* Stessa identità visiva della sidebar desktop */}
          <div className="mobile-sidebar-divider relative flex items-center justify-between border-b px-1 pb-4">
            <Link href={homeHref} onClick={() => setIsOpen(false)} className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-20 shrink-0 items-center overflow-hidden">
                <img src={logoUrl || "/logo.png"} alt="Paradise Beauty" className="max-h-10 w-full object-contain object-left dark:invert" />
              </span>
              <span className="min-w-0 text-left">
                <span className="mobile-sidebar-text block truncate text-[11px] font-black uppercase tracking-[0.16em]">Staff Hub</span>
                <span className="mobile-sidebar-muted mt-0.5 block truncate text-[9px] font-medium">Area operativa</span>
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="mobile-sidebar-close grid size-10 shrink-0 place-items-center rounded-xl border transition active:scale-95"
              aria-label="Chiudi menu"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="relative mt-3">
            <span className="mobile-sidebar-icon pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 opacity-65">
              <Search size={17} />
            </span>
            <input
              type="text"
              placeholder="Cerca pagina..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mobile-sidebar-search h-11 w-full rounded-xl border py-2 pl-10 pr-10 text-sm font-semibold outline-none transition"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mobile-sidebar-icon absolute inset-y-0 right-0 grid w-11 place-items-center opacity-65 transition hover:opacity-100"
                aria-label="Cancella ricerca"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {hasAreaSwitch ? (
            <div className="mobile-sidebar-area-switch mt-2.5 grid grid-cols-2 rounded-xl border p-1">
              {(["PERSONALE", "LAVORO"] as const).map((area) => {
                const selected = activeArea === area;
                const Icon = area === "PERSONALE" ? UserRound : BriefcaseBusiness;
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setActiveArea(area)}
                    aria-pressed={selected}
                    className={cn(
                      "mobile-sidebar-area-button flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-[9px] font-black uppercase tracking-[0.11em] transition",
                      selected && "is-active",
                    )}
                  >
                    <Icon className="size-4" />
                    {area === "PERSONALE" ? "Personale" : "Lavoro"}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Main Navigation links */}
          <div className="no-scrollbar mt-3 flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-3 pb-3">
              {sections.map((section) => (
                <div key={section.id}>
                  {section.title ? (
                    <button
                      type="button"
                      onClick={() => setOpenSectionId((current) => current === section.id ? null : section.id)}
                      className="mobile-sidebar-section mb-0.5 flex min-h-9 w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition"
                      aria-expanded={openSectionId === section.id}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.18em]">{section.title}</p>
                      <ChevronDown className={cn("size-4 transition-transform", openSectionId === section.id && "rotate-180")} />
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
                            onClick={() => setIsOpen(false)}
                            className={cn(
                            "mobile-sidebar-link relative flex min-h-11 items-center justify-between gap-2.5 rounded-xl border border-transparent px-2 py-1.5 text-[13px] font-bold tracking-tight transition",
                            isActive
                              ? "active shadow-none"
                              : ""
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                              <span className={cn("mobile-sidebar-link-icon grid size-7 shrink-0 place-items-center", isActive && "active")}>
                                <DynamicIcon name={item.iconName} className="size-4 shrink-0" />
                              </span>
                              <span className="truncate">{displayLabel}</span>
                            </div>

                            {item.href === "/requests" || itemBadge > 0 ? (
                              <span className="grid min-w-7 shrink-0 place-items-center rounded-full bg-red-500 px-2 py-1 text-xs font-black text-white shadow-[0_0_14px_rgba(239,68,68,0.45)]">
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
                <div className="mobile-sidebar-muted rounded-2xl border border-dashed px-3 py-4 text-center text-xs font-bold">
                  Nessuna pagina trovata.
                </div>
              ) : null}
            </div>
          </div>

          {/* Navigation lists directly end here */}
        </div>

        <div className="mobile-sidebar-divider mobile-sidebar-footer relative mt-2 shrink-0 border-t pt-2.5">
          <div className="mb-1.5 flex items-stretch gap-2">
            <Link href={profileHref} onClick={() => setIsOpen(false)} className="mobile-sidebar-profile flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-2.5 py-1.5 transition active:scale-[0.99]">
              <span className="mobile-sidebar-avatar relative size-9 shrink-0 overflow-visible rounded-full border">
                <span className="block size-full overflow-hidden rounded-full">
                  {userPhoto ? (
                    <img src={resolveDrivePhotoUrl(userPhoto)} alt={userName} className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-[11px] font-black">{userName.slice(0, 2).toUpperCase()}</span>
                  )}
                </span>
                <span className="mobile-sidebar-status absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 ring-2" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="mobile-sidebar-text block truncate text-xs font-black">{userName}</span>
                <span className="mobile-sidebar-muted mt-0.5 block truncate text-[9px] font-bold uppercase tracking-[0.12em]">{roleLabel}</span>
              </span>
            </Link>
            <ThemeToggleButton className="mobile-sidebar-theme grid w-12 shrink-0 place-items-center rounded-xl border transition active:scale-95" />
          </div>
          {logoutButton}
        </div>
      </div>
    </div>
  );
}
