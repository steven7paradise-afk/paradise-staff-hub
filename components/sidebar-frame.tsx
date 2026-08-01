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
}: {
  aside: React.ReactNode;
  main: React.ReactNode;
  mobileNav?: React.ReactNode;
  style: React.CSSProperties;
  transparentMain?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const pathname = usePathname();

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
        collapsed && "sidebar-collapsed",
        isTablet && "tablet-mode"
      )}
      style={style}
    >
      <div
        className={cn(
          "relative transition-[width,background-color] duration-300 xl:fixed xl:inset-y-0 xl:left-0 xl:z-40 xl:h-screen xl:overflow-visible",
          collapsed
            ? "xl:w-[88px] bg-[color:var(--user-sidebar-color,var(--sidebar))] border-r border-black/5 dark:border-white/10 xl:bg-[linear-gradient(165deg,var(--sidebar-gradient-from),var(--sidebar-gradient-mid)_54%,var(--sidebar-gradient-to))] xl:border-white/10"
            : "xl:w-[280px] bg-[color:var(--user-sidebar-color,var(--sidebar))] border-r border-black/5 dark:border-white/10 xl:bg-[linear-gradient(165deg,var(--sidebar-gradient-from),var(--sidebar-gradient-mid)_54%,var(--sidebar-gradient-to))] xl:border-white/10"
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
          <div className={cn("xl:rounded-[28px] xl:shadow-sm flex-1 border border-black/5 dark:border-white/5 xl:flex xl:flex-col overflow-hidden", transparentMain ? "bg-transparent" : "bg-[color:var(--card)]")}>
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
