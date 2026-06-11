"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

type MobileMenuDrawerProps = {
  logoUrl?: string | null;
  userName: string;
  userPhoto?: string | null;
  roleLabel: string;
  unreadNotifications: number;
  children: React.ReactNode;
  logoutButton: React.ReactNode;
};

const themePresets = [
  {
    id: "blue",
    name: "Classic Blue",
    gradient: "linear-gradient(135deg, #0076e5, #002d9c)",
    primary: "#0076e5",
    button: "#0076e5",
    secondary: "#e0f0ff",
  },
  {
    id: "pink",
    name: "Paradise Pink",
    gradient: "linear-gradient(135deg, #FFA8DD, #C66170)",
    primary: "#FFA8DD",
    button: "#FFA8DD",
    secondary: "#FFD6EA",
  },
  {
    id: "gold",
    name: "Sunset Gold",
    gradient: "linear-gradient(135deg, #E8C98B, #B88E3D)",
    primary: "#E8C98B",
    button: "#E8C98B",
    secondary: "#F7E9EF",
  },
  {
    id: "green",
    name: "Emerald Green",
    gradient: "linear-gradient(135deg, #10B981, #064E3B)",
    primary: "#10B981",
    button: "#10B981",
    secondary: "#D1FAE5",
  },
  {
    id: "purple",
    name: "Luxury Purple",
    gradient: "linear-gradient(135deg, #8B5CF6, #4C1D95)",
    primary: "#8B5CF6",
    button: "#8B5CF6",
    secondary: "#EDE9FE",
  },
];

export function MobileMenuDrawer({
  logoUrl,
  userName,
  userPhoto,
  roleLabel,
  unreadNotifications,
  children,
  logoutButton,
}: MobileMenuDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState("blue");

  // Load and apply theme on mount
  useEffect(() => {
    const saved = localStorage.getItem("mobile-theme-color");
    if (saved && themePresets.some(p => p.id === saved)) {
      setActiveTheme(saved);
      applyThemeProperties(saved);
    } else {
      applyThemeProperties("blue");
    }
  }, []);

  const changeTheme = (id: string) => {
    setActiveTheme(id);
    localStorage.setItem("mobile-theme-color", id);
    applyThemeProperties(id);
  };

  const applyThemeProperties = (id: string) => {
    const preset = themePresets.find((p) => p.id === id);
    if (!preset) return;
    const root = document.querySelector<HTMLElement>(".paradise-theme-root") || document.documentElement;
    root.style.setProperty("--primary", preset.primary);
    root.style.setProperty("--button", preset.button);
    root.style.setProperty("--secondary", preset.secondary);
  };

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

  const activePreset = themePresets.find(p => p.id === activeTheme) || themePresets[0];

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
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer Panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-full max-w-[300px] p-6 shadow-luxury transition-transform duration-300 ease-out flex flex-col justify-between border-r border-white/10 text-white",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: activePreset.gradient }}
      >
        <div className="flex flex-col min-h-0 flex-1">
          {/* User Profile Header (mockup styled) */}
          <div className="flex items-center justify-between pb-6 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <div className="size-12 rounded-full overflow-hidden border-2 border-white/20 bg-white/10 shadow-sm shrink-0">
                {userPhoto ? (
                  <img src={userPhoto} alt={userName} className="size-full object-cover select-none pointer-events-none" />
                ) : (
                  <div className="size-full flex items-center justify-center font-extrabold text-base text-white">
                    {userName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-white text-base tracking-tight leading-tight truncate max-w-[150px]">{userName}</p>
                <p className="text-xs text-white/60 font-semibold mt-0.5">{roleLabel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid size-9 place-items-center rounded-xl bg-white/10 border border-white/10 text-white transition active:scale-95 hover:bg-white/20"
              aria-label="Chiudi menu"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Navigation Links Scroll Area */}
          <div className="mt-6 flex-1 overflow-y-auto luxury-scroll pr-1 py-1" onClick={() => setIsOpen(false)}>
            <div className="space-y-1">
              {children}
            </div>
          </div>
        </div>

        <div className="shrink-0 mt-6 space-y-5">
          {/* Color Theme Selector (Choosing colors on mobile) */}
          <div className="border-t border-white/10 pt-4">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/40 mb-2.5">Scegli Colore</p>
            <div className="flex items-center gap-3">
              {themePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => changeTheme(preset.id)}
                  className={cn(
                    "size-6 rounded-full border border-white/10 transition-transform duration-200 active:scale-95 focus:outline-none",
                    activeTheme === preset.id ? "scale-125 ring-2 ring-white/80 shadow-md" : "opacity-60 hover:opacity-100"
                  )}
                  style={{ background: preset.gradient }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>

          {/* Footer with Logout */}
          <div className="border-t border-white/10 pt-4">
            {logoutButton}
          </div>
        </div>
      </div>
    </div>
  );
}
