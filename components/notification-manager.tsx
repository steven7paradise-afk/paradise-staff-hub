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
  FileText,
  FileUp,
  Image as ImageIcon,
  LayoutGrid,
  Link as LinkIcon,
  Mail,
  MailPlus,
  Megaphone,
  MessageSquareText,
  Newspaper,
  Paperclip,
  PencilLine,
  Pin,
  Search,
  Send,
  Share2,
  Sparkles,
  Trash2,
  UploadCloud,
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
type SectionTab = "BLOG" | "ATTENDANCE" | "ALL";

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

function isAttendanceAlert(item: NotificationItem) {
  const text = `${item.title} ${item.message} ${item.type}`.toLowerCase();
  return item.type === "TIMBRATURA" || /superamento limite pausa|pausa|uscit|timbram|timbratura/.test(text);
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
  const [sectionTab, setSectionTab] = useState<SectionTab>("BLOG");
  const [selectedResponseIdForModal, setSelectedResponseIdForModal] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(role === "RESPONSABILE" ? "location" : "all");
  const [targetId, setTargetId] = useState(locations[0]?.id ?? recipients[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [customLinkUrl, setCustomLinkUrl] = useState("");
  const [customButtonText, setCustomButtonText] = useState("");
  
  // File Upload to Drive state
  const [attachedFileUrl, setAttachedFileUrl] = useState("");
  const [attachedFileName, setAttachedFileName] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);

  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState(notifications);

  // Active communication for the Blog Reader view (defaults to latest non-attendance post if in blog mode)
  const initialActive = useMemo(() => {
    return notifications.find((n) => !isAttendanceAlert(n)) ?? notifications[0] ?? null;
  }, [notifications]);

  const [activeItem, setActiveItem] = useState<NotificationItem | null>(initialActive);

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
      const defaultPost = notifications.find((n) => !isAttendanceAlert(n)) ?? notifications[0];
      setActiveItem(defaultPost);
    }
  }, [notifications]);

  // Handle Google Drive File Upload
  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setStatus("Caricamento allegato su Google Drive in corso...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/notifications/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setUploadingFile(false);

      if (!res.ok) {
        setStatus(data.error ?? "Errore durante il caricamento del file.");
        return;
      }

      setAttachedFileUrl(data.url);
      setAttachedFileName(data.name);
      setStatus("✓ File caricato su Google Drive con successo!");
    } catch (err) {
      console.error("Upload error:", err);
      setUploadingFile(false);
      setStatus("Errore durante il caricamento.");
    }
  }

  const stats = useMemo(() => {
    return {
      total: items.length,
      unread: items.filter((item) => !item.read).length,
      sign: items.filter(needsSignature).length,
      urgent: items.filter(isUrgent).length,
      attendance: items.filter(isAttendanceAlert).length,
      blog: items.filter((item) => !isAttendanceAlert(item)).length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((item) => {
        if (sectionTab === "BLOG") return !isAttendanceAlert(item);
        if (sectionTab === "ATTENDANCE") return isAttendanceAlert(item);
        return true;
      })
      .filter((item) => (filter === "IMPORTANT" ? isImportant(item) : filter === "UNREAD" ? !item.read : true))
      .filter((item) => !q || `${item.title} ${item.message} ${item.type}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filter, items, query, sectionTab]);

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
  }  async function send() {
    setSending(true);
    setStatus("Invio comunicazione in corso...");

    const finalActionUrl = customLinkUrl.trim() || attachedFileUrl || "/notifications";
    const finalMessage = message.trim();

    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target,
        targetId,
        title,
        message: finalMessage,
        type: "COMUNICAZIONE",
        actionUrl: finalActionUrl,
      }),
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
      message: finalMessage,
      type: "COMUNICAZIONE",
      page: 1,
      read: true,
      actionUrl: finalActionUrl,
      createdAt: new Date().toISOString(),
    };
    setItems((prev) => [newPost, ...prev]);
    setActiveItem(newPost);
    setTitle("");
    setMessage("");
    setCustomLinkUrl("");
    setCustomButtonText("");
    setAttachedFileUrl("");
    setAttachedFileName("");
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

        {/* Section Tabs (Blog vs Timbrature Separati) */}
        <div className="flex flex-wrap items-center gap-2 border-b border-black/10 pb-3">
          {[
            { id: "BLOG", label: "📰 Blog Comunicazioni", count: stats.blog },
            { id: "ATTENDANCE", label: "⏱️ Avvisi Timbrature & Pause", count: stats.attendance },
            { id: "ALL", label: "📋 Tutte le Notifiche", count: stats.total },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSectionTab(tab.id as SectionTab);
                if (tab.id === "ATTENDANCE") {
                  const firstAttendance = items.find(isAttendanceAlert);
                  if (firstAttendance) setActiveItem(firstAttendance);
                } else if (tab.id === "BLOG") {
                  const firstBlog = items.find((n) => !isAttendanceAlert(n));
                  if (firstBlog) setActiveItem(firstBlog);
                }
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black transition active:scale-95",
                sectionTab === tab.id
                  ? "bg-white text-[#B83D7F] shadow-sm border border-[#F6C6DE] ring-1 ring-[#B83D7F]/20"
                  : "bg-neutral-100 text-black/60 hover:bg-neutral-200"
              )}
            >
              <span>{tab.label}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", sectionTab === tab.id ? "bg-[#FFF0F6] text-[#B83D7F]" : "bg-black/10 text-black/60")}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Stats Metrics Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[
            { label: "Totali comunicazioni", value: stats.blog, icon: MessageSquareText, bg: "bg-pink-100 text-[#C66170]" },
            { label: "Non lette", value: stats.unread, icon: Mail, bg: "bg-violet-100 text-violet-700" },
            { label: "Avvisi Timbrature", value: stats.attendance, icon: BellRing, bg: "bg-rose-100 text-rose-700" },
            { label: "Urgenti", value: stats.urgent, icon: AlertTriangle, bg: "bg-amber-100 text-amber-700" },
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
                    <div className="rounded-3xl border border-black/5 bg-[#FFFDFC] p-6 sm:p-8 shadow-2xs space-y-5">
                      <p className="whitespace-pre-line text-base font-semibold leading-relaxed text-[#2C2C2C]">
                        {activeItem.message
                          .replace(/\n\n📄 ALLEGATO DRIVE: \[.*?\]\(.*?\)/gi, "")
                          .replace(/📄 ALLEGATO DRIVE: \[.*?\]\(.*?\)/gi, "")
                          .trim()}
                      </p>

                      {/* Directly visible embedded image preview */}
                      {(() => {
                        const targetUrl = activeItem.actionUrl || activeItem.message;
                        const driveId = targetUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] || targetUrl.match(/id=([a-zA-Z0-9_-]+)/)?.[1];
                        const isImg = /\.(png|jpg|jpeg|webp|gif)($|\?|\))/i.test(targetUrl) || /\[.*?\.(png|jpg|jpeg|webp|gif)\]/i.test(activeItem.message) || !!driveId;

                        if (!isImg || (!activeItem.actionUrl && !driveId)) return null;

                        const imgSrc = driveId ? `/api/drive-image?id=${driveId}` : activeItem.actionUrl!;

                        return (
                          <div className="mt-4 overflow-hidden rounded-2xl border border-[#F4D3E2] bg-neutral-900/5 p-2 shadow-md flex flex-col items-center">
                            <img
                              src={imgSrc}
                              alt="Immagine allegata"
                              className="w-full max-h-[550px] object-contain rounded-xl bg-white"
                              onError={(e) => {
                                // Fallback to direct drive view if proxy fails
                                if (driveId && e.currentTarget.src.includes("/api/drive-image")) {
                                  e.currentTarget.src = `https://lh3.googleusercontent.com/d/${driveId}`;
                                }
                              }}
                            />
                          </div>
                        );
                      })()}
                    </div>

                    {/* Attachment / Action Link Button */}
                    {activeItem.actionUrl && activeItem.actionUrl !== "/notifications" ? (
                      <div className="rounded-2xl border border-[#F4D3E2] bg-[#FFF5F9] p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {activeItem.actionUrl.includes("drive.google.com") || activeItem.actionUrl.endsWith(".pdf") ? (
                            <FileText className="size-5 text-[#B83D7F]" />
                          ) : (
                            <LinkIcon className="size-5 text-[#B83D7F]" />
                          )}
                          <span className="text-xs font-bold text-[#1F1F1F]">
                            {/\.(png|jpg|jpeg|webp|gif)($|\?)/i.test(activeItem.actionUrl) || activeItem.message.toLowerCase().includes(".png")
                              ? "Allegato Immagine (Google Drive)"
                              : activeItem.actionUrl.endsWith(".pdf")
                              ? "Allegato Documento PDF (Google Drive)"
                              : "Risorsa / Link Esterno Collegato"}
                          </span>
                        </div>
                        <a
                          href={activeItem.actionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-6 py-2.5 text-xs font-black text-white shadow-md hover:opacity-95 transition active:scale-95 w-full sm:w-auto"
                        >
                          <span>
                            {/\.(png|jpg|jpeg|webp|gif)($|\?)/i.test(activeItem.actionUrl) || activeItem.message.toLowerCase().includes(".png")
                              ? "Apri Immagine Originale ↗"
                              : activeItem.actionUrl.endsWith(".pdf")
                              ? "Visualizza PDF ↗"
                              : "Apri Risorsa ↗"}
                          </span>
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                    ) : null}

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
                  Nessuna comunicazione in questa sezione.
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Blog Stream & Search (4 Cols) */}
            <div className="lg:col-span-4 space-y-4">
              <Card className="p-5 border border-black/5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#B83D7F] flex items-center gap-2">
                    <Newspaper className="size-4 text-[#D96B94]" /> Elenco Comunicazioni
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
          <Card className="w-full max-w-xl border border-black/10 shadow-2xl p-6 sm:p-8 rounded-[32px] bg-white max-h-[90vh] overflow-y-auto">
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
                    <option value="all">Tutto lo staff (Tutti i saloni)</option>
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

              {/* Upload file on Google Drive */}
              <div className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-black/50">Allegato Immagine o PDF (Google Drive)</span>
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-black/10 bg-neutral-50 px-4 py-2.5 text-xs font-bold text-black/70 hover:bg-neutral-100 transition active:scale-95">
                    <UploadCloud className="size-4 text-[#D96B94]" />
                    <span>{uploadingFile ? "Caricamento in corso..." : "Carica File (Immagine o PDF)"}</span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
                  </label>
                  {attachedFileName ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-pink-50 border border-pink-200 px-3 py-1.5 text-xs font-bold text-[#B83D7F]">
                      <Paperclip className="size-3.5" />
                      <span className="truncate max-w-[180px]">{attachedFileName}</span>
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Custom Link & Button */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-black/50">Link Esterno (opzionale)</span>
                  <Field value={customLinkUrl} onChange={(event) => setCustomLinkUrl(event.target.value)} placeholder="https://..." />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-black/50">Testo Pulsante (opzionale)</span>
                  <Field value={customButtonText} onChange={(event) => setCustomButtonText(event.target.value)} placeholder="Es: Apri documento ↗" />
                </label>
              </div>

              {status ? <p className="rounded-2xl bg-[#FFF0F6] border border-[#F9D5E7] p-3 text-xs font-black text-[#B83D7F]">{status}</p> : null}

              <button
                type="button"
                onClick={send}
                disabled={sending || uploadingFile}
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
