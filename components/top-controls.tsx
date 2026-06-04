"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Bell, CalendarDays, Languages, LogOut, Moon, Sun, UserRound } from "lucide-react";

type Language = "EN" | "ES" | "IT";

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
}: {
  unread: number;
  name: string;
  photoUrl: string | null;
}) {
  const [language, setLanguage] = useState<Language>("IT");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("paradise-language") as Language | null;
    if (saved === "EN" || saved === "ES" || saved === "IT") {
      setLanguage(saved);
      document.documentElement.lang = saved.toLowerCase();
    }
    const savedTheme = window.localStorage.getItem("paradise-theme");
    if (savedTheme === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
      window.requestAnimationFrame(() => applyThemeVariables(true));
    } else {
      window.requestAnimationFrame(() => applyThemeVariables(false));
    }
  }, []);

  function changeLanguage(next: Language) {
    setLanguage(next);
    window.localStorage.setItem("paradise-language", next);
    document.documentElement.lang = next.toLowerCase();
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("paradise-theme", next ? "dark" : "light");
    applyThemeVariables(next);
  }

  return (
    <div className="flex items-center justify-end gap-3">
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
      <div className="hidden items-center gap-1 rounded-2xl bg-white/80 p-1 shadow-sm ring-1 ring-black/5 backdrop-blur-md dark:bg-white/10 dark:ring-white/10 sm:flex">
        <Languages className="ml-2 size-4 text-black/45 dark:text-white/45" />
        {(["EN", "ES", "IT"] as Language[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => changeLanguage(item)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200 ${language === item ? "bg-[#C66170] text-white shadow-sm" : "text-black/55 hover:bg-paradise-softPink hover:text-paradise-noir dark:text-white/70 dark:hover:bg-white/10"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="group relative">
        <Link href="/profile" className="relative grid size-12 place-items-center rounded-full text-sm font-bold text-white shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-md">
          <span className="grid size-12 place-items-center overflow-hidden rounded-full bg-[#C66170]">
            {photoUrl ? <img src={photoUrl} alt={name} className="size-full object-cover" /> : name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
          </span>
          <span className="absolute -right-0.5 top-0 size-3 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse-green" />
        </Link>
        <div className="invisible absolute right-0 top-12 z-50 w-56 translate-y-2 pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
          <div className="rounded-[22px] border border-black/5 bg-white p-2 shadow-2xl shadow-black/10 ring-1 ring-black/5 dark:border-white/10 dark:bg-[#1F1F1F] dark:ring-white/10">
            <div className="border-b border-black/5 px-3 py-3 dark:border-white/10">
              <p className="truncate text-sm font-bold text-black dark:text-white">{name}</p>
              <p className="text-xs text-black/45 dark:text-white/45">Account staff</p>
            </div>
            <Link href="/profile" className="mt-2 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-black/75 transition hover:bg-paradise-softPink/60 dark:text-white/75 dark:hover:bg-white/10">
              <UserRound className="size-4" />
              Profilo
            </Link>
            <Link href="/my-shifts" className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-black/75 transition hover:bg-paradise-softPink/60 dark:text-white/75 dark:hover:bg-white/10">
              <CalendarDays className="size-4" />
              Turni
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
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
