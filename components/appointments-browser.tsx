"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  ArrowRight,
  Check,
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
  Sparkles,
  Trash,
  UserRound,
  UsersRound,
  MessageCircle,
  X,
  Loader2,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { appointmentSalonUrl, normalizeAppointmentSalonSlug } from "@/lib/appointment-salon-url";
import { AppointmentSignModal } from "./appointment-sign-modal";

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

type TeamOption = BookingTeammate;

type ClientControlEmployee = {
  id: string;
  name: string;
  locationName?: string | null;
};

type ClientControlAppointmentForm = {
  salon: string;
  clientName: string;
  email: string;
  phone: string;
  serviceTitle: string;
  depositPaid: string;
  paid: string;
  staffIds: string[];
  shopifyOrder: string;
  instagramTag: string;
  customNoteText: string;
  notes: boolean;
  beforeMedia: boolean;
  afterMedia: boolean;
  products: boolean;
  review: boolean;
  bookingId?: string | null;
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
  sheetMatched?: boolean;
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

const pcLinkManagerRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
const pcLockTimeoutMs = 10 * 60 * 1000;

const clientControlSalons = [{ label: "Corso", value: "Salone Buenos Aires" }];

const clientControlNoteSuggestions = [
  "Cliente simpatica",
  "Cliente si e trovata bene",
  "Cliente poco collaborativa",
  "Cliente arrivata in ritardo",
  "Capelli molto sottili",
  "Capelli poco curati",
  "Cute sensibile",
  "Ha bisogno di consulenza colore",
  "Spiegata manutenzione a casa",
];

const extensionFormatOptions = [
  "100g 55cm",
  "150g 55cm",
  "200g 55cm",
  "100g 65cm",
  "150g 65cm",
  "200g 65cm",
];

const extensionColorOptions = [
  "1 - CAMY - NERO",
  "2 - ALY - CASTANO SCURO",
  "3 - GINY - CASTANO FONDENTE",
  "4 - ROXY - CASTANO",
  "4.A - ROXY - CASTANO",
  "4.B - ROXY - CASTANO",
  "5 - NOEMY - NOCCIOLA",
  "5.B - NOEMY - NOCCIOLA",
  "6 - FRANCY - CASTANO CHIARO",
  "6.B - FRANCY - CASTANO CHIARO",
  "7 - KARY - CARAMELLO",
  "8 MICHY - TOFFE MESCIATO",
  "8.A - MICHY - TOFFE MESCIATO",
  "8.B - MICHY - TOFFE MESCIATO",
  "9 - VERONICA - CASTANO & MIELE",
  "9.A - VERONICA - CASTANO & MIELE",
  "10 - GABY - BIONDO MIELE SFUMATO",
  "10.A - GABY - BIONDO MIELE SFUMATO",
  "10.B - GABY - BIONDO MIELE SFUMATO",
  "11 - EMY - BIONDO CENERE",
  "11.A - EMY - BIONDO CENERE",
  "12 - LISY - BIONDO RAMATO",
  "12.A - LISY - BIONDO RAMATO",
  "13 - LOLY - BIONDO & MIELE",
  "14 - PAMY - BIONDO MESCIATO",
  "14.A - PAMY - BIONDO MESCIATO",
  "15 - LEIDY - BIONDO NOCCIOLA",
];

const viewOptions: Array<{ value: ViewMode; label: string }> = [
  { value: "day", label: "Giorno" },
  { value: "week", label: "Settimana" },
  { value: "month", label: "Mese" },
];

const appointmentsPageSize = 5;

const appointmentStatusOptions: Array<{
  value: AppointmentStatusValue;
  label: string;
}> = [
  { value: "PRENOTATO", label: "Prenotato" },
  { value: "NON_PRESENTATO", label: "Non presentato" },
  { value: "INIZIATO", label: "Iniziato" },
  { value: "IN_ATTESA", label: "In attesa" },
  { value: "COMPLETATO", label: "Completato" },
  { value: "ARRIVATO_IN_RITARDO", label: "Arrivato in ritardo" },
  { value: "PAGATO", label: "Pagato" },
];

const appointmentStatusLabels = Object.fromEntries(
  appointmentStatusOptions.map((option) => [option.value, option.label]),
) as Record<AppointmentStatusValue, string>;

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
    new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date),
    new Intl.DateTimeFormat("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date),
    new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" }).format(
      date,
    ),
    new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(
      date,
    ),
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
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
    return "-";
  const minutes = Math.max(
    0,
    Math.round((endDate.getTime() - startDate.getTime()) / 60000),
  );
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
  return cleaned.length > max
    ? `${cleaned.slice(0, max - 1).trim()}...`
    : cleaned;
}

function getDetailValue(
  details: AppointmentRecord["extraDetails"],
  keywords: string[],
) {
  const normalizedKeywords = keywords.map((keyword) =>
    normalizeSearchValue(keyword),
  );
  return (
    details?.find((item) => {
      const label = normalizeSearchValue(item.label);
      return normalizedKeywords.some((keyword) => label.includes(keyword));
    })?.value || ""
  );
}

function getQuantityLabel(booking: AppointmentRecord) {
  return (
    compactValue(
      getDetailValue(booking.extraDetails, ["quantita", "qta", "quantity"]),
      18,
    ) || "1"
  );
}

function getCustomerContactLines(booking: AppointmentRecord) {
  const phone =
    booking.customerPhone ||
    getDetailValue(booking.extraDetails, [
      "numero telefono",
      "telefono",
      "phone",
    ]);
  const email =
    booking.customerEmail || getDetailValue(booking.extraDetails, ["email"]);
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

  return {
    phone: compactValue(phone, 30),
    email: compactValue(email, 34),
    answers,
  };
}

function getBookingNotePreview(booking: AppointmentRecord) {
  const cowlendarNote = compactValue(booking.notesText, 130);
  if (cowlendarNote) return cowlendarNote;
  const formNote = getDetailValue(booking.extraDetails, [
    "note",
    "nota",
    "comment",
    "memo",
  ]);
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

function normalizeAppointmentStatus(
  value?: string | null,
): AppointmentStatusValue | null {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .trim();

  if (normalized === "NON_PRESENTATO" || normalized === "NO_SHOW")
    return "NON_PRESENTATO";
  if (normalized === "ARRIVATO_IN_RITARDO" || normalized === "IN_RITARDO")
    return "ARRIVATO_IN_RITARDO";
  if (normalized === "IN_ATTESA" || normalized === "ATTESA") return "IN_ATTESA";
  if (normalized === "INIZIATO") return "INIZIATO";
  if (normalized === "COMPLETATO" || normalized === "COMPLETA")
    return "COMPLETATO";
  if (normalized === "PAGATO" || normalized === "PAID") return "PAGATO";
  if (
    normalized === "PRENOTATO" ||
    normalized === "CONFIRMED" ||
    normalized === "CONFERMATO"
  )
    return "PRENOTATO";
  return null;
}

function getDefaultAppointmentStatus(
  booking: AppointmentRecord,
): AppointmentStatusValue {
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

function getBookingDateKey(
  booking: Pick<AppointmentRecord, "startDate" | "dateKey">,
) {
  if ("dateKey" in booking && booking.dateKey) {
    return booking.dateKey;
  }

  return localDateKey(new Date(booking.startDate));
}

function getFirstVisibleBookingDate(bookings: AppointmentRecord[]) {
  const todayKey = localDateKey(new Date());
  const activeBookings = bookings.filter((booking) => !booking.isCanceled);
  const sorted = [...(activeBookings.length ? activeBookings : bookings)].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
  const upcoming =
    sorted.find((booking) => getBookingDateKey(booking) >= todayKey) ||
    sorted[0];
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
    return `${new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(start)} - ${new Intl.DateTimeFormat(
      "it-IT",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      },
    ).format(end)}`;
  }

  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(anchorDate);
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

function Avatar({
  name,
  photoUrl,
  size = "size-10",
}: {
  name: string;
  photoUrl?: string | null;
  size?: string;
}) {
  if (photoUrl) {
    return (
      <div
        className={`overflow-hidden rounded-2xl border border-black/5 bg-[#F7DCE3] ${size}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveDrivePhotoUrl(photoUrl)}
          alt={name}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`grid place-items-center rounded-2xl bg-[#F7DCE3] font-black text-[#171717] ${size}`}
    >
      {getInitials(name) || "?"}
    </div>
  );
}

function ServiceImage({
  title,
  imageUrl,
  compact = false,
}: {
  title: string;
  imageUrl?: string | null;
  compact?: boolean;
}) {
  const sizeClass = compact ? "size-12" : "h-36 w-full";

  if (imageUrl) {
    return (
      <div
        className={`overflow-hidden rounded-2xl border border-black/5 bg-[#FFF1F6] ${sizeClass}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`grid place-items-center rounded-2xl border border-black/5 bg-[#FFF1F6] text-[#C66170] ${sizeClass}`}
    >
      <CalendarDays className={compact ? "size-5" : "size-8"} />
    </div>
  );
}

type ActivePcWorker = {
  id: string;
  name: string;
  photo_url?: string | null;
  locationName: string;
  status: "IN" | "BREAK" | string;
  breakStartedAt?: string | null;
};

function formatPcBreakTimer(startedAt: string, now: number) {
  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

function PcStaffLockScreen({
  salon,
  onUnlock,
}: {
  salon: SalonFilter;
  onUnlock: (worker: ActivePcWorker) => void;
}) {
  const [activeStaff, setActiveStaff] = useState<ActivePcWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectingWorkerId, setSelectingWorkerId] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [pinPrefix, setPinPrefix] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;

    async function loadActiveStaff() {
      setLoading(true);
      setError("");

      try {
        const params = salon !== "tutti" ? `?salone=${encodeURIComponent(salon)}` : "";
        const response = await fetch(`/api/appointments/pc/active-staff${params}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Impossibile recuperare lo staff attivo.");
        }
        const data = await response.json();
        if (active) setActiveStaff(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load active PC staff:", err);
        if (active) {
          setError(err instanceof Error ? err.message : "Impossibile caricare il personale attivo.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadActiveStaff();
    const interval = window.setInterval(loadActiveStaff, 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [salon]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase();
  const selectedPcWorker = activeStaff.find((item) => item.id === selectedWorkerId) || null;

  function addPinDigit(digit: string) {
    if (!selectedWorkerId || selectingWorkerId) return;
    setPinPrefix((current) => `${current}${digit}`.replace(/\D/g, "").slice(0, 2));
    setError("");
  }

  async function unlockWithWorker(worker: ActivePcWorker) {
    const cleanPinPrefix = pinPrefix.replace(/\D/g, "").slice(0, 2);
    if (!/^\d{2}$/.test(cleanPinPrefix)) {
      setError("Inserisci le prime 2 cifre del PIN.");
      return;
    }
    setSelectingWorkerId(worker.id);
    setError("");
    try {
      const response = await fetch("/api/appointments/pc/select-worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: worker.id, salone: salon, pinPrefix: cleanPinPrefix }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Impossibile accedere con questo profilo.");
      onUnlock(worker);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile accedere con questo profilo.");
      setSelectingWorkerId("");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] h-dvh max-h-dvh overflow-hidden bg-[#FFFBF6] text-neutral-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.96),rgba(255,251,246,0.86)_42%,rgba(246,229,214,0.38))]" />
      <div className="pointer-events-none absolute -right-32 bottom-[-36%] h-[78vh] w-[52vw] rounded-full border border-[#D8B7A7]/30 shadow-[inset_22px_28px_45px_rgba(195,159,139,0.10)]" />
      <section className="relative flex h-full min-h-0 flex-col items-center px-5 py-5 md:px-10 lg:px-14">
        <div className="mx-auto max-w-4xl space-y-2 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full border border-[#D8B7A7]/40 bg-white/35 text-neutral-950 shadow-[0_14px_40px_rgba(120,82,64,0.08)]">
            <LockKeyhole className="size-6" strokeWidth={1.45} />
          </div>
          <h2 className="font-serif text-4xl font-light leading-tight tracking-normal text-neutral-950 md:text-5xl xl:text-6xl">
            Chi vuole usare il gestionale?
          </h2>
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-neutral-700 md:text-sm">
            Seleziona il tuo profilo per continuare.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="size-8 animate-spin text-[#A56A42]" />
            <span className="mt-4 text-xs font-black uppercase tracking-wider text-neutral-400">
              Caricamento personale attivo...
            </span>
          </div>
        ) : activeStaff.length === 0 ? (
          <div className={`mx-auto max-w-xl rounded-2xl border p-5 text-center text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {error || "Nessun membro dello staff risulta timbrato. Effettua prima la timbratura dal tablet."}
          </div>
        ) : (
          <>
          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-center text-sm font-bold text-red-800">
              {error}
            </div>
          ) : null}
          <div className="mt-6 grid w-full max-w-7xl flex-1 grid-cols-2 justify-items-center gap-x-7 gap-y-5 overflow-y-auto pb-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {activeStaff.map((worker) => {
              const photoUrl = resolveDrivePhotoUrl(worker.photo_url || "");
              const firstName = worker.name.split(" ")[0] || worker.name;
              const selected = selectedWorkerId === worker.id;
              const isOnBreak = worker.status === "BREAK" && Boolean(worker.breakStartedAt);

              return (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() => {
                    setSelectedWorkerId(worker.id);
                    setPinPrefix("");
                    setError("");
                  }}
                  disabled={Boolean(selectingWorkerId)}
                  className="group flex w-36 min-w-0 flex-col items-center text-center transition hover:-translate-y-1 disabled:pointer-events-none disabled:opacity-70 2xl:w-40"
                >
                  <div className={`relative grid size-36 place-items-center rounded-full border p-2 shadow-[0_18px_42px_rgba(95,58,45,0.08)] transition 2xl:size-40 ${selected ? "border-[#C96F70] bg-[#F8E3DE] ring-4 ring-[#D98A88]/30" : "border-[#E6CEC4] bg-white/50 group-hover:border-[#D9A69A]"}`}>
                    {photoUrl ? (
                      <span className="block size-full overflow-hidden rounded-full">
                        <img
                          src={photoUrl}
                          alt={worker.name}
                          className="size-full scale-125 object-cover object-[50%_24%]"
                        />
                      </span>
                    ) : (
                      <div className="grid size-full place-items-center rounded-full bg-[#FCE6EF] font-serif text-3xl font-semibold text-[#F12D83]">
                        {getInitials(worker.name)}
                      </div>
                    )}
                    <span className={`absolute right-4 top-3 size-4 rounded-full border-2 border-white shadow-2xs ${isOnBreak ? "bg-amber-400" : "bg-emerald-400"}`} />
                    {selected ? (
                      <span className="absolute -right-2 top-4 grid size-11 place-items-center rounded-full bg-[#C96F70] text-white shadow-[0_10px_25px_rgba(201,111,112,0.28)]">
                        <Check className="size-5" strokeWidth={2} />
                      </span>
                    ) : null}
                    {selectingWorkerId === worker.id ? (
                      <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70">
                        <Loader2 className="size-7 animate-spin text-[#F12D83]" />
                      </span>
                    ) : null}
                  </div>
                  <p className={`mt-4 max-w-full break-words text-sm font-semibold uppercase leading-tight tracking-[0.22em] md:text-base ${selected ? "text-[#C96F70]" : "text-neutral-800"}`}>
                    {firstName}
                  </p>
                  <div className="mt-2 h-6">
                    {isOnBreak ? (
                      <span className="inline-flex items-center rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
                        Pausa {formatPcBreakTimer(worker.breakStartedAt!, now)}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="sticky bottom-0 mt-4 flex w-full flex-col items-center gap-2 border-t border-[#E6CEC4]/65 bg-[#FFFBF6]/92 py-3 backdrop-blur">
            <label className="text-center text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">
              Prime 2 cifre del PIN
            </label>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={pinPrefix}
              onChange={(event) => setPinPrefix(event.target.value.replace(/\D/g, "").slice(0, 2))}
              disabled={!selectedWorkerId || Boolean(selectingWorkerId)}
              className="h-12 w-28 rounded-2xl border border-[#D8B7A7]/70 bg-white/75 text-center text-2xl font-black tracking-[0.24em] text-neutral-950 shadow-[0_14px_30px_rgba(120,82,64,0.08)] outline-none transition placeholder:text-neutral-300 focus:border-[#C96F70] focus:ring-4 focus:ring-[#D98A88]/20 disabled:opacity-45"
              placeholder="--"
              aria-label="Prime 2 cifre del PIN"
            />
            <div className="grid w-[252px] grid-cols-3 gap-1.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={!selectedWorkerId || pinPrefix.length >= 2 || Boolean(selectingWorkerId)}
                  onClick={() => {
                    setPinPrefix((current) => `${current}${digit}`.slice(0, 2));
                    setError("");
                  }}
                  className="grid h-11 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white/70 text-lg font-black text-neutral-900 shadow-[0_10px_22px_rgba(120,82,64,0.07)] transition active:scale-95 disabled:opacity-35"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                disabled={!selectedWorkerId || !pinPrefix || Boolean(selectingWorkerId)}
                onClick={() => {
                  setPinPrefix((current) => current.slice(0, -1));
                  setError("");
                }}
                className="grid h-11 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white/70 text-neutral-900 shadow-[0_10px_22px_rgba(120,82,64,0.07)] transition active:scale-95 disabled:opacity-35"
                aria-label="Cancella una cifra"
              >
                <X className="size-5" />
              </button>
              <button
                type="button"
                disabled={!selectedWorkerId || pinPrefix.length >= 2 || Boolean(selectingWorkerId)}
                onClick={() => {
                  setPinPrefix((current) => `${current}0`.slice(0, 2));
                  setError("");
                }}
                className="grid h-11 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white/70 text-lg font-black text-neutral-900 shadow-[0_10px_22px_rgba(120,82,64,0.07)] transition active:scale-95 disabled:opacity-35"
              >
                0
              </button>
              <button
                type="button"
                disabled={!selectedWorkerId || !pinPrefix || Boolean(selectingWorkerId)}
                onClick={() => {
                  setPinPrefix("");
                  setError("");
                }}
                className="grid h-11 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white/70 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-700 shadow-[0_10px_22px_rgba(120,82,64,0.07)] transition active:scale-95 disabled:opacity-35"
              >
                Cancella
              </button>
            </div>
            <button
            type="button"
            disabled={!selectedWorkerId || pinPrefix.length !== 2 || Boolean(selectingWorkerId)}
            onClick={() => {
              const worker = activeStaff.find((item) => item.id === selectedWorkerId);
              if (worker) void unlockWithWorker(worker);
            }}
            className="inline-flex h-14 min-w-[min(92vw,420px)] items-center justify-center gap-6 rounded-2xl bg-neutral-950 px-6 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_22px_45px_rgba(0,0,0,0.20)] transition hover:bg-neutral-800 disabled:pointer-events-none disabled:opacity-35"
          >
            {selectingWorkerId ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                <span>
                  {selectedWorkerId
                    ? `Continua come ${activeStaff.find((item) => item.id === selectedWorkerId)?.name.split(" ")[0] || ""}`
                    : "Seleziona un profilo"}
                </span>
                <ArrowRight className="size-7" strokeWidth={1.4} />
              </>
            )}
          </button>
          </div>
          {selectedPcWorker ? (
            <div className="fixed inset-0 z-[90] grid place-items-center bg-black/28 px-5 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-[28px] border border-[#E6CEC4] bg-[#FFFBF6] p-5 text-center shadow-[0_28px_90px_rgba(60,38,28,0.24)]">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWorkerId("");
                    setPinPrefix("");
                    setError("");
                  }}
                  disabled={Boolean(selectingWorkerId)}
                  className="ml-auto grid size-10 place-items-center rounded-full border border-[#E6CEC4] bg-white/75 text-neutral-700 transition active:scale-95 disabled:opacity-45"
                  aria-label="Chiudi tastierino PIN"
                >
                  <X className="size-5" />
                </button>
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">
                  Prime 2 cifre PIN
                </p>
                <h3 className="mt-2 font-serif text-3xl font-light text-neutral-950">
                  {selectedPcWorker.name.split(" ")[0] || selectedPcWorker.name}
                </h3>
                <div className="mx-auto mt-5 grid h-14 w-32 grid-cols-2 items-center gap-3 rounded-2xl border border-[#D8B7A7]/70 bg-white/75 px-4">
                  {[0, 1].map((index) => (
                    <span
                      key={index}
                      className={`mx-auto size-5 rounded-full border-2 ${pinPrefix.length > index ? "border-[#C96F70] bg-[#C96F70]" : "border-neutral-300"}`}
                    />
                  ))}
                </div>
                <div className="mx-auto mt-5 grid w-[252px] grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      disabled={pinPrefix.length >= 2 || Boolean(selectingWorkerId)}
                      onClick={() => addPinDigit(digit)}
                      className="grid h-14 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white text-xl font-black text-neutral-950 shadow-[0_10px_22px_rgba(120,82,64,0.07)] transition active:scale-95 disabled:opacity-35"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={!pinPrefix || Boolean(selectingWorkerId)}
                    onClick={() => {
                      setPinPrefix((current) => current.slice(0, -1));
                      setError("");
                    }}
                    className="grid h-14 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white text-neutral-950 shadow-[0_10px_22px_rgba(120,82,64,0.07)] transition active:scale-95 disabled:opacity-35"
                    aria-label="Cancella una cifra"
                  >
                    <X className="size-5" />
                  </button>
                  <button
                    type="button"
                    disabled={pinPrefix.length >= 2 || Boolean(selectingWorkerId)}
                    onClick={() => addPinDigit("0")}
                    className="grid h-14 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white text-xl font-black text-neutral-950 shadow-[0_10px_22px_rgba(120,82,64,0.07)] transition active:scale-95 disabled:opacity-35"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    disabled={!pinPrefix || Boolean(selectingWorkerId)}
                    onClick={() => {
                      setPinPrefix("");
                      setError("");
                    }}
                    className="grid h-14 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white text-[10px] font-black uppercase tracking-[0.14em] text-neutral-700 shadow-[0_10px_22px_rgba(120,82,64,0.07)] transition active:scale-95 disabled:opacity-35"
                  >
                    Cancella
                  </button>
                </div>
                <button
                  type="button"
                  disabled={pinPrefix.length !== 2 || Boolean(selectingWorkerId)}
                  onClick={() => void unlockWithWorker(selectedPcWorker)}
                  className="mt-5 inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-neutral-950 px-6 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_18px_36px_rgba(0,0,0,0.18)] transition active:scale-95 disabled:pointer-events-none disabled:opacity-35"
                >
                  {selectingWorkerId ? <Loader2 className="size-5 animate-spin" /> : "Continua"}
                </button>
              </div>
            </div>
          ) : null}
          </>
        )}
      </section>
    </div>
  );
}

export function AppointmentsBrowser({
  initialBookings,
  corsoTeamOptions,
  isPC = false,
  pcLocationId = "",
  initialSalon = "tutti",
  initialPcWorkerName = "",
  locations = [],
}: {
  initialBookings: AppointmentRecord[];
  corsoTeamOptions: TeamOption[];
  isPC?: boolean;
  pcLocationId?: string;
  initialSalon?: SalonFilter;
  initialPcWorkerName?: string;
  locations?: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Signature Modal states
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "status" | "team" | "comment";
    payload: any;
  } | null>(null);

  // PC Link Generation Modal states
  const [pcGenModalOpen, setPcGenModalOpen] = useState(false);
  const [genSedeId, setGenSedeId] = useState("");
  const [genPcName, setGenPcName] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [genError, setGenError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (searchParams.get("refresh") === "true") {
      router.replace(appointmentSalonUrl(initialSalon === "tutti" ? null : initialSalon));
      setIsRefreshing(false);
    }
  }, [searchParams, router]);

  useEffect(() => {
    const salonFromUrl = normalizeAppointmentSalonSlug(searchParams.get("salone") || searchParams.get("salon"));
    setSalon((salonFromUrl || initialSalon) as SalonFilter);
  }, [initialSalon, searchParams]);

  function updateSalonFilter(nextSalon: SalonFilter) {
    setSalon(nextSalon);
    router.replace(appointmentSalonUrl(nextSalon === "tutti" ? null : nextSalon), { scroll: false });
  }

  const [view, setView] = useState<ViewMode>("day");
  const [salon, setSalon] = useState<SalonFilter>(initialSalon);
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [internalNotes, setInternalNotes] = useState<Record<string, string>>(
    {},
  );
  const [showCanceled, setShowCanceled] = useState(false);
  const [visibleCount, setVisibleCount] = useState(appointmentsPageSize);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);
  const [teamByBooking, setTeamByBooking] = useState<
    Record<string, BookingTeammate[]>
  >(() =>
    Object.fromEntries(
      initialBookings.map((booking) => [booking.id, booking.teammates]),
    ),
  );
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState(() => {
    const today = localDateKey(new Date());
    return {
      mode: "today" as AppointmentDateFilterMode,
      from: today,
      to: today,
    };
  });
  const [statusByBooking, setStatusByBooking] = useState<
    Record<string, AppointmentStatusValue>
  >(() =>
    Object.fromEntries(
      initialBookings
        .map(
          (booking) =>
            [
              booking.id,
              normalizeAppointmentStatus(booking.localStatus),
            ] as const,
        )
        .filter((entry): entry is readonly [string, AppointmentStatusValue] =>
          Boolean(entry[1]),
        ),
    ),
  );

  const normalizedSearch = normalizeSearchValue(searchTerm);
  function getBookingTeam(booking?: AppointmentRecord | null): BookingTeammate[] {
    if (!booking) return [];
    const team = teamByBooking[booking.id] || booking.teammates;
    return Array.isArray(team) ? team : [];
  }

  function normalizeSalonName(value?: string | null) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/^salone\s+/, "")
      .replace(/^corso\s+/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function salonNameForBooking(booking: AppointmentRecord) {
    return booking.inferredSalon === "buenos-aires"
      ? "Salone Buenos Aires"
      : "Salone Duomo";
  }

  function matchEmployeeIdsForBooking(
    booking: AppointmentRecord,
    employees: ClientControlEmployee[],
  ) {
    const clean = (value?: string | null) =>
      String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const bookingSalon = normalizeSalonName(salonNameForBooking(booking));
    const salonEmployees = employees.filter((employee) => {
      const employeeSalon = normalizeSalonName(employee.locationName);
      return (
        employeeSalon.includes(bookingSalon) ||
        bookingSalon.includes(employeeSalon)
      );
    });
    const ids: string[] = [];

    for (const mate of getBookingTeam(booking)) {
      const mateClean = clean(mate.name);
      if (!mateClean) continue;
      const matched = salonEmployees.find((employee) => {
        const employeeClean = clean(employee.name);
        if (!employeeClean) return false;
        const firstName = mateClean.split("|")[0] || mateClean;
        return (
          employeeClean.includes(mateClean) ||
          mateClean.includes(employeeClean) ||
          employeeClean.includes(firstName)
        );
      });
      if (matched && !ids.includes(matched.id)) ids.push(matched.id);
    }

    return ids;
  }

  const [clientControlOpen, setClientControlOpen] = useState(false);
  const [clientControlEmployees, setClientControlEmployees] = useState<
    ClientControlEmployee[]
  >([]);
  const [clientControlLoading, setClientControlLoading] = useState(false);
  const [clientControlSubmitting, setClientControlSubmitting] = useState(false);
  const [clientControlPolishing, setClientControlPolishing] = useState(false);
  const [clientControlMessage, setClientControlMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [selectedExtensionFormat, setSelectedExtensionFormat] = useState("");
  const [selectedExtensionColor, setSelectedExtensionColor] = useState("");
  const [clientControlForm, setClientControlForm] =
    useState<ClientControlAppointmentForm>({
      salon: "Salone Buenos Aires",
      clientName: "",
      email: "",
      phone: "",
      serviceTitle: "",
      depositPaid: "",
      paid: "",
      staffIds: [],
      shopifyOrder: "",
      instagramTag: "",
      customNoteText: "",
      notes: false,
      beforeMedia: false,
      afterMedia: false,
      products: false,
      review: false,
      bookingId: null,
    });

  const clientControlEmployeeOptions = useMemo(() => {
    const merged = new Map<string, ClientControlEmployee>();
    clientControlEmployees.forEach((employee) => {
      merged.set(employee.id, employee);
    });
    corsoTeamOptions.forEach((employee) => {
      if (!merged.has(employee.id)) {
        merged.set(employee.id, {
          id: employee.id,
          name: employee.name,
          locationName: "Salone Buenos Aires",
        });
      }
    });
    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name, "it"));
  }, [clientControlEmployees, corsoTeamOptions]);

  const filteredClientControlEmployees = useMemo(() => {
    const selectedSalon = normalizeSalonName(clientControlForm.salon);
    return clientControlEmployeeOptions.filter((employee) => {
      const employeeSalon = normalizeSalonName(employee.locationName);
      return (
        employeeSalon.includes(selectedSalon) ||
        selectedSalon.includes(employeeSalon)
      );
    });
  }, [clientControlEmployeeOptions, clientControlForm.salon]);

  function appendClientControlNote(text: string) {
    const value = text.trim();
    if (!value) return;
    setClientControlForm((prev) => {
      const current = prev.customNoteText.trim();
      return {
        ...prev,
        customNoteText: current ? `${current}\n${value}` : value,
        notes: true,
      };
    });
  }

  function selectedClientControlStaffNames() {
    return clientControlForm.staffIds
      .map(
        (id) =>
          clientControlEmployeeOptions.find((employee) => employee.id === id)?.name,
      )
      .filter((name): name is string => Boolean(name));
  }

  function hasClientControlNoteContext() {
    return Boolean(
      clientControlForm.customNoteText.trim() ||
      clientControlForm.clientName.trim() ||
      clientControlForm.shopifyOrder.trim() ||
      clientControlForm.serviceTitle.trim() ||
      clientControlForm.depositPaid ||
      clientControlForm.paid ||
      clientControlForm.staffIds.length ||
      clientControlForm.notes ||
      clientControlForm.beforeMedia ||
      clientControlForm.afterMedia ||
      clientControlForm.products ||
      clientControlForm.review,
    );
  }

  async function polishClientControlNote() {
    if (!hasClientControlNoteContext() || clientControlPolishing) return;
    setClientControlPolishing(true);
    setClientControlMessage(null);
    try {
      const response = await fetch("/api/client-control/polish-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: clientControlForm.customNoteText.trim(),
          clientName: clientControlForm.clientName,
          serviceTitle: clientControlForm.serviceTitle,
          orderNumber: clientControlForm.shopifyOrder,
          salon: clientControlForm.salon,
          depositPaid: clientControlForm.depositPaid,
          paid: clientControlForm.paid,
          instagramTag: clientControlForm.instagramTag,
          staffNames: selectedClientControlStaffNames(),
          checks: {
            notes: clientControlForm.notes,
            beforeMedia: clientControlForm.beforeMedia,
            afterMedia: clientControlForm.afterMedia,
            products: clientControlForm.products,
            review: clientControlForm.review,
          },
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.note)
        throw new Error(data?.error || "Non riesco a sistemare la nota.");
      setClientControlForm((prev) => ({
        ...prev,
        customNoteText: data.note,
        notes: true,
      }));
    } catch (error) {
      setClientControlMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Non riesco a sistemare la nota.",
      });
    } finally {
      setClientControlPolishing(false);
    }
  }

  async function loadClientControlEmployees() {
    if (clientControlEmployees.length) return clientControlEmployees;
    setClientControlLoading(true);
    try {
      const response = await fetch("/api/client-control/analytics", {
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          data?.error || "Non riesco a caricare le collaboratrici.",
        );
      const employees = Array.isArray(data?.employees) ? data.employees : [];
      setClientControlEmployees(employees);
      return employees as ClientControlEmployee[];
    } finally {
      setClientControlLoading(false);
    }
  }

  async function openClientControlForBooking(booking: AppointmentRecord) {
    setClientControlMessage(null);
    setSelectedExtensionFormat("");
    setSelectedExtensionColor("");
    try {
      const salonName = salonNameForBooking(booking);
      const baseForm: ClientControlAppointmentForm = {
        salon: clientControlSalons.some((option) => option.value === salonName)
          ? salonName
          : "Salone Buenos Aires",
        clientName: booking.customerName || "",
        email: booking.customerEmail || "",
        phone:
          booking.customerPhone ||
          getDetailValue(booking.extraDetails, [
            "numero telefono",
            "telefono",
            "phone",
          ]) ||
          "",
        serviceTitle: booking.serviceTitle || "",
        depositPaid:
          booking.priceAmount != null ? String(booking.priceAmount) : "",
        paid: "",
        staffIds: matchEmployeeIdsForBooking(
          booking,
          clientControlEmployees,
        ).slice(0, 1),
        shopifyOrder: booking.bookingStr
          ? booking.bookingStr.replace(/^#/, "")
          : "",
        instagramTag: "",
        customNoteText: "",
        notes: false,
        beforeMedia: false,
        afterMedia: false,
        products: false,
        review: false,
        bookingId: booking.id,
      };

      setClientControlForm(baseForm);
      setClientControlOpen(true);
    } catch (error) {
      console.error("Failed to open client control form:", error);
      setClientControlOpen(true);
      setClientControlMessage({
        type: "error",
        text: "Ho aperto il form, ma alcuni dati appuntamento non sono stati caricati.",
      });
    }

    const [employees, bookingNotes] = await Promise.all([
      loadClientControlEmployees().catch((error) => {
        setClientControlMessage({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Non riesco a caricare le collaboratrici.",
        });
        return [] as ClientControlEmployee[];
      }),
      fetch(
        `/api/appointments/comments?bookingId=${encodeURIComponent(booking.id)}${booking.bookingStr ? `&orderName=${encodeURIComponent(booking.bookingStr)}` : ""}`,
      )
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    ]);

    setClientControlForm((current) => {
      if (current.bookingId !== booking.id) return current;
      return {
        ...current,
        staffIds: current.staffIds.length
          ? current.staffIds.slice(0, 1)
          : matchEmployeeIdsForBooking(booking, employees).slice(0, 1),
        customNoteText:
          current.customNoteText || bookingNotes?.shopifyNote || "",
      };
    });
  }

  async function submitClientControlForm() {
    setClientControlMessage(null);
    if (
      !clientControlForm.salon ||
      !clientControlForm.clientName.trim() ||
      clientControlForm.staffIds.length === 0
    ) {
      setClientControlMessage({
        type: "error",
        text: "Completa sede, nome cliente e collaboratrice.",
      });
      return;
    }

    setClientControlSubmitting(true);
    try {
      const response = await fetch("/api/client-control/tablet-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientControlForm),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.error || "Errore durante il salvataggio.");
      setClientControlMessage({
        type: "success",
        text: "Scheda controllo cliente salvata.",
      });
    } catch (error) {
      setClientControlMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Errore durante il salvataggio.",
      });
    } finally {
      setClientControlSubmitting(false);
    }
  }

  const activeBookingsCount = initialBookings.filter(
    (booking) => !booking.isCanceled,
  ).length;
  const canceledBookingsCount = initialBookings.filter(
    (booking) => booking.isCanceled,
  ).length;
  const dateFilterLabel = useMemo(() => {
    if (dateFilter.mode === "all") return "Tutte le date";
    if (dateFilter.mode === "today") return "Oggi";
    if (dateFilter.mode === "tomorrow") return "Domani";
    const from = formatDate(dateFilter.from);
    const to = formatDate(dateFilter.to);
    return from === to ? from : `${from} - ${to}`;
  }, [dateFilter]);

  const availableStaffList = useMemo(() => {
    const set = new Set<string>();
    (initialBookings || []).forEach((b) => {
      getBookingTeam(b).forEach((mate) => {
        if (mate && mate.name) set.add(mate.name.trim());
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "it"));
  }, [initialBookings, teamByBooking]);

  const activeAdvancedFilterCount =
    (filterStaff !== "all" ? 1 : 0) +
    (filterPayment !== "all" ? 1 : 0) +
    (filterStatus !== "all" ? 1 : 0);

  const filteredBookings = useMemo(() => {
    const statusScoped = (initialBookings || []).filter((booking) =>
      showCanceled ? booking.isCanceled : !booking.isCanceled,
    );
    const base =
      salon === "tutti"
        ? statusScoped
        : statusScoped.filter((booking) => booking.inferredSalon === salon);
    const dateScoped =
      dateFilter.mode === "all"
        ? base
        : base.filter((booking) => {
            const key = getBookingDateKey(booking);
            const from =
              dateFilter.from <= dateFilter.to
                ? dateFilter.from
                : dateFilter.to;
            const to =
              dateFilter.from <= dateFilter.to
                ? dateFilter.to
                : dateFilter.from;
            return key >= from && key <= to;
          });

    const staffScoped =
      filterStaff === "all"
        ? dateScoped
        : dateScoped.filter((booking) => {
            const team = getBookingTeam(booking);
            return team.some(
              (mate) =>
                mate &&
                mate.name &&
                mate.name.trim().toLowerCase() === filterStaff.toLowerCase(),
            );
          });

    const paymentScoped =
      filterPayment === "all"
        ? staffScoped
        : staffScoped.filter((booking) => {
            const financial = normalizeSearchValue(booking.financialStatus || "");
            const title = normalizeSearchValue(booking.serviceTitle || "");
            if (filterPayment === "pagato") return financial.includes("paid") || booking.financialStatus === "PAGATO";
            if (filterPayment === "acconto") return title.includes("acconto") || financial.includes("partially_paid");
            if (filterPayment === "prenotato") return !financial.includes("paid") && !title.includes("acconto");
            return true;
          });

    const appointmentStatusScoped =
      filterStatus === "all"
        ? paymentScoped
        : paymentScoped.filter((booking) => {
            const status = getBookingStatus(booking);
            return status === filterStatus;
          });

    const searched = normalizedSearch
      ? appointmentStatusScoped.filter((booking) => {
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
            ...getBookingTeam(booking).map((mate) => mate.name),
            ...(booking.extraDetails ?? []).flatMap((item) => [
              item.label,
              item.value,
            ]),
          ]
            .filter(Boolean)
            .map((entry) => normalizeSearchValue(entry))
            .join(" ");

          return haystack.includes(normalizedSearch);
        })
      : appointmentStatusScoped;

    return [...searched].sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
  }, [
    dateFilter,
    filterStaff,
    filterPayment,
    filterStatus,
    initialBookings,
    normalizedSearch,
    salon,
    showCanceled,
    teamByBooking,
  ]);

  useEffect(() => {
    setVisibleCount(appointmentsPageSize);
  }, [dateFilter, normalizedSearch, salon, showCanceled, view, anchorDate]);

  const selectedBooking = useMemo(
    () =>
      filteredBookings.find((booking) => booking.id === selectedBookingId) ||
      initialBookings.find((booking) => booking.id === selectedBookingId) ||
      null,
    [filteredBookings, initialBookings, selectedBookingId],
  );

  useEffect(() => {
    if (!filteredBookings.length) {
      if (selectedBookingId !== null) setSelectedBookingId(null);
      return;
    }
    if (
      selectedBookingId &&
      !filteredBookings.some((booking) => booking.id === selectedBookingId)
    ) {
      setSelectedBookingId(null);
    }
  }, [filteredBookings, selectedBookingId]);

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
  const [cowlendarOrderNote, setCowlendarOrderNote] = useState<string | null>(
    null,
  );
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    role: string;
  } | null>(null);
  const [pcScreenLocked, setPcScreenLocked] = useState(isPC && !initialPcWorkerName);
  const [pcActiveWorker, setPcActiveWorker] = useState<ActivePcWorker | null>(
    initialPcWorkerName
      ? { id: "kiosk-selected-worker", name: initialPcWorkerName, locationName: "", status: "IN" }
      : null,
  );
  const canManageAppointmentNotes = currentUser?.role !== "DIPENDENTE";

  useEffect(() => {
    if (!isPC) return;

    const lockScreen = () => {
      setPcScreenLocked(true);
      setPcActiveWorker(null);
    };

    let timeout = window.setTimeout(lockScreen, pcLockTimeoutMs);
    const resetTimer = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(lockScreen, pcLockTimeoutMs);
    };

    const events = ["click", "keydown", "mousemove", "touchstart", "scroll"];
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));

    return () => {
      window.clearTimeout(timeout);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [isPC, pcActiveWorker?.id]);

  function handlePcUnlock(worker: ActivePcWorker) {
    setPcActiveWorker(worker);
    setPcScreenLocked(false);
  }

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
      setCowlendarOrderNote(null);
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
          setCowlendarOrderNote(data.cowlendarOrderNote || null);
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

  const handleGeneratePcLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genSedeId || !genPcName.trim() || generatingLink) return;

    setGeneratingLink(true);
    setGenError("");
    setGeneratedLink("");
    setCopiedLink(false);

    try {
      const res = await fetch("/api/appointments/pc/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: genSedeId, name: genPcName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Errore durante la generazione del link.");
      }

      const data = await res.json();
      if (!data?.link) {
        throw new Error("Il server non ha restituito un link valido.");
      }
      setGeneratedLink(data.link);
    } catch (err) {
      console.error(err);
      setGenError(err instanceof Error ? err.message : "Errore durante la generazione.");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleSignConfirm = (workerName: string) => {
    setSignModalOpen(false);
    if (!pendingAction) return;

    if (pendingAction.type === "status") {
      executeStatusChange(
        pendingAction.payload.bookingId,
        pendingAction.payload.nextStatus,
        workerName,
      );
    } else if (pendingAction.type === "team") {
      executeTeamChange(
        pendingAction.payload.booking,
        pendingAction.payload.teammateIds,
        workerName,
      );
    } else if (pendingAction.type === "comment") {
      executeAddComment(
        pendingAction.payload.orderName,
        pendingAction.payload.bookingId,
        pendingAction.payload.messageText,
        workerName,
      );
    }

    setPendingAction(null);
  };

  async function executeAddComment(
    orderName: string | null,
    bookingId: string,
    messageText: string,
    signedBy?: string,
  ) {
    setSubmittingComment(true);
    try {
      const res = await fetch("/api/appointments/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderName,
          bookingId,
          message: messageText,
          signedBy,
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
          return current && current.trim()
            ? `${current.trim()}\n\n${newBlock}`
            : newBlock;
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

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBooking || !newCommentText.trim() || submittingComment) return;

    const orderName = selectedBooking.bookingStr;
    const bookingId = selectedBooking.id;
    const messageText = newCommentText.trim();

    if (isPC) {
      if (!pcActiveWorker) {
        setPcScreenLocked(true);
        return;
      }
      executeAddComment(orderName, bookingId, messageText, pcActiveWorker.name);
    } else {
      executeAddComment(orderName, bookingId, messageText);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!window.confirm("Sei sicuro di voler eliminare questo commento?"))
      return;
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

  function getBookingStatus(
    booking: AppointmentRecord,
  ): AppointmentStatusValue {
    return statusByBooking[booking.id] || getDefaultAppointmentStatus(booking);
  }

  async function executeStatusChange(
    bookingId: string,
    nextStatus: AppointmentStatusValue,
    signedBy?: string,
  ) {
    const previousStatus = statusByBooking[bookingId];
    setStatusByBooking((current) => ({ ...current, [bookingId]: nextStatus }));
    setSavingStatusId(bookingId);

    try {
      const response = await fetch("/api/appointments/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, status: nextStatus, signedBy }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Non sono riuscito a salvare lo stato.");
      }

      const data = await response.json().catch(() => null);
      if (data?.statusComment && selectedBooking?.id === bookingId) {
        setDbComments((current) => [...current, data.statusComment]);
      }
    } catch (error) {
      console.error("Failed to save appointment status:", error);
      setStatusByBooking((current) => {
        const copy = { ...current };
        if (previousStatus) copy[bookingId] = previousStatus;
        else delete copy[bookingId];
        return copy;
      });
      alert(
        error instanceof Error
          ? error.message
          : "Non sono riuscito a salvare lo stato. Riprova.",
      );
    } finally {
      setSavingStatusId(null);
    }
  }

  function handleStatusChange(
    bookingId: string,
    nextStatus: AppointmentStatusValue,
  ) {
    if (isPC) {
      if (!pcActiveWorker) {
        setPcScreenLocked(true);
        return;
      }
      executeStatusChange(bookingId, nextStatus, pcActiveWorker.name);
    } else {
      executeStatusChange(bookingId, nextStatus);
    }
  }

  async function executeTeamChange(
    booking: AppointmentRecord,
    teammateIds: string[],
    signedBy?: string,
  ) {
    const previousTeam = getBookingTeam(booking);
    const nextTeam = corsoTeamOptions.filter((option) =>
      teammateIds.includes(option.id),
    );

    if (booking.inferredSalon !== "buenos-aires") {
      alert(
        "Il team si puo modificare solo per gli appuntamenti del salone Corso.",
      );
      return;
    }

    if (!nextTeam.length) {
      alert("Seleziona almeno una collaboratrice del salone Corso.");
      return;
    }

    setTeamByBooking((current) => ({ ...current, [booking.id]: nextTeam }));
    setSavingTeamId(booking.id);

    try {
      const response = await fetch("/api/appointments/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id, teammateIds, signedBy }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Non sono riuscito a salvare il team.");
      }
    } catch (error) {
      console.error("Failed to save appointment team:", error);
      setTeamByBooking((current) => ({
        ...current,
        [booking.id]: previousTeam,
      }));
      alert(
        error instanceof Error
          ? error.message
          : "Non sono riuscito a salvare il team. Riprova.",
      );
    } finally {
      setSavingTeamId(null);
    }
  }

  function handleTeamChange(
    booking: AppointmentRecord,
    teammateIds: string[],
  ) {
    if (isPC) {
      if (!pcActiveWorker) {
        setPcScreenLocked(true);
        return;
      }
      executeTeamChange(booking, teammateIds, pcActiveWorker.name);
    } else {
      executeTeamChange(booking, teammateIds);
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
      window.localStorage.setItem(
        "appointments_internal_notes",
        JSON.stringify(internalNotes),
      );
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
    const firstOfMonth = new Date(
      anchorDate.getFullYear(),
      anchorDate.getMonth(),
      1,
    );
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(
      anchorDate.getFullYear(),
      anchorDate.getMonth() + 1,
      0,
    ).getDate();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - firstWeekday + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return null;
      return new Date(
        anchorDate.getFullYear(),
        anchorDate.getMonth(),
        dayNumber,
      );
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

  const dayBookings = useMemo(
    () =>
      filteredBookings.filter(
        (booking) => getBookingDateKey(booking) === localDateKey(anchorDate),
      ),
    [filteredBookings, anchorDate],
  );

  const recentBookings = useMemo(
    () =>
      [...filteredBookings].sort(
        (a, b) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      ),
    [filteredBookings],
  );

  const visibleRecentBookings = recentBookings.slice(0, visibleCount);

  const detailEntries = useMemo(() => {
    if (!selectedBooking?.extraDetails?.length) {
      return {
        formFields: [] as Array<{ label: string; value: string }>,
        otherFields: [] as Array<{ label: string; value: string }>,
      };
    }

    const formFields = selectedBooking.extraDetails.filter((item) => {
      const label = String(item?.label || "").toLowerCase();
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

    const otherFields = selectedBooking.extraDetails.filter(
      (item) => !formFields.includes(item),
    );

    return { formFields, otherFields };
  }, [selectedBooking]);

  const StatusControl = ({
    booking,
    compact = false,
  }: {
    booking: AppointmentRecord;
    compact?: boolean;
  }) => {
    if (booking.isCanceled) {
      return (
        <span className="inline-flex rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-black text-red-700">
          Annullato
        </span>
      );
    }

    const status = getBookingStatus(booking);

    return (
      <div
        className="flex flex-col gap-1"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <select
          value={status}
          onChange={(event) =>
            handleStatusChange(
              booking.id,
              event.target.value as AppointmentStatusValue,
            )
          }
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
        {savingStatusId === booking.id ? (
          <span className="text-[10px] font-bold text-black/35">
            Salvataggio...
          </span>
        ) : null}
      </div>
    );
  };

  const TeamControl = ({ booking }: { booking: AppointmentRecord }) => {
    const currentTeam = getBookingTeam(booking);
    const [draftIds, setDraftIds] = useState(() =>
      currentTeam.map((mate) => mate.id),
    );

    useEffect(() => {
      setDraftIds(currentTeam.map((mate) => mate.id));
    }, [booking.id, currentTeam]);

    if (booking.inferredSalon !== "buenos-aires") {
      return (
        <p className="mt-3 rounded-2xl border border-black/5 bg-[#FCFCFC] p-3 text-xs font-bold text-black/45">
          Modifica disponibile solo per il salone Corso.
        </p>
      );
    }

    if (!corsoTeamOptions.length) {
      return (
        <p className="mt-3 rounded-2xl border border-black/5 bg-[#FCFCFC] p-3 text-xs font-bold text-black/45">
          Nessuna collaboratrice Corso trovata in Cowlendar.
        </p>
      );
    }

    return (
      <div
        className="mt-4 rounded-2xl border border-black/5 bg-[#FCFCFC] p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">
          Modifica team Corso
        </p>
        <div className="mt-3 grid gap-2">
          {corsoTeamOptions.map((option) => {
            const checked = draftIds.includes(option.id);
            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-2 text-sm font-bold text-[#171717]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={savingTeamId === booking.id}
                  onChange={(event) => {
                    setDraftIds((current) =>
                      event.target.checked
                        ? [...new Set([...current, option.id])]
                        : current.filter((id) => id !== option.id),
                    );
                  }}
                  className="size-4 accent-[#C66170]"
                />
                <Avatar
                  name={option.name}
                  photoUrl={option.photoUrl}
                  size="size-9"
                />
                <span className="min-w-0 truncate">{option.name}</span>
              </label>
            );
          })}
        </div>
        <button
          type="button"
          disabled={savingTeamId === booking.id}
          onClick={() => handleTeamChange(booking, draftIds)}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#171717] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
        >
          {savingTeamId === booking.id ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UsersRound className="size-4" />
          )}
          {savingTeamId === booking.id ? "Salvataggio..." : "Salva team"}
        </button>
      </div>
    );
  };

  const WhatsAppSheetNote = ({
    booking,
    compact = false,
    always = false,
  }: {
    booking: AppointmentRecord;
    compact?: boolean;
    always?: boolean;
  }) => {
    const message =
      booking.sheetNote ||
      (booking.sheetMatched
        ? "Conferma trovata, cella J vuota"
        : "Non trovato nel foglio conferme");
    if (!always && !booking.sheetNote) return null;
    const found = Boolean(booking.sheetMatched || booking.sheetNote);
    return (
      <div
        className={[
          "inline-flex max-w-full items-start gap-2 rounded-2xl border",
          found
            ? "border-emerald-100 bg-emerald-50 text-emerald-800"
            : "border-amber-100 bg-amber-50 text-amber-800",
          compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs",
        ].join(" ")}
        title={message}
      >
        <MessageCircle
          className={
            compact ? "mt-0.5 size-3.5 shrink-0" : "mt-0.5 size-4 shrink-0"
          }
        />
        <span className="min-w-0">
          <span className="font-black">WhatsApp</span>
          <span className="ml-1 font-semibold">
            {compact ? compactValue(message, 42) : message}
          </span>
        </span>
      </div>
    );
  };

  const tableBookings = filteredBookings.slice(0, visibleCount);
  const prenotateCount = initialBookings.filter(
    (booking) => !booking.isCanceled,
  ).length;
  const inArrivoCount = initialBookings.filter(
    (booking) =>
      !booking.isCanceled &&
      new Date(booking.startDate).getTime() >= Date.now(),
  ).length;
  const prePaymentCount = initialBookings.filter(
    (booking) =>
      normalizeSearchValue(booking.financialStatus).includes("paid") ||
      normalizeSearchValue(booking.serviceTitle).includes("acconto"),
  ).length;
  const waitListCount = initialBookings.filter(
    (booking) =>
      normalizeSearchValue(booking.bookingType).includes("wait") ||
      normalizeSearchValue(booking.notesText).includes("lista d attesa"),
  ).length;
  const selectedStatus = selectedBooking
    ? getBookingStatus(selectedBooking)
    : "PRENOTATO";
  const selectedContacts = selectedBooking
    ? getCustomerContactLines(selectedBooking)
    : null;
  const selectedNotePreview = selectedBooking
    ? getBookingNotePreview(selectedBooking)
    : "";

  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-5 lg:px-6">
      {clientControlOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-black/15 bg-white shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4 border-b border-black/10 bg-white px-5 py-5 sm:px-7">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#E88AC5]">
                  Store manager
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#171717] sm:text-3xl">
                  Appuntamenti e controllo cliente
                </h2>
                <p className="mt-1 text-xs font-semibold text-black/45">
                  Compila il controllo partendo dai dati dell'appuntamento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClientControlOpen(false)}
                className="grid size-11 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-black shadow-sm transition hover:bg-black/[0.02] active:scale-95"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8F4F1] p-4 sm:p-6">
              <div className="space-y-5">
                <section className="rounded-[20px] border border-black/10 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                        Sede *
                      </p>
                      <p className="mt-1 text-sm font-black text-[#2B211C]">
                        Controllo cliente e nota Shopify
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {clientControlSalons.map((salon) => (
                        <button
                          key={salon.value}
                          type="button"
                          onClick={() =>
                            setClientControlForm((prev) => ({
                              ...prev,
                              salon: salon.value,
                              staffIds: [],
                            }))
                          }
                          className={[
                            "rounded-full border px-3 py-2 text-xs font-black transition",
                            clientControlForm.salon === salon.value
                              ? "border-[#E88AC5] bg-[#FCE5F3] text-[#B83D7F]"
                              : "border-black/10 bg-white text-black/55 hover:bg-black/[0.02]",
                          ].join(" ")}
                        >
                          {salon.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-[20px] border border-black/10 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                      Dati appuntamento
                    </p>
                    <span className="rounded-full bg-black/[0.04] px-3 py-1 text-[10px] font-black text-black/45">
                      Shopify + controllo cliente
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                      ["clientName", "Nome cliente *", "Nome cliente"],
                      ["email", "Email cliente", "email@esempio.com"],
                      ["phone", "Telefono cliente", ""],
                      ["serviceTitle", "Servizio prenotato", "Servizio"],
                      ["shopifyOrder", "Ordine Shopify", "Numero ordine"],
                      ["depositPaid", "Acconto pagato (€)", "0.00"],
                      ["paid", "Pagato (€)", "0.00"],
                      ["instagramTag", "IG tag", "@cliente"],
                    ].map(([fieldKey, label, placeholder]) => (
                      <label key={fieldKey} className="block">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                          {label}
                        </span>
                        <input
                          value={String(
                            (clientControlForm as any)[fieldKey] ?? "",
                          )}
                          readOnly={fieldKey === "serviceTitle"}
                          onChange={(event) =>
                            setClientControlForm((prev) => ({
                              ...prev,
                              [fieldKey]: event.target.value,
                            }))
                          }
                          className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5] read-only:bg-black/[0.02] read-only:text-black/60"
                          placeholder={placeholder}
                        />
                      </label>
                    ))}
                    <div className="block md:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                          Testo nota Shopify
                        </span>
                        <button
                          type="button"
                          onClick={polishClientControlNote}
                          disabled={
                            !hasClientControlNoteContext() ||
                            clientControlPolishing
                          }
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#E88AC5] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-sm shadow-pink-200 transition active:scale-95 disabled:opacity-45"
                        >
                          <Sparkles className="size-3.5" />
                          {clientControlPolishing ? "Sistemo..." : "Sistema IA"}
                        </button>
                      </div>
                      <div className="mt-2 rounded-2xl border border-[#F3B5D4] bg-[#FFF8FC] p-3">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#B83D7F]/70">
                          Suggerimenti
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {clientControlNoteSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() =>
                                appendClientControlNote(suggestion)
                              }
                              className="rounded-full border border-[#F3B5D4] bg-white px-3 py-1.5 text-[11px] font-black text-[#B83D7F] transition active:scale-95"
                            >
                              + {suggestion}
                            </button>
                          ))}
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                              Formato extension
                            </span>
                            <select
                              value={selectedExtensionFormat}
                              onChange={(event) => {
                                const format = event.target.value;
                                setSelectedExtensionFormat(format);
                                if (format)
                                  appendClientControlNote(`Fatto ${format}`);
                              }}
                              className="mt-1 h-11 w-full rounded-2xl border border-[#F3B5D4] bg-white px-3 text-sm font-bold text-[#5D4A42] outline-none focus:border-[#E88AC5]"
                            >
                              <option value="">Seleziona formato</option>
                              {extensionFormatOptions.map((format) => (
                                <option key={format} value={format}>
                                  {format}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                              Colore collection
                            </span>
                            <select
                              value={selectedExtensionColor}
                              onChange={(event) => {
                                const color = event.target.value;
                                setSelectedExtensionColor(color);
                                if (color)
                                  appendClientControlNote(
                                    `Ha fatto colore ${color}`,
                                  );
                              }}
                              className="mt-1 h-11 w-full rounded-2xl border border-[#F3B5D4] bg-white px-3 text-sm font-bold text-[#5D4A42] outline-none focus:border-[#E88AC5]"
                            >
                              <option value="">Seleziona colore</option>
                              {extensionColorOptions.map((color) => (
                                <option key={color} value={color}>
                                  {color}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                      <textarea
                        value={clientControlForm.customNoteText}
                        onChange={(event) =>
                          setClientControlForm((prev) => ({
                            ...prev,
                            customNoteText: event.target.value,
                          }))
                        }
                        className="mt-2 min-h-24 w-full rounded-2xl border border-[#F3B5D4] bg-white p-3 text-sm font-semibold outline-none focus:border-[#E88AC5]"
                        placeholder="Scrivi qui la nota Shopify"
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                      Collaboratrice del salone *
                    </p>
                    <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-2xl border border-black/10 bg-black/[0.02] p-2 sm:grid-cols-2 md:grid-cols-4">
                      {clientControlLoading ? (
                        <p className="col-span-full p-3 text-center text-sm font-bold text-black/40">
                          Carico collaboratrici...
                        </p>
                      ) : filteredClientControlEmployees.length ? (
                        filteredClientControlEmployees.map((employee) => {
                          const selected = clientControlForm.staffIds.includes(
                            employee.id,
                          );
                          return (
                            <button
                              key={employee.id}
                              type="button"
                              onClick={() =>
                                setClientControlForm((prev) => ({
                                  ...prev,
                                  staffIds: selected ? [] : [employee.id],
                                }))
                              }
                              className={[
                                "rounded-xl border px-3 py-2 text-left text-xs font-black transition",
                                selected
                                  ? "border-[#E88AC5] bg-[#FCE5F3] text-[#B83D7F]"
                                  : "border-black/10 bg-white text-black/60 hover:bg-black/[0.02]",
                              ].join(" ")}
                            >
                              {employee.name}
                            </button>
                          );
                        })
                      ) : (
                        <p className="col-span-full p-3 text-center text-sm font-bold text-black/40">
                          Nessuna collaboratrice trovata per questa sede.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {[
                      ["notes", "Note Shopify"],
                      ["beforeMedia", "Prima foto/video"],
                      ["afterMedia", "Dopo foto/video"],
                      ["products", "Prodotti"],
                      ["review", "Recensione"],
                    ].map(([fieldKey, fieldLabel]) => (
                      <label
                        key={fieldKey}
                        className="flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 text-xs font-black text-black/60 hover:bg-black/[0.01]"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(
                            (clientControlForm as any)[fieldKey],
                          )}
                          onChange={(event) =>
                            setClientControlForm((prev) => ({
                              ...prev,
                              [fieldKey]: event.target.checked,
                            }))
                          }
                          className="size-4 accent-[#E88AC5]"
                        />
                        <span>{fieldLabel}</span>
                      </label>
                    ))}
                  </div>

                  {clientControlMessage ? (
                    <p
                      className={`mt-5 rounded-2xl px-4 py-3 text-sm font-black ${clientControlMessage.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                    >
                      {clientControlMessage.text}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={submitClientControlForm}
                    disabled={clientControlSubmitting || clientControlLoading}
                    className="mt-5 h-13 w-full rounded-2xl bg-[#E88AC5] px-5 py-4 text-sm font-black text-white shadow-lg shadow-pink-200 transition active:scale-[0.99] disabled:opacity-60"
                  >
                    {clientControlSubmitting
                      ? "Salvataggio..."
                      : "Salva appuntamento"}
                  </button>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-[1760px]">
        <main className="min-w-0 space-y-5">
          <section className="rounded-[28px] border border-[#E8D8CF] bg-white/85 p-5 shadow-sm backdrop-blur sm:p-7">
            <div>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <h1 className="font-serif text-4xl font-semibold tracking-[-0.02em] text-[#1F1F1F] sm:text-5xl">
                      Prenotazioni
                    </h1>
                    <span className="rounded-full bg-[#F7E5DC] px-3 py-1 text-sm font-black text-[#9B583D]">
                      {activeBookingsCount}
                    </span>
                    {isPC && pcActiveWorker ? (
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = `${appointmentSalonUrl(salon !== "tutti" ? salon : initialSalon !== "tutti" ? initialSalon : null)}?choose=1`;
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-800 transition hover:bg-emerald-100"
                        title="Cambia profilo"
                      >
                        <span className="size-2 rounded-full bg-emerald-500" />
                        <span>{pcActiveWorker.name}</span>
                        <span className="text-emerald-700/70">Cambia</span>
                      </button>
                    ) : null}
                  </div>

                  {!isPC && currentUser?.role && pcLinkManagerRoles.has(currentUser.role) && (
                    <button
                      type="button"
                      onClick={() => {
                        setGenSedeId(locations[0]?.id || "");
                        setGenPcName("");
                        setGeneratedLink("");
                        setGenError("");
                        setCopiedLink(false);
                        setPcGenModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#E8D8CF] bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#4E382C] hover:bg-[#FFF7F3] transition shadow-2xs hover:shadow-xs"
                    >
                      <Sparkles size={13} className="text-[#A56A42]" />
                      <span>Genera Link PC Cassa</span>
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm font-medium text-[#7B6B62]">
                  Visualizza tutte le prenotazioni in arrivo
                </p>
              </div>
            </div>

            <div className="mt-7 overflow-x-auto rounded-[18px] border border-[#E8D8CF] bg-[#FFFDFC] p-2">
              <div className="flex min-w-max gap-2">
                {[
                  {
                    label: "Tutte",
                    count: initialBookings.length,
                    active: !showCanceled,
                    onClick: () => setShowCanceled(false),
                  },
                  {
                    label: "Prenotate",
                    count: prenotateCount,
                    active: !showCanceled,
                    onClick: () => setShowCanceled(false),
                  },
                  {
                    label: "In arrivo",
                    count: inArrivoCount,
                    active: false,
                    onClick: () => setShowCanceled(false),
                  },
                  {
                    label: "Annullate",
                    count: canceledBookingsCount,
                    active: showCanceled,
                    onClick: () => setShowCanceled(true),
                  },
                  {
                    label: "Pre-pagamento",
                    count: prePaymentCount,
                    active: false,
                    onClick: () => setShowCanceled(false),
                  },
                  {
                    label: "Lista d'attesa",
                    count: waitListCount,
                    active: false,
                    onClick: () => setShowCanceled(false),
                  },
                ].map((tab) => (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={tab.onClick}
                    className={[
                      "inline-flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-black transition",
                      tab.active
                        ? "bg-[#FFF1F0] text-[#9F4D46] shadow-sm ring-1 ring-[#F1D1CA]"
                        : "text-[#4E382C] hover:bg-[#FFF7F3]",
                    ].join(" ")}
                  >
                    {tab.label}
                    <span className="rounded-full border border-[#E8D8CF] bg-white px-2.5 py-0.5 text-xs text-[#4E382C]">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(260px,1fr)_200px_200px_110px_140px]">
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
                        {
                          label: "Tutte le date",
                          mode: "all" as AppointmentDateFilterMode,
                          from: dateFilter.from,
                          to: dateFilter.to,
                        },
                        {
                          label: "Oggi",
                          mode: "today" as AppointmentDateFilterMode,
                          from: localDateKey(new Date()),
                          to: localDateKey(new Date()),
                        },
                        {
                          label: "Domani",
                          mode: "tomorrow" as AppointmentDateFilterMode,
                          from: localDateKey(addDays(new Date(), 1)),
                          to: localDateKey(addDays(new Date(), 1)),
                        },
                      ].map((option) => (
                        <button
                          key={option.mode}
                          type="button"
                          onClick={() => {
                            setDateFilter({
                              mode: option.mode,
                              from: option.from,
                              to: option.to,
                            });
                            setIsDatePickerOpen(false);
                          }}
                          className={[
                            "rounded-xl px-3 py-2 text-left text-sm font-black transition",
                            dateFilter.mode === option.mode
                              ? "bg-[#FFF1F6] text-[#B9476D]"
                              : "text-[#4E382C] hover:bg-[#FFF7F3]",
                          ].join(" ")}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2 border-t border-[#E8D8CF] pt-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8D5E49]">
                        Da giorno a giorno
                      </p>
                      <input
                        type="date"
                        value={dateFilter.from}
                        onChange={(event) =>
                          setDateFilter((current) => ({
                            ...current,
                            mode: "custom",
                            from: event.target.value,
                          }))
                        }
                        className="h-11 rounded-xl border border-[#E8D8CF] bg-white px-3 text-sm font-bold text-[#4E382C] outline-none"
                      />
                      <input
                        type="date"
                        value={dateFilter.to}
                        onChange={(event) =>
                          setDateFilter((current) => ({
                            ...current,
                            mode: "custom",
                            to: event.target.value,
                          }))
                        }
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
                onChange={(event) =>
                  updateSalonFilter(event.target.value as SalonFilter)
                }
                className="h-12 rounded-xl border border-[#E8D8CF] bg-white px-4 text-sm font-bold text-[#4E382C] outline-none focus:border-[#C98B73] focus:ring-2 focus:ring-[#F4D8CF]"
              >
                {salonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value === "tutti" ? "Tutti i saloni" : option.label}
                  </option>
                ))}
              </select>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen((current) => !current)}
                  className={`flex h-12 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition ${
                    activeAdvancedFilterCount > 0
                      ? "border-[#F1A7C3] bg-[#FFF1F6] text-[#B9476D] shadow-sm"
                      : "border-[#E8D8CF] bg-white text-[#4E382C] hover:bg-[#FFF7F3]"
                  }`}
                >
                  <MoreVertical className={`size-4 rotate-90 ${activeAdvancedFilterCount > 0 ? "text-[#B9476D]" : "text-[#A56A42]"}`} />
                  <span>Filtri</span>
                  {activeAdvancedFilterCount > 0 ? (
                    <span className="grid size-5 place-items-center rounded-full bg-[#B9476D] text-[10px] font-black text-white">
                      {activeAdvancedFilterCount}
                    </span>
                  ) : null}
                </button>

                {isFilterModalOpen ? (
                  <div className="absolute right-0 top-14 z-40 w-80 rounded-2xl border border-[#E8D8CF] bg-white p-5 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-[#E8D8CF] pb-3">
                      <h4 className="font-serif text-lg font-bold text-[#1F1F1F]">
                        Filtri avanzati
                      </h4>
                      <button
                        type="button"
                        onClick={() => setIsFilterModalOpen(false)}
                        className="rounded-lg p-1 text-[#8D5E49] hover:bg-[#FFF7F3]"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#8D5E49] mb-1.5">
                        Collaboratrice / Staff
                      </label>
                      <select
                        value={filterStaff}
                        onChange={(event) => setFilterStaff(event.target.value)}
                        className="h-10 w-full rounded-xl border border-[#E8D8CF] bg-white px-3 text-xs font-bold text-[#4E382C] outline-none"
                      >
                        <option value="all">Tutte le collaboratrici</option>
                        {availableStaffList.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#8D5E49] mb-1.5">
                        Stato Pagamento
                      </label>
                      <select
                        value={filterPayment}
                        onChange={(event) => setFilterPayment(event.target.value)}
                        className="h-10 w-full rounded-xl border border-[#E8D8CF] bg-white px-3 text-xs font-bold text-[#4E382C] outline-none"
                      >
                        <option value="all">Tutti i pagamenti</option>
                        <option value="pagato">Pagato interamente</option>
                        <option value="acconto">Acconto / Pre-pagamento</option>
                        <option value="prenotato">Da pagare / In salone</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#8D5E49] mb-1.5">
                        Stato Appuntamento
                      </label>
                      <select
                        value={filterStatus}
                        onChange={(event) => setFilterStatus(event.target.value)}
                        className="h-10 w-full rounded-xl border border-[#E8D8CF] bg-white px-3 text-xs font-bold text-[#4E382C] outline-none"
                      >
                        <option value="all">Tutti gli stati</option>
                        {appointmentStatusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#E8D8CF] pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setFilterStaff("all");
                          setFilterPayment("all");
                          setFilterStatus("all");
                        }}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        Azzera filtri
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsFilterModalOpen(false)}
                        className="rounded-xl bg-[#1F1F1F] px-4 py-2 text-xs font-black text-white hover:bg-black"
                      >
                        Applica
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={isRefreshing}
                onClick={() => {
                  setIsRefreshing(true);
                  router.push("/appointments?refresh=true");
                }}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#E8D8CF] bg-white px-4 text-sm font-black text-[#4E382C] hover:bg-[#FFF7F3] transition disabled:opacity-50"
              >
                <RefreshCw className={`size-4 text-[#A56A42] ${isRefreshing ? "animate-spin" : ""}`} />
                <span>{isRefreshing ? "Syncing..." : "Sincronizza"}</span>
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-[#E8D8CF] bg-white/90 shadow-sm">
            <div className="hidden grid-cols-[1.15fr_1fr_1.1fr_0.9fr_0.55fr_0.85fr_48px] gap-4 border-b border-[#E8D8CF] bg-[#FFF9F6] px-6 py-4 text-[12px] font-black uppercase tracking-[0.12em] text-[#8D5E49] xl:grid">
              <span>Appuntamento</span>
              <span>Cliente</span>
              <span>Servizio</span>
              <span>Collaboratrice</span>
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
                  const assignedTeam = getBookingTeam(booking);

                  return (
                    <div
                      key={booking.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedBookingId(booking.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setSelectedBookingId(booking.id);
                      }}
                      className={[
                        "grid w-full cursor-pointer gap-4 px-5 py-5 text-left transition xl:grid-cols-[1.15fr_1fr_1.1fr_0.9fr_0.55fr_0.85fr_48px] xl:items-center",
                        isSelected
                          ? "bg-[#FFF0F2] shadow-[inset_4px_0_0_#C96363]"
                          : "bg-white hover:bg-[#FFF8F6]",
                      ].join(" ")}
                    >
                      <div className="flex gap-3">
                        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#FFE4ED] text-[#C95B75]">
                          <CalendarDays className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#38271F]">
                            {formatDate(booking.startDate)}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#38271F]">
                            {formatTime(booking.startDate)} -{" "}
                            {formatTime(booking.endDate)}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-xs font-semibold uppercase text-[#7A5B4B]">
                            <MapPin className="size-3.5" />
                            {getSalonLabel(booking.inferredSalon)}
                          </p>
                        </div>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-[#1F1F1F]">
                          {booking.customerName}
                        </p>
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
                          <ServiceImage
                            title={booking.serviceTitle}
                            imageUrl={booking.serviceImageUrl}
                            compact
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold uppercase text-[#1F1F1F]">
                              {booking.serviceTitle}
                            </p>
                            <p className="mt-1 truncate text-xs font-medium text-[#6F625C]">
                              {booking.bookingType || "Regular booking"}
                            </p>
                            <span className="mt-2 inline-flex rounded-lg border border-[#E8D8CF] bg-[#FFF9F6] px-2 py-1 text-xs font-bold text-[#7A5B4B]">
                              {formatDuration(
                                booking.startDate,
                                booking.endDate,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 rounded-2xl bg-[#FFF9F6] p-3 xl:bg-transparent xl:p-0">
                        <div className="flex min-w-0 items-center gap-2">
                          {assignedTeam.slice(0, 2).map((mate) => (
                            <Avatar
                              key={mate.id}
                              name={mate.name}
                              photoUrl={mate.photoUrl}
                              size="size-8"
                            />
                          ))}
                          {!assignedTeam.length ? (
                            <UsersRound className="size-4 shrink-0 text-[#C95B75]" />
                          ) : null}
                          <span className="truncate text-sm font-semibold text-[#1F1F1F]">
                            {assignedTeam.map((mate) => mate.name).join(", ") ||
                              "Non assegnato"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs font-medium text-[#7A5B4B]">
                          {getSalonLabel(booking.inferredSalon)}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-[#1F1F1F]">
                          {formatMoney(
                            booking.priceAmount,
                            booking.priceCurrency,
                          )}
                        </p>
                        <p className="mt-1 text-xs font-medium text-[#6F625C]">
                          Qta: {getQuantityLabel(booking)}
                        </p>
                      </div>

                      <div
                        className="space-y-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <StatusControl booking={booking} compact />
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${booking.isCanceled ? "border-red-100 bg-red-50 text-red-700" : appointmentStatusClasses[status]}`}
                          >
                            {booking.isCanceled
                              ? "Annullato"
                              : appointmentStatusLabels[status]}
                          </span>
                          <WhatsAppSheetNote booking={booking} compact />
                        </div>
                      </div>

                      <button
                        type="button"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          void openClientControlForBooking(booking);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="grid size-10 place-items-center rounded-xl border border-[#E8D8CF] bg-white text-[#8D5E49] transition hover:border-[#E88AC5] hover:bg-[#FFF1F8] hover:text-[#B83D7F]"
                        title="Compila controllo cliente"
                      >
                        <ChevronRight className="size-5" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-sm font-semibold text-[#8A7266]">
                  Nessun appuntamento disponibile con questi filtri.
                </div>
              )}
            </div>

            {filteredBookings.length > tableBookings.length ? (
              <div className="border-t border-[#E8D8CF] p-5">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((current) => current + appointmentsPageSize)
                  }
                  className="w-full rounded-2xl border border-[#E8D8CF] bg-white px-4 py-3 text-sm font-black text-[#4E382C] transition hover:bg-[#FFF7F3]"
                >
                  Carica altri 5
                </button>
              </div>
            ) : null}
          </section>
        </main>

        {selectedBooking ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div
              className="fixed inset-0"
              onClick={() => setSelectedBookingId(null)}
            />
            <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl transition-transform animate-in slide-in-from-right duration-300">
              <div className="flex items-start justify-between border-b border-[#E8D8CF] bg-[#FFFBF8] p-6">
                <div>
                  <h2 className="font-serif text-2xl font-semibold text-[#1F1F1F]">
                    Dettaglio prenotazione
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-xl border px-3 py-1.5 text-sm font-semibold ${selectedBooking.isCanceled ? "border-red-100 bg-red-50 text-red-700" : appointmentStatusClasses[selectedStatus]}`}
                    >
                      {selectedBooking.isCanceled
                        ? "Annullato"
                        : appointmentStatusLabels[selectedStatus]}
                    </span>
                    <WhatsAppSheetNote booking={selectedBooking} compact />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBookingId(null);
                  }}
                  className="grid size-11 place-items-center rounded-xl border border-[#E8D8CF] bg-white text-[#5B4235] transition hover:bg-[#FFF7F3]"
                  aria-label="Chiudi dettaglio"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 p-6">
                <section>
                  <h3 className="font-serif text-3xl font-semibold text-[#1F1F1F]">
                    {selectedBooking.customerName}
                  </h3>
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
                  <div className="mt-4">
                    <WhatsAppSheetNote booking={selectedBooking} always />
                  </div>
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      void openClientControlForBooking(selectedBooking);
                    }}
                    onClick={(event) => event.stopPropagation()}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E88AC5] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#D96DB1] active:scale-[0.99]"
                  >
                    <ChevronRight className="size-4" />
                    Compila controllo cliente
                  </button>
                </section>

                <section className="border-t border-[#E8D8CF] pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8D5E49]">
                    Appuntamento
                  </p>
                  <div className="mt-4 space-y-3 text-sm font-medium text-[#3A2A23]">
                    <p className="flex gap-2">
                      <CalendarDays className="mt-0.5 size-4 shrink-0 text-[#A56A42]" />
                      {formatDate(selectedBooking.startDate)}
                    </p>
                    <p className="flex gap-2">
                      <Clock3 className="mt-0.5 size-4 shrink-0 text-[#A56A42]" />
                      {formatTime(selectedBooking.startDate)} -{" "}
                      {formatTime(selectedBooking.endDate)} (
                      {formatDuration(
                        selectedBooking.startDate,
                        selectedBooking.endDate,
                      )}
                      )
                    </p>
                    <p className="flex gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-[#A56A42]" />
                      {getSalonLabel(selectedBooking.inferredSalon)}
                    </p>
                    <p className="flex gap-2">
                      <UsersRound className="mt-0.5 size-4 shrink-0 text-[#A56A42]" />
                      <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
                        {getBookingTeam(selectedBooking)
                          .slice(0, 2)
                          .map((mate) => (
                            <Avatar
                              key={mate.id}
                              name={mate.name}
                              photoUrl={mate.photoUrl}
                              size="size-7"
                            />
                          ))}
                        <span>
                          {getBookingTeam(selectedBooking)
                            .map((mate) => mate.name)
                            .join(", ") || "Non assegnato"}
                        </span>
                      </span>
                    </p>
                  </div>
                </section>

                <section className="border-t border-[#E8D8CF] pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8D5E49]">
                    Servizio
                  </p>
                  <div className="mt-4 flex gap-3">
                    <ServiceImage
                      title={selectedBooking.serviceTitle}
                      imageUrl={selectedBooking.serviceImageUrl}
                      compact
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold uppercase text-[#1F1F1F]">
                        {selectedBooking.serviceTitle}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[#6F625C]">
                        {selectedBooking.bookingType || "Regular booking"}
                      </p>
                      {selectedBooking.bookingStr ? (
                        <p className="mt-2 text-xs font-semibold text-[#A56A42]">
                          Ordine {formatOrderCode(selectedBooking.bookingStr)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="border-t border-[#E8D8CF] pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8D5E49]">
                    Prezzo
                  </p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="font-medium text-[#6F625C]">Totale</span>
                    <span className="font-semibold text-[#1F1F1F]">
                      {formatMoney(
                        selectedBooking.priceAmount,
                        selectedBooking.priceCurrency,
                      )}
                    </span>
                  </div>
                </section>

                <section className="border-t border-[#E8D8CF] pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8D5E49]">
                    Stato
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <StatusControl booking={selectedBooking} />
                    <WhatsAppSheetNote booking={selectedBooking} />
                  </div>
                  {selectedBooking.statusUpdatedBy ? (
                    <p className="mt-3 text-xs font-medium text-[#8A7266]">
                      Ultima modifica: {selectedBooking.statusUpdatedBy}
                      {selectedBooking.statusUpdatedAt
                        ? ` · ${formatDateTime(selectedBooking.statusUpdatedAt)}`
                        : ""}
                    </p>
                  ) : null}
                  {selectedBooking.sheetNote ? (
                    <div className="mt-4 rounded-2xl border border-[#F0D9D3] bg-[#FFF6F7] p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#A15062]">
                        Nota conferma
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#5D4A42]">
                        {selectedBooking.sheetNote}
                      </p>
                    </div>
                  ) : null}
                </section>

                <section className="border-t border-[#E8D8CF] pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8D5E49]">
                    Note
                  </p>
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-[#F0D9D3] bg-[#FFF6F7] p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#A15062]">
                        Note Cowlendar
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#5D4A42]">
                        {selectedBooking.notesText?.trim() ||
                          cowlendarOrderNote?.trim() ||
                          "Nessuna nota presente in Cowlendar."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#F1DDC9] bg-[#FFF7F2] p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#B46125]">
                        Note Shopify
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#7C3E14]">
                        {selectedBooking.bookingStr
                          ? shopifyNote?.trim() ||
                            "Nessuna nota presente su Shopify."
                          : "Nessun ordine Shopify collegato."}
                      </p>
                    </div>
                  </div>
                </section>

                {selectedContacts?.answers.length ? (
                  <section className="border-t border-[#E8D8CF] pt-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8D5E49]">
                      Risposte cliente
                    </p>
                    <div className="mt-4 space-y-3">
                      {selectedContacts.answers.map((item, index) => (
                        <div
                          key={`${selectedBooking.id}-side-answer-${index}`}
                          className="rounded-2xl border border-[#E8D8CF] bg-[#FFFDFC] p-3"
                        >
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8D5E49]">
                            {item.label}
                          </p>
                          <p className="mt-1 text-sm font-medium text-[#3A2A23]">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="border-t border-[#E8D8CF] pt-5">
                  <TeamControl booking={selectedBooking} />
                </section>
              </div>
            </aside>
          </div>
        ) : null}
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
              !showCanceled
                ? "border-[#171717] bg-[#171717] text-white"
                : "border-black/8 bg-white text-black/55 hover:border-black/20 hover:text-black",
            ].join(" ")}
          >
            <CalendarCheck className="size-4" />
            Prenotazioni{" "}
            <span className="ml-2 opacity-70">{activeBookingsCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCanceled(true)}
            className={[
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition",
              showCanceled
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-black/8 bg-white text-black/55 hover:border-red-200 hover:text-red-700",
            ].join(" ")}
          >
            <X className="size-4" />
            Annullato{" "}
            <span className="ml-2 opacity-70">{canceledBookingsCount}</span>
          </button>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {salonOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateSalonFilter(option.value)}
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
            <button
              type="button"
              onClick={() => setAnchorDate(getPrevDate(view, anchorDate))}
              className="grid size-10 place-items-center rounded-full text-black/60 transition hover:bg-white hover:text-black"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="min-w-[180px] px-3 text-center text-sm font-black capitalize text-[#171717]">
              {getRangeLabel(view, anchorDate)}
            </div>
            <button
              type="button"
              onClick={() => setAnchorDate(getNextDate(view, anchorDate))}
              className="grid size-10 place-items-center rounded-full text-black/60 transition hover:bg-white hover:text-black"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-black/45">
            <span className="rounded-full bg-[#FFF1F5] px-3 py-1 font-bold text-[#C66170]">
              {filteredBookings.length} appuntamenti
            </span>
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
                  <div
                    key={day}
                    className="border-r border-black/5 px-4 py-3 text-center text-[11px] font-black uppercase tracking-[0.16em] text-black/45 last:border-r-0"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 border-x border-b border-black/5">
                {monthGrid.map((date, index) => {
                  if (!date) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="min-h-[188px] border-r border-b border-black/5 bg-black/[0.02] p-3 last:border-r-0"
                      />
                    );
                  }

                  const items = bookingsByDay.get(localDateKey(date)) ?? [];
                  const isToday =
                    localDateKey(date) === localDateKey(new Date());

                  return (
                    <div
                      key={date.toISOString()}
                      className="min-h-[188px] border-r border-b border-black/5 bg-white p-3 last:border-r-0"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span
                          className={`grid size-8 place-items-center rounded-full text-sm font-black ${isToday ? "bg-[#F4A9C6] text-white" : "text-[#171717]"}`}
                        >
                          {date.getDate()}
                        </span>
                        {items.length ? (
                          <span className="rounded-full bg-[#FFF1F5] px-2 py-1 text-[10px] font-black text-[#C66170]">
                            {items.length}
                          </span>
                        ) : null}
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
                            <p className="truncate text-[11px] font-black text-[#171717]">
                              {formatTime(booking.startDate)} ·{" "}
                              {booking.customerName}
                            </p>
                            {booking.bookingStr ? (
                              <p className="mt-1 truncate text-[10px] font-bold text-[#C66170]">
                                Ordine {formatOrderCode(booking.bookingStr)}
                              </p>
                            ) : null}
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
                <div
                  key={date.toISOString()}
                  className="rounded-[22px] border border-black/5 bg-[#FFFCFD] p-4"
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/45">
                    {weekDays[(date.getDay() + 6) % 7]}
                  </p>
                  <p className="mt-1 text-lg font-black text-[#171717]">
                    {date.getDate()}
                  </p>
                  <div className="mt-4 space-y-2">
                    {items.length ? (
                      items.map((booking) => (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => setSelectedBookingId(booking.id)}
                          className="w-full rounded-[16px] border border-[#F0DCE3] bg-white px-3 py-2 text-left transition hover:border-[#EAA1BB] hover:bg-[#FFF8FB]"
                        >
                          <p className="truncate text-xs font-black text-[#171717]">
                            {formatTime(booking.startDate)} ·{" "}
                            {booking.customerName}
                          </p>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-black/35">
                        Nessun appuntamento.
                      </p>
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
                Nessun appuntamento nel giorno selezionato. Ti mostro i primi
                appuntamenti disponibili con questi filtri.
              </div>
            ) : null}
            {(dayBookings.length
              ? dayBookings
              : recentBookings.slice(0, appointmentsPageSize)
            ).length ? (
              (dayBookings.length
                ? dayBookings
                : recentBookings.slice(0, appointmentsPageSize)
              ).map((booking) => {
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
                      if (event.key === "Enter" || event.key === " ")
                        setSelectedBookingId(booking.id);
                    }}
                    className="grid w-full gap-4 rounded-[22px] border border-black/5 bg-[#FFFDFD] px-4 py-4 text-left transition hover:border-[#EAA1BB] hover:bg-[#FFF8FB] lg:grid-cols-[2fr_0.75fr_1.35fr_1.15fr_0.95fr] lg:items-center"
                  >
                    <div className="flex min-w-0 gap-4">
                      <div className="shrink-0">
                        <ServiceImage
                          title={booking.serviceTitle}
                          imageUrl={booking.serviceImageUrl}
                          compact
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-[#171717]">
                          {booking.customerName}
                        </p>
                        <p className="mt-1 truncate text-sm font-black uppercase text-[#C66170]">
                          {formatTime(booking.startDate)} ·{" "}
                          {booking.serviceTitle}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-black/50">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3.5 text-[#C66170]" />
                            {formatDateTime(booking.startDate)}
                          </span>
                          {booking.bookingStr ? (
                            <span>
                              Ordine {formatOrderCode(booking.bookingStr)}
                            </span>
                          ) : null}
                          <span>
                            {booking.bookingType || "Regular booking"}
                          </span>
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
                        {formatMoney(
                          booking.priceAmount,
                          booking.priceCurrency,
                        )}
                      </p>
                      <p className="mt-1 text-xs font-bold text-black/45">
                        Qta: {getQuantityLabel(booking)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#FAFAFA] p-3 lg:bg-transparent lg:p-0">
                      <p className="flex items-center gap-1 text-sm font-black text-[#171717]">
                        <UserRound className="size-4 text-[#C66170]" />
                        {booking.customerName}
                      </p>
                      <p className="mt-1 flex items-center gap-1 truncate text-xs font-bold text-black/50">
                        <Phone className="size-3.5 text-black/35" />
                        <span className="truncate">
                          {customerLines.phone || "Nessun telefono"}
                        </span>
                      </p>
                      <p className="mt-1 flex items-center gap-1 truncate text-xs font-bold text-black/50">
                        <Mail className="size-3.5 text-black/35" />
                        <span className="truncate">
                          {customerLines.email || "Email non disponibile"}
                        </span>
                      </p>
                      {customerLines.answers.slice(0, 2).map((item, index) => (
                        <p
                          key={`${booking.id}-day-answer-${index}`}
                          className="mt-1 line-clamp-1 text-xs font-bold text-black/45"
                        >
                          {item.label}: {compactValue(item.value, 44)}
                        </p>
                      ))}
                    </div>

                    <div className="rounded-2xl bg-[#FAFAFA] p-3 lg:bg-transparent lg:p-0">
                      <p className="flex items-center gap-1 text-sm font-black text-[#171717]">
                        <UsersRound className="size-4 text-[#C66170]" />
                        {getBookingTeam(booking)
                          .map((mate) => mate.name)
                          .join(", ") || "Non assegnato"}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-black/45">
                        <MapPin className="size-3.5" />
                        {getSalonLabel(booking.inferredSalon)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <StatusControl booking={booking} compact />
                      {!booking.isCanceled ? (
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${appointmentStatusClasses[status]}`}
                        >
                          {appointmentStatusLabels[status]}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-dashed border-black/10 bg-[#FFFCFD] p-5 text-sm font-bold text-black/45">
                Nessun appuntamento disponibile.
              </div>
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
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#C66170]">
                {showCanceled ? "Annullati" : "Prenotazioni"}
              </p>
              <h3 className="mt-1 text-2xl font-black text-[#171717]">
                Lista appuntamenti
              </h3>
            </div>
          </div>
          <span className="rounded-full bg-[#F7F7F7] px-3 py-1 text-xs font-black text-black/55">
            {Math.min(visibleCount, recentBookings.length)} di{" "}
            {recentBookings.length}
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
                      if (event.key === "Enter" || event.key === " ")
                        setSelectedBookingId(booking.id);
                    }}
                    className="grid w-full gap-4 px-5 py-5 text-left transition hover:bg-[#FFF8FB] lg:grid-cols-[2.1fr_0.8fr_1.35fr_1.25fr_1fr_40px] lg:items-center"
                  >
                    <div className="flex min-w-0 gap-4">
                      <div className="shrink-0">
                        <ServiceImage
                          title={booking.serviceTitle}
                          imageUrl={booking.serviceImageUrl}
                          compact
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black uppercase text-[#171717]">
                          {booking.serviceTitle}
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-black/55">
                          {booking.bookingType || "Regular booking"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-black/50">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3.5" />
                            {formatDateTime(booking.startDate)}
                          </span>
                          {booking.bookingStr ? (
                            <span>
                              Ordine {formatOrderCode(booking.bookingStr)}
                            </span>
                          ) : null}
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
                        {formatMoney(
                          booking.priceAmount,
                          booking.priceCurrency,
                        )}
                      </p>
                      <p className="mt-1 text-xs font-bold text-black/45">
                        Qta: {getQuantityLabel(booking)}
                      </p>
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
                          <span className="truncate">
                            {customerLines.phone || "Nessun telefono"}
                          </span>
                        </p>
                        <p className="flex items-center gap-1">
                          <Mail className="size-3.5 text-black/35" />
                          <span className="truncate">
                            {customerLines.email || "Email non disponibile"}
                          </span>
                        </p>
                        {customerLines.answers.map((item, index) => (
                          <p
                            key={`${booking.id}-answer-${index}`}
                            className="flex items-start gap-1"
                          >
                            <span className="mt-1 grid size-3.5 shrink-0 place-items-center rounded-full border border-black/10 text-[9px] text-black/45">
                              i
                            </span>
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
                        {getBookingTeam(booking)
                          .map((mate) => mate.name)
                          .join(", ") || "Non assegnato"}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-black/45">
                        <MapPin className="size-3.5" />
                        {getSalonLabel(booking.inferredSalon)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <StatusControl booking={booking} compact />
                      {!booking.isCanceled ? (
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${appointmentStatusClasses[status]}`}
                        >
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
            <div className="p-5 text-sm font-bold text-black/45">
              Nessun appuntamento disponibile.
            </div>
          )}
        </div>
        {recentBookings.length > visibleRecentBookings.length ? (
          <div className="border-t border-black/5 p-5">
            <button
              type="button"
              onClick={() =>
                setVisibleCount((current) => current + appointmentsPageSize)
              }
              className="w-full rounded-[18px] border border-black/8 bg-white px-4 py-3 text-sm font-black text-[#171717] transition hover:border-[#F1A7C3] hover:bg-[#FFF8FB]"
            >
              Carica altri 5
            </button>
          </div>
        ) : null}
      </section>

      {false && clientControlOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-[26px] border border-black/15 bg-[#FAFAFA] shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-5 sm:px-7">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#E88AC5]">
                  Store manager
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#171717] sm:text-3xl">
                  Appuntamenti e controllo cliente
                </h2>
                <p className="mt-1 text-xs font-semibold text-black/45">
                  Compila il controllo partendo dai dati dell'appuntamento.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#171717] px-4 py-2 text-xs font-black text-white">
                    Crea appuntamento
                  </span>
                  <span className="rounded-full bg-black/5 px-4 py-2 text-xs font-black text-black/45">
                    Analytics
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClientControlOpen(false)}
                className="grid size-11 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-black shadow-sm transition hover:bg-black/[0.02] active:scale-95"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
              <div className="rounded-[26px] border border-black/10 bg-white p-4 shadow-sm sm:p-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                    Sede *
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {clientControlSalons.map((salon) => (
                      <button
                        key={salon.value}
                        type="button"
                        onClick={() =>
                          setClientControlForm((prev) => ({
                            ...prev,
                            salon: salon.value,
                            staffIds: [],
                          }))
                        }
                        className={[
                          "rounded-full border px-3 py-2 text-xs font-black transition",
                          clientControlForm.salon === salon.value
                            ? "border-[#E88AC5] bg-[#FCE5F3] text-[#B83D7F]"
                            : "border-black/10 bg-white text-black/55 hover:bg-black/[0.02]",
                        ].join(" ")}
                      >
                        {salon.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                      Nome cliente *
                    </span>
                    <input
                      value={clientControlForm.clientName}
                      onChange={(event) =>
                        setClientControlForm((prev) => ({
                          ...prev,
                          clientName: event.target.value,
                        }))
                      }
                      className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]"
                      placeholder="Nome cliente"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                      Email cliente
                    </span>
                    <input
                      value={clientControlForm.email}
                      onChange={(event) =>
                        setClientControlForm((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                      className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]"
                      placeholder="email@esempio.com"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                      Telefono cliente
                    </span>
                    <input
                      value={clientControlForm.phone}
                      onChange={(event) =>
                        setClientControlForm((prev) => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                      className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]"
                      placeholder=""
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                      Servizio prenotato
                    </span>
                    <input
                      value={clientControlForm.serviceTitle}
                      readOnly
                      className="mt-1 h-12 w-full rounded-2xl border border-black/10 bg-black/[0.02] px-4 text-sm font-bold text-black/60 outline-none"
                      placeholder="Servizio"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                      Ordine Shopify
                    </span>
                    <input
                      value={clientControlForm.shopifyOrder}
                      onChange={(event) =>
                        setClientControlForm((prev) => ({
                          ...prev,
                          shopifyOrder: event.target.value,
                        }))
                      }
                      className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]"
                      placeholder="Numero ordine"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                      Acconto pagato (€)
                    </span>
                    <input
                      inputMode="decimal"
                      value={clientControlForm.depositPaid}
                      onChange={(event) =>
                        setClientControlForm((prev) => ({
                          ...prev,
                          depositPaid: event.target.value,
                        }))
                      }
                      className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]"
                      placeholder="0.00"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                      Pagato (€)
                    </span>
                    <input
                      inputMode="decimal"
                      value={clientControlForm.paid}
                      onChange={(event) =>
                        setClientControlForm((prev) => ({
                          ...prev,
                          paid: event.target.value,
                        }))
                      }
                      className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]"
                      placeholder="0.00"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                      IG tag
                    </span>
                    <input
                      value={clientControlForm.instagramTag}
                      onChange={(event) =>
                        setClientControlForm((prev) => ({
                          ...prev,
                          instagramTag: event.target.value,
                        }))
                      }
                      className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]"
                      placeholder="@cliente"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                      Testo nota Shopify
                    </span>
                    <textarea
                      value={clientControlForm.customNoteText}
                      onChange={(event) =>
                        setClientControlForm((prev) => ({
                          ...prev,
                          customNoteText: event.target.value,
                        }))
                      }
                      className="mt-1 min-h-24 w-full rounded-2xl border border-[#F3B5D4] bg-[#FFF8FC] p-3 text-sm font-semibold outline-none focus:border-[#E88AC5]"
                      placeholder="Scrivi qui la nota Shopify"
                    />
                  </label>
                </div>

                <div className="mt-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                    Collaboratrice del salone *
                  </p>
                  <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-2xl border border-black/10 bg-black/[0.02] p-2 sm:grid-cols-2 md:grid-cols-4">
                    {clientControlLoading ? (
                      <p className="col-span-full p-3 text-center text-sm font-bold text-black/40">
                        Carico collaboratrici...
                      </p>
                    ) : filteredClientControlEmployees.length ? (
                      filteredClientControlEmployees.map((employee) => {
                        const selected = clientControlForm.staffIds.includes(
                          employee.id,
                        );
                        return (
                          <button
                            key={employee.id}
                            type="button"
                            onClick={() =>
                              setClientControlForm((prev) => ({
                                ...prev,
                                staffIds: selected ? [] : [employee.id],
                              }))
                            }
                            className={[
                              "rounded-xl border px-3 py-2 text-left text-xs font-black transition",
                              selected
                                ? "border-[#E88AC5] bg-[#FCE5F3] text-[#B83D7F]"
                                : "border-black/10 bg-white text-black/60 hover:bg-black/[0.02]",
                            ].join(" ")}
                          >
                            {employee.name}
                          </button>
                        );
                      })
                    ) : (
                      <p className="col-span-full p-3 text-center text-sm font-bold text-black/40">
                        Nessuna collaboratrice trovata per questa sede.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    ["notes", "Note Shopify"],
                    ["beforeMedia", "Prima foto/video"],
                    ["afterMedia", "Dopo foto/video"],
                    ["products", "Prodotti"],
                    ["review", "Recensione"],
                  ].map(([fieldKey, fieldLabel]) => (
                    <label
                      key={fieldKey}
                      className="flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 text-xs font-black text-black/60 hover:bg-black/[0.01]"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean((clientControlForm as any)[fieldKey])}
                        onChange={(event) =>
                          setClientControlForm((prev) => ({
                            ...prev,
                            [fieldKey]: event.target.checked,
                          }))
                        }
                        className="size-4 accent-[#E88AC5]"
                      />
                      <span>{fieldLabel}</span>
                    </label>
                  ))}
                </div>

                {clientControlMessage ? (
                  <p
                    className={`mt-5 rounded-2xl px-4 py-3 text-sm font-black ${clientControlMessage.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                  >
                    {clientControlMessage.text}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={submitClientControlForm}
                  disabled={clientControlSubmitting || clientControlLoading}
                  className="mt-5 h-13 w-full rounded-2xl bg-[#E88AC5] px-5 py-4 text-sm font-black text-white shadow-lg shadow-pink-200 transition active:scale-[0.99] disabled:opacity-60"
                >
                  {clientControlSubmitting
                    ? "Salvataggio..."
                    : "Salva appuntamento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedBooking ? (
        <div className="fixed inset-0 z-[90] bg-black/45 p-4 backdrop-blur-sm">
          <div className="mx-auto flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-black/5 px-5 py-5">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#C66170]">
                  Dettaglio appuntamento
                </p>
                <h3 className="mt-2 text-3xl font-black text-[#171717]">
                  {selectedBooking.customerName}
                </h3>
                <p className="mt-2 text-sm text-black/55">
                  {selectedBooking.serviceTitle}
                </p>
                <div className="mt-3">
                  <WhatsAppSheetNote booking={selectedBooking} always />
                </div>
                {selectedBooking.bookingStr ? (
                  <p className="mt-3 inline-flex rounded-full bg-[#FFF1F5] px-3 py-1 text-xs font-black text-[#C66170]">
                    Ordine Shopify {formatOrderCode(selectedBooking.bookingStr)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookingId(null)}
                className="grid size-12 place-items-center rounded-full border border-black/5 bg-white text-black/60 transition hover:text-black"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="grid flex-1 gap-6 overflow-auto p-5 lg:grid-cols-[1.15fr_0.85fr] min-h-0">
              <div className="space-y-5">
                <ServiceImage
                  title={selectedBooking.serviceTitle}
                  imageUrl={selectedBooking.serviceImageUrl}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-[#FFE2EC] bg-[#FFF7FA] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#C66170]">
                      Note Cowlendar
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-[#5D4A42]">
                      {selectedBooking!.notesText?.trim() ||
                        cowlendarOrderNote?.trim() ||
                        "Nessuna nota presente in questo appuntamento."}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-[#FFE7D6] bg-[#FFF7F2] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#C67035]">
                      Note Shopify
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-[#7C3E14]">
                      {selectedBooking!.bookingStr
                        ? shopifyNote?.trim() ||
                          "Nessuna nota presente su Shopify."
                        : "Nessun ordine Shopify collegato."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-black/5 bg-[#FFFCFD] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">
                      Data e ora
                    </p>
                    <p className="mt-2 text-lg font-black text-[#171717]">
                      {formatDateTime(selectedBooking.startDate)}
                    </p>
                    <p className="mt-1 text-sm text-black/55">
                      Fine: {formatDateTime(selectedBooking.endDate)}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-black/5 bg-[#FFFCFD] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">
                      Salone / stato
                    </p>
                    <p className="mt-2 text-lg font-black text-[#171717]">
                      {getSalonLabel(selectedBooking.inferredSalon)}
                    </p>
                    <div className="mt-3">
                      <StatusControl booking={selectedBooking} />
                    </div>
                    <div className="mt-3">
                      <WhatsAppSheetNote booking={selectedBooking} />
                    </div>
                    {selectedBooking.statusUpdatedBy ? (
                      <p className="mt-2 text-xs font-bold text-black/40">
                        Ultima modifica: {selectedBooking.statusUpdatedBy}
                        {selectedBooking.statusUpdatedAt
                          ? ` · ${formatDateTime(selectedBooking.statusUpdatedAt)}`
                          : ""}
                      </p>
                    ) : null}
                    {selectedBooking.sheetNote ? (
                      <div className="mt-3 rounded-2xl border border-black/5 bg-[#FFF6F7] p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#A15062]">
                          Nota conferma
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-5 text-[#5D4A42]">
                          {selectedBooking.sheetNote}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[24px] border border-black/5 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">
                    Cliente
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">
                        Nome
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">
                        {selectedBooking.customerName}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">
                        Telefono
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">
                        {selectedBooking.customerPhone || "-"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FAFAFA] p-3 sm:col-span-2">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">
                        Email
                      </p>
                      <p className="mt-2 break-all text-sm font-bold text-[#171717]">
                        {selectedBooking.customerEmail || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-black/5 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">
                    Dettagli prenotazione
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">
                        Servizio
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">
                        {selectedBooking.serviceTitle}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">
                        Importo
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">
                        {formatMoney(
                          selectedBooking.priceAmount,
                          selectedBooking.priceCurrency,
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">
                        Tipo booking
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">
                        {selectedBooking.bookingType || "-"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">
                        Ordine Shopify
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">
                        {formatOrderCode(selectedBooking.bookingStr)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-black/5 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">
                    Note interne
                  </p>
                  <div className="mt-3 space-y-3">
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
                          {(Array.isArray(dbComments) ? dbComments : []).map(
                            (c) => {
                              const isManager = c.user_role !== "DIPENDENTE";
                              const dateVal = c.created_at
                                ? new Date(c.created_at)
                                : new Date();
                              const isAdmin =
                                currentUser?.role === "ZERO" ||
                                currentUser?.role === "SUPER_ADMIN" ||
                                currentUser?.role === "ADMIN";
                              const isAuthor =
                                c.user_name === currentUser?.name;
                              const canDelete =
                                canManageAppointmentNotes &&
                                (isAdmin || isAuthor);

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
                                        {c.user_name} (
                                        {isManager ? "Direzione" : "Staff"})
                                      </span>
                                      {canDelete && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDeleteComment(c.id)
                                          }
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
                                  <p className="text-black/85 whitespace-pre-line">
                                    {c.message}
                                  </p>
                                </div>
                              );
                            },
                          )}

                          {(!dbComments || dbComments.length === 0) && (
                            <p className="text-xs text-black/45 italic py-2">
                              Nessun commento condiviso. Scrivi una nota o
                              risposta qui sotto.
                            </p>
                          )}
                        </div>
                      )}

                      {canManageAppointmentNotes ? (
                        <form
                          onSubmit={handleAddComment}
                          className="flex gap-2"
                        >
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
                            disabled={
                              submittingComment || !newCommentText.trim()
                            }
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
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">
                      Dati modulo Cowlendar
                    </p>
                    <div className="mt-3 space-y-4">
                      {detailEntries.formFields.length ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {detailEntries.formFields.map((item, index) => (
                            <div
                              key={`${item.label}-${index}`}
                              className="rounded-2xl bg-[#FAFAFA] p-3"
                            >
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">
                                {item.label}
                              </p>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm font-bold text-[#171717]">
                                {item.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {detailEntries.otherFields.length ? (
                        <details className="rounded-2xl border border-black/5 bg-[#FCFCFC] p-3">
                          <summary className="cursor-pointer text-sm font-black text-[#171717]">
                            Altri dettagli tecnici
                          </summary>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {detailEntries.otherFields.map((item, index) => (
                              <div
                                key={`${item.label}-${index}`}
                                className="rounded-2xl bg-white p-3"
                              >
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">
                                  {item.label}
                                </p>
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm font-bold text-[#171717]">
                                  {item.value}
                                </p>
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
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">
                        Collaboratori
                      </p>
                      <h4 className="text-lg font-black text-[#171717]">
                        Assegnati a questo appuntamento
                      </h4>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {getBookingTeam(selectedBooking!).length ? (
                      getBookingTeam(selectedBooking!).map((mate) => (
                        <div
                          key={mate.id}
                          className="flex items-center gap-3 rounded-2xl border border-black/5 bg-[#FFFCFD] p-3"
                        >
                          <Avatar
                            name={mate.name}
                            photoUrl={mate.photoUrl}
                            size="size-12"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[#171717]">
                              {mate.name}
                            </p>
                            <p className="text-xs text-black/45">
                              {getSalonLabel(selectedBooking!.inferredSalon)}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-black/10 p-4 text-sm text-black/45">
                        Nessun collaboratore assegnato.
                      </div>
                    )}
                  </div>
                  <TeamControl booking={selectedBooking!} />
                </div>

                <div className="rounded-[24px] border border-black/5 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl bg-[#FFF3E9] text-[#B77929]">
                      <CalendarDays className="size-5" />
                    </span>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">
                        Tracciamento
                      </p>
                      <h4 className="text-lg font-black text-[#171717]">
                        Creazione e aggiornamento
                      </h4>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">
                        Creato
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">
                        {formatDateTime(selectedBooking.createdAt)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FAFAFA] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">
                        Aggiornato
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#171717]">
                        {formatDateTime(selectedBooking.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-black/5 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl bg-[#FFF1F5] text-[#C66170]">
                      <Clock3 className="size-5" />
                    </span>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/40">
                        Contatti rapidi
                      </p>
                      <h4 className="text-lg font-black text-[#171717]">
                        Informazioni utili
                      </h4>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-[#FFFCFD] p-3 text-sm text-[#171717]">
                      <Mail className="size-4 text-[#C66170]" />
                      <span className="break-all">
                        {selectedBooking.customerEmail ||
                          "Email non disponibile"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-[#FFFCFD] p-3 text-sm text-[#171717]">
                      <Phone className="size-4 text-[#C66170]" />
                      <span>
                        {selectedBooking.customerPhone ||
                          "Telefono non disponibile"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isPC && pcScreenLocked ? (
        <PcStaffLockScreen salon={salon} onUnlock={handlePcUnlock} />
      ) : null}

      <AppointmentSignModal
        isOpen={signModalOpen}
        onClose={() => {
          setSignModalOpen(false);
          setPendingAction(null);
        }}
        onSign={handleSignConfirm}
        fallbackWorkers={corsoTeamOptions}
      />

      {pcGenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-[#E8D8CF] rounded-[32px] max-w-md w-full p-8 shadow-2xl relative space-y-6">
            
            <button
              onClick={() => setPcGenModalOpen(false)}
              className="absolute right-6 top-6 p-2 rounded-full hover:bg-neutral-100 transition text-neutral-400 hover:text-neutral-800"
            >
              <X size={18} />
            </button>

            <div className="space-y-1.5 text-center">
              <h2 className="text-xl font-serif font-light tracking-wide uppercase text-neutral-900">
                Registra PC Cassa
              </h2>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                Genera un link monouso per configurare un PC di cassa o reception.
              </p>
            </div>

            {generatedLink ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold text-center">
                  Link generato con successo! Copialo e aprilo una sola volta sul PC della cassa.
                </div>
                
                <div className="space-y-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedLink}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-neutral-700 outline-none font-mono"
                  />
                  
                  <button
                    type="button"
                    onClick={async () => {
                      let success = false;
                      if (navigator.clipboard && window.isSecureContext) {
                        try {
                          await navigator.clipboard.writeText(generatedLink);
                          success = true;
                        } catch (err) {
                          console.error("Clipboard API failed, using fallback:", err);
                        }
                      }
                      if (!success) {
                        const textArea = document.createElement("textarea");
                        textArea.value = generatedLink;
                        textArea.style.top = "0";
                        textArea.style.left = "0";
                        textArea.style.position = "fixed";
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        try {
                          success = document.execCommand("copy");
                        } catch (err) {
                          console.error("Fallback copy failed:", err);
                        }
                        document.body.removeChild(textArea);
                      }
                      if (success) {
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      } else {
                        alert("Impossibile copiare automaticamente. Seleziona il testo sopra e copialo manualmente.");
                      }
                    }}
                    className="w-full py-3.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-wider transition"
                  >
                    {copiedLink ? "Copiato!" : "Copia Link"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGeneratePcLink} className="space-y-4">
                {genError && (
                  <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
                    {genError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Sede Salone
                  </label>
                  <select
                    value={genSedeId}
                    onChange={(e) => setGenSedeId(e.target.value)}
                    required
                    className="w-full h-12 rounded-xl border border-[#E8D8CF] bg-white px-3 text-sm font-bold text-[#4E382C] outline-none"
                  >
                    <option value="">Seleziona sede</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Nome Dispositivo PC
                  </label>
                  <input
                    type="text"
                    required
                    value={genPcName}
                    onChange={(e) => setGenPcName(e.target.value)}
                    placeholder="Es: Cassa Buenos Aires"
                    className="w-full h-12 rounded-xl border border-[#E8D8CF] bg-white px-3 text-sm font-bold text-[#4E382C] outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={generatingLink || !genSedeId || !genPcName.trim()}
                  className="w-full py-3.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generatingLink && <Loader2 className="size-4 animate-spin" />}
                  <span>{generatingLink ? "Generazione..." : "Genera Link Monouso"}</span>
                </button>
              </form>
            )}

            {!generatedLink && (
              <button
                type="button"
                onClick={() => setPcGenModalOpen(false)}
                className="w-full py-3 rounded-full border border-neutral-200 hover:border-neutral-400 text-neutral-500 hover:text-neutral-900 text-xs font-black uppercase tracking-wider transition"
              >
                Chiudi
              </button>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
