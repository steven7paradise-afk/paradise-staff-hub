"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Building2, CheckCheck, ExternalLink } from "lucide-react";
import { parseNotificationMetadata } from "@/lib/notification-metadata";
import { isAttendanceNotification, resolveNotificationActionUrl } from "@/lib/notification-action-url";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  actionUrl: string | null;
  createdAt: string;
  read: boolean;
  type: string;
};

export function NotificationsPopover({ initialUnread = 0 }: { initialUnread?: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications/latest", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count ?? 0);
        if (Array.isArray(data.items)) {
          setItems(data.items);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markAllAsRead() {
    try {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setUnreadCount(0);
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleNotificationClick(item: NotificationItem) {
    if (!item.read) {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
        keepalive: true,
      }).catch(() => null);
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    }
    setIsOpen(false);
    if (isAttendanceNotification(item)) {
      const pauseExceeded = /pausa.*superat|superamento.*pausa/i.test(`${item.title} ${item.message}`);
      window.alert(`${pauseExceeded ? "Attenzione: pausa superata" : "Avviso timbratura"}\n\n${item.message}`);
      return;
    }
    const meta = parseNotificationMetadata(item);
    window.location.assign(resolveNotificationActionUrl(item, { isOrder: meta.category.isOrder }));
  }

  function formatTime(iso?: string | null) {
    if (!iso) return "";
    try {
      const date = new Date(iso);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) fetchNotifications();
        }}
        className="relative grid size-10 place-items-center rounded-2xl bg-white/90 shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md dark:bg-white/10 dark:ring-white/10 dark:hover:bg-white/15 active:scale-95"
        aria-label="Notifiche"
      >
        <Bell className="size-5 transition-transform duration-300 hover:rotate-12 text-[#4E382C] dark:text-white" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-5 h-5 place-items-center rounded-full bg-[#C66170] px-1.5 text-[10px] font-black text-white shadow-sm animate-pulse-soft">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-[#E8D8CF] bg-white p-4 shadow-2xl space-y-3 dark:border-white/10 dark:bg-[#1F1F1F]">
          <div className="flex items-center justify-between border-b border-[#E8D8CF] pb-3 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-[#C66170]" />
              <h4 className="font-serif text-base font-bold text-[#1F1F1F] dark:text-white">
                Notifiche & Avvisi
              </h4>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#FFF1F6] px-2 py-0.5 text-[10px] font-black text-[#B9476D]">
                  {unreadCount} nuove
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#C66170] hover:underline"
                title="Segna tutte come lette"
              >
                <CheckCheck className="size-3.5" />
                <span>Lette</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {items.length > 0 ? (
              items.map((item) => {
                const meta = parseNotificationMetadata(item);
                return (
                  <div
                    key={item.id}
                    onClick={() => void handleNotificationClick(item)}
                    className={cn(
                      "group relative rounded-xl p-3 text-left transition cursor-pointer border-l-4 space-y-1.5",
                      meta.category.borderLeft,
                      !item.read
                        ? "bg-[#FFF8FA] border-t border-r border-b border-[#FAD0E0] dark:bg-white/5"
                        : "bg-[#FFFDFC] border-t border-r border-b border-[#E8D8CF]/60 hover:bg-[#FFF7F3] dark:bg-transparent dark:border-white/10"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider", meta.category.badge)}>
                          {meta.category.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-[#8D5E49] dark:text-neutral-400">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>

                    <p className={`text-xs font-bold ${!item.read ? "text-[#9E2B4D] dark:text-pink-300" : "text-[#3A2A23] dark:text-white"}`}>
                      {item.title}
                    </p>

                    <p className="line-clamp-2 text-xs font-medium text-[#6F625C] dark:text-neutral-300">
                      {item.message}
                    </p>

                    {/* Salone & Persona Pills */}
                    {(meta.salonName || meta.personName) && (
                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-black/5 dark:border-white/5">
                        {meta.salonName && meta.salonColor && (
                          <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase", meta.salonColor.badge)}>
                            <Building2 className="size-2.5" />
                            {meta.salonName}
                          </span>
                        )}
                        {meta.personName && meta.personColor && (
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase", meta.personColor.badge)}>
                            <span className={cn("grid size-3 place-items-center rounded-full text-[7px] font-black", meta.personColor.avatarBg)}>
                              {meta.personInitials}
                            </span>
                            {meta.personName}
                          </span>
                        )}
                      </div>
                    )}

                    {!isAttendanceNotification(item) && (item.actionUrl || item.type === "COMUNICAZIONE") && (
                      <Link
                        href={resolveNotificationActionUrl(item, { isOrder: meta.category.isOrder })}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleNotificationClick(item);
                        }}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#B9476D] hover:underline"
                      >
                        <span>Apri dettaglio</span>
                        <ExternalLink className="size-3" />
                      </Link>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs font-semibold text-[#8D5E49] dark:text-neutral-400">
                Nessuna notifica recente.
              </div>
            )}
          </div>

          <div className="border-t border-[#E8D8CF] pt-2 flex items-center justify-between dark:border-white/10">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-[#8D5E49] hover:text-[#1F1F1F] dark:text-neutral-300 dark:hover:text-white"
            >
              Vedi tutte le comunicazioni →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
