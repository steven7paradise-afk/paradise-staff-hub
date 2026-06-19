"use client";

import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidebarFrame({
  aside,
  main,
  mobileNav,
  style,
}: {
  aside: React.ReactNode;
  main: React.ReactNode;
  mobileNav?: React.ReactNode;
  style: React.CSSProperties;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const hasTabletCookie = typeof document !== "undefined" && document.cookie.includes("paradise_tablet_access");
    setIsTablet(hasTabletCookie);
    if (!hasTabletCookie) return;

    let timeoutId: number;

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(async () => {
        const { signOut } = await import("next-auth/react");
        void signOut({ callbackUrl: "/tablet-clock" });
      }, 90000); // 90 secondi di inattività
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach((name) => document.addEventListener(name, resetTimer, true));

    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((name) => document.removeEventListener(name, resetTimer, true));
    };
  }, []);

  return (
    <div
      className={cn(
        "paradise-theme-root min-h-screen bg-[color:var(--user-background-color,var(--background))] xl:h-screen xl:overflow-hidden",
        collapsed && "sidebar-collapsed",
        isTablet && "tablet-mode"
      )}
      style={style}
    >
      <div
        className={cn(
          "relative transition-[width,background-color] duration-300 xl:fixed xl:inset-y-0 xl:left-0 xl:z-40 xl:h-screen xl:overflow-visible",
          collapsed ? "xl:w-[88px] bg-transparent" : "xl:w-[280px] bg-[color:var(--user-sidebar-color,var(--sidebar))] border-r border-black/5 dark:border-white/10"
        )}
      >
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="absolute -right-[18px] bottom-[82px] z-50 hidden size-9 place-items-center rounded-xl border border-black/5 bg-white text-black/60 shadow-sm transition hover:bg-white hover:text-black dark:border-white/10 dark:bg-neutral-800 dark:text-white/80 xl:grid"
          aria-label={collapsed ? "Apri menu" : "Chiudi menu"}
          title={collapsed ? "Apri menu" : "Chiudi menu"}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </button>
        {aside}
      </div>
      <div className={cn("min-w-0 transition-[margin-left] duration-300 xl:h-screen xl:overflow-hidden", collapsed ? "xl:ml-[88px]" : "xl:ml-[280px]")}>
        <div className="xl:p-5 xl:pl-3 xl:h-screen xl:flex xl:flex-col">
          <div className="bg-[color:var(--card)] xl:rounded-[28px] xl:shadow-sm flex-1 border border-black/5 dark:border-white/5 xl:flex xl:flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto luxury-scroll min-w-0">
              {main}
            </div>
          </div>
        </div>
      </div>
      {mobileNav}
    </div>
  );
}
