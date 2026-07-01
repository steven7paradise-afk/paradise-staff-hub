"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export function LogoutButton({ className }: { className?: string }) {
  const pathname = usePathname();

  const handleLogout = () => {
    const isTablet = pathname?.startsWith("/tablet-clock");
    void signOut({ callbackUrl: isTablet ? "/tablet-clock" : "/login" });
  };

  return (
    <button
      className={className || "sidebar-logout mt-5 flex w-full items-center gap-3 rounded-2xl border border-black/5 bg-white/55 px-3 py-3 text-sm font-medium text-black/68 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/70"}
      onClick={handleLogout}
      title="Esci"
    >
      <LogOut className="size-4" />
      <span className="sidebar-label">Esci</span>
    </button>
  );
}
