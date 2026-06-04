"use client";

import { useState } from "react";
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

  return (
    <div
      className={cn(
        "paradise-theme-root min-h-screen bg-[color:var(--background)]",
        collapsed && "sidebar-collapsed",
      )}
      style={style}
    >
      <div
        className={cn(
          "relative bg-[color:var(--sidebar)] transition-[width] duration-300 xl:fixed xl:inset-y-0 xl:left-0 xl:z-40 xl:h-screen xl:overflow-visible",
          collapsed ? "xl:w-[88px]" : "xl:w-[280px]",
        )}
      >
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="absolute -right-4 top-6 z-50 hidden size-9 place-items-center rounded-xl border border-black/5 bg-white text-black/60 shadow-sm transition hover:bg-white hover:text-black xl:grid"
          aria-label={collapsed ? "Apri menu" : "Chiudi menu"}
          title={collapsed ? "Apri menu" : "Chiudi menu"}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </button>
        {aside}
      </div>
      <div className={cn("min-w-0 transition-[margin-left] duration-300", collapsed ? "xl:ml-[88px]" : "xl:ml-[280px]")}>
        {main}
      </div>
      {mobileNav}
    </div>
  );
}
