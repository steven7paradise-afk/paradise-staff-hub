"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { InstantLink } from "@/components/instant-link";
import { DynamicIcon } from "@/components/dynamic-icon";
import { cn } from "@/lib/utils";

type SidebarNavGroupProps = {
  label: string;
  iconName: string;
  items: {
    href: string;
    label: string;
    iconName: string;
    badge?: number;
  }[];
};

export function SidebarNavGroup({ label, iconName, items }: SidebarNavGroupProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = useMemo(() => {
    return items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  }, [items, pathname]);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={label}
        className={cn(
          "sidebar-nav-link flex w-full shrink-0 items-center gap-3 rounded-l-none rounded-r-2xl border-l-4 border-transparent pl-3 pr-4 py-3 text-sm font-medium text-[color:var(--sidebar-text)] transition-all duration-300 hover:bg-paradise-nude dark:text-[color:var(--dark-sidebar-text)] dark:hover:bg-white/10 hover:border-l-paradise-pink/40",
          active && "active bg-gradient-to-r from-paradise-pink/15 to-paradise-softPink/5 border-l-paradise-pink text-paradise-noir shadow-sm dark:from-paradise-pink/10 dark:to-transparent dark:border-paradise-pink dark:text-white",
        )}
      >
        <DynamicIcon name={iconName} className="size-4 text-[color:var(--sidebar-icon)] transition-colors duration-300 dark:text-[color:var(--dark-sidebar-icon)]" />
        <span className="sidebar-label flex-1 text-left transition-transform duration-300 hover:translate-x-0.5">{label}</span>
        <ChevronDown className={cn("sidebar-label size-4 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="sidebar-label ml-5 space-y-1 border-l border-black/10 pl-3 dark:border-white/10">
          {items.map((item) => {
            return (
              <InstantLink
                key={item.href}
                href={item.href}
                title={item.label}
                className="sidebar-nav-link flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-[color:var(--sidebar-text)] transition-all duration-300 hover:bg-paradise-nude dark:text-[color:var(--dark-sidebar-text)] dark:hover:bg-white/10"
                activeClassName="active bg-paradise-softPink/55 text-paradise-noir shadow-sm dark:bg-white/15 dark:text-white"
              >
                <DynamicIcon name={item.iconName} className="size-4 text-[color:var(--sidebar-icon)] transition-colors duration-300 dark:text-[color:var(--dark-sidebar-icon)]" />
                <span className="transition-transform duration-300 hover:translate-x-0.5">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="ml-auto min-w-5 rounded-full bg-[#C66170] px-1.5 py-0.5 text-center text-[11px] font-bold text-white shadow-[0_0_8px_rgba(198,97,112,0.6)] animate-pulse-soft">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </InstantLink>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
