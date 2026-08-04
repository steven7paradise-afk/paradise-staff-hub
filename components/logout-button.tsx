"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export function LogoutButton({
  className,
  redirectTo,
  skipSignOut = false,
  label = "Esci",
  title = "Esci",
}: {
  className?: string;
  redirectTo?: string;
  skipSignOut?: boolean;
  label?: string;
  title?: string;
}) {
  const pathname = usePathname();

  const handleLogout = async () => {
    if (redirectTo) {
      if (!skipSignOut) {
        await signOut({ redirect: false });
      }
      window.location.replace(redirectTo);
      return;
    }

    const isTablet = pathname?.startsWith("/tablet-clock");
    await signOut({ redirect: false });
    window.location.replace(isTablet ? "/tablet-clock" : "/login");
  };

  return (
    <button
      className={className || "sidebar-logout mt-5 flex w-full items-center gap-3 rounded-2xl border border-black/5 bg-white/55 px-3 py-3 text-sm font-medium text-black/68 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/70"}
      onClick={handleLogout}
      title={title}
    >
      <LogOut className="size-4" />
      <span className="sidebar-label">{label}</span>
    </button>
  );
}
