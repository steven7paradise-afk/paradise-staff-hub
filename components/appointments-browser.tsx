"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Mail, Phone, UsersRound, X, MessageSquare, Loader2, Send, Trash } from "lucide-react";

type ViewMode = "day" | "week" | "month";
type SalonFilter = "tutti" | "duomo" | "buenos-aires" | "ufficio";

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

function formatTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

function getBookingDateKey(booking: Pick<AppointmentRecord, "startDate">) {
  return localDateKey(new Date(booking.startDate));
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
        <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return <div className={`grid place-items-center rounded-2xl bg-[#F7DCE3] font-black text-[#171717] ${size}`}>{getInitials(name) || "?"}</div>;
}

export function AppointmentsBrowser({ initialBookings }: { initialBookings: AppointmentRecord[] }) {
  const [view, setView] = useState<ViewMode>("day");
  const [salon, setSalon] = useState<SalonFilter>("tutti");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [internalNotes, setInternalNotes] = useState<Record<string, string>>({});

  const normalizedSearch = normalizeSearchValue(searchTerm);

  const filteredBookings = useMemo(() => {
    const base = salon === "tutti" ? initialBookings : initialBookings.filter((booking) => booking.inferredSalon === salon);
    const searched = normalizedSearch
      ? base.filter((booking) => {
          const orderVariants = getOrderSearchVariants(booking.bookingStr);
          const haystack = [
            booking.customerName,
            booking.customerEmail,
            booking.customerPhone,
            booking.serviceTitle,
            booking.bookingStr,
            ...orderVariants,
            booking.bookingType,
            booking.notesText,
            ...booking.teammates.map((mate) => mate.name),
            ...(booking.extraDetails ?? []).flatMap((item) => [item.label, item.value]),
          ]
            .filter(Boolean)
            .map((entry) => normalizeSearchValue(entry))
            .join(" ");

          return haystack.includes(normalizedSearch);
        })
      : base;

    return [...searched].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [initialBookings, normalizedSearch, salon]);

  const selectedBooking = useMemo(
    () => filteredBookings.find((booking) => booking.id === selectedBookingId) || initialBookings.find((booking) => booking.id === selectedBookingId) || null,
    [filteredBookings, initialBookings, selectedBookingId],
  );

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
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
        .slice(0, 120),
    [filteredBookings],
  );

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

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
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

        <div className="mt-4">
          <label className="sr-only" htmlFor="appointments-search">
            Cerca appuntamenti
          </label>
          <input
            id="appointments-search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Cerca per nome, cognome, telefono, email, numero ordine Shopify..."
            className="w-full rounded-[18px] border border-black/8 bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#EAA1BB] focus:ring-2 focus:ring-[#FBE1EB]"
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
            {dayBookings.length ? (
              dayBookings.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => setSelectedBookingId(booking.id)}
                  className="w-full rounded-[22px] border border-black/5 bg-[#FFFDFD] px-4 py-4 text-left transition hover:border-[#EAA1BB] hover:bg-[#FFF8FB]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-black text-[#171717]">{booking.customerName}</p>
                      <p className="mt-1 text-sm font-bold text-[#C66170]">{formatTime(booking.startDate)} · {booking.serviceTitle}</p>
                      <p className="mt-2 text-sm text-black/55">{booking.teammates.map((mate) => mate.name).join(", ") || "Collaboratore non assegnato"}</p>
                    </div>
                    <span className="rounded-full bg-[#FFF1F5] px-3 py-1 text-xs font-black text-[#C66170]">{getSalonLabel(booking.inferredSalon)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-black/10 bg-[#FFFCFD] p-5 text-sm text-black/45">Nessun appuntamento in questo giorno.</div>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-black/5 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-black/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C66170]">Cronologia completa</p>
            <h3 className="mt-1 text-2xl font-black text-[#171717]">Tutti gli appuntamenti caricati</h3>
          </div>
          <span className="rounded-full bg-[#F7F7F7] px-3 py-1 text-xs font-black text-black/55">{recentBookings.length} visibili</span>
        </div>

        <div className="max-h-[720px] overflow-auto">
          {recentBookings.length ? (
            <div className="divide-y divide-black/5">
              {recentBookings.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => setSelectedBookingId(booking.id)}
                  className="grid w-full gap-4 px-5 py-4 text-left transition hover:bg-[#FFF8FB] md:grid-cols-[1.2fr_1fr_1fr_auto]"
                >
                  <div>
                    <p className="text-base font-black text-[#171717]">{booking.customerName}</p>
                    <p className="mt-1 text-sm text-black/55">{booking.serviceTitle}</p>
                    <p className="mt-1 text-xs text-black/40">{formatDateTime(booking.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">Collaboratori</p>
                    <p className="mt-2 text-sm font-bold text-[#171717]">{booking.teammates.map((mate) => mate.name).join(", ") || "Non assegnato"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">Salone / Pagamento</p>
                    <p className="mt-2 text-sm font-bold text-[#171717]">{getSalonLabel(booking.inferredSalon)}</p>
                    <p className="mt-1 text-sm text-black/55">{formatMoney(booking.priceAmount, booking.priceCurrency)}</p>
                    <p className="mt-1 text-xs text-black/40">Ordine Shopify: {formatOrderCode(booking.bookingStr)}</p>
                  </div>
                  <div className="self-center justify-self-start md:justify-self-end">
                    <span className="inline-flex rounded-full bg-[#171717] px-3 py-1 text-xs font-black text-white">Apri dettaglio</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-5 text-sm text-black/45">Nessun appuntamento disponibile.</div>
          )}
        </div>
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-black/5 bg-[#FFFCFD] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">Data e ora</p>
                    <p className="mt-2 text-lg font-black text-[#171717]">{formatDateTime(selectedBooking.startDate)}</p>
                    <p className="mt-1 text-sm text-black/55">Fine: {formatDateTime(selectedBooking.endDate)}</p>
                  </div>
                  <div className="rounded-[24px] border border-black/5 bg-[#FFFCFD] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">Salone / stato</p>
                    <p className="mt-2 text-lg font-black text-[#171717]">{getSalonLabel(selectedBooking.inferredSalon)}</p>
                    <p className="mt-1 text-sm text-black/55">{selectedBooking.confirmationStatus || selectedBooking.financialStatus || selectedBooking.attendance || "Nessuno stato"}</p>
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
                            const canDelete = isAdmin || isAuthor;

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
