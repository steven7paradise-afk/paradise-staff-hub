"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BriefcaseBusiness, Search, ChevronDown, Menu, UserRound, X } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";
import { DynamicIcon } from "./dynamic-icon";
import { ThemeToggleButton } from "./top-controls";
import { LogoutButton } from "./logout-button";
import brandStyles from "./direction-sidebar.module.css";
import styles from "./staff-mobile-sidebar.module.css";

type MobileMenuDrawerProps = {
  logoUrl?: string | null;
  userName: string;
  userPhoto?: string | null;
  roleLabel: string;
  unreadNotifications: number;
  colleagues?: Array<{ id: string; name: string; photo_url: string | null }>;
  items: Array<{ href: string; label: string; iconName: string; section?: string; badge?: number }>;
  sidebarConfig?: Array<{ id: string; title: string; routes: string[]; labels?: Record<string, string>; area?: "LAVORO" | "PERSONALE" }> | null;
  logoutRedirectTo?: string;
  logoutSkipSignOut?: boolean;
  logoutLabel?: string;
  homeHref?: string;
  profileHref?: string;
  directionSidebar?: boolean;
};

export function MobileMenuDrawer({
  logoUrl,
  userName,
  userPhoto,
  roleLabel,
  unreadNotifications,
  items,
  sidebarConfig = null,
  logoutRedirectTo,
  logoutSkipSignOut = false,
  logoutLabel = "Esci",
  homeHref = "/dashboard",
  profileHref = "/profile",
  directionSidebar = false,
}: MobileMenuDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [activeArea, setActiveArea] = useState<"LAVORO" | "PERSONALE">("LAVORO");
  const pathname = usePathname();
  const drawerId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const drawer = panel.current;
    const opener = trigger.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus({ preventScroll: true });

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawer) return;
      const controls = Array.from(drawer.querySelectorAll<HTMLElement>("a[href], button, input"))
        .filter((item) => item.tabIndex >= 0 && !item.matches(":disabled") && item.getClientRects().length > 0);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      const focusOutside = !drawer.contains(document.activeElement);
      if (focusOutside || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }

    const desktop = window.matchMedia("(min-width: 1280px)");
    const closeOnDesktop = () => { if (desktop.matches) setIsOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
      document.removeEventListener("keydown", handleKey);
      if (opener?.getClientRects().length) opener.focus({ preventScroll: true });
    };
  }, [isOpen]);

  function openDrawer() {
    setSearchQuery("");
    setIsOpen(true);
  }

  function handlePcProfileChoice(event: React.MouseEvent<HTMLElement>) {
    if (!logoutSkipSignOut || !pathname?.startsWith("/appointments")) return;
    event.preventDefault();
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent("appointments:choose-profile"));
  }

  const getSidebarLabel = (href: string, fallback: string) => {
    const folder = sidebarConfig?.find((sec) => sec.routes.includes(href));
    return folder?.labels?.[href] || fallback;
  };

  const normalize = (value: string) => value.trim().toLocaleLowerCase("it").normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const normalizedSearch = normalize(searchQuery);
  const filteredItems = items.filter((item) =>
    normalize(`${getSidebarLabel(item.href, item.label)} ${item.label}`).includes(normalizedSearch)
  );
  const hasAreaSwitch = sidebarConfig !== null
    && !sidebarConfig.some((folder) => folder.id === "pc-cassa" || folder.id === "ex-dipendente");
  const activeHref = items.reduce<string>((active, item) => {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const visible = sidebarConfig === null || sidebarConfig.some((folder) => folder.routes.includes(item.href));
    return matches && visible && item.href.length > active.length ? item.href : active;
  }, "");
  const activePageArea = sidebarConfig?.find((folder) => folder.routes.includes(activeHref))?.area ?? "LAVORO";

  const getRenderSections = () => {
    if (sidebarConfig !== null) {
      const configured = sidebarConfig
        .filter((sec) => normalizedSearch || !hasAreaSwitch || (sec.area ?? "LAVORO") === activeArea)
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
  const isItemActive = (href: string) => href === activeHref;
  const currentSectionId = sections.find((section) => section.items.some((item) => isItemActive(item.href)))?.id ?? sections[0]?.id ?? null;

  useEffect(() => {
    if (hasAreaSwitch) setActiveArea(activePageArea);
  }, [activePageArea, hasAreaSwitch, pathname]);

  useEffect(() => {
    if (isOpen) setOpenSectionId(currentSectionId);
  }, [activeArea, currentSectionId, isOpen, pathname]);

  return (
    <div className="xl:hidden">
      <div className="fixed inset-x-0 top-0 z-40 bg-[color:var(--user-background-color,var(--background))]">
        <div className={cn("flex min-h-[calc(env(safe-area-inset-top)+76px)] items-end gap-3 border-b border-black/[0.06] bg-white px-5 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] dark:border-white/[0.08] dark:bg-[#171719]", directionSidebar && styles.header)}>
          <Link href={homeHref} className="flex min-w-0 items-center gap-3" aria-label="Paradise Staff Hub">
            <span className={cn("grid size-10 shrink-0 place-items-center overflow-hidden", directionSidebar && brandStyles.mobileMonogram)}>
              <img src={directionSidebar ? "/paradise-sidebar-monogram.png" : "/favicon.png"} alt="" className="size-full rounded-xl object-contain" aria-hidden="true" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold leading-tight text-[#28151e] dark:text-white">Paradise</span>
              <span className="mt-0.5 block truncate text-xs leading-tight text-[#725a67] dark:text-[#d5bbc8]">Staff Hub</span>
            </span>
          </Link>
          <span className="min-w-0 flex-1" aria-hidden="true" />
          <div className="relative size-11 shrink-0">
            <Link href={profileHref} onClick={handlePcProfileChoice} className="block size-11 overflow-hidden rounded-full border border-black/10 bg-[#f8edf2] dark:border-white/15" aria-label={logoutSkipSignOut ? "Cambia profilo" : `Apri il profilo di ${userName}`}>
              {userPhoto ? <img src={resolveDrivePhotoUrl(userPhoto)} alt={userName} className="size-full object-cover" /> : <span className="grid size-full place-items-center text-xs font-black text-[#8c3f60]">{userName.slice(0, 2).toUpperCase()}</span>}
            </Link>
            <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-400 dark:border-[#1d1d22]" aria-hidden="true" />
          </div>
          <button
            type="button"
            ref={trigger}
            onClick={openDrawer}
            className={cn("relative grid size-11 shrink-0 place-items-center rounded-xl text-black transition-colors hover:bg-black/[0.05] dark:text-white dark:hover:bg-white/10", directionSidebar && styles.trigger)}
            aria-label="Apri menu"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-controls={drawerId}
          >
            <Menu className="size-5" aria-hidden="true" />
            {unreadNotifications > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex size-2.5">
                <span aria-hidden="true" className="relative inline-flex size-2.5 rounded-full bg-[#ac4269]" />
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Overlay backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-[#180d14]/60 transition-opacity duration-200 motion-reduce:transition-none",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <div
        ref={panel}
        id={drawerId}
        role="dialog"
        aria-modal={isOpen || undefined}
        aria-label="Menu Staff Hub"
        className={cn(
          "mobile-liquid-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(88vw,332px)] flex-col justify-between overflow-hidden rounded-r-[26px] border-r p-3.5 pb-[max(.875rem,env(safe-area-inset-bottom))] pt-[max(.875rem,env(safe-area-inset-top))] font-[family-name:var(--sidebar-font)] transition-[transform,box-shadow] duration-200 ease-out motion-reduce:transition-none sm:px-4",
          directionSidebar && styles.drawer,
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        inert={!isOpen}
        aria-hidden={!isOpen}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mobile-sidebar-divider relative flex items-center justify-between gap-2 border-b px-1 pb-4">
            <Link href={homeHref} onClick={() => setIsOpen(false)} className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-[92px] shrink-0 items-center">
                <img
                  src={directionSidebar ? "/paradise-logo-sidebar.png" : logoUrl || "/logo.png"}
                  alt="Paradise Beauty"
                  className={cn("max-h-10 w-full object-contain object-left", directionSidebar ? brandStyles.whiteLogo : "dark:invert")}
                />
              </span>
              <span className="min-w-0 text-left">
                <span className="mobile-sidebar-text block truncate text-sm font-semibold">Staff Hub</span>
              </span>
            </Link>

            <button
              type="button"
              ref={closeButton}
              onClick={() => setIsOpen(false)}
              className="mobile-sidebar-close grid size-11 shrink-0 place-items-center rounded-xl border transition-colors"
              aria-label="Chiudi menu"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          <div className="relative mt-3">
            <span className="mobile-sidebar-icon pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 opacity-65">
              <Search size={17} />
            </span>
            <input
              ref={searchInput}
              type="search"
              aria-label="Cerca una pagina"
              placeholder="Cerca una pagina"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mobile-sidebar-search h-11 w-full rounded-xl border py-2 pl-10 pr-10 text-sm font-semibold outline-none transition"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInput.current?.focus();
                }}
                className="mobile-sidebar-icon absolute inset-y-0 right-0 grid w-11 place-items-center opacity-65 transition hover:opacity-100"
                aria-label="Cancella ricerca"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {hasAreaSwitch ? (
            <div role="group" aria-label="Area del menu" className="mobile-sidebar-area-switch mt-2.5 grid grid-cols-2 rounded-xl border p-1">
              {(["LAVORO", "PERSONALE"] as const).map((area) => {
                const selected = activeArea === area;
                const Icon = area === "PERSONALE" ? UserRound : BriefcaseBusiness;
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setActiveArea(area)}
                    aria-pressed={selected}
                    className={cn(
                      "mobile-sidebar-area-button flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition-colors",
                      selected && "is-active",
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {area === "PERSONALE" ? "Personale" : "Lavoro"}
                  </button>
                );
              })}
            </div>
          ) : null}

          <nav aria-label="Navigazione principale" className={cn("mt-3 flex-1 overflow-y-auto overscroll-contain", directionSidebar && styles.navigation)}>
            <div className="space-y-2 pb-3">
              {sections.map((section, index) => {
                const expanded = openSectionId === section.id || Boolean(normalizedSearch);
                const sectionId = `${drawerId}-section-${index}`;
                return (
                  <div key={section.id}>
                    {section.title ? (
                      <button
                        type="button"
                        onClick={() => setOpenSectionId((current) => current === section.id ? null : section.id)}
                        className="mobile-sidebar-section mb-0.5 flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors"
                        aria-expanded={expanded}
                        aria-controls={sectionId}
                        disabled={Boolean(normalizedSearch)}
                      >
                        <span className="text-xs font-semibold">{section.title}</span>
                        <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", expanded && "rotate-180")} />
                      </button>
                    ) : null}
                    <div id={sectionId} hidden={!expanded && Boolean(section.title)} className="space-y-1">
                      {section.items.map((item) => {
                        const isActive = isItemActive(item.href);
                        const displayLabel = getSidebarLabel(item.href, item.label);
                        const itemBadge = item.href === "/notifications" ? unreadNotifications : item.badge ?? 0;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            aria-current={isActive ? "page" : undefined}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              "mobile-sidebar-link relative flex min-h-11 items-center justify-between gap-2.5 rounded-xl border border-transparent px-3 py-1.5 text-sm font-medium transition-colors",
                              isActive && "active shadow-none",
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className={cn("mobile-sidebar-link-icon grid size-7 shrink-0 place-items-center", isActive && "active")} aria-hidden="true">
                                <DynamicIcon name={item.iconName} className="size-4 shrink-0" />
                              </span>
                              <span className="truncate">{displayLabel}</span>
                            </span>
                            {item.href === "/requests" || itemBadge > 0 ? (
                              <span className={cn("grid min-w-7 shrink-0 place-items-center rounded-full bg-red-700 px-2 py-1 text-xs font-semibold tabular-nums text-white", directionSidebar && styles.badge)}>
                                {itemBadge > 99 ? "99+" : itemBadge}
                              </span>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {sections.length === 0 ? (
                <div className="mobile-sidebar-muted rounded-2xl border border-dashed px-3 py-4 text-center text-xs font-bold">
                  Nessuna pagina trovata.
                </div>
              ) : null}
            </div>
          </nav>
        </div>

        <div className="mobile-sidebar-divider mobile-sidebar-footer relative mt-2 shrink-0 border-t pt-2.5">
          <div className="mb-1.5 flex items-stretch gap-2">
            <Link href={profileHref} onClick={(event) => { handlePcProfileChoice(event); setIsOpen(false); }} aria-label={logoutSkipSignOut ? "Cambia profilo" : undefined} className="mobile-sidebar-profile flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-2.5 py-1.5 transition active:scale-[0.99]">
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
                <span className="mobile-sidebar-text block truncate text-sm font-semibold">{userName}</span>
                <span className="mobile-sidebar-muted mt-0.5 block truncate text-xs font-medium">{roleLabel}</span>
              </span>
            </Link>
            <ThemeToggleButton className="mobile-sidebar-theme grid w-12 shrink-0 place-items-center rounded-xl border transition active:scale-95" />
          </div>
          <LogoutButton
            className={cn("flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-sm font-semibold text-slate-300 transition-colors", directionSidebar && styles.logout)}
            redirectTo={logoutRedirectTo}
            skipSignOut={logoutSkipSignOut}
            label={logoutLabel}
            title={logoutSkipSignOut ? "Torna alla selezione profilo" : "Esci"}
          />
        </div>
      </div>
    </div>
  );
}
