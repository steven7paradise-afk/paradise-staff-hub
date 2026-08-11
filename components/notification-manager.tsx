"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  Bookmark,
  Building2,
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
  Filter,
  Image as ImageIcon,
  Link as LinkIcon,
  Mail,
  MailPlus,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Newspaper,
  Paperclip,
  PencilLine,
  Pin,
  Search,
  Send,
  Share2,
  ShoppingBag,
  Sparkles,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { Badge, Button, Card, Field } from "@/components/ui";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { ResponseDetailModal } from "@/components/response-detail-modal";
import { parseNotificationMetadata } from "@/lib/notification-metadata";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";

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

type Recipient = { id: string; name: string; photoUrl: string | null; locationId: string | null; locationName: string };
type LocationOption = { id: string; name: string };
type Filter = "ALL" | "IMPORTANT" | "UNREAD";
type SectionTab = "BLOG" | "SENT" | "ATTENDANCE" | "ALL";

type CommunicationReader = { id: string; name: string; photoUrl: string | null };
type CommunicationComment = {
  id: string;
  userId: string;
  userName: string;
  photoUrl: string | null;
  message: string;
  createdAt: string;
};
type CommunicationEngagement = {
  readers: CommunicationReader[];
  recipientCount: number;
  comments: CommunicationComment[];
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "P";
}

function displayNotificationTitle(title: string) {
  return title.replace(/^\s*Modulo\s+Compilato\s*:\s*/i, "").trim();
}

function ProfileAvatar({ person, size = "md" }: { person: CommunicationReader; size?: "sm" | "md" }) {
  const photo = resolveDrivePhotoUrl(person.photoUrl);
  return (
    <span className="group relative inline-flex shrink-0" title={person.name}>
      <span className={cn(
        "grid overflow-hidden rounded-full border-2 border-white bg-[#F4D7E4] place-items-center font-black text-[#8E334E] shadow-sm",
        size === "sm" ? "size-8 text-[10px]" : "size-10 text-xs",
      )}>
        {photo ? <img src={photo} alt={person.name} className="size-full object-cover" /> : initials(person.name)}
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#17151A] px-2.5 py-1.5 text-[10px] font-bold text-white shadow-lg group-hover:block">
        {person.name}
      </span>
    </span>
  );
}

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
  focusNotificationId = null,
  initialSection = "BLOG",
  openCommunicationDirectly = false,
}: {
  role: Role;
  notifications: NotificationItem[];
  recipients: Recipient[];
  locations: LocationOption[];
  currentUserId?: string;
  currentUserName?: string;
  focusNotificationId?: string | null;
  initialSection?: SectionTab;
  openCommunicationDirectly?: boolean;
}) {
  const canSend = role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN" || role === "RESPONSABILE";
  const showBlogView = false;
  const [sectionTab, setSectionTab] = useState<SectionTab>(initialSection);
  const [selectedResponseIdForModal, setSelectedResponseIdForModal] = useState<string | null>(null);
  const [items, setItems] = useState(notifications);

  // Active communication for the Blog Reader view (defaults to latest non-attendance post if in blog mode)
  const initialActive = useMemo(() => {
    if (focusNotificationId) {
      const focused = notifications.find((notification) => notification.id === focusNotificationId);
      if (focused) return focused;
    }
    return notifications.find((notification) => notification.type === "COMUNICAZIONE") ?? notifications[0] ?? null;
  }, [focusNotificationId, notifications]);

  const [activeItem, setActiveItem] = useState<NotificationItem | null>(initialActive);
  const [focusedIntroOpen, setFocusedIntroOpen] = useState(
    Boolean(focusNotificationId && initialActive?.id === focusNotificationId && !openCommunicationDirectly),
  );

  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [selectedSalon, setSelectedSalon] = useState<string>("ALL");
  const [selectedPerson, setSelectedPerson] = useState<string>("ALL");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [engagement, setEngagement] = useState<CommunicationEngagement | null>(null);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [commentStatus, setCommentStatus] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const router = useRouter();

  const enrichedItems = useMemo(() => {
    return items.map((item) => {
      const meta = parseNotificationMetadata(item, recipients, locations);
      return { item, meta };
    });
  }, [items, recipients, locations]);

  const activeMeta = useMemo(() => {
    return activeItem ? parseNotificationMetadata(activeItem, recipients, locations) : null;
  }, [activeItem, recipients, locations]);

  useEffect(() => {
    setItems(notifications);
    if (!activeItem && notifications.length > 0) {
      const defaultPost = notifications.find((notification) => notification.type === "COMUNICAZIONE") ?? notifications[0];
      setActiveItem(defaultPost);
    }
  }, [notifications]);

  useEffect(() => {
    if (!focusNotificationId) return;

    const focused = notifications.find((notification) => notification.id === focusNotificationId);
    if (!focused) return;

    setActiveItem(focused);
    setFocusedIntroOpen(!openCommunicationDirectly);
  }, [focusNotificationId, notifications, openCommunicationDirectly]);

  useEffect(() => {
    if (!activeItem || isAttendanceAlert(activeItem)) {
      setEngagement(null);
      return;
    }
    let cancelled = false;
    setEngagementLoading(true);
    fetch(`/api/notifications/${activeItem.id}/engagement`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Impossibile caricare le risposte.");
        if (!cancelled) setEngagement(data);
      })
      .catch(() => {
        if (!cancelled) setEngagement(null);
      })
      .finally(() => {
        if (!cancelled) setEngagementLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeItem?.id]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      unread: items.filter((item) => !item.read).length,
      sign: items.filter(needsSignature).length,
      urgent: items.filter(isUrgent).length,
      attendance: items.filter(isAttendanceAlert).length,
      blog: items.filter((item) => item.type === "COMUNICAZIONE").length,
      communications: items.filter((item) => item.type === "COMUNICAZIONE").length,
      orders: enrichedItems.filter(({ meta }) => meta.category.isOrder).length,
    };
  }, [items, enrichedItems]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enrichedItems
      .filter(({ item }) => {
        if (sectionTab === "BLOG") return item.type === "COMUNICAZIONE";
        if (sectionTab === "SENT") return item.type === "COMUNICAZIONE";
        if (sectionTab === "ATTENDANCE") return isAttendanceAlert(item);
        return true;
      })
      .filter(({ item }) => (filter === "IMPORTANT" ? isImportant(item) : filter === "UNREAD" ? !item.read : true))
      .filter(({ item, meta }) => {
        if (selectedSalon !== "ALL" && meta.salonName?.toLowerCase() !== selectedSalon.toLowerCase()) return false;
        if (selectedPerson !== "ALL" && meta.personName?.toLowerCase() !== selectedPerson.toLowerCase()) return false;
        if (selectedCategoryFilter === "ORDERS") return meta.category.isOrder;
        if (selectedCategoryFilter === "FORMS") return item.type === "FORM" && !meta.category.isOrder;
        if (selectedCategoryFilter === "TIMBRATURA") return isAttendanceAlert(item);
        if (selectedCategoryFilter === "COMUNICAZIONE") return item.type === "COMUNICAZIONE";
        return true;
      })
      .filter(({ item, meta }) => {
        if (!q) return true;
        const haystack = `${item.title} ${item.message} ${item.type} ${meta.personName ?? ""} ${meta.salonName ?? ""} ${meta.category.label}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime());
  }, [enrichedItems, filter, query, sectionTab, selectedSalon, selectedPerson, selectedCategoryFilter]);

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

  async function submitComment() {
    if (!activeItem || !comment.trim() || commentSending) return;
    setCommentSending(true);
    setCommentStatus("");
    if (!activeItem.read) await markRead(activeItem);

    const response = await fetch(`/api/notifications/${activeItem.id}/engagement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: comment.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    setCommentSending(false);
    if (!response.ok) {
      setCommentStatus(data.error || "Commento non inviato.");
      return;
    }
    setEngagement((current) => current ? { ...current, comments: data.comments } : {
      readers: [],
      recipientCount: 0,
      comments: data.comments,
    });
    setComment("");
    setCommentStatus("Commento pubblicato.");
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

  // Open operational notifications in their owning page; only communications use the reader.
  function selectCommunication(item: NotificationItem) {
    const meta = parseNotificationMetadata(item, recipients, locations);
    const isForm = item.type === "FORM";

    if (meta.category.isOrder || isForm || isAttendanceAlert(item)) {
      const fallbackUrl = isAttendanceAlert(item) ? "/attendance" : "/service-forms";
      const hasOperationalUrl = item.actionUrl && !item.actionUrl.startsWith("/notifications");
      window.location.assign(hasOperationalUrl ? item.actionUrl : fallbackUrl);
      return;
    }

    window.location.assign(`/notifications?communication=${encodeURIComponent(item.id)}&direct=1`);
  }

  // Find next and previous index in filtered list
  const activeIndex = activeItem ? filteredItems.findIndex(({ item }) => item.id === activeItem.id) : -1;
  const prevPost = activeIndex > 0 ? filteredItems[activeIndex - 1].item : null;
  const nextPost = activeIndex >= 0 && activeIndex < filteredItems.length - 1 ? filteredItems[activeIndex + 1].item : null;

  const focusedMode = Boolean(focusNotificationId && activeItem?.id === focusNotificationId && !isAttendanceAlert(activeItem));
  const focusedMessage = activeItem?.message
    .replace(/\n\n📄 ALLEGATO DRIVE: \[.*?\]\(.*?\)/gi, "")
    .replace(/📄 ALLEGATO DRIVE: \[.*?\]\(.*?\)/gi, "")
    .trim() ?? "";
  const focusedDriveId = activeItem
    ? (activeItem.actionUrl || activeItem.message).match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]
      || (activeItem.actionUrl || activeItem.message).match(/id=([a-zA-Z0-9_-]+)/)?.[1]
    : null;
  const focusedHasImage = Boolean(
    activeItem && (
      /\.(png|jpg|jpeg|webp|gif)($|\?|\))/i.test(activeItem.actionUrl || activeItem.message)
      || /\[.*?\.(png|jpg|jpeg|webp|gif)\]/i.test(activeItem.message)
      || focusedDriveId
    ),
  );
  const focusedImageSrc = activeItem && focusedHasImage
    ? focusedDriveId
      ? `/api/drive-image?id=${focusedDriveId}`
      : activeItem.actionUrl
    : null;

  if (focusedMode && activeItem) {
    if (focusedIntroOpen) {
      return (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#F8F6FA] text-[#17151A]">
          <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
            <header className="grid grid-cols-[44px_1fr_44px] items-center py-3">
              <button
                type="button"
                onClick={() => router.push("/notifications")}
                className="grid size-11 place-items-center rounded-full text-black transition hover:bg-black/5"
                aria-label="Torna alle comunicazioni"
              >
                <ChevronLeft className="size-7" />
              </button>
              <p className="text-center text-sm font-bold">Avvisi</p>
              <span />
            </header>

            <main className="flex flex-1 flex-col justify-center py-8 sm:py-12">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-[#17151A] text-white shadow-sm">
                <Megaphone className="size-6" />
              </div>
              <p className="mt-5 text-center text-[11px] font-black uppercase tracking-[0.2em] text-[#A74758]">Paradise Beauty</p>
              <h1 className="mx-auto mt-3 max-w-md text-center text-2xl font-black leading-tight sm:text-3xl">
                Hai una nuova comunicazione
              </h1>
              <p className="mt-2 text-center text-sm font-semibold text-black/45">Comunicazione interna ufficiale</p>

              <section className="mt-8 overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
                <dl className="divide-y divide-black/10 text-sm">
                  <div className="grid grid-cols-[92px_1fr] gap-4 px-5 py-4">
                    <dt className="font-semibold text-black/45">Mittente</dt>
                    <dd className="text-right font-black">Direzione Paradise</dd>
                  </div>
                  <div className="grid grid-cols-[92px_1fr] gap-4 px-5 py-4">
                    <dt className="font-semibold text-black/45">Oggetto</dt>
                    <dd className="text-right font-black">{displayNotificationTitle(activeItem.title)}</dd>
                  </div>
                </dl>
                <div className="border-t border-black/10 px-5 py-5">
                  <p className="line-clamp-5 whitespace-pre-line rounded-md bg-[#F7F4F8] p-4 text-sm font-medium leading-6 text-black/65">
                    {focusedMessage}
                  </p>
                </div>
                <div className="grid grid-cols-[92px_1fr] gap-4 border-t border-black/10 px-5 py-4 text-xs">
                  <span className="font-semibold text-black/45">Codice avviso</span>
                  <span className="text-right font-black uppercase tracking-wider">{activeItem.id.slice(0, 12)}</span>
                </div>
              </section>

              <p className="mt-5 text-center text-xs font-semibold leading-5 text-black/40">
                Aprendo il contenuto confermi di aver ricevuto e letto la comunicazione.
              </p>
              <button
                type="button"
                onClick={() => {
                  void markRead(activeItem);
                  setFocusedIntroOpen(false);
                }}
                className="mt-7 min-h-14 w-full rounded-md bg-[#17151A] px-6 text-sm font-black text-white transition hover:bg-black active:scale-[0.99]"
              >
                Leggi tutta
              </button>
            </main>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-white text-[#17151A]">
        <header className="sticky top-0 z-20 border-b border-black/10 bg-white/95 backdrop-blur">
          <div className="mx-auto grid h-16 w-full max-w-3xl grid-cols-[44px_1fr_44px] items-center px-3 sm:px-6">
            <button
              type="button"
              onClick={() => router.push("/notifications")}
              className="grid size-11 place-items-center rounded-full transition hover:bg-black/5"
              aria-label="Torna alle comunicazioni"
            >
              <ChevronLeft className="size-7" />
            </button>
            <p className="text-center text-sm font-black">Comunicazione</p>
            <span />
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl pb-[max(3rem,env(safe-area-inset-bottom))]">
          {focusedImageSrc ? (
            <div className="border-b border-black/10 bg-[#F7F4F8]">
              <img
                src={focusedImageSrc}
                alt={`Allegato: ${displayNotificationTitle(activeItem.title)}`}
                className="max-h-[60vh] w-full object-contain"
                onError={(event) => {
                  if (focusedDriveId && event.currentTarget.src.includes("/api/drive-image")) {
                    event.currentTarget.src = `https://lh3.googleusercontent.com/d/${focusedDriveId}`;
                  }
                }}
              />
            </div>
          ) : null}

          <article className="px-5 py-8 sm:px-8 sm:py-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-[#F4E5EB] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#8E334E]">
                Comunicazione interna
              </span>
              <span className={cn("rounded px-2.5 py-1 text-[10px] font-black", notificationStatus(activeItem).className)}>
                {notificationStatus(activeItem).label}
              </span>
            </div>
            <h1 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">{displayNotificationTitle(activeItem.title)}</h1>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-black/45">
              <span>Direzione Paradise</span>
              <time>{dateLabel(activeItem.createdAt)}</time>
            </div>
            <div className="mt-8 whitespace-pre-line text-base font-medium leading-7 text-black/75 sm:text-lg sm:leading-8">
              {focusedMessage}
            </div>

            {activeItem.actionUrl && activeItem.actionUrl !== "/notifications" ? (
              <a
                href={activeItem.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-black/15 bg-white px-5 text-sm font-black hover:bg-black hover:text-white sm:w-auto"
              >
                <Paperclip className="size-4" /> Apri allegato
              </a>
            ) : null}

            <section className="mt-10 border-t border-black/10 pt-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-[#A74758]">Conferme di lettura</p>
                  <p className="mt-1 text-sm font-semibold text-black/45">
                    {engagement?.readers.length ?? 0} di {engagement?.recipientCount ?? 0} persone
                  </p>
                </div>
                <div className="flex -space-x-2">
                  {engagement?.readers.slice(0, 8).map((reader) => (
                    <ProfileAvatar key={reader.id} person={reader} size="sm" />
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-8 border-t border-black/10 pt-7">
              <div className="flex items-center gap-2">
                <MessageCircle className="size-5 text-[#A74758]" />
                <h2 className="text-lg font-black">Risposte</h2>
                <span className="rounded bg-[#F4E5EB] px-2 py-0.5 text-[10px] font-black text-[#8E334E]">
                  {engagement?.comments.length ?? 0}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {engagement?.comments.map((entry) => (
                  <div key={entry.id} className="flex gap-3 rounded-md bg-[#F8F6F7] p-4">
                    <ProfileAvatar person={{ id: entry.userId, name: entry.userName, photoUrl: entry.photoUrl }} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap justify-between gap-2">
                        <p className="text-xs font-black">{entry.userName}</p>
                        <time className="text-[10px] font-semibold text-black/35">{shortDateLabel(entry.createdAt)}</time>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-6 text-black/70">{entry.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-md border border-black/10 p-3 focus-within:border-[#A74758]">
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={1000}
                  placeholder="Scrivi una risposta..."
                  className="min-h-24 w-full resize-none bg-transparent px-1 py-1 text-sm font-medium outline-none"
                />
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-black/10 pt-3">
                  <span className="text-[10px] font-semibold text-black/35">{comment.length}/1000</span>
                  <button
                    type="button"
                    onClick={submitComment}
                    disabled={!comment.trim() || commentSending}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#17151A] px-5 text-xs font-black text-white disabled:opacity-35"
                  >
                    <Send className="size-4" /> {commentSending ? "Invio..." : "Invia risposta"}
                  </button>
                </div>
              </div>
              {commentStatus ? <p className="mt-2 text-xs font-bold text-[#8E334E]">{commentStatus}</p> : null}
            </section>
          </article>
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-none space-y-6">
        {/* AppShell mostra gia il titolo pagina: qui restano solo contesto e azioni. */}
        <div className="flex flex-col gap-4 border-y border-black/10 bg-white px-4 py-4 sm:rounded-md sm:border lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#F7E2EB] text-[#A74758]">
              <MessageSquareText className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A74758]">Bacheca interna</p>
              <p className="mt-0.5 text-sm font-semibold text-black/55">Messaggi ufficiali, conferme di lettura e risposte del team.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {canSend ? (
              <button
                type="button"
                onClick={() => router.push("/notifications/new")}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#17151A] px-6 py-3 text-xs font-black text-white transition hover:bg-black active:scale-95"
              >
                <MailPlus className="size-4" /> Nuova comunicazione
              </button>
            ) : null}
          </div>
        </div>

        {/* Section Tabs (Blog vs Timbrature Separati) */}
        <div className="flex flex-wrap items-center gap-2 border-b border-black/10 pb-3">
          {[
            { id: "BLOG", label: "Comunicazioni ricevute", count: stats.blog },
            ...(canSend ? [{ id: "SENT", label: "Comunicazioni inviate", count: stats.communications }] : []),
            { id: "ATTENDANCE", label: "Timbrature e pause", count: stats.attendance },
            { id: "ALL", label: "Tutte", count: stats.total },
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
                  const firstBlog = items.find((notification) => notification.type === "COMUNICAZIONE");
                  if (firstBlog) setActiveItem(firstBlog);
                } else if (tab.id === "SENT") {
                  setSelectedSalon("ALL");
                  setSelectedPerson("ALL");
                  setSelectedCategoryFilter("ALL");
                  const firstCommunication = items.find((notification) => notification.type === "COMUNICAZIONE");
                  if (firstCommunication) setActiveItem(firstCommunication);
                }
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-xs font-black transition active:scale-95",
                sectionTab === tab.id
                  ? "border border-[#A74758] bg-white text-[#A74758]"
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
              <Card key={metric.label} className="flex items-center gap-3.5 rounded-md border border-black/10 p-4 sm:p-5 shadow-none">
                <div className={cn("grid size-11 place-items-center rounded-md shrink-0", metric.bg)}>
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
        {showBlogView ? (
          /* BLOG READER VIEW (2 Columns) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Featured Main Article (8 Cols) */}
            <div className="lg:col-span-8 space-y-4">
              {activeItem ? (
                <article className="overflow-hidden rounded-md border border-black/10 bg-white shadow-sm transition-all">
                  {/* Article Banner Header */}
                  <div className="space-y-4 border-b border-black/10 bg-[#FCF7F9] p-6 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {isImportant(activeItem) ? (
                          <span className="rounded-full bg-[#E13D81] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-2xs">
                            Importante
                          </span>
                        ) : null}
                        {activeMeta ? (
                          <>
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-2xs", activeMeta.category.badge)}>
                              {activeMeta.category.label}
                            </span>
                            {activeMeta.salonName && activeMeta.salonColor ? (
                              <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider", activeMeta.salonColor.badge)}>
                                <Building2 className="size-3" />
                                {activeMeta.salonName}
                              </span>
                            ) : null}
                            {activeMeta.personName && activeMeta.personColor ? (
                              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider", activeMeta.personColor.badge)}>
                                <span className={cn("grid size-4 place-items-center rounded-full text-[9px] font-black", activeMeta.personColor.avatarBg)}>
                                  {activeMeta.personInitials}
                                </span>
                                {activeMeta.personName}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="rounded-full bg-white/80 border border-[#F4D3E2] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#B83D7F]">
                            {typeStyles[activeItem.type]?.label || activeItem.type}
                          </span>
                        )}
                      </div>
                      <span className={cn("rounded-full px-3 py-1 text-xs font-black", notificationStatus(activeItem).className)}>
                        {notificationStatus(activeItem).label}
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1F1F1F] leading-tight">
                      {displayNotificationTitle(activeItem.title)}
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
                    <div className="space-y-5 border-l-2 border-[#D3879D] bg-[#FFFDFC] p-5 sm:p-6">
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

                    {!isAttendanceAlert(activeItem) ? (
                      <section className="grid gap-4 border-t border-black/10 pt-6 lg:grid-cols-[minmax(230px,0.75fr)_minmax(0,1.25fr)]" aria-label="Letture e commenti">
                        <div className="rounded-md border border-black/10 bg-[#FAF8F9] p-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <Users className="size-4 text-[#A74758]" />
                              <h3 className="text-sm font-black text-[#17151A]">Conferme di lettura</h3>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-black/45">
                              {engagementLoading
                                ? "Aggiornamento in corso..."
                                : `${engagement?.readers.length ?? 0} di ${engagement?.recipientCount ?? 0} persone hanno letto`}
                            </p>
                          </div>
                          <div className="mt-4 flex min-h-10 flex-wrap items-center -space-x-2 pl-2">
                            {engagement?.readers.slice(0, 12).map((reader) => (
                              <ProfileAvatar key={reader.id} person={reader} />
                            ))}
                            {(engagement?.readers.length ?? 0) > 12 ? (
                              <span
                                className="grid size-10 place-items-center rounded-full border-2 border-white bg-[#17151A] text-[10px] font-black text-white"
                                title={engagement?.readers.slice(12).map((reader) => reader.name).join(", ")}
                              >
                                +{(engagement?.readers.length ?? 0) - 12}
                              </span>
                            ) : null}
                            {!engagementLoading && !engagement?.readers.length ? (
                              <span className="text-xs font-semibold text-black/35">Nessuna conferma</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-md border border-black/10 p-4">
                          <div className="flex items-center gap-2">
                            <MessageCircle className="size-4 text-[#A74758]" />
                            <h3 className="text-sm font-black text-[#17151A]">Commenti</h3>
                            <span className="rounded bg-[#F4E5EB] px-2 py-0.5 text-[10px] font-black text-[#8E334E]">
                              {engagement?.comments.length ?? 0}
                            </span>
                          </div>

                          <div className="mt-4 space-y-3">
                            {engagement?.comments.map((entry) => (
                              <article key={entry.id} className="flex gap-3 rounded-md border border-black/10 bg-[#FAF8F9] p-3.5">
                                <ProfileAvatar person={{ id: entry.userId, name: entry.userName, photoUrl: entry.photoUrl }} size="sm" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-black text-[#17151A]">{entry.userName}</p>
                                    <time className="text-[10px] font-bold text-black/35">{shortDateLabel(entry.createdAt)}</time>
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-5 text-black/70">{entry.message}</p>
                                </div>
                              </article>
                            ))}
                            {!engagementLoading && !engagement?.comments.length ? (
                              <p className="rounded-md border border-dashed border-black/15 px-4 py-5 text-center text-xs font-semibold text-black/40">
                                Nessun commento. Puoi lasciare la prima risposta.
                              </p>
                            ) : null}
                          </div>

                          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                            <textarea
                              value={comment}
                              onChange={(event) => setComment(event.target.value)}
                              onKeyDown={(event) => {
                                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void submitComment();
                              }}
                              maxLength={1000}
                              placeholder="Scrivi una risposta alla comunicazione..."
                              className="min-h-12 flex-1 resize-y rounded-md border border-black/10 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-[#A74758] focus:ring-2 focus:ring-[#A74758]/10"
                            />
                            <button
                              type="button"
                              onClick={submitComment}
                              disabled={!comment.trim() || commentSending}
                              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#17151A] px-6 text-xs font-black text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Send className="size-4" />
                              {commentSending ? "Invio..." : "Pubblica commento"}
                            </button>
                          </div>
                          {commentStatus ? <p className="mt-2 text-xs font-bold text-[#8E334E]">{commentStatus}</p> : null}
                        </div>
                      </section>
                    ) : null}
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
                        <span className="truncate">Prec: {displayNotificationTitle(prevPost.title)}</span>
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
                        <span className="truncate">Succ: {displayNotificationTitle(nextPost.title)}</span>
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

                {/* Advanced Multi-Attribute Filters (Salone, Persona, Ordine) */}
                <div className="space-y-2.5 rounded-2xl border border-black/5 bg-neutral-50/80 p-3 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] font-black uppercase text-[#B83D7F]">
                    <span className="flex items-center gap-1">
                      <Filter className="size-3" /> Filtri Salone, Persona & Moduli
                    </span>
                    {(selectedSalon !== "ALL" || selectedPerson !== "ALL" || selectedCategoryFilter !== "ALL") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSalon("ALL");
                          setSelectedPerson("ALL");
                          setSelectedCategoryFilter("ALL");
                        }}
                        className="text-[10px] font-bold text-black/50 hover:text-black hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Filter by Salon */}
                    <select
                      value={selectedSalon}
                      onChange={(e) => setSelectedSalon(e.target.value)}
                      className="h-8 w-full rounded-xl border border-black/10 bg-white px-2 text-[11px] font-bold outline-none focus:border-[#D96B94]"
                    >
                      <option value="ALL">🏢 Tutti i Saloni</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.name}>
                          {loc.name}
                        </option>
                      ))}
                    </select>

                    {/* Filter by Person */}
                    <select
                      value={selectedPerson}
                      onChange={(e) => setSelectedPerson(e.target.value)}
                      className="h-8 w-full rounded-xl border border-black/10 bg-white px-2 text-[11px] font-bold outline-none focus:border-[#D96B94]"
                    >
                      <option value="ALL">👤 Tutte le Persone</option>
                      {recipients.map((rec) => (
                        <option key={rec.id} value={rec.name}>
                          {rec.name} ({rec.locationName})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter by Category / Modulo Ordine */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {[
                      { id: "ALL", label: "Tutti" },
                      { id: "ORDERS", label: `📦 Ordini (${stats.orders})` },
                      { id: "FORMS", label: "📄 Altri Moduli" },
                      { id: "TIMBRATURA", label: "⏱️ Timbrature" },
                      { id: "COMUNICAZIONE", label: "📢 Comunicazioni" },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategoryFilter(cat.id)}
                        className={cn(
                          "rounded-lg px-2 py-0.5 text-[10px] font-black transition active:scale-95",
                          selectedCategoryFilter === cat.id
                            ? "bg-[#7C3AED] text-white shadow-2xs"
                            : "bg-white border border-black/10 text-black/60 hover:bg-neutral-100"
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filter Pills (Status: All, Important, Unread) */}
                <div className="flex items-center gap-1.5 pt-1">
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
                    filteredItems.map(({ item, meta }) => {
                      const isSelected = activeItem?.id === item.id;
                      const CategoryIcon = meta.category.Icon;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectCommunication(item)}
                          className={cn(
                            "w-full text-left p-3.5 rounded-2xl border transition-all duration-150 flex flex-col gap-2 active:scale-98 shadow-2xs mt-2 relative overflow-hidden",
                            meta.category.borderLeft,
                            isSelected
                              ? "border-[#D96B94] bg-gradient-to-r from-[#FFF0F6] via-[#FFF7FB] to-white ring-2 ring-[#D96B94]/20 shadow-xs"
                              : item.read
                              ? "border-black/5 bg-white hover:bg-neutral-50"
                              : "border-[#F9D5E7] bg-[#FFF8FB] hover:bg-[#FCE5F3]"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <div className={cn("grid size-7 place-items-center rounded-xl shrink-0", meta.category.iconBg)}>
                                <CategoryIcon className={cn("size-3.5", meta.category.iconText)} />
                              </div>
                              <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider", meta.category.badge)}>
                                {meta.category.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-black uppercase text-black/50">
                                {shortDateLabel(item.createdAt)}
                              </span>
                              {!item.read && (
                                <span className="size-2.5 rounded-full bg-[#E13D81] ring-4 ring-pink-100 animate-pulse" />
                              )}
                            </div>
                          </div>

                          <h4 className="text-xs font-black text-[#1F1F1F] line-clamp-1 leading-snug">
                            {displayNotificationTitle(item.title)}
                          </h4>

                          <p className="text-[11px] font-semibold text-black/60 line-clamp-2 leading-normal">
                            {item.message}
                          </p>

                          {/* Salone & Persona Badges */}
                          {(meta.salonName || meta.personName) && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-black/5">
                              {meta.salonName && meta.salonColor && (
                                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase", meta.salonColor.badge)}>
                                  <Building2 className="size-2.5" />
                                  {meta.salonName}
                                </span>
                              )}
                              {meta.personName && meta.personColor && (
                                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase", meta.personColor.badge)}>
                                  <span className={cn("grid size-3.5 place-items-center rounded-full text-[8px] font-black", meta.personColor.avatarBg)}>
                                    {meta.personInitials}
                                  </span>
                                  {meta.personName}
                                </span>
                              )}
                            </div>
                          )}
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
                filteredItems.map(({ item: notification, meta }) => {
                  const CategoryIcon = meta.category.Icon;
                  const statusInfo = notificationStatus(notification);

                  return (
                    <button
                      key={notification.id}
                      className={cn(
                        "grid w-full gap-4 p-6 text-left transition hover:bg-[#FAF7F9] md:grid-cols-[64px_1fr_auto] md:items-center relative border-l-4",
                        meta.category.borderLeft
                      )}
                      onClick={() => selectCommunication(notification)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        void deleteNotification(notification);
                      }}
                    >
                      <div className={cn("grid size-14 place-items-center rounded-2xl shrink-0", meta.category.iconBg)}>
                        <CategoryIcon className={cn("size-7", meta.category.iconText)} />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {isImportant(notification) ? (
                            <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold uppercase text-[#E13D81]">
                              Importante
                            </span>
                          ) : null}
                          <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider", meta.category.badge)}>
                            {meta.category.label}
                          </span>
                          {meta.salonName && meta.salonColor && (
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase", meta.salonColor.badge)}>
                              <Building2 className="size-3" />
                              {meta.salonName}
                            </span>
                          )}
                          {meta.personName && meta.personColor && (
                            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase", meta.personColor.badge)}>
                              <span className={cn("grid size-4 place-items-center rounded-full text-[9px] font-black", meta.personColor.avatarBg)}>
                                {meta.personInitials}
                              </span>
                              {meta.personName}
                            </span>
                          )}
                        </div>
                        <p className="text-base font-black text-[#1F1F1F]">{displayNotificationTitle(notification.title)}</p>
                        <p className="text-xs font-semibold text-black/50">
                          {dateLabel(notification.createdAt)}
                        </p>
                        <p className="line-clamp-2 text-xs font-medium text-black/70 leading-relaxed">{notification.message}</p>
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
