"use client";

import { useState, useEffect } from "react";
import { Menu, X, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

type MobileMenuDrawerProps = {
  logoUrl?: string | null;
  roleLabel: string;
  unreadNotifications: number;
  children: React.ReactNode;
  logoutButton: React.ReactNode;
};

export function MobileMenuDrawer({
  logoUrl,
  roleLabel,
  unreadNotifications,
  children,
  logoutButton,
}: MobileMenuDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Prevent background scrolling when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <div className="xl:hidden">
      {/* Hamburger Button */}
      <div className="flex items-center gap-3">
        {unreadNotifications > 0 && (
          <span className="relative flex size-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C66170] opacity-75"></span>
            <span className="relative inline-flex rounded-full size-2.5 bg-[#C66170]"></span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="grid size-11 place-items-center rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 text-paradise-noir dark:text-white transition active:scale-95"
          aria-label="Apri menu"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* Drawer Overlay Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-[300px] bg-[color:var(--sidebar)] p-6 shadow-luxury transition-transform duration-300 ease-out flex flex-col justify-between dark:border-l dark:border-white/5",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col min-h-0 flex-1">
          {/* Header */}
          <div className="flex items-center justify-between pb-5 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center overflow-hidden rounded-xl text-sm font-bold text-white shadow-soft bg-transparent">
                <img src={logoUrl || "/logo.png"} alt="Logo" className="size-full object-contain dark:invert" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--sidebar-text)] dark:text-[color:var(--dark-sidebar-text)]">Paradise</p>
                <p className="text-[10px] text-[color:var(--sidebar-text)] opacity-55 dark:text-[color:var(--dark-sidebar-text)]">Staff Hub</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid size-9 place-items-center rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 text-paradise-noir dark:text-white transition active:scale-95"
              aria-label="Chiudi menu"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Role badge */}
          <div className="mt-4 px-1">
            <span className="inline-block rounded-full bg-paradise-softPink px-3 py-1 text-xs font-semibold">
              {roleLabel}
            </span>
          </div>

          {/* Navigation Links Scroll Area */}
          <div className="mt-5 flex-1 overflow-y-auto luxury-scroll pr-1 py-1" onClick={() => setIsOpen(false)}>
            <div className="space-y-1">
              {children}
            </div>
          </div>
        </div>

        {/* Footer with Logout */}
        <div className="mt-6 border-t border-black/5 dark:border-white/5 pt-4 shrink-0">
          {logoutButton}
        </div>
      </div>
    </div>
  );
}
