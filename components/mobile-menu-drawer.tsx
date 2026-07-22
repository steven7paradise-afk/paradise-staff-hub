"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { X, Search, ArrowLeft, Video, Sparkles, MessageSquare, Menu } from "lucide-react";
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
  items: Array<{ href: string; label: string; iconName: string }>;
  logoutButton: ReactNode;
};

export function MobileMenuDrawer({
  userName,
  userPhoto,
  roleLabel,
  unreadNotifications,
  colleagues = [],
  items,
  logoutButton,
}: MobileMenuDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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

  return (
    <div className="xl:hidden">
      {/* Drawer Open Trigger Button */}
      <div className="fixed left-0 top-[14px] z-40 flex items-center">
        <div className="pointer-events-none fixed bottom-0 left-0 top-0 w-1 bg-[color:var(--user-sidebar-color,var(--sidebar))]" />

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative flex h-10 w-9 items-center justify-center rounded-r-2xl border border-black/5 bg-zinc-900 text-white shadow-soft transition-all duration-200 hover:w-10 active:scale-95"
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
          "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* Sliding Drawer Container (Ultra Premium Dark UI matching screenshot) */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-full max-w-[280px] flex-col justify-between border-r border-zinc-800 bg-[#0B121F] p-5 shadow-2xl transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          
          {/* User Identity Header */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="size-11 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800 shadow-sm">
                  {userPhoto ? (
                    <img src={resolveDrivePhotoUrl(userPhoto)} alt={userName} className="size-full select-none object-cover pointer-events-none" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-sm font-extrabold text-white bg-pink-500">
                      {userName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0B121F]" />
              </div>
              
              <div className="min-w-0 text-left">
                <p className="max-w-[130px] truncate text-xs font-black uppercase tracking-wide text-white leading-tight">{userName}</p>
                <p className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-zinc-500">{roleLabel}</p>
              </div>
            </div>

            {/* Circular Toggle Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid size-8 place-items-center rounded-full bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#10b981] transition active:scale-95 shrink-0"
              aria-label="Chiudi menu"
            >
              <ArrowLeft className="size-4" />
            </button>
          </div>

          {/* Slate Search Bar */}
          <div className="relative mt-4">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Cerca pagina..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1e293b]/40 border border-zinc-800 text-xs font-bold text-white rounded-xl py-2 pl-9 pr-4 focus:outline-none focus:border-zinc-700 placeholder-zinc-600"
            />
          </div>

          {/* Main Navigation links */}
          <div className="luxury-scroll mt-5 flex-1 overflow-y-auto pr-1 space-y-1">
            {filteredItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center justify-between gap-3.5 rounded-xl px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all duration-250",
                    isActive
                      ? "bg-[#2563eb] text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)]"
                      : "text-zinc-400 hover:bg-zinc-800/40 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <DynamicIcon name={item.iconName} className={cn("size-4 shrink-0", isActive ? "text-white" : "text-zinc-400")} />
                    <span>{item.label}</span>
                  </div>

                  {item.label.toLowerCase() === "task" && (
                    <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full shrink-0", isActive ? "bg-white text-blue-600" : "bg-zinc-800 text-zinc-400")}>
                      3
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Team Online Section (mockup styled) */}
          {colleagues && colleagues.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-zinc-500 px-1">
                <span>Team online</span>
                <span className="text-pink-500 text-[8px] tracking-wider cursor-pointer">vedi tutti</span>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {colleagues.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-1.5 rounded-xl hover:bg-zinc-800/20 transition duration-200">
                    <div className="flex items-center gap-2.5">
                      <div className="relative shrink-0">
                        <div className="size-7 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800">
                          {member.photo_url ? (
                            <img src={resolveDrivePhotoUrl(member.photo_url)} alt={member.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-extrabold text-zinc-400">
                              {member.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-1 ring-[#0B121F]" />
                      </div>

                      <span className="text-[10px] font-black uppercase tracking-wide text-zinc-300 truncate max-w-[130px]">{member.name}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/50 transition">
                        <Video size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Theme switcher pill at bottom */}
          <div className="mt-4 flex items-center justify-between bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl">
            <button className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg bg-zinc-800 text-white shadow-sm border border-zinc-700/55">
              <Sparkles size={10} className="text-pink-400" />
              <span>Light</span>
            </button>
            <button className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg text-zinc-500">
              <span>Dark</span>
            </button>
          </div>

        </div>

        <div className="mt-4 shrink-0 border-t border-zinc-800/80 pt-4">{logoutButton}</div>
      </div>
    </div>
  );
}
