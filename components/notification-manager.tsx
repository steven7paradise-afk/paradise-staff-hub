"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  Bookmark,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck2,
  LayoutGrid,
  Mail,
  MailPlus,
  Megaphone,
  MessageSquareText,
  Newspaper,
  PencilLine,
  Pin,
  Search,
  Send,
  Share2,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { ResponseDetailModal } from "@/components/response-detail-modal";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  page: number;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
};

type Recipient = { id: string; name: string; locationId: string | null; locationName: string };
type LocationOption = { id: string; name: string };
type Filter = "ALL" | "IMPORTANT" | "UNREAD";

const typeStyles: Record<string, { icon: typeof Megaphone; bg: string; pill: string; label: string }> = {
  COMUNICAZIONE: { icon: Megaphone, bg: "bg-pink-100 text-[#C66170]", pill: "bg-pink-100 text-[#C66170]", label: "Comunicazione" },
  TASK: { icon: CheckCircle2, bg: "bg-violet-100 text-violet-700", pill: "bg-violet-100 text-violet-700", label: "Task" },
  RICHIESTA: { icon: FileCheck2, bg: "bg-amber-100 text-amber-700", pill: "bg-amber-100 text-amber-700", label: "Richiesta" },
  DOCUMENTO: { icon: Mail, bg: "bg-blue-100 text-blue-700", pill: "bg-blue-100 text-blue-700", label: "Documento" },
  TIMBRATURA: { icon: BellRing, bg: "bg-rose-100 text-rose-700", pill: "bg-rose-100 text-rose-700", label: "Timbratura" },
  CONTRACT_EXPIRY: { icon: AlertTriangle, bg: "bg-red-100 text-red-700", pill: "bg-red-100 text-red-700", label: "Contratto" },
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

function shortDateLabel(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

function isImportant(item: NotificationItem) {
  const text = `${item.title} ${item.message} ${item.type}`.toLowerCase();
  return item.page === 1 || /importante|urgent|scadenza|rifiutat|approvat|firma|task|timbratura|contratto/.test(text);
}

function isUrgent(item: NotificationItem) {
  const text = `${item.title} ${item.message} ${item.type}`.toLowerCase();
  return /urgent|scadenza|mancat|rifiutat|blocc|contratto/.test(text);
}

function needsSignature(item: NotificationItem) {
  const text = `${item.title} ${item.message}`.toLowerCase();
  return /firma|firmare|confermare|regolamento|documento/.test(text);
}

function notificationStatus(item: NotificationItem) {
  if (item.read) return { label: "Letta", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
  if (needsSignature(item)) return { label: "Da confermare", className: "bg-amber-50 text-amber-700 border border-amber-200" };
  if (item.type === "DOCUMENTO") return { label: "Documento", className: "bg-blue-50 text-blue-700 border border-blue-200" };
  return { label: "Nuova", className: "bg-gradient-to-r from-[#D96B94] to-[#B83D7F] text-white shadow-2xs" };
}

export function NotificationManager({
  role,
  notifications,
  recipients,
  locations,
  currentUserId = "",
  currentUserName = "",
}: {
  role: Role;
  notifications: NotificationItem[];
  recipients: Recipient[];
  locations: LocationOption[];
  currentUserId?: string;
  currentUserName?: string;
}) {
  const canSend = role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN" || role === "RESPONSABILE";
  const [viewMode, setViewMode] = useState<"BLOG" | "LIST">("BLOG");
  const [selectedResponseIdForModal, setSelectedResponseIdForModal] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(role === "RESPONSABILE" ? "location" : "all");
  const [targetId, setTargetId] = useState(locations[0]?.id ?? recipients[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState(notifications);

  // Active communication for the Blog Reader view (defaults to latest)
  const [activeItem, setActiveItem] = useState<NotificationItem | null>(() => notifications[0] ?? null);

  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const router = useRouter();

  const recipientsByLocation = locations.map((location) => ({
    ...location,
    recipients: recipients.filter((recipient) => recipient.locationId === location.id),
  }));
  const recipientsWithoutLocation = recipients.filter((recipient) => !recipient.locationId);

  useEffect(() => {
    setItems(notifications);
    if (!activeItem && notifications.length > 0) {
      setActiveItem(notifications[0]);
    }
  }, [notifications]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      unread: items.filter((item) => !item.read).length,
      sign: items.filter(needsSignature).length,
      urgent: items.filter(isUrgent).length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((item) => (filter === "IMPORTANT" ? isImportant(item) : filter === "UNREAD" ? !item.read : true))
      .filter((item) => !q || `${item.title} ${item.message} ${item.type}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filter, items, query]);

  async function markRead(notification: NotificationItem) {
    if (notification.read) return;
    setItems((current) => current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)));
    if (activeItem?.id === notification.id) {
      setActiveItem((current) => (current ? { ...current, read: true } : current));
    }
    await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notification.id }),
    });
    router.refresh();
  }

  async function deleteNotification(notification: NotificationItem) {
    const ok = window.confirm("Eliminare questa notifica?");
    if (!ok) return;
    setItems((current) => current.filter((item) => item.id !== notification.id));
    if (activeItem?.id === notification.id) {
      const remaining = items.filter((item) => item.id !== notification.id);
      setActiveItem(remaining[0] ?? null);
    }
    await fetch(`/api/notifications/${notification.id}`, { method: "DELETE" });
    router.refresh();
  }

  // 1-Click action: Select and view in Blog Reader
  function selectCommunication(item: NotificationItem) {
    setActiveItem(item);
    if (!item.read) {
      void markRead(item);
    }
    if (viewMode === "LIST") {
      setViewMode("BLOG");
    }
  }

  async function send() {
    setSending(true);
    setStatus("Invio comunicazione in corso...");
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, targetId, title, message, type: "COMUNICAZIONE" }),
    });
    const data = await response.json();
    setSending(false);
    if (!response.ok) {
      setStatus(data.error ?? "Comunicazione non inviata.");
      return;
    }
    const newPost: NotificationItem = {
      id: String(Date.now()),
      title,
      message,
      type: "COMUNICAZIONE",
      page: 1,
      read: true,
      actionUrl: "/notifications",
      createdAt: new Date().toISOString(),
    };
    setItems((prev) => [newPost, ...prev]);
    setActiveItem(newPost);
    setTitle("");
    setMessage("");
    setStatus(`✓ Comunicazione pubblicata con successo ed inviata a ${data.sent} destinatari.`);
    setTimeout(() => {
      setOpen(false);
      setStatus("");
    }, 1200);
    router.refresh();
  }

  // Find next and previous index in filtered list
  const activeIndex = activeItem ? filteredItems.findIndex((item) => item.id === activeItem.id) : -1;
  const prevPost = activeIndex > 0 ? filteredItems[activeIndex - 1] : null;
  const nextPost = activeIndex >= 0 && activeIndex < filteredItems.length - 1 ? filteredItems[activeIndex + 1] : null;

  return (
    <>
      <div className="w-full max-w-none space-y-6">
        {/* Top Header & View Controls */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xs mb-1">
              Blog & Comunicazioni
            </span>
            <h1 className="text-3xl font-black tracking-tight text-[#1F1F1F]">Comunicazioni Aziendali</h1>
            <p className="mt-1 text-xs font-semibold text-black/55">
              Il blog interno con i messaggi, gli avvisi e le disposizioni ufficiali Paradise.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* View Mode Toggle: Blog Reader vs List */}
            <div className="inline-flex items-center rounded-2xl border border-black/10 bg-white p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("BLOG")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition active:scale-95",
                  viewMode === "BLOG"
                    ? "bg-gradient-to-r from-[#D96B94] to-[#B83D7F] text-white shadow-xs"
                    : "text-black/60 hover:text-black hover:bg-neutral-50"
                )}
              >
                <Newspaper className="size-4" />
                <span>Vista Blog</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("LIST")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition active:scale-95",
                  viewMode === "LIST"
                    ? "bg-gradient-to-r from-[#D96B94] to-[#B83D7F] text-white shadow-xs"
                    : "text-black/60 hover:text-black hover:bg-neutral-50"
                )}
              >
                <LayoutGrid className="size-4" />
                <span>Vista Elenco</span>
              </button>
            </div>

            {canSend ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-6 py-3 text-xs font-black text-white shadow-md transition hover:opacity-95 active:scale-95"
              >
                <MailPlus className="size-4" /> Nuova comunicazione
              </button>
            ) : null}
          </div>
        </div>

        {/* Stats Metrics Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[
            { label: "Totali comunicazioni", value: stats.total, icon: MessageSquareText, bg: "bg-pink-100 text-[#C66170]" },
            { label: "Non lette", value: stats.unread, icon: Mail, bg: "bg-violet-100 text-violet-700" },
            { label: "Da firmare", value: stats.sign, icon: PencilLine, bg: "bg-amber-100 text-amber-700" },
            { label: "Urgenti", value: stats.urgent, icon: AlertTriangle, bg: "bg-rose-100 text-rose-700" },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.label} className="flex items-center gap-3.5 p-4 sm:p-5 border border-black/5 shadow-2xs">
                <div className={cn("grid size-11 place-items-center rounded-2xl shrink-0", metric.bg)}>
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-black tracking-tight text-[#1F1F1F]">{metric.value}</p>
                  <p className="text-xs font-bold text-black/50 truncate">{metric.label}</p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* MAIN CONTENT AREA */}
        {viewMode === "BLOG" ? (
          /* BLOG READER VIEW (2 Columns) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Featured Main Article (8 Cols) */}
            <div className="lg:col-span-8 space-y-4">
              {activeItem ? (
                <article className="overflow-hidden rounded-[32px] border border-[#F6C6DE] bg-white shadow-xl transition-all">
                  {/* Article Banner Header */}
                  <div className="border-b border-[#F9D5E7] bg-gradient-to-br from-[#FFF7FB] via-[#FFF0F6] to-[#FFEBF4] p-6 sm:p-8 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {isImportant(activeItem) ? (
                          <span className="rounded-full bg-[#E13D81] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-2xs">
                            Importante
                          </span>
                        ) : null}
                        <span className="rounded-full bg-white/80 border border-[#F4D3E2] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#B83D7F]">
                          {typeStyles[activeItem.type]?.label || activeItem.type}
                        </span>
                      </div>
                      <span className={cn("rounded-full px-3 py-1 text-xs font-black", notificationStatus(activeItem).className)}>
                        {notificationStatus(activeItem).label}
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1F1F1F] leading-tight">
                      {activeItem.title}
                    </h2>

                    <div className="flex items-center gap-4 text-xs font-bold text-black/60 pt-1 border-t border-black/5">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5 text-[#D96B94]" />
                        {dateLabel(activeItem.createdAt)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <User className="size-3.5 text-[#D96B94]" />
                        Direzione Paradise
                      </span>
                    </div>
                  </div>

                  {/* Article Content Body */}
                  <div className="p-6 sm:p-8 space-y-6">
                    <div className="rounded-3xl border border-black/5 bg-[#FFFDFC] p-6 sm:p-8 shadow-2xs">
                      <p className="whitespace-pre-line text-base font-semibold leading-relaxed text-[#2C2C2C]">
                        {activeItem.message}
                      </p>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                      {!activeItem.read ? (
                        <button
                          type="button"
                          onClick={() => markRead(activeItem)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-3.5 text-xs font-black text-white shadow-md transition hover:opacity-95 active:scale-95 w-full sm:w-auto"
                        >
                          <Check className="size-4" strokeWidth={3} />
                          <span>Conferma e segna come letta</span>
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-black text-emerald-800">
                          <Check className="size-4 text-emerald-600" strokeWidth={3} />
                          <span>Comunicazione letta</span>
                        </div>
                      )}

                      {activeItem.actionUrl && activeItem.actionUrl !== "/notifications" ? (
                        <a
                          href={activeItem.actionUrl}
                          className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-black/10 bg-neutral-100 px-5 py-3 text-xs font-black text-black/80 hover:bg-neutral-200 transition active:scale-95 w-full sm:w-auto"
                        >
                          <span>Apri dettaglio collegato</span>
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {/* Navigation Footer (Prev / Next Post) */}
                  <div className="flex items-center justify-between border-t border-black/5 bg-neutral-50/70 px-6 py-4">
                    {prevPost ? (
                      <button
                        type="button"
                        onClick={() => selectCommunication(prevPost)}
                        className="inline-flex items-center gap-1.5 text-xs font-black text-black/60 hover:text-[#B83D7F] transition truncate max-w-[200px]"
                      >
                        <ChevronLeft className="size-4" />
                        <span className="truncate">Prec: {prevPost.title}</span>
                      </button>
                    ) : (
                      <span />
                    )}

                    {nextPost ? (
                      <button
                        type="button"
                        onClick={() => selectCommunication(nextPost)}
                        className="inline-flex items-center gap-1.5 text-xs font-black text-black/60 hover:text-[#B83D7F] transition truncate max-w-[200px]"
                      >
                        <span className="truncate">Succ: {nextPost.title}</span>
                        <ChevronRight className="size-4" />
                      </button>
                    ) : null}
                  </div>
                </article>
              ) : (
                <div className="rounded-[32px] border border-dashed border-black/10 bg-white p-12 text-center text-sm font-bold text-black/40">
                  Nessuna comunicazione selezionata.
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Blog Stream & Search (4 Cols) */}
            <div className="lg:col-span-4 space-y-4">
              <Card className="p-5 border border-black/5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#B83D7F] flex items-center gap-2">
                    <Newspaper className="size-4 text-[#D96B94]" /> Tutte le Comunicazioni
                  </h3>
                  <span className="rounded-full bg-[#FFF0F6] px-2.5 py-0.5 text-[10px] font-black text-[#B83D7F]">
                    {filteredItems.length}
                  </span>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-black/40" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cerca per titolo o parola..."
                    className="h-10 w-full rounded-2xl border border-black/10 bg-neutral-50/80 pl-10 pr-4 text-xs font-bold outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20 transition"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5">
                  {[
                    ["ALL", "Tutte"],
                    ["IMPORTANT", "Importanti"],
                    ["UNREAD", "Non lette"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value as Filter)}
                      className={cn(
                        "rounded-xl px-3 py-1.5 text-[11px] font-black transition active:scale-95",
                        filter === value
                          ? "bg-gradient-to-r from-[#D96B94] to-[#B83D7F] text-white shadow-2xs"
                          : "bg-neutral-100 text-black/60 hover:bg-neutral-200"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Communications Feed Stream (1-Click selection) */}
                <div className="divide-y divide-black/5 max-h-[620px] overflow-y-auto pr-1 space-y-2">
                  {filteredItems.length === 0 ? (
                    <p className="p-4 text-center text-xs font-bold text-black/40">Nessuna comunicazione trovata.</p>
                  ) : (
                    filteredItems.map((item) => {
                      const isSelected = activeItem?.id === item.id;
                      const style = typeStyles[item.type] ?? typeStyles.COMUNICAZIONE;
                      const Icon = style.icon;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectCommunication(item)}
                          className={cn(
                            "w-full text-left p-3.5 rounded-2xl border transition-all duration-150 flex flex-col gap-1.5 active:scale-98 shadow-2xs mt-2",
                            isSelected
                              ? "border-[#D96B94] bg-gradient-to-r from-[#FFF0F6] via-[#FFF7FB] to-white ring-2 ring-[#D96B94]/20 shadow-xs"
                              : item.read
                              ? "border-black/5 bg-white hover:bg-neutral-50"
                              : "border-[#F9D5E7] bg-[#FFF8FB] hover:bg-[#FCE5F3]"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={cn("grid size-7 place-items-center rounded-xl shrink-0", style.bg)}>
                                <Icon className="size-3.5" />
                              </div>
                              <span className="text-[10px] font-black uppercase text-black/50">
                                {shortDateLabel(item.createdAt)}
                              </span>
                            </div>
                            {!item.read && (
                              <span className="size-2.5 rounded-full bg-[#E13D81] ring-4 ring-pink-100 animate-pulse" />
                            )}
                          </div>

                          <h4 className="text-xs font-black text-[#1F1F1F] line-clamp-1 leading-snug">
                            {item.title}
                          </h4>

                          <p className="text-[11px] font-semibold text-black/50 line-clamp-2 leading-normal">
                            {item.message}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>
          </div>
        ) : (
          /* TRADITIONAL LIST VIEW */
          <Card className="p-0 border border-black/5 shadow-2xs overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-black/5 p-6 lg:flex-row lg:items-center lg:justify-between bg-white">
              <h3 className="text-lg font-black text-[#1F1F1F]">
                {filter === "IMPORTANT" ? "Comunicazioni importanti" : filter === "UNREAD" ? "Comunicazioni non lette" : "Tutte le comunicazioni"}
              </h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block sm:w-80">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-black/40" />
                  <Field value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca comunicazione..." className="pl-11" />
                </label>
              </div>
            </div>

            <div className="divide-y divide-black/5 bg-white">
              {filteredItems.length === 0 ? (
                <div className="p-6 text-sm font-semibold text-black/50">Nessuna comunicazione trovata.</div>
              ) : (
                filteredItems.map((notification) => {
                  const style = typeStyles[notification.type] ?? typeStyles.COMUNICAZIONE;
                  const Icon = style.icon;
                  const statusInfo = notificationStatus(notification);

                  return (
                    <button
                      key={notification.id}
                      className="grid w-full gap-4 p-6 text-left transition hover:bg-[#FAF7F9] md:grid-cols-[64px_1fr_auto] md:items-center"
                      onClick={() => selectCommunication(notification)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        void deleteNotification(notification);
                      }}
                    >
                      <div className={cn("grid size-14 place-items-center rounded-2xl shrink-0", style.bg)}>
                        <Icon className="size-6" />
                      </div>
                      <div className="min-w-0">
                        {isImportant(notification) ? (
                          <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold uppercase text-[#E13D81] mb-1 inline-block">
                            Importante
                          </span>
                        ) : null}
                        <p className="text-base font-black text-[#1F1F1F]">{notification.title}</p>
                        <p className="mt-1 text-xs font-semibold text-black/50">
                          {notification.type.toLowerCase()} <span className="mx-2">•</span> {dateLabel(notification.createdAt)}
                        </p>
                        <p className="mt-2 line-clamp-1 text-xs font-medium text-black/60 leading-relaxed">{notification.message}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("rounded-full px-3 py-1 text-xs font-bold", statusInfo.className)}>{statusInfo.label}</span>
                        <ChevronRight className="size-5 text-black/40" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        )}
      </div>

      {/* NEW COMMUNICATION MODAL */}
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-xl border border-black/10 shadow-2xl p-6 sm:p-8 rounded-[32px] bg-white">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xs">
                  Nuovo Post
                </span>
                <h2 className="mt-2 text-2xl font-black text-[#1F1F1F]">Nuova comunicazione</h2>
                <p className="mt-1 text-xs font-semibold text-black/50">
                  Pubblica un articolo sul blog aziendale ed invia notifica allo staff.
                </p>
              </div>
              <button className="grid size-10 place-items-center rounded-full border border-black/10 bg-neutral-50 hover:bg-neutral-100 transition" onClick={() => setOpen(false)}>
                <X className="size-5" />
              </button>
            </div>

            <div className="grid gap-4">
              {role !== "RESPONSABILE" ? (
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-black/50">Destinatari</span>
                  <Select
                    value={target}
                    onChange={(event) => {
                      setTarget(event.target.value);
                      setTargetId(event.target.value === "location" ? locations[0]?.id ?? "" : recipients[0]?.id ?? "");
                    }}
                  >
                    <option value="all">Tutti lo staff</option>
                    <option value="location">Specifico salone</option>
                    <option value="user">Singola persona</option>
                  </Select>
                </label>
              ) : null}

              {target === "location" ? (
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-black/50">Salone</span>
                  <Select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null}

              {target === "user" ? (
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-black/50">Persona</span>
                  <Select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                    {recipientsByLocation.map((location) =>
                      location.recipients.length > 0 ? (
                        <optgroup key={location.id} label={location.name}>
                          {location.recipients.map((recipient) => (
                            <option key={recipient.id} value={recipient.id}>
                              {recipient.name}
                            </option>
                          ))}
                        </optgroup>
                      ) : null
                    )}
                    {recipientsWithoutLocation.length > 0 ? (
                      <optgroup label="Senza salone">
                        {recipientsWithoutLocation.map((recipient) => (
                          <option key={recipient.id} value={recipient.id}>
                            {recipient.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </Select>
                </label>
              ) : null}

              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-black/50">Titolo comunicazione</span>
                <Field value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Es: Nuove direttive per la piega mossa" />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-black/50">Testo del messaggio</span>
                <textarea
                  className="min-h-36 w-full rounded-2xl border border-black/10 bg-white p-4 text-xs font-bold outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20 transition"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Scrivi qui la comunicazione completa..."
                />
              </label>

              {status ? <p className="rounded-2xl bg-[#FFF0F6] border border-[#F9D5E7] p-3 text-xs font-black text-[#B83D7F]">{status}</p> : null}

              <button
                type="button"
                onClick={send}
                disabled={sending}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-8 py-3.5 text-xs font-black text-white shadow-md transition hover:opacity-95 active:scale-95 disabled:opacity-60 mt-2"
              >
                <Send className="size-4" />
                <span>{sending ? "Pubblicazione..." : "Pubblica sul Blog ed Invia"}</span>
              </button>
            </div>
          </Card>
        </div>
      ) : null}

      {selectedResponseIdForModal && (
        <ResponseDetailModal
          responseId={selectedResponseIdForModal}
          isOpen={true}
          onClose={() => setSelectedResponseIdForModal(null)}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserRole={role}
        />
      )}
    </>
  );
}
