"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search, ArrowLeft, ChevronDown, Menu } from "lucide-react";
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
  items: Array<{ href: string; label: string; iconName: string; section?: string }>;
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

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSidebarLabel = (href: string, fallback: string) => {
    const folder = sidebarConfig?.find((sec) => sec.routes.includes(href));
    return folder?.labels?.[href] || fallback;
  };

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
    setOpenSectionId((current) => current ?? activeSectionId ?? sections[0]?.id ?? null);
  }, [activeSectionId, isOpen, sections]);

  return (
    <div className="xl:hidden">
      {/* Drawer Open Trigger Button */}
      <div className="fixed left-0 top-[14px] z-40 flex items-center">
        <div className="pointer-events-none fixed bottom-0 left-0 top-0 w-1 bg-[color:var(--user-sidebar-color,var(--sidebar))]" />

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative flex h-10 w-9 items-center justify-center rounded-r-2xl border border-black/5 bg-zinc-900 text-white transition-all duration-200 hover:w-10 active:scale-95"
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
          "fixed inset-0 z-50 bg-black/70 backdrop-blur-[3px] transition-opacity duration-300",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsOpen(false)}
      />

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-full max-w-[302px] flex-col justify-between border-r border-white/8 bg-[#07101F] p-5 transition-[transform,box-shadow] duration-300 ease-out",
          isOpen ? "translate-x-0 shadow-[18px_0_50px_rgba(0,0,0,0.45)]" : "-translate-x-full shadow-none",
        )}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-16 top-16 size-48 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute -right-20 bottom-24 size-56 rounded-full bg-blue-600/10 blur-3xl" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          
          {/* User Identity Header */}
          <div className="relative flex items-center justify-between border-b border-white/10 pb-5">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="absolute inset-[-4px] rounded-full bg-cyan-400/80 blur-[7px]" />
                <div className="relative size-14 overflow-hidden rounded-full border-2 border-cyan-300 bg-zinc-800 shadow-[0_0_22px_rgba(34,211,238,0.55)]">
                  {userPhoto ? (
                    <img src={resolveDrivePhotoUrl(userPhoto)} alt={userName} className="size-full select-none object-cover pointer-events-none" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-sm font-extrabold text-white bg-pink-500">
                      {userName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="absolute bottom-0 right-0 size-4 rounded-full bg-emerald-400 ring-4 ring-[#07101F]" />
              </div>
              
              <div className="min-w-0 text-left">
                <p className="max-w-[150px] truncate text-sm font-black uppercase leading-tight tracking-[0.16em] text-white">{userName}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{roleLabel}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid size-10 shrink-0 place-items-center rounded-full text-cyan-300 transition hover:bg-white/8 active:scale-95"
              aria-label="Chiudi menu"
            >
              <ArrowLeft className="size-6" />
            </button>
          </div>

          {/* Slate Search Bar */}
          <div className="relative mt-6">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
              <Search size={17} />
            </span>
            <input
              type="text"
              placeholder="Cerca pagina..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 w-full rounded-2xl border border-white/8 bg-white/[0.045] py-2 pl-12 pr-4 text-base font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35 focus:bg-white/[0.07]"
            />
          </div>

          {/* Main Navigation links */}
          <div className="no-scrollbar mt-7 flex-1 overflow-y-auto">
            <div className="space-y-8 pb-4">
              {sections.map((section) => (
                <div key={section.id}>
                  <button
                    type="button"
                    onClick={() => setOpenSectionId((current) => current === section.id ? null : section.id)}
                    className="mb-3 flex w-full items-center justify-between rounded-2xl px-3 py-1.5 text-left transition hover:bg-white/[0.04]"
                  >
                    <p className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400/85">{section.title}</p>
                    <ChevronDown className={cn("size-4 text-slate-500 transition-transform", openSectionId === section.id && "rotate-180")} />
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
                            onClick={() => setIsOpen(false)}
                            className={cn(
                            "relative flex min-h-14 items-center justify-between gap-3 rounded-3xl px-4 py-3 text-[17px] font-semibold tracking-tight transition",
                            isActive
                              ? "border border-white/16 bg-white/[0.08] text-white shadow-none"
                              : "text-slate-300 hover:bg-white/[0.055] hover:text-white"
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                              <span className={cn("grid size-10 shrink-0 place-items-center rounded-2xl", isActive ? "text-white" : "text-slate-400")}>
                                <DynamicIcon name={item.iconName} className="size-6 shrink-0" />
                              </span>
                              <span className="truncate">{displayLabel}</span>
                            </div>

                            {item.href === "/notifications" && unreadNotifications > 0 ? (
                              <span className="grid min-w-7 shrink-0 place-items-center rounded-full bg-red-500 px-2 py-1 text-xs font-black text-white shadow-[0_0_14px_rgba(239,68,68,0.45)]">
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
                <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-center text-xs font-bold text-slate-500">
                  Nessuna pagina trovata.
                </div>
              ) : null}
            </div>
          </div>

          {/* Navigation lists directly end here */}
        </div>

        <div className="relative mt-4 shrink-0 border-t border-white/10 pt-5">{logoutButton}</div>
      </div>
    </div>
  );
}
