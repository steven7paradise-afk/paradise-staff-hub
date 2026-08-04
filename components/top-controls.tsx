"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Bell, CalendarDays, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";

function applyThemeVariables(isDark: boolean) {
  const root = document.querySelector<HTMLElement>(".paradise-theme-root");
  if (!root) return;
  const styles = getComputedStyle(root);
  const pairs = isDark
    ? {
        "--background": "--dark-background",
        "--sidebar": "--dark-sidebar",
        "--card": "--dark-card",
        "--text": "--dark-text",
        "--button": "--dark-button",
      }
    : {
        "--background": "--light-background",
        "--sidebar": "--light-sidebar",
        "--card": "--light-card",
        "--text": "--light-text",
        "--button": "--light-button",
      };

  Object.entries(pairs).forEach(([target, source]) => {
    const value = styles.getPropertyValue(source).trim();
    if (value) root.style.setProperty(target, value);
  });
}

export function TopControls({
  unread,
  name,
  photoUrl,
  userId,
  profileHref = "/profile",
}: {
  unread: number;
  name: string;
  photoUrl: string | null;
  userId?: string;
  profileHref?: string;
}) {
  const [dark, setDark] = useState(false);
  const [activeWorkers, setActiveWorkers] = useState<any[]>([]);

  useEffect(() => {
    if (userId !== "PC_CASSA") return;
    
    async function fetchActiveWorkers() {
      try {
        const res = await fetch("/api/appointments/pc/active-staff");
        if (res.ok) {
          const data = await res.json();
          setActiveWorkers(data);
        }
      } catch (err) {
        console.error("Failed to fetch active staff in TopControls:", err);
      }
    }

    void fetchActiveWorkers();
    
    // Poll every 30 seconds to keep active staff updated
    const interval = setInterval(fetchActiveWorkers, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("paradise-theme");
    if (savedTheme === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
      window.requestAnimationFrame(() => applyThemeVariables(true));
    } else {
      window.requestAnimationFrame(() => applyThemeVariables(false));
    }
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("paradise-theme", next ? "dark" : "light");
    applyThemeVariables(next);
  }

  async function handleLogout() {
    if (userId === "PC_CASSA") {
      window.location.replace(profileHref);
      return;
    }

    await signOut({ redirect: false });
    window.location.replace("/login");
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {userId === "PC_CASSA" && activeWorkers.length > 0 && (
        <div className="flex items-center gap-2.5 mr-4 border-r border-black/5 dark:border-white/10 pr-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mr-2 hidden sm:inline">
            Turni staff:
          </span>
          <div className="flex items-center -space-x-2.5">
            {activeWorkers.map((worker) => (
              <Link
                key={worker.id}
                href={profileHref}
                title={`Cambia profilo: ${worker.name}`}
                className="relative block size-9 rounded-full ring-2 ring-white hover:ring-[#C66170] dark:ring-neutral-900 transition-all duration-300 hover:scale-110 hover:z-10 overflow-hidden bg-paradise-softPink"
              >
                {worker.photo_url ? (
                  <img
                    src={resolveDrivePhotoUrl(worker.photo_url)}
                    alt={worker.name}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="size-full flex items-center justify-center font-bold text-[10px] text-[#C66170]">
                    {worker.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className={`absolute bottom-0 right-0 size-2 rounded-full border border-white dark:border-neutral-900 ${worker.status === "BREAK" ? "bg-amber-500" : "bg-emerald-500"}`} />
              </Link>
            ))}
          </div>
        </div>
      )}
      <Link href="/notifications" className="relative grid size-10 place-items-center rounded-2xl bg-white/90 shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md dark:bg-white/10 dark:ring-white/10 dark:hover:bg-white/15">
        <Bell className="size-5 transition-transform duration-300 hover:rotate-12" />
        {unread > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-[#C66170] px-1.5 py-0.5 text-center text-[10px] font-bold text-white shadow-[0_0_8px_rgba(198,97,112,0.6)] animate-pulse-soft">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>
      <button onClick={toggleTheme} className="grid size-10 place-items-center rounded-2xl bg-white/90 shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md dark:bg-white/10 dark:ring-white/10 dark:hover:bg-white/15" type="button" aria-label="Tema">
        {dark ? <Sun className="size-5 text-amber-400 animate-pulse-soft" /> : <Moon className="size-5 text-slate-700" />}
      </button>
      <div className="group relative">
        <Link href={profileHref} className="relative grid size-12 place-items-center rounded-full text-sm font-bold text-white shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-md">
          <span className="grid size-12 place-items-center overflow-hidden rounded-full bg-[#C66170]">
            {photoUrl ? <img src={resolveDrivePhotoUrl(photoUrl)} alt={name} className="size-full object-cover" /> : name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
          </span>
          <span className="absolute -right-0.5 top-0 size-3 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse-green" />
        </Link>
        <div className="invisible absolute right-0 top-12 z-50 w-56 translate-y-2 pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
          <div className="rounded-[22px] border border-black/5 bg-white p-2 shadow-2xl shadow-black/10 ring-1 ring-black/5 dark:border-white/10 dark:bg-[#1F1F1F] dark:ring-white/10">
            <div className="border-b border-black/5 px-3 py-3 dark:border-white/10">
              <p className="truncate text-sm font-bold text-black dark:text-white">{name}</p>
              <p className="text-xs text-black/45 dark:text-white/45">Account staff</p>
            </div>
            <Link href={profileHref} className="mt-2 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-black/75 transition hover:bg-paradise-softPink/60 dark:text-white/75 dark:hover:bg-white/10">
              <UserRound className="size-4" />
              {userId === "PC_CASSA" ? "Cambia profilo" : "Profilo"}
            </Link>
            <Link href={userId === "PC_CASSA" ? profileHref : "/my-shifts"} className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-black/75 transition hover:bg-paradise-softPink/60 dark:text-white/75 dark:hover:bg-white/10">
              <CalendarDays className="size-4" />
              {userId === "PC_CASSA" ? "Cambia profilo" : "Turni"}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold text-black/75 transition hover:bg-paradise-softPink/60 dark:text-white/75 dark:hover:bg-white/10"
            >
              <LogOut className="size-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
