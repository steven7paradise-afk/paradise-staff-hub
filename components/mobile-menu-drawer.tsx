"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search, ArrowLeft, ChevronDown, Menu, X } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";
import { DynamicIcon } from "./dynamic-icon";

type MobileMenuDrawerProps = {
  logoUrl?: string | null;
  userName: string;
  userPhoto?: string | null;
  roleLabel: string;
  unreadNotifications: number;
  colleagues?: Array<{ id: string; name: string; photo_url: string | null }>;
  items: Array<{ href: string; label: string; iconName: string; section?: string; badge?: number }>;
  sidebarConfig?: Array<{ id: string; title: string; routes: string[]; labels?: Record<string, string> }> | null;
  logoutButton: ReactNode;
};

export function MobileMenuDrawer({
  userName,
  userPhoto,
  roleLabel,
  unreadNotifications,
  colleagues = [],
  items,
  sidebarConfig = null,
  logoutButton,
}: MobileMenuDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const getSidebarLabel = (href: string, fallback: string) => {
    const folder = sidebarConfig?.find((sec) => sec.routes.includes(href));
    return folder?.labels?.[href] || fallback;
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) =>
    getSidebarLabel(item.href, item.label).toLowerCase().includes(normalizedSearch)
  );

  const getRenderSections = () => {
    if (sidebarConfig && sidebarConfig.length > 0) {
      const renderedHrefs = new Set<string>();
      const configured = sidebarConfig.map((sec) => {
        const sectionItems = filteredItems
          .filter((item) => {
            const match = sec.routes.includes(item.href);
            if (match) renderedHrefs.add(item.href);
            return match;
          })
          .sort((a, b) => sec.routes.indexOf(a.href) - sec.routes.indexOf(b.href));
        return { id: sec.id, title: sec.title, items: sectionItems };
      });
      const unassigned = filteredItems.filter((item) => !renderedHrefs.has(item.href));
      return [
        ...configured.filter((sec) => sec.items.length > 0),
        ...(unassigned.length ? [{ id: "fallback-unassigned", title: "Altre pagine", items: unassigned }] : []),
      ];
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
    if (!isOpen) return;
    if (activeSectionId) {
      setOpenSectionId(activeSectionId);
      return;
    }
    setOpenSectionId((current) => current ?? sections[0]?.id ?? null);
  }, [activeSectionId, isOpen, pathname]);

  return (
    <div className="xl:hidden">
      {/* Drawer Open Trigger Button */}
      <div className="fixed left-0 top-[calc(env(safe-area-inset-top)+14px)] z-40 flex items-center">
        <div className="pointer-events-none fixed bottom-0 left-0 top-0 w-1 bg-[color:var(--user-sidebar-color,var(--sidebar))]" />

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mobile-sidebar-trigger relative flex size-11 items-center justify-center rounded-r-2xl border shadow-lg backdrop-blur-xl transition-all duration-200 hover:w-12 active:scale-95"
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

      {/* Overlay backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/45 transition-opacity duration-300",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsOpen(false)}
      />

      <div
        className={cn(
          "mobile-liquid-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(82vw,320px)] flex-col justify-between overflow-hidden border-r border-white/15 p-5 font-[family-name:var(--sidebar-font)] transition-[transform,box-shadow] duration-300 ease-out will-change-transform",
          isOpen ? "translate-x-0 shadow-[10px_0_28px_rgba(0,0,0,0.30)]" : "-translate-x-full shadow-none",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          
          {/* User Identity Header */}
          <div className="mobile-sidebar-divider relative flex items-center justify-between border-b pb-5">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="mobile-sidebar-avatar relative size-14 overflow-hidden rounded-full border shadow-sm">
                  {userPhoto ? (
                    <img src={resolveDrivePhotoUrl(userPhoto)} alt={userName} className="size-full select-none object-cover pointer-events-none" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-[color:var(--button)] text-sm font-extrabold text-[color:var(--text)]">
                      {userName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="mobile-sidebar-status absolute bottom-0 right-0 size-4 rounded-full bg-emerald-400 ring-4" />
              </div>
              
              <div className="min-w-0 text-left">
                <p className="mobile-sidebar-text max-w-[150px] truncate text-sm font-black uppercase leading-tight tracking-[0.16em]">{userName}</p>
                <p className="mobile-sidebar-muted mt-1 text-[10px] font-black uppercase tracking-[0.2em]">{roleLabel}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="mobile-sidebar-close grid size-11 shrink-0 place-items-center rounded-full border transition active:scale-95"
              aria-label="Chiudi menu"
            >
              <ArrowLeft className="size-6" />
            </button>
          </div>

          <div className="relative mt-6">
            <span className="mobile-sidebar-icon pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 opacity-65">
              <Search size={17} />
            </span>
            <input
              type="text"
              placeholder="Cerca pagina..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mobile-sidebar-search h-12 w-full rounded-xl border py-2 pl-12 pr-11 text-base font-semibold outline-none transition"
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

          {/* Main Navigation links */}
          <div className="no-scrollbar mt-7 flex-1 overflow-y-auto">
            <div className="space-y-8 pb-4">
              {sections.map((section) => (
                <div key={section.id}>
                  {section.title ? (
                    <button
                      type="button"
                      onClick={() => setOpenSectionId((current) => current === section.id ? null : section.id)}
                      className="mobile-sidebar-section mb-2 flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2 text-left transition"
                      aria-expanded={openSectionId === section.id}
                    >
                      <p className="text-[12px] font-black uppercase tracking-[0.18em]">{section.title}</p>
                      <ChevronDown className={cn("size-4 transition-transform", openSectionId === section.id && "rotate-180")} />
                    </button>
                  ) : null}
                  {openSectionId === section.id || !section.title || searchQuery.trim() ? (
                    <div className="space-y-1.5">
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
                            "mobile-sidebar-link relative flex min-h-12 items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5 text-[16px] font-semibold tracking-tight transition",
                            isActive
                              ? "active shadow-none"
                              : ""
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                              <span className={cn("mobile-sidebar-link-icon grid size-9 shrink-0 place-items-center rounded-md", isActive && "active")}>
                                <DynamicIcon name={item.iconName} className="size-6 shrink-0" />
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

        <div className="mobile-sidebar-divider mobile-sidebar-footer relative mt-4 shrink-0 border-t pt-5">{logoutButton}</div>
      </div>
    </div>
  );
}
