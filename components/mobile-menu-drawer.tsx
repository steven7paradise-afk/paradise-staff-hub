"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";

type MobileMenuDrawerProps = {
  logoUrl?: string | null;
  userName: string;
  userPhoto?: string | null;
  roleLabel: string;
  unreadNotifications: number;
  children: ReactNode;
  logoutButton: ReactNode;
};

export function MobileMenuDrawer({
  userName,
  userPhoto,
  roleLabel,
  unreadNotifications,
  children,
  logoutButton,
}: MobileMenuDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <div className="xl:hidden">
      <div className="fixed left-0 top-[14px] z-40 flex items-center">
        <div className="pointer-events-none fixed bottom-0 left-0 top-0 w-1 bg-[color:var(--user-sidebar-color,var(--sidebar))]" />

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative flex h-10 w-9 items-center justify-center rounded-r-2xl border border-black/5 bg-[color:var(--user-sidebar-color,var(--sidebar))] text-[color:var(--sidebar-icon)] shadow-soft transition-all duration-200 hover:w-10 active:scale-95"
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

      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/55 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsOpen(false)}
      />

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-full max-w-[300px] flex-col justify-between border-r border-black/10 p-6 shadow-luxury transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{
          background:
            "linear-gradient(160deg, var(--user-sidebar-color,var(--sidebar)) 0%, color-mix(in srgb, var(--user-sidebar-color,var(--sidebar)) 84%, var(--button)) 100%)",
          color: "var(--sidebar-text)",
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-current/10 pb-6">
            <div className="flex items-center gap-3.5">
              <div className="size-12 shrink-0 overflow-hidden rounded-full border border-current/15 bg-white/20 shadow-sm">
                {userPhoto ? (
                  <img src={resolveDrivePhotoUrl(userPhoto)} alt={userName} className="size-full select-none object-cover pointer-events-none" />
                ) : (
                  <div className="flex size-full items-center justify-center text-base font-extrabold">
                    {userName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="max-w-[150px] truncate text-base font-extrabold leading-tight tracking-tight">{userName}</p>
                <p className="mt-0.5 text-xs font-semibold opacity-60">{roleLabel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid size-9 place-items-center rounded-xl border border-current/10 bg-white/20 transition hover:bg-white/30 active:scale-95"
              aria-label="Chiudi menu"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="luxury-scroll mt-6 flex-1 overflow-y-auto py-1 pr-1" onClick={() => setIsOpen(false)}>
            <div className="space-y-1">{children}</div>
          </div>
        </div>

        <div className="mt-6 shrink-0 border-t border-current/10 pt-4">{logoutButton}</div>
      </div>
    </div>
  );
}
