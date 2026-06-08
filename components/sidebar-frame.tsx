"use client";

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
  return (
    <div
      className="paradise-theme-root min-h-screen bg-[color:var(--background)] sidebar-collapsed"
      style={style}
    >
      <div
        className="relative bg-[color:var(--sidebar)] transition-[width] duration-300 xl:fixed xl:inset-y-0 xl:left-0 xl:z-40 xl:h-screen xl:overflow-visible xl:w-[88px]"
      >
        {aside}
      </div>
      <div className="min-w-0 xl:ml-[88px]">
        {main}
      </div>
      {mobileNav}
    </div>
  );
}
