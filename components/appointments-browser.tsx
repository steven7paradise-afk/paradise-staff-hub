"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Mail,
  MapPin,
  MessageSquare,
  MoreVertical,
  Phone,
  Search,
  Send,
  Trash,
  UserRound,
  UsersRound,
  MessageCircle,
  X,
  Loader2,
} from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";

type ViewMode = "day" | "week" | "month";
type SalonFilter = "tutti" | "duomo" | "buenos-aires" | "ufficio";
type AppointmentDateFilterMode = "all" | "today" | "tomorrow" | "custom";
type AppointmentStatusValue =
  | "PRENOTATO"
  | "NON_PRESENTATO"
  | "INIZIATO"
  | "IN_ATTESA"
  | "COMPLETATO"
  | "ARRIVATO_IN_RITARDO"
  | "PAGATO";

type BookingTeammate = {
  id: string;
  name: string;
  photoUrl?: string | null;
};

type AppointmentRecord = {
  id: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  serviceTitle: string;
  serviceImageUrl?: string | null;
  bookingType?: string | null;
  bookingStr?: string | null;
  startDate: string;
  endDate?: string | null;
  dateKey: string;
  inferredSalon: SalonFilter | "altro";
  teammates: BookingTeammate[];
  priceAmount?: number | null;
  priceCurrency?: string | null;
  confirmationStatus?: string | null;
  financialStatus?: string | null;
  attendance?: string | null;
  isCanceled?: boolean;
  localStatus?: AppointmentStatusValue | string | null;
  statusUpdatedAt?: string | null;
  statusUpdatedBy?: string | null;
  sheetNote?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  notesText?: string | null;
  extraDetails?: Array<{ label: string; value: string }>;
};

const salonOptions: Array<{ value: SalonFilter; label: string }> = [
  { value: "tutti", label: "Tutti" },
  { value: "duomo", label: "Duomo" },
  { value: "buenos-aires", label: "Buenos Aires" },
  { value: "ufficio", label: "Ufficio Paradise" },
];

const viewOptions: Array<{ value: ViewMode; label: string }> = [
  { value: "day", label: "Giorno" },
  { value: "week", label: "Settimana" },
  { value: "month", label: "Mese" },
];

const appointmentsPageSize = 5;

const appointmentStatusOptions: Array<{ value: AppointmentStatusValue; label: string }> = [
  { value: "PRENOTATO", label: "Prenotato" },
  { value: "NON_PRESENTATO", label: "Non presentato" },
  { value: "INIZIATO", label: "Iniziato" },
  { value: "IN_ATTESA", label: "In attesa" },
  { value: "COMPLETATO", label: "Completato" },
  { value: "ARRIVATO_IN_RITARDO", label: "Arrivato in ritardo" },
  { value: "PAGATO", label: "Pagato" },
];

const appointmentStatusLabels = Object.fromEntries(appointmentStatusOptions.map((option) => [option.value, option.label])) as Record<AppointmentStatusValue, string>;

const appointmentStatusClasses: Record<AppointmentStatusValue, string> = {
  PRENOTATO: "border-sky-100 bg-sky-50 text-sky-700",
  NON_PRESENTATO: "border-red-100 bg-red-50 text-red-700",
  INIZIATO: "border-emerald-100 bg-emerald-50 text-emerald-700",
  IN_ATTESA: "border-amber-100 bg-amber-50 text-amber-700",
  COMPLETATO: "border-green-100 bg-green-50 text-green-700",
  ARRIVATO_IN_RITARDO: "border-orange-100 bg-orange-50 text-orange-700",
  PAGATO: "border-[#F1A7C3] bg-[#FFF1F6] text-[#B9476D]",
};

const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function getInitials(value?: string | null) {
  return (value || "")
    .split(" ")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || "")
    .join("");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getDateSearchValues(value?: string | null) {
  if (!value) return [];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return [];
  return [
    localDateKey(date),
    new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date),
    new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" }).format(date),
    new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" }).format(date),
    new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(date),
    new Intl.DateTimeFormat("it-IT", { month: "long" }).format(date),
    formatDateTime(value),
  ];
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return "-";
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "-";
  const minutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  return `${minutes} min`;
}

function formatMoney(amount?: number | null, currency?: string | null) {
  if (amount == null) return "-";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: currency || "EUR",
  }).format(amount);
}

function normalizeSearchValue(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/[^\p{L}\p{N}@.+\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatOrderCode(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  return raw.startsWith("#") ? raw : `#${raw}`;
}

function compactValue(value?: string | null, max = 96) {
  const cleaned = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trim()}...` : cleaned;
}

function getDetailValue(details: AppointmentRecord["extraDetails"], keywords: string[]) {
  const normalizedKeywords = keywords.map((keyword) => normalizeSearchValue(keyword));
  return (
    details?.find((item) => {
      const label = normalizeSearchValue(item.label);
      return normalizedKeywords.some((keyword) => label.includes(keyword));
    })?.value || ""
  );
}

function getQuantityLabel(booking: AppointmentRecord) {
  return compactValue(getDetailValue(booking.extraDetails, ["quantita", "qta", "quantity"]), 18) || "1";
}

function getCustomerContactLines(booking: AppointmentRecord) {
  const phone = booking.customerPhone || getDetailValue(booking.extraDetails, ["numero telefono", "telefono", "phone"]);
  const email = booking.customerEmail || getDetailValue(booking.extraDetails, ["email"]);
  const answers = (booking.extraDetails ?? [])
    .filter((item) => {
      const label = normalizeSearchValue(item.label);
      return (
        label.includes("dichiaro") ||
        label.includes("comprendo") ||
        label.includes("disponibile") ||
        label.includes("accett") ||
        label.includes("scelta") ||
        label.includes("ripr")
      );
    })
    .slice(0, 3);

  return { phone: compactValue(phone, 30), email: compactValue(email, 34), answers };
}

function getBookingNotePreview(booking: AppointmentRecord) {
  const cowlendarNote = compactValue(booking.notesText, 130);
  if (cowlendarNote) return cowlendarNote;
  const formNote = getDetailValue(booking.extraDetails, ["note", "nota", "comment", "memo"]);
  return compactValue(formNote, 130);
}

function getOrderSearchVariants(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const withoutHash = raw.replace(/^#/, "");
  return [...new Set([raw, withoutHash, `#${withoutHash}`].filter(Boolean))];
}

function getSalonLabel(value: AppointmentRecord["inferredSalon"]) {
  if (value === "duomo") return "Duomo";
  if (value === "buenos-aires") return "Buenos Aires";
  if (value === "ufficio") return "Ufficio Paradise";
  return "Altro";
}

function normalizeAppointmentStatus(value?: string | null): AppointmentStatusValue | null {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .trim();

  if (normalized === "NON_PRESENTATO" || normalized === "NO_SHOW") return "NON_PRESENTATO";
  if (normalized === "ARRIVATO_IN_RITARDO" || normalized === "IN_RITARDO") return "ARRIVATO_IN_RITARDO";
  if (normalized === "IN_ATTESA" || normalized === "ATTESA") return "IN_ATTESA";
  if (normalized === "INIZIATO") return "INIZIATO";
  if (normalized === "COMPLETATO" || normalized === "COMPLETA") return "COMPLETATO";
  if (normalized === "PAGATO" || normalized === "PAID") return "PAGATO";
  if (normalized === "PRENOTATO" || normalized === "CONFIRMED" || normalized === "CONFERMATO") return "PRENOTATO";
  return null;
}

function getDefaultAppointmentStatus(booking: AppointmentRecord): AppointmentStatusValue {
  return (
    normalizeAppointmentStatus(booking.localStatus) ||
    normalizeAppointmentStatus(booking.attendance) ||
    normalizeAppointmentStatus(booking.financialStatus) ||
    normalizeAppointmentStatus(booking.confirmationStatus) ||
    "PRENOTATO"
  );
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfCalendarMonth(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(first);
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dateFromLocalKey(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getBookingDateKey(booking: Pick<AppointmentRecord, "startDate" | "dateKey">) {
  if ("dateKey" in booking && booking.dateKey) {
    return booking.dateKey;
  }

  return localDateKey(new Date(booking.startDate));
}

function getFirstVisibleBookingDate(bookings: AppointmentRecord[]) {
  const todayKey = localDateKey(new Date());
  const activeBookings = bookings.filter((booking) => !booking.isCanceled);
  const sorted = [...(activeBookings.length ? activeBookings : bookings)].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const upcoming = sorted.find((booking) => getBookingDateKey(booking) >= todayKey) || sorted[0];
  return dateFromLocalKey(upcoming?.dateKey) || new Date();
}

function getRangeLabel(view: ViewMode, anchorDate: Date) {
  if (view === "day") {
    return new Intl.DateTimeFormat("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(anchorDate);
  }

  if (view === "week") {
    const start = startOfWeek(anchorDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(start)} - ${new Intl.DateTimeFormat("it-IT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(end)}`;
  }

  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(anchorDate);
}

function getPrevDate(view: ViewMode, date: Date) {
  const next = new Date(date);
  if (view === "day") next.setDate(next.getDate() - 1);
  else if (view === "week") next.setDate(next.getDate() - 7);
  else next.setMonth(next.getMonth() - 1);
  return next;
}

function getNextDate(view: ViewMode, date: Date) {
  const next = new Date(date);
  if (view === "day") next.setDate(next.getDate() + 1);
  else if (view === "week") next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

function Avatar({ name, photoUrl, size = "size-10" }: { name: string; photoUrl?: string | null; size?: string }) {
  if (photoUrl) {
    return (
      <div className={`overflow-hidden rounded-2xl border border-black/5 bg-[#F7DCE3] ${size}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolveDrivePhotoUrl(photoUrl)} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return <div className={`grid place-items-center rounded-2xl bg-[#F7DCE3] font-black text-[#171717] ${size}`}>{getInitials(name) || "?"}</div>;
}

function ServiceImage({ title, imageUrl, compact = false }: { title: string; imageUrl?: string | null; compact?: boolean }) {
  const sizeClass = compact ? "size-12" : "h-36 w-full";

  if (imageUrl) {
    return (
      <div className={`overflow-hidden rounded-2xl border border-black/5 bg-[#FFF1F6] ${sizeClass}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`grid place-items-center rounded-2xl border border-black/5 bg-[#FFF1F6] text-[#C66170] ${sizeClass}`}>
      <CalendarDays className={compact ? "size-5" : "size-8"} />
    </div>
  );
}

export function AppointmentsBrowser({ initialBookings }: { initialBookings: AppointmentRecord[] }) {
  const [view, setView] = useState<ViewMode>("day");
  const [salon, setSalon] = useState<SalonFilter>("tutti");
  const [anchorDate, setAnchorDate] = useState(() => getFirstVisibleBookingDate(initialBookings));
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [detailClosed, setDetailClosed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [internalNotes, setInternalNotes] = useState<Record<string, string>>({});
  const [showCanceled, setShowCanceled] = useState(false);
  const [visibleCount, setVisibleCount] = useState(appointmentsPageSize);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState(() => {
    const today = localDateKey(new Date());
    return { mode: "all" as AppointmentDateFilterMode, from: today, to: today };
  });
  const [statusByBooking, setStatusByBooking] = useState<Record<string, AppointmentStatusValue>>(() =>
    Object.fromEntries(
      initialBookings
        .map((booking) => [booking.id, normalizeAppointmentStatus(booking.localStatus)] as const)
        .filter((entry): entry is readonly [string, AppointmentStatusValue] => Boolean(entry[1])),
    ),
  );

  const normalizedSearch = normalizeSearchValue(searchTerm);
  const activeBookingsCount = initialBookings.filter((booking) => !booking.isCanceled).length;
  const canceledBookingsCount = initialBookings.filter((booking) => booking.isCanceled).length;
  const dateFilterLabel = useMemo(() => {
    if (dateFilter.mode === "all") return "Tutte le date";
    if (dateFilter.mode === "today") return "Oggi";
    if (dateFilter.mode === "tomorrow") return "Domani";
    const from = formatDate(dateFilter.from);
    const to = formatDate(dateFilter.to);
    return from === to ? from : `${from} - ${to}`;
  }, [dateFilter]);

  const filteredBookings = useMemo(() => {
    const statusScoped = initialBookings.filter((booking) => (showCanceled ? booking.isCanceled : !booking.isCanceled));
    const base = salon === "tutti" ? statusScoped : statusScoped.filter((booking) => booking.inferredSalon === salon);
    const dateScoped =
      dateFilter.mode === "all"
        ? base
        : base.filter((booking) => {
            const key = getBookingDateKey(booking);
            const from = dateFilter.from <= dateFilter.to ? dateFilter.from : dateFilter.to;
            const to = dateFilter.from <= dateFilter.to ? dateFilter.to : dateFilter.from;
            return key >= from && key <= to;
          });
    const searched = normalizedSearch
      ? dateScoped.filter((booking) => {
          const orderVariants = getOrderSearchVariants(booking.bookingStr);
          const haystack = [
            booking.customerName,
            booking.customerEmail,
            booking.customerPhone,
            booking.serviceTitle,
            booking.bookingStr,
            ...orderVariants,
            booking.bookingType,
            booking.dateKey,
            ...getDateSearchValues(booking.startDate),
            ...getDateSearchValues(booking.endDate),
            booking.notesText,
            ...booking.teammates.map((mate) => mate.name),
            ...(booking.extraDetails ?? []).flatMap((item) => [item.label, item.value]),
          ]
            .filter(Boolean)
            .map((entry) => normalizeSearchValue(entry))
            .join(" ");

          return haystack.includes(normalizedSearch);
        })
      : dateScoped;

    return [...searched].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [dateFilter, initialBookings, normalizedSearch, salon, showCanceled]);

  useEffect(() => {
    setVisibleCount(appointmentsPageSize);
  }, [dateFilter, normalizedSearch, salon, showCanceled, view, anchorDate]);

  const selectedBooking = useMemo(
    () => filteredBookings.find((booking) => booking.id === selectedBookingId) || initialBookings.find((booking) => booking.id === selectedBookingId) || null,
    [filteredBookings, initialBookings, selectedBookingId],
  );

  useEffect(() => {
    if (!filteredBookings.length) {
      if (selectedBookingId !== null) setSelectedBookingId(null);
      return;
    }

    if (!detailClosed && (!selectedBookingId || !filteredBookings.some((booking) => booking.id === selectedBookingId))) {
      setSelectedBookingId(filteredBookings[0].id);
    }
  }, [detailClosed, filteredBookings, selectedBookingId]);

  type AppointmentComment = {
    id: string;
    order_name: string;
    user_name: string;
    user_role: string;
    message: string;
    created_at: string;
  };

  const [dbComments, setDbComments] = useState<AppointmentComment[]>([]);
  const [shopifyNote, setShopifyNote] = useState<string | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; role: string } | null>(null);
  const canManageAppointmentNotes = currentUser?.role !== "DIPENDENTE";

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) {
          setCurrentUser({
            name: data.user.name || "",
            role: data.user.role || "",
          });
        }
      })
      .catch((err) => console.error("Failed to load session:", err));
  }, []);

  useEffect(() => {
    if (!selectedBooking) {
      setDbComments([]);
      setShopifyNote(null);
      return;
    }

    const currentBooking = selectedBooking;
    let active = true;
    async function load() {
      setLoadingComments(true);
      const orderName = currentBooking.bookingStr;
      const bookingId = currentBooking.id;

      const url = `/api/appointments/comments?bookingId=${encodeURIComponent(bookingId)}${
        orderName ? `&orderName=${encodeURIComponent(orderName)}` : ""
      }`;
      try {
        console.log("Fetching comments from:", url);
        const res = await fetch(url);
        if (res.ok && active) {
          const data = await res.json();
          console.log("Fetched comments data:", data);
          setDbComments(Array.isArray(data.comments) ? data.comments : []);
          setShopifyNote(data.shopifyNote || null);
        } else if (active) {
          console.error("Failed to load comments. Status:", res.status);
          const errBody = await res.text().catch(() => "");
          console.error("Error body:", errBody);
        }
      } catch (err) {
        console.error("Failed to load comments exception:", err);
      } finally {
        if (active) setLoadingComments(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [selectedBooking]);

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBooking || !newCommentText.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      const orderName = selectedBooking.bookingStr;
      const bookingId = selectedBooking.id;

      const res = await fetch("/api/appointments/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderName,
          bookingId,
          message: newCommentText.trim(),
        }),
      });

      if (res.ok) {
        const comment = await res.json();
        setDbComments((current) => [...current, comment]);
        setNewCommentText("");
        setShopifyNote((current) => {
          const author = comment.user_name ?? "Staff";
          const msg = comment.message ?? "";
          const newBlock = `Staff: ${author}\n${msg}`;
          return current && current.trim() ? `${current.trim()}\n\n${newBlock}` : newBlock;
        });
      } else {
        alert("Errore durante l'aggiunta del commento.");
      }
    } catch (err) {
      console.error("Failed to post comment", err);
      alert("Impossibile salvare il commento.");
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!window.confirm("Sei sicuro di voler eliminare questo commento?")) return;
    try {
      const res = await fetch(`/api/appointments/comments?id=${commentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDbComments((current) => current.filter((c) => c.id !== commentId));
      } else {
        const data = await res.json();
        alert(data.error || "Impossibile eliminare il commento.");
      }
    } catch (err) {
      console.error("Failed to delete comment", err);
      alert("Errore durante l'eliminazione.");
    }
  }

  function getBookingStatus(booking: AppointmentRecord): AppointmentStatusValue {
    return statusByBooking[booking.id] || getDefaultAppointmentStatus(booking);
  }

  async function handleStatusChange(bookingId: string, nextStatus: AppointmentStatusValue) {
    const previousStatus = statusByBooking[bookingId];
    setStatusByBooking((current) => ({ ...current, [bookingId]: nextStatus }));
    setSavingStatusId(bookingId);

    try {
      const response = await fetch("/api/appointments/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, status: nextStatus }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
    } catch (error) {
      console.error("Failed to save appointment status:", error);
      setStatusByBooking((current) => {
        const copy = { ...current };
        if (previousStatus) copy[bookingId] = previousStatus;
        else delete copy[bookingId];
        return copy;
      });
      alert("Non sono riuscito a salvare lo stato. Riprova.");
    } finally {
      setSavingStatusId(null);
    }
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("appointments_internal_notes");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      setInternalNotes(parsed);
    } catch {
      setInternalNotes({});
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("appointments_internal_notes", JSON.stringify(internalNotes));
    } catch {
      // ignore local storage failures
    }
  }, [internalNotes]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, AppointmentRecord[]>();
    for (const booking of filteredBookings) {
      const bookingDayKey = getBookingDateKey(booking);
      const current = map.get(bookingDayKey) ?? [];
      current.push(booking);
      map.set(bookingDayKey, current);
    }
    return map;
  }, [filteredBookings]);

  const monthGrid = useMemo(() => {
    const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - firstWeekday + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return null;
      return new Date(anchorDate.getFullYear(), anchorDate.getMonth(), dayNumber);
    });
  }, [anchorDate]);

  const weekGrid = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(startOfWeek(anchorDate));
        date.setDate(date.getDate() + index);
        return date;
      }),
    [anchorDate],
  );

  const dayBookings = useMemo(() => filteredBookings.filter((booking) => getBookingDateKey(booking) === localDateKey(anchorDate)), [filteredBookings, anchorDate]);

  const recentBookings = useMemo(
    () =>
      [...filteredBookings]
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
    [filteredBookings],
  );

  const visibleRecentBookings = recentBookings.slice(0, visibleCount);

  const detailEntries = useMemo(() => {
    if (!selectedBooking?.extraDetails?.length) {
      return { formFields: [] as Array<{ label: string; value: string }>, otherFields: [] as Array<{ label: string; value: string }> };
    }

    const formFields = selectedBooking.extraDetails.filter((item) => {
      const label = item.label.toLowerCase();
      return (
        label.startsWith("nome") ||
        label.startsWith("cognome") ||
        label.startsWith("email") ||
        label.startsWith("numero telefono") ||
        label.startsWith("ig tag") ||
        label.startsWith("ordine shopify") ||
        label.startsWith("quantita") ||
        label.includes("accettato") ||
        label.includes("scelta") ||
        label.includes("disponibile") ||
        label.includes("foto") ||
        label.includes("video") ||
        label.includes("pagato") ||
        label.includes("note") ||
        label.includes("prodot") ||
        label.includes("recension")
      );
    });

    const otherFields = selectedBooking.extraDetails.filter((item) => !formFields.includes(item));

    return { formFields, otherFields };
  }, [selectedBooking]);

  const StatusControl = ({ booking, compact = false }: { booking: AppointmentRecord; compact?: boolean }) => {
    if (booking.isCanceled) {
      return <span className="inline-flex rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-black text-red-700">Annullato</span>;
    }

    const status = getBookingStatus(booking);

    return (
      <div className="flex flex-col gap-1" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <select
          value={status}
          onChange={(event) => handleStatusChange(booking.id, event.target.value as AppointmentStatusValue)}
          disabled={savingStatusId === booking.id}
          className={[
            "rounded-full border px-3 font-black outline-none transition focus:ring-2 focus:ring-[#FBE1EB]",
            compact ? "py-1 text-xs" : "py-2 text-sm",
            appointmentStatusClasses[status],
            savingStatusId === booking.id ? "opacity-60" : "",
          ].join(" ")}
        >
          {appointmentStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {savingStatusId === booking.id ? <span className="text-[10px] font-bold text-black/35">Salvataggio...</span> : null}
      </div>
    );
  };

  const WhatsAppSheetNote = ({ booking, compact = false }: { booking: AppointmentRecord; compact?: boolean }) => {
    if (!booking.sheetNote) return null;
    return (
      <div
        className={[
          "inline-flex max-w-full items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-800",
          compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs",
        ].join(" ")}
        title={booking.sheetNote}
      >
        <MessageCircle className={compact ? "mt-0.5 size-3.5 shrink-0" : "mt-0.5 size-4 shrink-0"} />
        <span className="min-w-0">
          <span className="font-black">WhatsApp</span>
          {!compact ? <span className="ml-1 font-semibold">{booking.sheetNote}</span> : null}
        </span>
      </div>
    );
  };

  const tableBookings = filteredBookings.slice(0, visibleCount);
  const prenotateCount = initialBookings.filter((booking) => !booking.isCanceled).length;
  const inArrivoCount = initialBookings.filter((booking) => !booking.isCanceled && new Date(booking.startDate).getTime() >= Date.now()).length;
  const prePaymentCount = initialBookings.filter((booking) => normalizeSearchValue(booking.financialStatus).includes("paid") || normalizeSearchValue(booking.serviceTitle).includes("acconto")).length;
  const waitListCount = initialBookings.filter((booking) => normalizeSearchValue(booking.bookingType).includes("wait") || normalizeSearchValue(booking.notesText).includes("lista d attesa")).length;
  const selectedStatus = selectedBooking ? getBookingStatus(selectedBooking) : "PRENOTATO";
  const selectedContacts = selectedBooking ? getCustomerContactLines(selectedBooking) : null;
  const selectedNotePreview = selectedBooking ? getBookingNotePreview(selectedBooking) : "";

  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto grid w-full max-w-[1760px] gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <main className="min-w-0 space-y-5">
          <section className="rounded-[28px] border border-[#E8D8CF] bg-white/85 p-5 shadow-sm backdrop-blur sm:p-7">
            <div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-serif text-4xl font-semibold tracking-[-0.02em] text-[#1F1F1F] sm:text-5xl">Prenotazioni</h1>
                  <span className="rounded-full bg-[#F7E5DC] px-3 py-1 text-sm font-black text-[#9B583D]">{activeBookingsCount}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-[#7B6B62]">Visualizza tutte le prenotazioni in arrivo</p>
              </div>
            </div>

            <div className="mt-7 overflow-x-auto rounded-[18px] border border-[#E8D8CF] bg-[#FFFDFC] p-2">
              <div className="flex min-w-max gap-2">
                {[
                  { label: "Tutte", count: initialBookings.length, active: !showCanceled, onClick: () => setShowCanceled(false) },
                  { label: "Prenotate", count: prenotateCount, active: !showCanceled, onClick: () => setShowCanceled(false) },
                  { label: "In arrivo", count: inArrivoCount, active: false, onClick: () => setShowCanceled(false) },
                  { label: "Annullate", count: canceledBookingsCount, active: showCanceled, onClick: () => setShowCanceled(true) },
                  { label: "Pre-pagamento", count: prePaymentCount, active: false, onClick: () => setShowCanceled(false) },
                  { label: "Lista d'attesa", count: waitListCount, active: false, onClick: () => setShowCanceled(false) },
                ].map((tab) => (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={tab.onClick}
                    className={[
                      "inline-flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-black transition",
                      tab.active ? "bg-[#FFF1F0] text-[#9F4D46] shadow-sm ring-1 ring-[#F1D1CA]" : "text-[#4E382C] hover:bg-[#FFF7F3]",
                    ].join(" ")}
                  >
                    {tab.label}
                    <span className="rounded-full border border-[#E8D8CF] bg-white px-2.5 py-0.5 text-xs text-[#4E382C]">{tab.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(260px,1fr)_220px_220px_140px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#9E8D83]" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Cerca per nome cliente, email o servizio..."
                  className="h-12 w-full rounded-xl border border-[#E8D8CF] bg-white pl-12 pr-4 text-sm font-semibold text-[#2B211C] outline-none transition placeholder:text-[#A7968B] focus:border-[#C98B73] focus:ring-2 focus:ring-[#F4D8CF]"
                />
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen((current) => !current)}
                  className="flex h-12 w-full items-center justify-between rounded-xl border border-[#E8D8CF] bg-white px-4 text-sm font-bold text-[#4E382C]"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <CalendarDays className="size-4 shrink-0 text-[#A56A42]" />
                    <span className="truncate">{dateFilterLabel}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 rotate-90" />
                </button>
                {isDatePickerOpen ? (
                  <div className="absolute left-0 right-0 top-14 z-30 rounded-2xl border border-[#E8D8CF] bg-white p-3 shadow-xl">
                    <div className="grid gap-2">
                      {[
                        { label: "Tutte le date", mode: "all" as AppointmentDateFilterMode, from: dateFilter.from, to: dateFilter.to },
                        { label: "Oggi", mode: "today" as AppointmentDateFilterMode, from: localDateKey(new Date()), to: localDateKey(new Date()) },
                        { label: "Domani", mode: "tomorrow" as AppointmentDateFilterMode, from: localDateKey(addDays(new Date(), 1)), to: localDateKey(addDays(new Date(), 1)) },
                      ].map((option) => (
                        <button
                          key={option.mode}
                          type="button"
                          onClick={() => {
                            setDateFilter({ mode: option.mode, from: option.from, to: option.to });
                            setIsDatePickerOpen(false);
                          }}
                          className={[
                            "rounded-xl px-3 py-2 text-left text-sm font-black transition",
                            dateFilter.mode === option.mode ? "bg-[#FFF1F6] text-[#B9476D]" : "text-[#4E382C] hover:bg-[#FFF7F3]",
                          ].join(" ")}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2 border-t border-[#E8D8CF] pt-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8D5E49]">Da giorno a giorno</p>
                      <input
                        type="date"
                        value={dateFilter.from}
                        onChange={(event) => setDateFilter((current) => ({ ...current, mode: "custom", from: event.target.value }))}
                        className="h-11 rounded-xl border border-[#E8D8CF] bg-white px-3 text-sm font-bold text-[#4E382C] outline-none"
                      />
                      <input
                        type="date"
                        value={dateFilter.to}
                        onChange={(event) => setDateFilter((current) => ({ ...current, mode: "custom", to: event.target.value }))}
                        className="h-11 rounded-xl border border-[#E8D8CF] bg-white px-3 text-sm font-bold text-[#4E382C] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(false)}
                        className="h-11 rounded-xl bg-[#1F1F1F] px-4 text-sm font-black text-white"
                      >
                        Applica periodo
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <select
                value={salon}
                onChange={(event) => setSalon(event.target.value as SalonFilter)}
                className="h-12 rounded-xl border border-[#E8D8CF] bg-white px-4 text-sm font-bold text-[#4E382C] outline-none focus:border-[#C98B73] focus:ring-2 focus:ring-[#F4D8CF]"
              >
                {salonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value === "tutti" ? "Tutti i saloni" : option.label}
                  </option>
                ))}
              </select>
              <button type="button" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#E8D8CF] bg-white px-4 text-sm font-black text-[#4E382C]">
                <MoreVertical className="size-4 rotate-90 text-[#A56A42]" />
                Filtri
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-[#E8D8CF] bg-white/90 shadow-sm">
            <div className="hidden grid-cols-[1.25fr_1.05fr_1.15fr_0.6fr_0.95fr_48px] gap-4 border-b border-[#E8D8CF] bg-[#FFF9F6] px-6 py-4 text-[12px] font-black uppercase tracking-[0.12em] text-[#8D5E49] xl:grid">
              <span>Appuntamento</span>
              <span>Cliente</span>
              <span>Servizio</span>
              <span>Prezzo</span>
              <span>Stato</span>
              <span />
            </div>

            <div className="divide-y divide-[#EDE0DA]">
              {tableBookings.length ? (
                tableBookings.map((booking, index) => {
                  const status = getBookingStatus(booking);
                  const contacts = getCustomerContactLines(booking);
                  const isSelected = selectedBooking?.id === booking.id;

                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => {
                        setDetailClosed(false);
                        setSelectedBookingId(booking.id);
                      }}
                      className={[
                        "grid w-full gap-4 px-5 py-5 text-left transition xl:grid-cols-[1.25fr_1.05fr_1.15fr_0.6fr_0.95fr_48px] xl:items-center",
                        isSelected ? "bg-[#FFF0F2] shadow-[inset_4px_0_0_#C96363]" : "bg-white hover:bg-[#FFF8F6]",
                      ].join(" ")}
                    >
                      <div className="flex gap-3">
                        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#FFE4ED] text-[#C95B75]">
                          <CalendarDays className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#38271F]">{formatDate(booking.startDate)}</p>
                          <p className="mt-1 text-sm font-semibold text-[#38271F]">
                            {formatTime(booking.startDate)} - {formatTime(booking.endDate)}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-xs font-semibold uppercase text-[#7A5B4B]">
                            <MapPin className="size-3.5" />
                            {getSalonLabel(booking.inferredSalon)}
                          </p>
                        </div>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-[#1F1F1F]">{booking.customerName}</p>
                        <p className="flex items-center gap-1 truncate text-xs font-medium text-[#6F625C]">
                          <Phone className="size-3.5 text-[#A56A42]" />
                          {contacts.phone || "Nessun telefono"}
                        </p>
                        <p className="flex items-center gap-1 truncate text-xs font-medium text-[#6F625C]">
                          <Mail className="size-3.5 text-[#A56A42]" />
                          {contacts.email || "Email non disponibile"}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <ServiceImage title={booking.serviceTitle} imageUrl={booking.serviceImageUrl} compact />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold uppercase text-[#1F1F1F]">{booking.serviceTitle}</p>
                            <p className="mt-1 truncate text-xs font-medium text-[#6F625C]">{booking.bookingType || "Regular booking"}</p>
                            <span className="mt-2 inline-flex rounded-lg border border-[#E8D8CF] bg-[#FFF9F6] px-2 py-1 text-xs font-bold text-[#7A5B4B]">
                              {formatDuration(booking.startDate, booking.endDate)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-[#1F1F1F]">{formatMoney(booking.priceAmount, booking.priceCurrency)}</p>
                        <p className="mt-1 text-xs font-medium text-[#6F625C]">Qta: {getQuantityLabel(booking)}</p>
                      </div>

                      <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
                        <StatusControl booking={booking} compact />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${booking.isCanceled ? "border-red-100 bg-red-50 text-red-700" : appointmentStatusClasses[status]}`}>
                            {booking.isCanceled ? "Annullato" : appointmentStatusLabels[status]}
                          </span>
                          <WhatsAppSheetNote booking={booking} compact />
                        </div>
                      </div>

                      <span className="grid size-10 place-items-center rounded-xl border border-[#E8D8CF] bg-white text-[#8D5E49]">
                        <ChevronRight className="size-5" />
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="p-8 text-sm font-semibold text-[#8A7266]">Nessun appuntamento disponibile con questi filtri.</div>
              )}
            </div>

            {filteredBookings.length > tableBookings.length ? (
              <div className="border-t border-[#E8D8CF] p-5">
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => current + appointmentsPageSize)}
                  className="w-full rounded-2xl border border-[#E8D8CF] bg-white px-4 py-3 text-sm font-black text-[#4E382C] transition hover:bg-[#FFF7F3]"
                >
                  Carica altri 5
                </button>
              </div>
            ) : null}
          </section>
        </main>

        <aside className="min-w-0 rounded-[28px] border border-[#E8D8CF] bg-white/95 shadow-sm xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)] xl:overflow-auto">
          {selectedBooking ? (
            <div>
              <div className="flex items-start justify-between border-b border-[#E8D8CF] p-6">
                <div>
                  <h2 className="font-serif text-2xl font-semibold text-[#1F1F1F]">Dettaglio prenotazione</h2>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-xl border px-3 py-1.5 text-sm font-semibold ${selectedBooking.isCanceled ? "border-red-100 bg-red-50 text-red-700" : appointmentStatusClasses[selectedStatus]}`}>
                      {selectedBooking.isCanceled ? "Annullato" : appointmentStatusLabels[selectedStatus]}
                    </span>
                    <WhatsAppSheetNote booking={selectedBooking} compact />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDetailClosed(true);
                    setSelectedBookingId(null);
                  }}
                  className="grid size-11 place-items-center rounded-xl border border-[#E8D8CF] bg-white text-[#5B4235] transition hover:bg-[#FFF7F3]"
                  aria-label="Chiudi dettaglio"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-6 p-6">
                <section>
                  <h3 className="font-serif text-3xl font-semibold text-[#1F1F1F]">{selectedBooking.customerName}</h3>
                  <div className="mt-4 space-y-2 text-sm font-medium text-[#6F625C]">
                    <p className="flex items-center gap-2">
                      <Phone className="size-4 text-[#A56A42]" />
                      {selectedContacts?.phone || "Nessun telefono"}
                    </p>
                    <p className="flex items-center gap-2 break-all">
                      <Mail className="size-4 text-[#A56A42]" />
                      {selectedContacts?.email || "Email non disponibile"}
                    </p>
                  </div>
                </section>

                <section className="border-t border-[#E8D8CF] pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8D5E49]">Appuntamento</p>
                  <div className="mt-4 space-y-3 text-sm font-medium text-[#3A2A23]">
                    <p className="flex gap-2">
                      <CalendarDays className="mt-0.5 size-4 shrink-0 text-[#A56A42]" />
                      {formatDate(selectedBooking.startDate)}
                    </p>
                    <p className="flex gap-2">
                      <Clock3 className="mt-0.5 size-4 shrink-0 text-[#A56A42]" />
                      {formatTime(selectedBooking.startDate)} - {formatTime(selectedBooking.endDate)} ({formatDuration(selectedBooking.startDate, selectedBooking.endDate)})
                    </p>
                    <p className="flex gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-[#A56A42]" />
                      {getSalonLabel(selectedBooking.inferredSalon)}
                    </p>
                  </div>
                </section>

                <section className="border-t border-[#E8D8CF] pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8D5E49]">Servizio</p>
                  <div className="mt-4 flex gap-3">
                    <ServiceImage title={selectedBooking.serviceTitle} imageUrl={selectedBooking.serviceImageUrl} compact />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold uppercase text-[#1F1F1F]">{selectedBooking.serviceTitle}</p>
                      <p className="mt-1 text-sm font-medium text-[#6F625C]">{selectedBooking.bookingType || "Regular booking"}</p>
                      {selectedBooking.bookingStr ? <p className="mt-2 text-xs font-semibold text-[#A56A42]">Ordine {formatOrderCode(selectedBooking.bookingStr)}</p> : null}
                    </div>
                  </div>
                </section>

                <section className="border-t border-[#E8D8CF] pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8D5E49]">Prezzo</p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="font-medium text-[#6F625C]">Totale</span>
                    <span className="font-semibold text-[#1F1F1F]">{formatMoney(selectedBooking.priceAmount, selectedBooking.priceCurrency)}</span>
                  </div>
                </section>

                <section className="border-t border-[#E8D8CF] pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8D5E49]">Stato</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <StatusControl booking={selectedBooking} />
                    <WhatsAppSheetNote booking={selectedBooking} />
                  </div>
                  {selectedBooking.statusUpdatedBy ? (
                    <p className="mt-3 text-xs font-medium text-[#8A7266]">
                      Ultima modifica: {selectedBooking.statusUpdatedBy}
                      {selectedBooking.statusUpdatedAt ? ` · ${formatDateTime(selectedBooking.statusUpdatedAt)}` : ""}
                    </p>
                  ) : null}
                  {selectedBooking.sheetNote ? (
                    <div className="mt-4 rounded-2xl border border-[#F0D9D3] bg-[#FFF6F7] p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#A15062]">Nota conferma</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#5D4A42]">{selectedBooking.sheetNote}</p>
                    </div>
                  ) : null}
                </section>

                <section className="border-t border-[#E8D8CF] pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8D5E49]">Note</p>
                  <div className="mt-4 rounded-2xl border border-[#F0D9D3] bg-[#FFF6F7] p-4">
                    <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#5D4A42]">
                      {selectedNotePreview || selectedBooking.notesText?.trim() || shopifyNote?.trim() || "Nessuna nota aggiunta"}
                    </p>
                  </div>
                </section>

                {selectedContacts?.answers.length ? (
                  <section className="border-t border-[#E8D8CF] pt-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8D5E49]">Risposte cliente</p>
                    <div className="mt-4 space-y-3">
                      {selectedContacts.answers.map((item, index) => (
                        <div key={`${selectedBooking.id}-side-answer-${index}`} className="rounded-2xl border border-[#E8D8CF] bg-[#FFFDFC] p-3">
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8D5E49]">{item.label}</p>
                          <p className="mt-1 text-sm font-medium text-[#3A2A23]">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

              </div>
            </div>
          ) : (
            <div className="grid min-h-[420px] place-items-center p-6 text-center">
              <div>
                <CalendarCheck className="mx-auto size-10 text-[#C98B73]" />
                <p className="mt-4 font-serif text-2xl font-semibold text-[#1F1F1F]">Seleziona una prenotazione</p>
                <p className="mt-2 text-sm font-medium text-[#8A7266]">Il dettaglio completo apparirà qui.</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCanceled(false)}
            className={[
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition",
              !showCanceled ? "border-[#171717] bg-[#171717] text-white" : "border-black/8 bg-white text-black/55 hover:border-black/20 hover:text-black",
            ].join(" ")}
          >
            <CalendarCheck className="size-4" />
            Prenotazioni <span className="ml-2 opacity-70">{activeBookingsCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCanceled(true)}
            className={[
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition",
              showCanceled ? "border-red-200 bg-red-50 text-red-700" : "border-black/8 bg-white text-black/55 hover:border-red-200 hover:text-red-700",
            ].join(" ")}
          >
            <X className="size-4" />
            Annullato <span className="ml-2 opacity-70">{canceledBookingsCount}</span>
          </button>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {salonOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSalon(option.value)}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-bold transition",
                  salon === option.value
                    ? "border-[#F1A7C3] bg-[#FCE6EF] text-[#B9476D]"
                    : "border-black/8 bg-white text-black/55 hover:border-[#F1A7C3] hover:text-[#B9476D]",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {viewOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setView(option.value)}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-bold transition",
                  view === option.value
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-black/8 bg-white text-black/55 hover:border-black/20 hover:text-black",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 border-t border-black/5 pt-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2 self-start rounded-full border border-black/5 bg-[#FCFCFC] p-1">
            <button type="button" onClick={() => setAnchorDate(getPrevDate(view, anchorDate))} className="grid size-10 place-items-center rounded-full text-black/60 transition hover:bg-white hover:text-black">
              <ChevronLeft className="size-4" />
            </button>
            <div className="min-w-[180px] px-3 text-center text-sm font-black capitalize text-[#171717]">{getRangeLabel(view, anchorDate)}</div>
            <button type="button" onClick={() => setAnchorDate(getNextDate(view, anchorDate))} className="grid size-10 place-items-center rounded-full text-black/60 transition hover:bg-white hover:text-black">
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-black/45">
            <span className="rounded-full bg-[#FFF1F5] px-3 py-1 font-bold text-[#C66170]">{filteredBookings.length} appuntamenti</span>
            <span>Nome + ora nel calendario, dettaglio completo al click.</span>
          </div>
        </div>

        <div className="relative mt-4">
          <label className="sr-only" htmlFor="appointments-search">
            Cerca appuntamenti
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-black/35" />
          <input
            id="appointments-search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Cerca per nome, cognome, telefono, email, numero ordine Shopify..."
            className="w-full rounded-[18px] border border-black/8 bg-white py-3 pl-12 pr-4 text-sm font-bold text-[#171717] outline-none transition placeholder:font-bold placeholder:text-black/35 focus:border-[#EAA1BB] focus:ring-2 focus:ring-[#FBE1EB]"
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
        {view === "month" ? (
          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-7 rounded-t-[22px] border border-black/5 bg-[#FFF8FA]">
                {weekDays.map((day) => (
                  <div key={day} className="border-r border-black/5 px-4 py-3 text-center text-[11px] font-black uppercase tracking-[0.16em] text-black/45 last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 border-x border-b border-black/5">
                {monthGrid.map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} className="min-h-[188px] border-r border-b border-black/5 bg-black/[0.02] p-3 last:border-r-0" />;
                  }

                  const items = bookingsByDay.get(localDateKey(date)) ?? [];
                  const isToday = localDateKey(date) === localDateKey(new Date());

                  return (
                    <div key={date.toISOString()} className="min-h-[188px] border-r border-b border-black/5 bg-white p-3 last:border-r-0">
                      <div className="mb-3 flex items-center justify-between">
                        <span className={`grid size-8 place-items-center rounded-full text-sm font-black ${isToday ? "bg-[#F4A9C6] text-white" : "text-[#171717]"}`}>{date.getDate()}</span>
                        {items.length ? <span className="rounded-full bg-[#FFF1F5] px-2 py-1 text-[10px] font-black text-[#C66170]">{items.length}</span> : null}
                      </div>

                      <div className="space-y-2">
                        {items.slice(0, 4).map((booking) => (
                          <button
                            key={booking.id}
                            type="button"
                            onClick={() => setSelectedBookingId(booking.id)}
                            className="w-full rounded-[16px] border border-[#F0DCE3] bg-[#FFF9FB] px-2.5 py-2 text-left transition hover:border-[#EAA1BB] hover:bg-[#FFF1F6]"
                            title={`${booking.customerName}${booking.bookingStr ? ` - Ordine ${formatOrderCode(booking.bookingStr)}` : ""}`}
                          >
                            <p className="truncate text-[11px] font-black text-[#171717]">{formatTime(booking.startDate)} · {booking.customerName}</p>
                            {booking.bookingStr ? <p className="mt-1 truncate text-[10px] font-bold text-[#C66170]">Ordine {formatOrderCode(booking.bookingStr)}</p> : null}
                          </button>
                        ))}
                        {items.length > 4 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setAnchorDate(date);
                              setView("day");
                            }}
                            className="w-full rounded-[14px] bg-black/[0.04] px-2.5 py-2 text-left text-[11px] font-bold text-black/45 transition hover:bg-black/[0.07]"
                          >
                            + {items.length - 4} altri
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {view === "week" ? (
          <div className="grid gap-4 lg:grid-cols-7">
            {weekGrid.map((date) => {
              const items = bookingsByDay.get(localDateKey(date)) ?? [];
              return (
                <div key={date.toISOString()} className="rounded-[22px] border border-black/5 bg-[#FFFCFD] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/45">{weekDays[(date.getDay() + 6) % 7]}</p>
                  <p className="mt-1 text-lg font-black text-[#171717]">{date.getDate()}</p>
                  <div className="mt-4 space-y-2">
                    {items.length ? (
                      items.map((booking) => (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => setSelectedBookingId(booking.id)}
                          className="w-full rounded-[16px] border border-[#F0DCE3] bg-white px-3 py-2 text-left transition hover:border-[#EAA1BB] hover:bg-[#FFF8FB]"
                        >
                          <p className="truncate text-xs font-black text-[#171717]">{formatTime(booking.startDate)} · {booking.customerName}</p>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-black/35">Nessun appuntamento.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {view === "day" ? (
          <div className="space-y-3">
            {!dayBookings.length ? (
              <div className="rounded-[22px] border border-dashed border-[#F1D7DD] bg-[#FFF8FB] p-4 text-sm font-bold text-[#A15062]">
                Nessun appuntamento nel giorno selezionato. Ti mostro i primi appuntamenti disponibili con questi filtri.
              </div>
            ) : null}
            {(dayBookings.length ? dayBookings : recentBookings.slice(0, appointmentsPageSize)).length ? (
              (dayBookings.length ? dayBookings : recentBookings.slice(0, appointmentsPageSize)).map((booking) => {
                const customerLines = getCustomerContactLines(booking);
                const notePreview = getBookingNotePreview(booking);
                const status = getBookingStatus(booking);

                return (
                  <div
                    key={booking.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedBookingId(booking.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setSelectedBookingId(booking.id);
                    }}
                    className="grid w-full gap-4 rounded-[22px] border border-black/5 bg-[#FFFDFD] px-4 py-4 text-left transition hover:border-[#EAA1BB] hover:bg-[#FFF8FB] lg:grid-cols-[2fr_0.75fr_1.35fr_1.15fr_0.95fr] lg:items-center"
                  >
                    <div className="flex min-w-0 gap-4">
                      <div className="shrink-0">
                        <ServiceImage title={booking.serviceTitle} imageUrl={booking.serviceImageUrl} compact />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-[#171717]">{booking.customerName}</p>
                        <p className="mt-1 truncate text-sm font-black uppercase text-[#C66170]">
                          {formatTime(booking.startDate)} · {booking.serviceTitle}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-black/50">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3.5 text-[#C66170]" />
                            {formatDateTime(booking.startDate)}
                          </span>
                          {booking.bookingStr ? <span>Ordine {formatOrderCode(booking.bookingStr)}</span> : null}
                          <span>{booking.bookingType || "Regular booking"}</span>
                        </div>
                        {notePreview ? (
                          <p className="mt-2 line-clamp-2 rounded-xl bg-[#FFF7FA] px-3 py-2 text-xs font-bold leading-relaxed text-[#9C4F62]">
                            <MessageSquare className="mr-1 inline size-3.5 align-[-2px]" />
                            {notePreview}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#FAFAFA] p-3 lg:bg-transparent lg:p-0">
                      <p className="flex items-center gap-1 text-sm font-black text-[#171717]">
                        <CreditCard className="size-4 text-[#C66170]" />
                        {formatMoney(booking.priceAmount, booking.priceCurrency)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-black/45">Qta: {getQuantityLabel(booking)}</p>
                    </div>

                    <div className="rounded-2xl bg-[#FAFAFA] p-3 lg:bg-transparent lg:p-0">
                      <p className="flex items-center gap-1 text-sm font-black text-[#171717]">
                        <UserRound className="size-4 text-[#C66170]" />
                        {booking.customerName}
                      </p>
                      <p className="mt-1 flex items-center gap-1 truncate text-xs font-bold text-black/50">
                        <Phone className="size-3.5 text-black/35" />
                        <span className="truncate">{customerLines.phone || "Nessun telefono"}</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1 truncate text-xs font-bold text-black/50">
                        <Mail className="size-3.5 text-black/35" />
                        <span className="truncate">{customerLines.email || "Email non disponibile"}</span>
                      </p>
                      {customerLines.answers.slice(0, 2).map((item, index) => (
                        <p key={`${booking.id}-day-answer-${index}`} className="mt-1 line-clamp-1 text-xs font-bold text-black/45">
                          {item.label}: {compactValue(item.value, 44)}
                        </p>
                      ))}
                    </div>

                    <div className="rounded-2xl bg-[#FAFAFA] p-3 lg:bg-transparent lg:p-0">
                      <p className="flex items-center gap-1 text-sm font-black text-[#171717]">
                        <UsersRound className="size-4 text-[#C66170]" />
                        {booking.teammates.map((mate) => mate.name).join(", ") || "Non assegnato"}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-black/45">
                        <MapPin className="size-3.5" />
                        {getSalonLabel(booking.inferredSalon)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <StatusControl booking={booking} compact />
                      {!booking.isCanceled ? (
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${appointmentStatusClasses[status]}`}>
                          {appointmentStatusLabels[status]}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-dashed border-black/10 bg-[#FFFCFD] p-5 text-sm font-bold text-black/45">Nessun appuntamento disponibile.</div>
            )}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-black/5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-[#FFF1F6] text-[#C66170]">
              <CalendarCheck className="size-5" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#C66170]">{showCanceled ? "Annullati" : "Prenotazioni"}</p>
              <h3 className="mt-1 text-2xl font-black text-[#171717]">Lista appuntamenti</h3>
            </div>
          </div>
          <span className="rounded-full bg-[#F7F7F7] px-3 py-1 text-xs font-black text-black/55">
            {Math.min(visibleCount, recentBookings.length)} di {recentBookings.length}
          </span>
        </div>

        <div className="hidden grid-cols-[2.1fr_0.8fr_1.35fr_1.25fr_1fr_40px] gap-4 border-b border-black/5 bg-[#FBFBFB] px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-black/40 lg:grid">
          <span>Informazioni sulla prenotazione</span>
          <span>Prezzo e qta</span>
          <span>Cliente</span>
          <span>Compagno di squadra</span>
          <span>Stato</span>
          <span />
        </div>

        <div>
          {recentBookings.length ? (
            <div className="divide-y divide-black/5">
              {visibleRecentBookings.map((booking) => {
                const status = getBookingStatus(booking);
                const customerLines = getCustomerContactLines(booking);
                const notePreview = getBookingNotePreview(booking);
                return (
                  <div
                    key={booking.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedBookingId(booking.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setSelectedBookingId(booking.id);
                    }}
                    className="grid w-full gap-4 px-5 py-5 text-left transition hover:bg-[#FFF8FB] lg:grid-cols-[2.1fr_0.8fr_1.35fr_1.25fr_1fr_40px] lg:items-center"
                  >
                    <div className="flex min-w-0 gap-4">
                      <div className="shrink-0">
                        <ServiceImage title={booking.serviceTitle} imageUrl={booking.serviceImageUrl} compact />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black uppercase text-[#171717]">{booking.serviceTitle}</p>
                        <p className="mt-1 truncate text-sm font-bold text-black/55">{booking.bookingType || "Regular booking"}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-black/50">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3.5" />
                            {formatDateTime(booking.startDate)}
                          </span>
                          {booking.bookingStr ? <span>Ordine {formatOrderCode(booking.bookingStr)}</span> : null}
                        </div>
                        {notePreview ? (
                          <p className="mt-2 line-clamp-2 rounded-xl bg-[#FFF7FA] px-3 py-2 text-xs font-bold leading-relaxed text-[#9C4F62]">
                            <MessageSquare className="mr-1 inline size-3.5 align-[-2px]" />
                            {notePreview}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#FAFAFA] p-3 lg:bg-transparent lg:p-0">
                      <p className="flex items-center gap-1 text-sm font-black text-[#171717]">
                        <CreditCard className="size-4 text-black/35" />
                        {formatMoney(booking.priceAmount, booking.priceCurrency)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-black/45">Qta: {getQuantityLabel(booking)}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                        <CalendarCheck className="size-3.5" />
                        Prenotato
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#FAFAFA] p-3 lg:bg-transparent lg:p-0">
                      <p className="flex items-center gap-1 text-sm font-black text-[#171717]">
                        <UserRound className="size-4 text-black/35" />
                        {booking.customerName}
                      </p>
                      <div className="mt-2 space-y-1 text-xs font-bold text-black/50">
                        <p className="flex items-center gap-1">
                          <Phone className="size-3.5 text-black/35" />
                          <span className="truncate">{customerLines.phone || "Nessun telefono"}</span>
                        </p>
                        <p className="flex items-center gap-1">
                          <Mail className="size-3.5 text-black/35" />
                          <span className="truncate">{customerLines.email || "Email non disponibile"}</span>
                        </p>
                        {customerLines.answers.map((item, index) => (
                          <p key={`${booking.id}-answer-${index}`} className="flex items-start gap-1">
                            <span className="mt-1 grid size-3.5 shrink-0 place-items-center rounded-full border border-black/10 text-[9px] text-black/45">i</span>
                            <span className="line-clamp-1">
                              {item.label}: {compactValue(item.value, 46)}
                            </span>
                          </p>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#FAFAFA] p-3 lg:bg-transparent lg:p-0">
                      <p className="flex items-center gap-1 text-sm font-black text-[#171717]">
                        <UsersRound className="size-4 text-black/35" />
                        {booking.teammates.map((mate) => mate.name).join(", ") || "Non assegnato"}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-black/45">
                        <MapPin className="size-3.5" />
                        {getSalonLabel(booking.inferredSalon)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <StatusControl booking={booking} compact />
                      {!booking.isCanceled ? (
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${appointmentStatusClasses[status]}`}>
                          {appointmentStatusLabels[status]}
                        </span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedBookingId(booking.id);
                      }}
                      className="grid size-10 place-items-center rounded-full border border-black/5 bg-white text-black/45 transition hover:border-[#F1A7C3] hover:text-[#C66170]"
                      aria-label="Apri dettaglio prenotazione"
                    >
                      <MoreVertical className="size-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-5 text-sm font-bold text-black/45">Nessun appuntamento disponibile.</div>
          )}
        </div>
        {recentBookings.length > visibleRecentBookings.length ? (
          <div className="border-t border-black/5 p-5">
            <button
              type="button"
              onClick={() => setVisibleCount((current) => current + appointmentsPageSize)}
              className="w-full rounded-[18px] border border-black/8 bg-white px-4 py-3 text-sm font-black text-[#171717] transition hover:border-[#F1A7C3] hover:bg-[#FFF8FB]"
            >
              Carica altri 5
            </button>
          </div>
        ) : null}
      </section>

      {selectedBooking ? (
        <div className="fixed inset-0 z-[90] bg-black/45 p-4 backdrop-blur-sm">
          <div className="mx-auto flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-black/5 px-5 py-5">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#C66170]">Dettaglio appuntamento</p>
                <h3 className="mt-2 text-3xl font-black text-[#171717]">{selectedBooking.customerName}</h3>
                <p className="mt-2 text-sm text-black/55">{selectedBooking.serviceTitle}</p>
                {selectedBooking.bookingStr ? (
                  <p className="mt-3 inline-flex rounded-full bg-[#FFF1F5] px-3 py-1 text-xs font-black text-[#C66170]">
                    Ordine Shopify {formatOrderCode(selectedBooking.bookingStr)}
                  </p>
                ) : null}
              </div>
              <button type="button" onClick={() => setSelectedBookingId(null)} className="grid size-12 place-items-center rounded-full border border-black/5 bg-white text-black/60 transition hover:text-black">
                <X className="size-5" />
              </button>
            </div>

            <div className="grid flex-1 gap-6 overflow-auto p-5 lg:grid-cols-[1.15fr_0.85fr] min-h-0">
              <div className="space-y-5">
                <ServiceImage title={selectedBooking.serviceTitle} imageUrl={selectedBooking.serviceImageUrl} />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-black/5 bg-[#FFFCFD] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">Data e ora</p>
                    <p className="mt-2 text-lg font-black text-[#171717]">{formatDateTime(selectedBooking.startDate)}</p>
                    <p className="mt-1 text-sm text-black/55">Fine: {formatDateTime(selectedBooking.endDate)}</p>
                  </div>
                  <div className="rounded-[24px] border border-black/5 bg-[#FFFCFD] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">Salone / stato</p>
                    <p className="mt-2 text-lg font-black text-[#171717]">{getSalonLabel(selectedBooking.inferredSalon)}</p>
                    <div className="mt-3">
                      <StatusControl booking={selectedBooking} />
                    </div>
                    <div className="mt-3">
                      <WhatsAppSheetNote booking={selectedBooking} />
                    </div>
                    {selectedBooking.statusUpdatedBy ? (
                      <p className="mt-2 text-xs font-bold text-black/40">
                        Ultima modifica: {selectedBooking.statusUpdatedBy}
                        {selectedBooking.statusUpdatedAt ? ` · ${formatDateTime(selectedBooking.statusUpdatedAt)}` : ""}
                      </p>
                    ) : null}
                    {selectedBooking.sheetNote ? (
                      <div className="mt-3 rounded-2xl border border-black/5 bg-[#FFF6F7] p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#A15062]">Nota conferma</p>
                        <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-5 text-[#5D4A42]">{selectedBooking.sheetNote}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[24px] border border-black/5 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">Cliente</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">Nome</p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">{selectedBooking.customerName}</p>
                    </div>
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">Telefono</p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">{selectedBooking.customerPhone || "-"}</p>
                    </div>
                    <div className="rounded-2xl bg-[#FAFAFA] p-3 sm:col-span-2">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">Email</p>
                      <p className="mt-2 break-all text-sm font-bold text-[#171717]">{selectedBooking.customerEmail || "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-black/5 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">Dettagli prenotazione</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">Servizio</p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">{selectedBooking.serviceTitle}</p>
                    </div>
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">Importo</p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">{formatMoney(selectedBooking.priceAmount, selectedBooking.priceCurrency)}</p>
                    </div>
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">Tipo booking</p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">{selectedBooking.bookingType || "-"}</p>
                    </div>
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">Ordine Shopify</p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">{formatOrderCode(selectedBooking.bookingStr)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-black/5 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">Note</p>
                  <div className="mt-3 space-y-3">
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">Note ricevute da Cowlendar</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium text-[#171717]">
                        {selectedBooking.notesText?.trim() || "Nessuna nota presente in questo appuntamento."}
                      </p>
                    </div>

                    {selectedBooking.bookingStr && (
                      <div className="rounded-2xl bg-[#FFF7F2] border border-[#FFE7D6] p-3">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#C67035]">Note presenti su Shopify</p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium text-[#7C3E14]">
                          {shopifyNote?.trim() || "Nessuna nota presente su Shopify."}
                        </p>
                      </div>
                    )}

                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="size-4 text-paradise-pink" />
                        <span className="text-xs font-black uppercase tracking-[0.16em] text-black/40">
                          Note e Commenti Condivisi
                        </span>
                      </div>

                      {loadingComments ? (
                        <div className="flex items-center gap-2 py-4 text-xs font-semibold text-black/40">
                          <Loader2 className="size-4 animate-spin text-paradise-pink" />
                          Caricamento commenti...
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-1 mb-4">
                          {(Array.isArray(dbComments) ? dbComments : []).map((c) => {
                            const isManager = c.user_role !== "DIPENDENTE";
                            const dateVal = c.created_at ? new Date(c.created_at) : new Date();
                            const isAdmin = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN";
                            const isAuthor = c.user_name === currentUser?.name;
                            const canDelete = canManageAppointmentNotes && (isAdmin || isAuthor);

                            return (
                              <div
                                key={c.id}
                                className={`rounded-2xl p-3 text-xs leading-relaxed max-w-[85%] ${
                                  isManager 
                                    ? "bg-paradise-softPink border border-paradise-pink/15 mr-auto text-left" 
                                    : "bg-black/5 border border-black/5 ml-auto text-left"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3 mb-1">
                                  <div className="flex items-center gap-1 min-w-0">
                                    <span className="font-bold text-black truncate">
                                      {c.user_name} ({isManager ? "Direzione" : "Staff"})
                                    </span>
                                    {canDelete && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(c.id)}
                                        className="p-1 text-black/30 hover:text-red-600 transition shrink-0"
                                        title="Elimina commento"
                                      >
                                        <Trash className="size-3" />
                                      </button>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-black/40 shrink-0">
                                    {dateVal.toLocaleString("it-IT", {
                                      day: "numeric",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                <p className="text-black/85 whitespace-pre-line">{c.message}</p>
                              </div>
                            );
                          })}

                          {(!dbComments || dbComments.length === 0) && (
                            <p className="text-xs text-black/45 italic py-2">
                              Nessun commento condiviso. Scrivi una nota o risposta qui sotto.
                            </p>
                          )}
                        </div>
                      )}

                      {canManageAppointmentNotes ? (
                        <form onSubmit={handleAddComment} className="flex gap-2">
                          <input
                            type="text"
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder="Scrivi una nota condivisa..."
                            className="flex-1 h-9 rounded-xl border border-black/10 px-3 text-xs focus:border-paradise-pink bg-white text-black outline-none"
                            disabled={submittingComment}
                          />
                          <button
                            type="submit"
                            disabled={submittingComment || !newCommentText.trim()}
                            className="grid size-9 place-items-center rounded-xl bg-paradise-pink text-white hover:scale-105 active:scale-95 transition disabled:opacity-40"
                          >
                            {submittingComment ? (
                              <Loader2 className="size-4 animate-spin text-white" />
                            ) : (
                              <Send className="size-4" />
                            )}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>

                {selectedBooking.extraDetails?.length ? (
                  <div className="rounded-[24px] border border-black/5 bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">Dati modulo Cowlendar</p>
                    <div className="mt-3 space-y-4">
                      {detailEntries.formFields.length ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {detailEntries.formFields.map((item, index) => (
                            <div key={`${item.label}-${index}`} className="rounded-2xl bg-[#FAFAFA] p-3">
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">{item.label}</p>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm font-bold text-[#171717]">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {detailEntries.otherFields.length ? (
                        <details className="rounded-2xl border border-black/5 bg-[#FCFCFC] p-3">
                          <summary className="cursor-pointer text-sm font-black text-[#171717]">Altri dettagli tecnici</summary>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {detailEntries.otherFields.map((item, index) => (
                              <div key={`${item.label}-${index}`} className="rounded-2xl bg-white p-3">
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">{item.label}</p>
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm font-bold text-[#171717]">{item.value}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-5">
                <div className="rounded-[24px] border border-black/5 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl bg-[#EAF7F1] text-[#2A8C69]">
                      <UsersRound className="size-5" />
                    </span>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">Collaboratori</p>
                      <h4 className="text-lg font-black text-[#171717]">Assegnati a questo appuntamento</h4>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedBooking.teammates.length ? (
                      selectedBooking.teammates.map((mate) => (
                        <div key={mate.id} className="flex items-center gap-3 rounded-2xl border border-black/5 bg-[#FFFCFD] p-3">
                          <Avatar name={mate.name} photoUrl={mate.photoUrl} size="size-12" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[#171717]">{mate.name}</p>
                            <p className="text-xs text-black/45">{getSalonLabel(selectedBooking.inferredSalon)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-black/10 p-4 text-sm text-black/45">Nessun collaboratore assegnato.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-black/5 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl bg-[#FFF3E9] text-[#B77929]">
                      <CalendarDays className="size-5" />
                    </span>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">Tracciamento</p>
                      <h4 className="text-lg font-black text-[#171717]">Creazione e aggiornamento</h4>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">Creato</p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">{formatDateTime(selectedBooking.createdAt)}</p>
                    </div>
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">Aggiornato</p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">{formatDateTime(selectedBooking.updatedAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-black/5 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl bg-[#FFF1F5] text-[#C66170]">
                      <Clock3 className="size-5" />
                    </span>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">Contatti rapidi</p>
                      <h4 className="text-lg font-black text-[#171717]">Informazioni utili</h4>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-[#FFFCFD] p-3 text-sm text-[#171717]">
                      <Mail className="size-4 text-[#C66170]" />
                      <span className="break-all">{selectedBooking.customerEmail || "Email non disponibile"}</span>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-[#FFFCFD] p-3 text-sm text-[#171717]">
                      <Phone className="size-4 text-[#C66170]" />
                      <span>{selectedBooking.customerPhone || "Telefono non disponibile"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
