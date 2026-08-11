"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidebarFrame({
  aside,
  main,
  mobileNav,
  style,
  transparentMain = false,
  forceCollapsed = false,
}: {
  aside: React.ReactNode;
  main: React.ReactNode;
  mobileNav?: React.ReactNode;
  style: React.CSSProperties;
  transparentMain?: boolean;
  forceCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const pathname = usePathname();
  const isCollapsed = forceCollapsed || collapsed;

  useEffect(() => {
    if (forceCollapsed) return;
    setCollapsed(window.localStorage.getItem("paradise-sidebar-collapsed") === "1");
  }, [forceCollapsed]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const nextValue = !value;
      window.localStorage.setItem("paradise-sidebar-collapsed", nextValue ? "1" : "0");
      return nextValue;
    });
  };

  useEffect(() => {
    const tabletRoute = pathname?.startsWith("/tablet-clock") ?? false;
    setIsTablet(tabletRoute);
    if (!tabletRoute) return;

    let timeoutId: number;

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(async () => {
        const { signOut } = await import("next-auth/react");
        await signOut({ redirect: false });
        window.location.replace("/tablet-clock");
      }, 90000); // 90 secondi di inattività
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach((name) => document.addEventListener(name, resetTimer, true));

    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((name) => document.removeEventListener(name, resetTimer, true));
    };
  }, [pathname]);

  return (
    <div
      className={cn(
        "paradise-theme-root min-h-screen bg-[color:var(--user-background-color,var(--background))] xl:h-screen xl:overflow-hidden",
        isCollapsed && "sidebar-collapsed",
        isTablet && "tablet-mode"
      )}
      style={style}
    >
      <div
        className={cn(
          "app-liquid-sidebar relative transition-[width,background-color] duration-300 xl:fixed xl:inset-y-0 xl:left-0 xl:z-40 xl:h-screen xl:overflow-visible",
          isCollapsed
            ? "xl:w-[88px] bg-[color:var(--user-sidebar-color,var(--sidebar))] border-r border-black/5 dark:border-white/10 xl:bg-[linear-gradient(165deg,var(--sidebar-gradient-from),var(--sidebar-gradient-mid)_54%,var(--sidebar-gradient-to))] xl:border-white/10"
            : "xl:w-[264px] bg-[color:var(--user-sidebar-color,var(--sidebar))] border-r border-black/5 dark:border-white/10 xl:bg-[linear-gradient(165deg,var(--sidebar-gradient-from),var(--sidebar-gradient-mid)_54%,var(--sidebar-gradient-to))] xl:border-white/10"
        )}
      >
        {!forceCollapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="absolute -right-[22px] top-6 z-50 hidden size-11 place-items-center rounded-full border border-white/45 bg-white/70 text-black/65 shadow-lg backdrop-blur-xl transition hover:bg-white/90 hover:text-black dark:border-white/15 dark:bg-neutral-900/70 dark:text-white/80 xl:grid"
            aria-label={isCollapsed ? "Apri menu" : "Chiudi menu"}
            title={isCollapsed ? "Apri menu" : "Chiudi menu"}
          >
            {isCollapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        ) : null}
        {aside}
      </div>
      <div className={cn("min-w-0 transition-[margin-left] duration-300 xl:h-screen xl:overflow-hidden", isCollapsed ? "xl:ml-[88px]" : "xl:ml-[264px]")}>
        <div className="xl:flex xl:h-screen xl:flex-col">
          <div className={cn(
            "app-content-surface flex-1 overflow-hidden border-0 shadow-none xl:flex xl:flex-col",
            transparentMain ? "bg-transparent" : "bg-[color:var(--card)]",
          )}>
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
