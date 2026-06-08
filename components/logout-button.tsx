"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      className="sidebar-logout mt-5 flex w-full items-center gap-3 rounded-2xl border border-black/5 bg-white/55 px-3 py-3 text-sm font-medium text-black/68 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/70"
      onClick={() => signOut({ callbackUrl: "/login" })}
      title="Esci"
    >
      <LogOut className="size-4" />
      <span className="sidebar-label">Esci</span>
    </button>
  );
}
