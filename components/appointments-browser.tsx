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
  Cloud,
  AtSign,
  ChevronDown,
  Receipt,
  User,
  ShoppingBag,
  Coins,
  Pencil,
  Ruler,
  Palette,
  FileText,
  Save,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { appointmentSalonUrl, normalizeAppointmentSalonSlug } from "@/lib/appointment-salon-url";
import { AppointmentSignModal } from "./appointment-sign-modal";
import { GlobalFullscreenLayer } from "@/components/global-fullscreen-layer";
import { CLIENT_CONTROL_FIELD_IDS } from "@/lib/client-control-form";

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

type ShopifyClientOrder = {
  id: string;
  orderName: string;
  clientName: string;
  firstName?: string;
  lastName?: string;
  totalPrice: number;
  email: string;
  phone: string;
  addressLine?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
  serviceTitle: string;
  note: string;
  createdAt: string;
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
  secondShopifyOrder?: string;
  instagramTag: string;
  customNoteText: string;
  notes: boolean;
  beforeMedia: boolean;
  afterMedia: boolean;
  products: boolean;
  review: boolean;
  bookingId?: string | null;
};

type ManualPaymentMethod = "CARTA" | "SHOPIFY" | "CONTANTI";

export function getShopifyAdminOrderUrl(orderNameOrId?: string | null, numericId?: string | number | null): string {
  const shopDomain = "c1uzax-u0";
  const numIdStr = numericId ? String(numericId).trim() : "";

  // 1. If numericId is a 10+ digit Shopify order ID (e.g. 8216417370458)
  if (numIdStr && /^\d{10,}$/.test(numIdStr)) {
    return `https://admin.shopify.com/store/${shopDomain}/orders/${numIdStr}`;
  }

  const nameStr = String(orderNameOrId || "").trim().replace(/^#/, "");
  if (!nameStr) return `https://admin.shopify.com/store/${shopDomain}/orders`;

  // 2. If nameStr itself is a 10+ digit numeric ID
  if (/^\d{10,}$/.test(nameStr)) {
    return `https://admin.shopify.com/store/${shopDomain}/orders/${nameStr}`;
  }

  // 3. Otherwise (e.g. "25311" or "#25311"), search directly by query "#25311"
  return `https://admin.shopify.com/store/${shopDomain}/orders?query=${encodeURIComponent("#" + nameStr)}`;
}

export function formatOrderDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return `Oggi ${hours}:${minutes}`;
    }

    return `${day}/${month}/${d.getFullYear()} ${hours}:${minutes}`;
  } catch {
    return "";
  }
}

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
  statusStartedAt?: string | null;
  statusStoppedAt?: string | null;
  statusElapsedSeconds?: number | null;
  sheetMatched?: boolean;
  sheetNote?: string | null;
  customerUpdate?: {
    state?: "ON_THE_WAY" | "DELAYED";
    delayMinutes?: number | null;
    message?: string | null;
    updatedAt?: string;
  } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  notesText?: string | null;
  extraDetails?: Array<{ label: string; value: string }>;
};

type AppointmentComment = {
  id: string;
  order_name: string;
  user_name: string;
  user_role: string;
  message: string;
  created_at: string;
};

type CustomerArrivalUpdate = NonNullable<AppointmentRecord["customerUpdate"]>;

function WhatsAppMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.5 11.7a8.5 8.5 0 0 1-12.55 7.48L3.5 20.5l1.3-4.32A8.5 8.5 0 1 1 20.5 11.7Z" />
      <path d="M8.4 7.9c.2-.24.43-.26.66-.1l1.35 1.04c.25.2.3.45.15.72l-.57.96c.7 1.28 1.73 2.31 3.01 3.01l.96-.57c.27-.15.52-.1.72.15l1.04 1.35c.16.23.14.46-.1.66-.5.42-1.1.65-1.72.65-3.54 0-7.67-4.13-7.67-7.67 0-.62.23-1.22.65-1.72Z" />
    </svg>
  );
}

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

const appointmentsPageSize = 25;

const appointmentStatusOptions: Array<{
  value: AppointmentStatusValue;
  label: string;
}> = [
  { value: "PRENOTATO", label: "Confermato" },
  { value: "NON_PRESENTATO", label: "Non presentato" },
  { value: "INIZIATO", label: "Iniziato" },
  { value: "IN_ATTESA", label: "In attesa" },
  { value: "COMPLETATO", label: "Completato" },
  { value: "ARRIVATO_IN_RITARDO", label: "Arrivato in ritardo" },
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
  // Payment is not an operational appointment state. Legacy PAGATO/PAID
  // entries are displayed with the common booking state "Confermato".
  if (normalized === "PAGATO" || normalized === "PAID") return "PRENOTATO";
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
    normalizeAppointmentStatus(booking.confirmationStatus) ||
    "PRENOTATO"
  );
}

function getPaymentLabel(booking: AppointmentRecord) {
  const financial = normalizeSearchValue(booking.financialStatus);
  if (financial.includes("partially paid") || financial.includes("partially_paid")) return "Acconto";
  if (financial.includes("paid") || financial.includes("pagato")) return "Pagamento registrato";
  return null;
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
  const sizeClass = compact ? "size-12 shrink-0" : "h-36 w-full";

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

function formatAppointmentTimer(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function LiveAppointmentTimer({
  startedAt,
  elapsedSeconds = 0,
}: {
  startedAt?: string | null;
  elapsedSeconds?: number;
}) {
  const calculateElapsed = () => {
    const startedAtMs = startedAt ? new Date(startedAt).getTime() : Number.NaN;
    return Number.isFinite(startedAtMs)
      ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
      : Math.max(0, Number(elapsedSeconds || 0));
  };
  const [currentElapsed, setCurrentElapsed] = useState(calculateElapsed);

  useEffect(() => {
    setCurrentElapsed(calculateElapsed());
    if (!startedAt || !Number.isFinite(new Date(startedAt).getTime())) return;

    const interval = window.setInterval(
      () => setCurrentElapsed(calculateElapsed()),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [startedAt, elapsedSeconds]);

  return <>{formatAppointmentTimer(currentElapsed)}</>;
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
    <GlobalFullscreenLayer className="max-h-dvh overflow-hidden bg-[#FFFBF6] text-neutral-900">
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
    </GlobalFullscreenLayer>
  );
}

export function AppointmentsBrowser({
  initialBookings,
  corsoTeamOptions,
  isPC = false,
  pcLocationId = "",
  initialSalon = "tutti",
  initialPcWorkerName = "",
  initialView = "day",
  initialAnchorDate,
  initialRangeFrom,
  initialRangeTo,
  initialScopeAll = false,
  locations = [],
  navigationBasePath,
  pageTitle = "Appuntamenti",
  pageSubtitle = "Clienti, arrivi e servizi in un’unica vista operativa",
}: {
  initialBookings: AppointmentRecord[];
  corsoTeamOptions: TeamOption[];
  isPC?: boolean;
  pcLocationId?: string;
  initialSalon?: SalonFilter;
  initialPcWorkerName?: string;
  initialView?: ViewMode;
  initialAnchorDate?: string;
  initialRangeFrom?: string;
  initialRangeTo?: string;
  initialScopeAll?: boolean;
  locations?: Array<{ id: string; name: string }>;
  navigationBasePath?: string;
  pageTitle?: string;
  pageSubtitle?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveCustomerUpdates, setLiveCustomerUpdates] = useState<
    Record<string, CustomerArrivalUpdate>
  >(() =>
    Object.fromEntries(
      initialBookings
        .filter((booking) => booking.customerUpdate)
        .map((booking) => [booking.id, booking.customerUpdate as CustomerArrivalUpdate]),
    ),
  );

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let requestInProgress = false;

    const synchronizeCustomerUpdates = async () => {
      if (document.visibilityState === "hidden") {
        timer = setTimeout(synchronizeCustomerUpdates, 1500);
        return;
      }

      if (requestInProgress) return;
      requestInProgress = true;

      try {
        const response = await fetch("/api/appointments/customer-updates", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (response.ok) {
          const payload = (await response.json()) as {
            updates?: Record<string, CustomerArrivalUpdate>;
          };
          if (!stopped && payload.updates) setLiveCustomerUpdates(payload.updates);
        }
      } catch {
        // A temporary network error must not interrupt appointment management.
      } finally {
        requestInProgress = false;
        if (!stopped) timer = setTimeout(synchronizeCustomerUpdates, 1000);
      }
    };

    const synchronizeWhenVisible = () => {
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        void synchronizeCustomerUpdates();
      }
    };

    void synchronizeCustomerUpdates();
    document.addEventListener("visibilitychange", synchronizeWhenVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", synchronizeWhenVisible);
    };
  }, []);

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
      const params = new URLSearchParams(searchParams.toString());
      params.delete("refresh");
      const base = navigationBasePath || appointmentSalonUrl(initialSalon === "tutti" ? null : initialSalon);
      router.replace(params.size ? `${base}?${params.toString()}` : base, { scroll: false });
    }
    setIsRefreshing(false);
  }, [searchParams, router]);

  useEffect(() => {
    const salonFromUrl = normalizeAppointmentSalonSlug(searchParams.get("salone") || searchParams.get("salon"));
    setSalon((salonFromUrl || initialSalon) as SalonFilter);
  }, [initialSalon, searchParams]);

  function updateSalonFilter(nextSalon: SalonFilter) {
    setSalon(nextSalon);
    navigateToAppointmentRange(view, anchorDate, {
      salonOverride: nextSalon,
      from: dateFilter.from,
      to: dateFilter.to,
      scopeAll: dateFilter.mode === "all",
      replace: true,
    });
  }

  const [view, setView] = useState<ViewMode>(initialView);
  const [salon, setSalon] = useState<SalonFilter>(initialSalon);
  const [anchorDate, setAnchorDate] = useState(
    () => dateFromLocalKey(initialAnchorDate) || new Date(),
  );
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
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState(() => {
    const today = localDateKey(new Date());
    if (initialScopeAll) {
      return {
        mode: "all" as AppointmentDateFilterMode,
        from: initialRangeFrom || today,
        to: initialRangeTo || today,
      };
    }
    if (initialView !== "day" && initialRangeFrom && initialRangeTo) {
      return {
        mode: "custom" as AppointmentDateFilterMode,
        from: initialRangeFrom,
        to: initialRangeTo,
      };
    }
    return {
      mode: "today" as AppointmentDateFilterMode,
      from: today,
      to: today,
    };
  });

  function rangeForView(nextView: ViewMode, date: Date) {
    const start = new Date(date);
    const end = new Date(date);
    if (nextView === "week") {
      const weekStart = startOfWeek(date);
      start.setTime(weekStart.getTime());
      end.setTime(weekStart.getTime());
      end.setDate(end.getDate() + 6);
    } else if (nextView === "month") {
      start.setFullYear(date.getFullYear(), date.getMonth(), 1);
      end.setFullYear(date.getFullYear(), date.getMonth() + 1, 0);
    }
    return { from: localDateKey(start), to: localDateKey(end) };
  }

  function navigateToAppointmentRange(
    nextView: ViewMode,
    nextAnchor: Date,
    options?: {
      salonOverride?: SalonFilter;
      from?: string;
      to?: string;
      scopeAll?: boolean;
      forceRefresh?: boolean;
      replace?: boolean;
    },
  ) {
    const targetSalon = options?.salonOverride ?? salon;
    const range = options?.from && options?.to
      ? { from: options.from, to: options.to }
      : rangeForView(nextView, nextAnchor);
    const params = new URLSearchParams();
    params.set("view", nextView);
    params.set("focus", localDateKey(nextAnchor));
    if (options?.scopeAll) {
      params.set("scope", "all");
    } else {
      params.set("from", range.from);
      params.set("to", range.to);
    }
    const worker = searchParams.get("worker");
    if (worker) params.set("worker", worker);
    if (options?.forceRefresh) params.set("refresh", "true");

    setIsRefreshing(true);
    if (navigationBasePath && targetSalon !== "tutti") {
      params.set("salone", targetSalon);
    }
    const base = navigationBasePath || appointmentSalonUrl(targetSalon === "tutti" ? null : targetSalon);
    const target = `${base}?${params.toString()}`;
    if (options?.replace) router.replace(target, { scroll: false });
    else router.push(target, { scroll: false });
  }
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
  const [statusTimingByBooking, setStatusTimingByBooking] = useState<
    Record<string, {
      startedAt?: string | null;
      stoppedAt?: string | null;
      elapsedSeconds?: number;
    }>
  >(() =>
    Object.fromEntries(
      initialBookings.map((booking) => [
        booking.id,
        {
          startedAt: booking.statusStartedAt ?? null,
          stoppedAt: booking.statusStoppedAt ?? null,
          elapsedSeconds: Number(booking.statusElapsedSeconds || 0),
        },
      ]),
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

  function matchEmployeeIdForTeammate(
    teammate: Pick<BookingTeammate, "id" | "name">,
    employees: ClientControlEmployee[],
  ) {
    const normalizedName = normalizeSearchValue(teammate.name);
    if (!normalizedName) return null;
    const exact = employees.find(
      (employee) => normalizeSearchValue(employee.name) === normalizedName,
    );
    if (exact) return exact.id;

    const nameParts = normalizedName.split(" ").filter(Boolean);
    const compatible = employees.filter((employee) => {
      const employeeName = normalizeSearchValue(employee.name);
      return nameParts.every((part) => employeeName.split(" ").includes(part));
    });
    return compatible.length === 1 ? compatible[0].id : null;
  }

  function matchEmployeeIdsForStoredStaff(
    storedStaff: unknown,
    employees: ClientControlEmployee[],
  ) {
    const names = (Array.isArray(storedStaff) ? storedStaff : [storedStaff])
      .flatMap((value) =>
        typeof value === "string" ? value.split(/[,;\n]+/) : [],
      )
      .map((name) => normalizeSearchValue(name))
      .filter(Boolean);

    return employees
      .filter((employee) =>
        names.includes(normalizeSearchValue(employee.name)),
      )
      .map((employee) => employee.id);
  }

  const [clientControlOpen, setClientControlOpen] = useState(false);
  const [clientControlEmployees, setClientControlEmployees] = useState<
    ClientControlEmployee[]
  >([]);
  const [clientControlLoading, setClientControlLoading] = useState(false);
  const [clientControlSubmitting, setClientControlSubmitting] = useState(false);
  const [clientControlExistingId, setClientControlExistingId] = useState<string | null>(null);
  const [clientControlPolishing, setClientControlPolishing] = useState(false);
  const [clientControlMessage, setClientControlMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [clientControlAppointmentComments, setClientControlAppointmentComments] =
    useState<AppointmentComment[]>([]);
  const [selectedGrammi, setSelectedGrammi] = useState("");
  const [customGrammiInput, setCustomGrammiInput] = useState("");
  const [selectedLunghezza, setSelectedLunghezza] = useState("");
  const [selectedFasce, setSelectedFasce] = useState("");
  const [customFasceInput, setCustomFasceInput] = useState("");
  const [selectedAtteggiamento, setSelectedAtteggiamento] = useState("");
  const [extraNoteText, setExtraNoteText] = useState("");
  const [isDepositUnlockedManually, setIsDepositUnlockedManually] = useState(false);
  const [isSecondUnlockedManually, setIsSecondUnlockedManually] = useState(false);

  function updateShopifyNote(overrides?: {
    grammi?: string;
    lunghezza?: string;
    fasce?: string;
    atteggiamento?: string;
    extraNote?: string;
  }) {
    const rawG = overrides?.grammi !== undefined ? overrides.grammi : selectedGrammi;
    const g = rawG === "custom" ? customGrammiInput : rawG;

    const l = overrides?.lunghezza !== undefined ? overrides.lunghezza : selectedLunghezza;

    const rawF = overrides?.fasce !== undefined ? overrides.fasce : selectedFasce;
    const f = rawF === "custom" ? customFasceInput : rawF;

    const a = overrides?.atteggiamento !== undefined ? overrides.atteggiamento : selectedAtteggiamento;
    const n = overrides?.extraNote !== undefined ? overrides.extraNote : extraNoteText;

    const parts: string[] = [];
    if (g) parts.push(`Grammi: ${g}`);
    if (l) parts.push(`Lunghezza: ${l}`);
    if (f) parts.push(`Fasce: ${f}`);
    if (a) parts.push(`Cliente: ${a}`);

    let formatted = parts.join(" • ");
    if (n.trim()) {
      formatted = formatted ? `${formatted}\nNote: ${n.trim()}` : n.trim();
    }

    setClientControlForm((prev) => ({
      ...prev,
      customNoteText: formatted,
      notes: Boolean(formatted.trim()),
    }));
  }
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
      secondShopifyOrder: "",
      instagramTag: "",
      customNoteText: "",
      notes: false,
      beforeMedia: false,
      afterMedia: false,
      products: false,
      review: false,
      bookingId: null,
    });

  const [selectedOrderDetails, setSelectedOrderDetails] = useState<{
    id?: string;
    orderName: string;
    clientName: string;
    totalPrice: number;
    email: string;
    phone: string;
    serviceTitle: string;
    note: string;
    createdAt?: string;
    financialStatus?: string | null;
    paymentGateways?: string[];
    paymentMethod?: "CARTA" | "CASHMATIC" | "CONTANTI" | "MISTO" | "DA_VERIFICARE";
    paymentReference?: string | null;
    transactionStatus?: string | null;
    transactionProcessedAt?: string | null;
  } | null>(null);

  const [secondOrderDetails, setSecondOrderDetails] = useState<{
    id?: string;
    orderName: string;
    clientName: string;
    totalPrice: number;
    email: string;
    phone: string;
    serviceTitle: string;
    note: string;
    createdAt?: string;
    financialStatus?: string | null;
    paymentGateways?: string[];
    paymentMethod?: "CARTA" | "CASHMATIC" | "CONTANTI" | "MISTO" | "DA_VERIFICARE";
    paymentReference?: string | null;
    transactionStatus?: string | null;
    transactionProcessedAt?: string | null;
  } | null>(null);

  const [toastNotification, setToastNotification] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: "success" | "error";
  }>({
    show: false,
    title: "",
    message: "",
    type: "success",
  });

  function showPushToast(title: string, message: string, type: "success" | "error" = "success") {
    setToastNotification({
      show: true,
      title,
      message,
      type,
    });

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: message,
        });
      } catch (e) {
        // ignore push errors
      }
    }

    setTimeout(() => {
      setToastNotification((prev) => ({ ...prev, show: false }));
    }, 4000);
  }

  const [shopifyLookupLoading, setShopifyLookupLoading] = useState(false);
  const [secondShopifyLookupLoading, setSecondShopifyLookupLoading] = useState(false);
  const [manualPaymentMethod, setManualPaymentMethod] = useState<ManualPaymentMethod | null>(null);
  const [paymentMethodPrompt, setPaymentMethodPrompt] = useState<{
    open: boolean;
    gateways: string[];
    resumeSubmit: boolean;
  }>({ open: false, gateways: [], resumeSubmit: false });
  const paymentMethodNeedsChoice = Boolean(
    clientControlOpen &&
    secondOrderDetails &&
    String(secondOrderDetails.financialStatus || "").toLowerCase() === "paid" &&
    !["CARTA", "CASHMATIC", "CONTANTI", "MISTO"].includes(String(secondOrderDetails.paymentMethod || "")) &&
    !manualPaymentMethod,
  );

  async function handleShopifyOrderLookup(queryOverride?: string) {
    const query = (queryOverride ?? clientControlForm.shopifyOrder ?? clientControlForm.clientName ?? "").trim();
    if (!query) return;

    setShopifyLookupLoading(true);
    try {
      const res = await fetch(`/api/shopify-order-lookup?query=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => null);

      if (res.ok && data) {
        setSelectedOrderDetails({
          id: data.id ? String(data.id) : undefined,
          orderName: data.orderName || query,
          clientName: data.clientName || clientControlForm.clientName,
          totalPrice: data.totalPrice || 0,
          email: data.email || "",
          phone: data.phone || "",
          serviceTitle: Array.isArray(data.lineItems) ? data.lineItems.map((i: any) => i.title).join(", ") : "",
          note: data.note || "",
        });
        setClientControlForm((prev) => {
          const newOrder = data.orderName ? data.orderName.replace(/^#/, "") : prev.shopifyOrder;
          const newDeposit = data.totalPrice != null ? String(data.totalPrice) : prev.depositPaid;
          const newEmail = data.email || prev.email;
          const newPhone = data.phone || prev.phone;
          const newClientName = data.clientName || prev.clientName;

          return {
            ...prev,
            shopifyOrder: newOrder,
            depositPaid: newDeposit,
            email: newEmail,
            phone: newPhone,
            clientName: newClientName,
          };
        });
      }
    } catch (err) {
      console.error("Failed to lookup Shopify order:", err);
    } finally {
      setShopifyLookupLoading(false);
    }
  }

  async function handleSecondShopifyOrderLookup(queryOverride?: string) {
    const query = (queryOverride ?? clientControlForm.secondShopifyOrder ?? "").trim();
    if (!query) return;

    setManualPaymentMethod(null);
    setSecondShopifyLookupLoading(true);
    try {
      const res = await fetch(`/api/shopify-order-lookup?query=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => null);

      if (res.ok && data) {
        setSecondOrderDetails({
          id: data.id ? String(data.id) : undefined,
          orderName: data.orderName || query,
          clientName: data.clientName || clientControlForm.clientName,
          totalPrice: data.totalPrice || 0,
          email: data.email || "",
          phone: data.phone || "",
          serviceTitle: Array.isArray(data.lineItems) ? data.lineItems.map((i: any) => i.title).join(", ") : "",
          note: data.note || "",
          createdAt: data.createdAt || data.created_at || "",
          financialStatus: data.financialStatus || null,
          paymentGateways: Array.isArray(data.paymentGateways) ? data.paymentGateways : [],
          paymentMethod: data.paymentMethod || "DA_VERIFICARE",
          paymentReference: data.paymentReference || null,
          transactionStatus: data.transactionStatus || null,
          transactionProcessedAt: data.transactionProcessedAt || null,
        });
        setClientControlForm((prev) => ({
          ...prev,
          secondShopifyOrder: data.orderName ? data.orderName.replace(/^#/, "") : prev.secondShopifyOrder,
          paid: data.totalPrice != null ? String(data.totalPrice) : prev.paid,
        }));
      }
    } catch (err) {
      console.error("Failed to lookup second Shopify order:", err);
    } finally {
      setSecondShopifyLookupLoading(false);
    }
  }

  const [showTodayOrdersDropdown, setShowTodayOrdersDropdown] = useState(false);
  const [todayOrdersList, setTodayOrdersList] = useState<ShopifyClientOrder[]>([]);
  const [loadingTodayOrders, setLoadingTodayOrders] = useState(false);

  async function fetchTodayShopifyOrders(identity?: { clientName?: string; email?: string; phone?: string }) {
    setLoadingTodayOrders(true);
    try {
      const params = new URLSearchParams({
        mode: "client_orders",
        clientName: identity?.clientName ?? clientControlForm.clientName ?? "",
        email: identity?.email ?? clientControlForm.email ?? "",
        phone: identity?.phone ?? clientControlForm.phone ?? "",
      });
      const res = await fetch(`/api/shopify-order-lookup?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.orders)) {
        setTodayOrdersList(data.orders);
      }
    } catch (err) {
      console.error("Failed to fetch client's Shopify orders:", err);
    } finally {
      setLoadingTodayOrders(false);
    }
  }

  function selectShopifyOrderFromList(
    order: ShopifyClientOrder,
    forceTarget?: "first" | "second"
  ) {
    const cleanName = order.orderName ? order.orderName.replace(/^#/, "") : "";
    const isSecond = forceTarget
      ? forceTarget === "second"
      : Boolean(clientControlForm.shopifyOrder && clientControlForm.shopifyOrder.trim() !== "");

    if (isSecond) {
      setSecondOrderDetails(order);
      setClientControlForm((prev) => {
        const orderPriceStr = order.totalPrice != null ? String(order.totalPrice) : "";
        return {
          ...prev,
          secondShopifyOrder: cleanName,
          paid: orderPriceStr || prev.paid,
          email: order.email || prev.email,
          phone: order.phone || prev.phone,
          clientName: order.clientName || prev.clientName,
        };
      });
      void handleSecondShopifyOrderLookup(cleanName);
    } else {
      setSelectedOrderDetails(order);
      setClientControlForm((prev) => {
        const orderPriceStr = order.totalPrice != null ? String(order.totalPrice) : "";
        return {
          ...prev,
          shopifyOrder: cleanName,
          depositPaid: orderPriceStr || prev.depositPaid,
          email: order.email || prev.email,
          phone: order.phone || prev.phone,
          clientName: order.clientName || prev.clientName,
        };
      });
    }
    setShowTodayOrdersDropdown(false);
  }

  const sortedTodayOrdersList = useMemo(() => {
    if (!todayOrdersList.length) return [];
    if (!clientControlForm.clientName && !clientControlForm.email && !clientControlForm.phone) return todayOrdersList;

    const phoneDigits = (clientControlForm.phone || "").replace(/\D/g, "");
    const emailClean = (clientControlForm.email || "").trim().toLowerCase();
    const nameNorm = (clientControlForm.clientName || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    const nameParts = nameNorm.split(/\s+/).filter((p) => p.length > 1);

    return [...todayOrdersList].sort((a, b) => {
      const aPhone = (a.phone || "").replace(/\D/g, "");
      const bPhone = (b.phone || "").replace(/\D/g, "");

      const aEmail = (a.email || "").trim().toLowerCase();
      const bEmail = (b.email || "").trim().toLowerCase();

      const aName = (a.clientName || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
      const bName = (b.clientName || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

      // Phone match
      const phoneMatchA = phoneDigits && aPhone && (phoneDigits === aPhone || phoneDigits.endsWith(aPhone) || aPhone.endsWith(phoneDigits));
      const phoneMatchB = phoneDigits && bPhone && (phoneDigits === bPhone || phoneDigits.endsWith(bPhone) || bPhone.endsWith(phoneDigits));

      // Email match
      const emailMatchA = emailClean && aEmail && emailClean === aEmail;
      const emailMatchB = emailClean && bEmail && emailClean === bEmail;

      // Full Name match (both first and last)
      const nameMatchA = nameNorm && aName && (nameNorm === aName || (nameParts.length >= 2 && aName.includes(nameParts[0]) && aName.includes(nameParts[nameParts.length - 1])));
      const nameMatchB = nameNorm && bName && (nameNorm === bName || (nameParts.length >= 2 && bName.includes(nameParts[0]) && bName.includes(nameParts[nameParts.length - 1])));

      const isMatchA = Boolean(phoneMatchA || emailMatchA || nameMatchA);
      const isMatchB = Boolean(phoneMatchB || emailMatchB || nameMatchB);

      if (isMatchA && !isMatchB) return -1;
      if (!isMatchA && isMatchB) return 1;
      return 0;
    });
  }, [todayOrdersList, clientControlForm.clientName, clientControlForm.email, clientControlForm.phone]);

  const clientMatchingOrders = useMemo(() => {
    if (!todayOrdersList.length) return [];

    const phoneDigits = (clientControlForm.phone || "").replace(/\D/g, "");
    const emailClean = (clientControlForm.email || "").trim().toLowerCase();
    const nameNorm = (clientControlForm.clientName || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    const nameParts = nameNorm.split(/\s+/).filter((p) => p.length > 1);

    return todayOrdersList.filter((order) => {
      const oPhone = (order.phone || "").replace(/\D/g, "");
      const oEmail = (order.email || "").trim().toLowerCase();
      const oName = (order.clientName || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

      // 1. Match Phone
      if (phoneDigits && oPhone && (phoneDigits === oPhone || phoneDigits.endsWith(oPhone) || oPhone.endsWith(phoneDigits))) {
        return true;
      }
      // 2. Match Email
      if (emailClean && oEmail && emailClean === oEmail) {
        return true;
      }
      // 3. Match Full Name
      if (nameNorm && oName) {
        if (nameNorm === oName) return true;
        if (nameParts.length >= 2 && oName.includes(nameParts[0]) && oName.includes(nameParts[nameParts.length - 1])) {
          return true;
        }
      }
      return false;
    });
  }, [clientControlForm.clientName, clientControlForm.email, clientControlForm.phone, todayOrdersList]);

  const clientOrderProfile = useMemo(() => {
    const order = clientMatchingOrders[0] || sortedTodayOrdersList[0];
    if (!order) return null;
    const fullName = [order.firstName, order.lastName].filter(Boolean).join(" ") || order.clientName;
    const locality = [order.postalCode, order.city, order.province].filter(Boolean).join(" ");
    const address = [order.addressLine, locality, order.country].filter(Boolean).join(" · ");
    return { fullName, email: order.email, phone: order.phone, address };
  }, [clientMatchingOrders, sortedTodayOrdersList]);

  // Suggested 1° Ordine (Acconto)
  const suggestedAccontoOrder = useMemo(() => {
    if (!clientMatchingOrders.length) return null;
    const isAccontoKey = (title?: string) => /acconto|booking|prenotazione|cowlendar|deposit/i.test(title || "");
    const explicit = clientMatchingOrders.find((o) => isAccontoKey(o.serviceTitle));
    if (explicit) return explicit;
    if (clientMatchingOrders.length > 1) {
      return clientMatchingOrders[clientMatchingOrders.length - 1]; // oldest order
    }
    return clientMatchingOrders[0];
  }, [clientMatchingOrders]);

  // Suggested 2° Ordine (Saldo Finale)
  const suggestedSaldoOrder = useMemo(() => {
    if (!clientMatchingOrders.length) return null;
    const isSaldoKey = (title?: string) => /saldo|salone|riapplicazione|pos|commissioni/i.test(title || "");
    const explicit = clientMatchingOrders.find((o) => isSaldoKey(o.serviceTitle));
    if (explicit) return explicit;
    if (clientMatchingOrders.length > 1 && suggestedAccontoOrder) {
      const nonAcconto = clientMatchingOrders.find((o) => o.id !== suggestedAccontoOrder.id && o.orderName !== suggestedAccontoOrder.orderName);
      if (nonAcconto) return nonAcconto;
    }
    return clientMatchingOrders[0];
  }, [clientMatchingOrders, suggestedAccontoOrder]);

  const clientControlEmployeeOptions = useMemo(() => {
    const rawList: ClientControlEmployee[] = [...clientControlEmployees];
    corsoTeamOptions.forEach((employee) => {
      rawList.push({
        id: employee.id,
        name: employee.name,
        locationName: "Salone Buenos Aires",
      });
    });

    const result: ClientControlEmployee[] = [];
    const norm = (val: string) =>
      String(val || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    for (const emp of rawList) {
      const empNorm = norm(emp.name);
      if (!empNorm) continue;
      const empFirstWord = empNorm.split(" ")[0];

      const existingIndex = result.findIndex((item) => {
        const itemNorm = norm(item.name);
        if (itemNorm === empNorm) return true;
        const itemFirstWord = itemNorm.split(" ")[0];
        if (
          itemFirstWord === empFirstWord &&
          (itemNorm.split(" ").length === 1 || empNorm.split(" ").length === 1)
        ) {
          return true;
        }
        return false;
      });

      if (existingIndex >= 0) {
        const existing = result[existingIndex];
        const existingNorm = norm(existing.name);
        if (empNorm.length > existingNorm.length) {
          result[existingIndex] = emp;
        }
      } else {
        result.push(emp);
      }
    }

    return result.sort((a, b) => a.name.localeCompare(b.name, "it"));
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

  async function openClientControlForBooking(
    booking: AppointmentRecord,
    preferredTeammate?: Pick<BookingTeammate, "id" | "name">,
  ) {
    setClientControlMessage(null);
    setClientControlExistingId(null);
    setClientControlAppointmentComments([]);
    setManualPaymentMethod(null);
    setPaymentMethodPrompt({ open: false, gateways: [], resumeSubmit: false });
    setSelectedGrammi("");
    setCustomGrammiInput("");
    setSelectedLunghezza("");
    setSelectedFasce("");
    setCustomFasceInput("");
    setSelectedAtteggiamento("");
    setExtraNoteText("");
    setIsDepositUnlockedManually(false);
    setIsSecondUnlockedManually(false);
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
          booking.bookingStr && booking.priceAmount != null
            ? String(booking.priceAmount)
            : "",
        paid: "",
        staffIds: preferredTeammate
          ? [matchEmployeeIdForTeammate(preferredTeammate, clientControlEmployees)].filter(
              (id): id is string => Boolean(id),
            )
          : matchEmployeeIdsForBooking(booking, clientControlEmployees),
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

      // Pass the booking identity explicitly: React has not applied baseForm yet.
      void fetchTodayShopifyOrders({
        clientName: baseForm.clientName,
        email: baseForm.email,
        phone: baseForm.phone,
      });
      if (booking.bookingStr || booking.customerName) {
        void handleShopifyOrderLookup(booking.bookingStr || booking.customerName);
      }
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
        `/api/appointments/comments?bookingId=${encodeURIComponent(booking.id)}${booking.bookingStr ? `&orderName=${encodeURIComponent(booking.bookingStr)}` : ""}${booking.customerName ? `&clientName=${encodeURIComponent(booking.customerName)}` : ""}`,
      )
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    ]);

    const existingAnswers = bookingNotes?.existingControl?.answers as Record<string, any> | undefined;
    setClientControlExistingId(
      bookingNotes?.existingControl?.id ? String(bookingNotes.existingControl.id) : null,
    );
    setClientControlAppointmentComments(
      Array.isArray(bookingNotes?.comments) ? bookingNotes.comments : [],
    );
    const preferredEmployeeId = preferredTeammate
      ? matchEmployeeIdForTeammate(preferredTeammate, employees)
      : null;
    const storedStaffIds = existingAnswers
      ? matchEmployeeIdsForStoredStaff(
          existingAnswers[CLIENT_CONTROL_FIELD_IDS.serviceStaff],
          employees,
        )
      : [];

    setClientControlForm((current) => {
      if (current.bookingId !== booking.id) return current;
      if (existingAnswers) {
        return {
          ...current,
          staffIds: preferredEmployeeId
            ? [preferredEmployeeId]
            : storedStaffIds.length
            ? storedStaffIds
            : current.staffIds.length
            ? current.staffIds
            : matchEmployeeIdsForBooking(booking, employees),
          secondShopifyOrder: String(existingAnswers.second_shopify_order || existingAnswers.secondShopifyOrder || ""),
          paid: existingAnswers[CLIENT_CONTROL_FIELD_IDS.paid] !== undefined && existingAnswers[CLIENT_CONTROL_FIELD_IDS.paid] !== null
            ? String(existingAnswers[CLIENT_CONTROL_FIELD_IDS.paid])
            : current.paid,
          depositPaid: existingAnswers[CLIENT_CONTROL_FIELD_IDS.depositPaid] !== undefined && existingAnswers[CLIENT_CONTROL_FIELD_IDS.depositPaid] !== null
            ? String(existingAnswers[CLIENT_CONTROL_FIELD_IDS.depositPaid])
            : current.depositPaid,
          shopifyOrder: String(existingAnswers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder] || current.shopifyOrder || ""),
          instagramTag: String(existingAnswers[CLIENT_CONTROL_FIELD_IDS.instagramTag] || ""),
          customNoteText: String(existingAnswers.client_control_notes_text || current.customNoteText || bookingNotes?.shopifyNote || ""),
          notes: Boolean(existingAnswers[CLIENT_CONTROL_FIELD_IDS.notes]),
          beforeMedia: Boolean(existingAnswers[CLIENT_CONTROL_FIELD_IDS.beforeMedia]),
          afterMedia: Boolean(existingAnswers[CLIENT_CONTROL_FIELD_IDS.afterMedia]),
          products: Boolean(existingAnswers[CLIENT_CONTROL_FIELD_IDS.products]),
          review: Boolean(existingAnswers[CLIENT_CONTROL_FIELD_IDS.review]),
        };
      }
      return {
        ...current,
        staffIds: preferredEmployeeId
          ? [preferredEmployeeId]
          : current.staffIds.length
          ? current.staffIds
          : matchEmployeeIdsForBooking(booking, employees),
        customNoteText:
          current.customNoteText || bookingNotes?.shopifyNote || "",
      };
    });

    if (preferredTeammate && !preferredEmployeeId) {
      setClientControlMessage({
        type: "error",
        text: `${preferredTeammate.name} non è collegata a un profilo interno. Puoi selezionarla manualmente nel Controllo Cliente.`,
      });
    }

    if (existingAnswers) {
      const secOrder = String(existingAnswers.second_shopify_order || existingAnswers.secondShopifyOrder || "").trim();
      if (secOrder) {
        void handleSecondShopifyOrderLookup(secOrder);
      }
      if (existingAnswers.custom_grammi) {
        const g = String(existingAnswers.custom_grammi);
        if (["100g", "150g", "200g"].includes(g)) {
          setSelectedGrammi(g);
        } else {
          setSelectedGrammi("custom");
          setCustomGrammiInput(g);
        }
      }
      if (existingAnswers.custom_lunghezza) {
        setSelectedLunghezza(String(existingAnswers.custom_lunghezza));
      }
      if (existingAnswers.custom_fasce) {
        const f = String(existingAnswers.custom_fasce);
        if (["1", "2", "3", "4", "5"].includes(f)) {
          setSelectedFasce(f);
        } else {
          setSelectedFasce("custom");
          setCustomFasceInput(f);
        }
      }
      if (existingAnswers.custom_atteggiamento) {
        setSelectedAtteggiamento(String(existingAnswers.custom_atteggiamento));
      }
      if (existingAnswers.custom_extra_note) {
        setExtraNoteText(String(existingAnswers.custom_extra_note));
      }
    }
  }

  useEffect(() => {
    if (!clientControlOpen) return;
    if (clientControlForm.secondShopifyOrder) {
      const cleanSec = clientControlForm.secondShopifyOrder.trim().replace(/^#/, "");
      const currentLoaded = secondOrderDetails?.orderName ? secondOrderDetails.orderName.replace(/^#/, "") : "";
      if (cleanSec && cleanSec !== currentLoaded) {
        const timer = window.setTimeout(() => void handleSecondShopifyOrderLookup(cleanSec), 450);
        return () => window.clearTimeout(timer);
      }
    }
  }, [clientControlOpen, clientControlForm.secondShopifyOrder, secondOrderDetails]);

  async function submitClientControlForm(manualPaymentMethodOverride?: ManualPaymentMethod) {
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
      const customGrammiVal = selectedGrammi === "custom" ? customGrammiInput : selectedGrammi;
      const customFasceVal = selectedFasce === "custom" ? customFasceInput : selectedFasce;

      const payload = {
        ...clientControlForm,
        manualPaymentMethod: manualPaymentMethodOverride ?? manualPaymentMethod ?? undefined,
        secondShopifyOrder: clientControlForm.secondShopifyOrder || "",
        customGrammi: customGrammiVal || "",
        customLunghezza: selectedLunghezza || "",
        customFasce: customFasceVal || "",
        customAtteggiamento: selectedAtteggiamento || "",
        customExtraNote: extraNoteText || "",
      };

      const response = await fetch("/api/client-control/tablet-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok && data?.code === "PAYMENT_METHOD_REQUIRED") {
        setPaymentMethodPrompt({
          open: true,
          gateways: Array.isArray(data?.paymentGateways) ? data.paymentGateways : [],
          resumeSubmit: true,
        });
        return;
      }
      if (!response.ok)
        throw new Error(data?.error || "Errore durante il salvataggio.");

      const savedOperation = data?.operation === "updated" ? "updated" : "created";
      if (data?.id) setClientControlExistingId(String(data.id));

      const clientName = clientControlForm.clientName || "Cliente";
      const targetBookingId = clientControlForm.bookingId || selectedBooking?.id;
      const targetBooking = targetBookingId
        ? initialBookings.find((booking) => booking.id === targetBookingId)
        : null;
      const selectedStaff = clientControlEmployeeOptions
        .filter((employee) => clientControlForm.staffIds.includes(employee.id))
        .map((employee) => ({
          id: employee.id,
          name: employee.name,
          photoUrl:
            corsoTeamOptions.find((option) => option.id === employee.id)
              ?.photoUrl || null,
        }));

      let teamSyncWarning = "";
      if (
        targetBookingId &&
        selectedStaff.length > 0 &&
        normalizeSalonName(clientControlForm.salon).includes("buenos aires")
      ) {
        const teamResponse = await fetch("/api/appointments/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: targetBookingId,
            orderName:
              targetBooking?.bookingStr || clientControlForm.shopifyOrder,
            teammateIds: selectedStaff.map((employee) => employee.id),
            teammates: selectedStaff,
          }),
        });

        if (teamResponse.ok) {
          setTeamByBooking((current) => ({
            ...current,
            [targetBookingId]: selectedStaff,
          }));
        } else {
          const teamError = await teamResponse.json().catch(() => null);
          teamSyncWarning =
            teamError?.error ||
            "La scheda è salvata, ma la collaboratrice non è stata aggiornata nella lista appuntamenti.";
        }
      }

      if (targetBookingId) {
        setStatusByBooking((prev) => ({
          ...prev,
          [targetBookingId]: "COMPLETATO",
        }));
      }

      showPushToast(
        teamSyncWarning ? "Scheda salvata con avviso" : "✓ Salvato con successo!",
        teamSyncWarning ||
          `Scheda controllo per ${clientName} registrata. Collaboratrice e stato aggiornati.`,
        teamSyncWarning ? "error" : undefined,
      );
      setClientControlMessage({
        type: teamSyncWarning ? "error" : "success",
        text:
          teamSyncWarning ||
          (savedOperation === "updated"
            ? "✓ Appuntamento modificato e salvato. Puoi continuare a fare altre modifiche."
            : "✓ Appuntamento salvato. Puoi continuare a modificarlo."),
      });
      setPaymentMethodPrompt({ open: false, gateways: [], resumeSubmit: false });

      if (targetBookingId) {
        const historyResponse = await fetch(
          `/api/appointments/comments?bookingId=${encodeURIComponent(targetBookingId)}${targetBooking?.bookingStr ? `&orderName=${encodeURIComponent(targetBooking.bookingStr)}` : ""}${clientControlForm.clientName ? `&clientName=${encodeURIComponent(clientControlForm.clientName)}` : ""}`,
          { cache: "no-store" },
        ).catch(() => null);
        if (historyResponse?.ok) {
          const historyData = await historyResponse.json().catch(() => null);
          setClientControlAppointmentComments(
            Array.isArray(historyData?.comments) ? historyData.comments : [],
          );
        }
      }

      router.refresh();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Errore durante il salvataggio.";
      showPushToast("❌ Errore di salvataggio", errMsg, "error");
      setClientControlMessage({
        type: "error",
        text: errMsg,
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
      salon === "tutti" || normalizedSearch
        ? statusScoped
        : statusScoped.filter((booking) => {
            if (booking.inferredSalon === salon) return true;
            // Also include if assigned teammate belongs to current salon
            const team = getBookingTeam(booking);
            return team.some((mate) => {
              const matched = corsoTeamOptions.some(
                (opt) => opt.name.toLowerCase() === mate.name.toLowerCase()
              );
              return salon === "buenos-aires" ? matched : false;
            });
          });
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
    const bookingFromUrl = searchParams.get("booking");
    const orderFromUrl = searchParams.get("order");
    const booking = bookingFromUrl
      ? initialBookings.find((item) => item.id === bookingFromUrl)
      : null;
    if (booking) {
      void openClientControlForBooking(booking);
    } else if (orderFromUrl) {
      setSearchTerm(orderFromUrl);
    }
  }, [initialBookings, searchParams]);

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
        showPushToast("Nota salvata", "La nota interna è stata aggiunta all’appuntamento.");
      } else {
        showPushToast("Nota non salvata", "Errore durante l'aggiunta del commento.", "error");
      }
    } catch (err) {
      console.error("Failed to post comment", err);
      showPushToast("Nota non salvata", "Impossibile salvare il commento.", "error");
    } finally {
      setSubmittingComment(false);
    }
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBooking || !newCommentText.trim() || submittingComment) return;

    const orderName = selectedBooking.bookingStr ?? null;
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
        showPushToast("Modifica salvata", "La nota è stata eliminata.");
      } else {
        const data = await res.json();
        showPushToast("Modifica non salvata", data.error || "Impossibile eliminare il commento.", "error");
      }
    } catch (err) {
      console.error("Failed to delete comment", err);
      showPushToast("Modifica non salvata", "Errore durante l'eliminazione.", "error");
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
    const booking = initialBookings.find((item) => item.id === bookingId);
    const previousStatus = booking
      ? getBookingStatus(booking)
      : statusByBooking[bookingId];
    const previousTiming = statusTimingByBooking[bookingId] || {};
    const transitionAt = new Date();
    const optimisticTiming = { ...previousTiming };

    if (
      nextStatus === "INIZIATO" &&
      (previousStatus !== "INIZIATO" || !optimisticTiming.startedAt)
    ) {
      optimisticTiming.startedAt = transitionAt.toISOString();
      optimisticTiming.stoppedAt = null;
      optimisticTiming.elapsedSeconds = 0;
    } else if (
      nextStatus !== "INIZIATO" &&
      previousStatus === "INIZIATO" &&
      optimisticTiming.startedAt
    ) {
      optimisticTiming.stoppedAt = transitionAt.toISOString();
      optimisticTiming.elapsedSeconds = Math.max(
        0,
        Math.floor(
          (transitionAt.getTime() - new Date(optimisticTiming.startedAt).getTime()) /
            1000,
        ),
      );
    }

    setStatusByBooking((current) => ({ ...current, [bookingId]: nextStatus }));
    setStatusTimingByBooking((current) => ({
      ...current,
      [bookingId]: optimisticTiming,
    }));
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
      if (data?.status) {
        setStatusTimingByBooking((current) => ({
          ...current,
          [bookingId]: {
            startedAt: data.status.startedAt ?? null,
            stoppedAt: data.status.stoppedAt ?? null,
            elapsedSeconds: Number(data.status.elapsedSeconds || 0),
          },
        }));
      }
      if (data?.statusComment && selectedBooking?.id === bookingId) {
        setDbComments((current) => [...current, data.statusComment]);
      }
      const elapsedMessage =
        previousStatus === "INIZIATO" && nextStatus !== "INIZIATO"
          ? ` Tempo trascorso: ${formatAppointmentTimer(Number(data?.status?.elapsedSeconds || optimisticTiming.elapsedSeconds || 0))}.`
          : "";
      showPushToast(
        "Modifica salvata",
        `Stato aggiornato: ${appointmentStatusLabels[nextStatus]}.${elapsedMessage}`,
      );
    } catch (error) {
      console.error("Failed to save appointment status:", error);
      setStatusByBooking((current) => {
        const copy = { ...current };
        if (previousStatus) copy[bookingId] = previousStatus;
        else delete copy[bookingId];
        return copy;
      });
      setStatusTimingByBooking((current) => ({
        ...current,
        [bookingId]: previousTiming,
      }));
      showPushToast(
        "Modifica non salvata",
        error instanceof Error
          ? error.message
          : "Non sono riuscito a salvare lo stato. Riprova.",
        "error",
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
      return false;
    }

    if (!nextTeam.length) {
      alert("Seleziona almeno una collaboratrice del salone Corso.");
      return false;
    }

    setTeamByBooking((current) => ({ ...current, [booking.id]: nextTeam }));
    setSavingTeamId(booking.id);

    try {
      const response = await fetch("/api/appointments/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          orderName: booking.bookingStr,
          teammateIds,
          teammates: nextTeam,
          signedBy,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Non sono riuscito a salvare il team.");
      }
      const data = await response.json().catch(() => null);
      if (booking.bookingStr && data?.shopifyNoteSaved === false) {
        showPushToast(
          "Collaboratrice salvata",
          "Modifica salvata in Paradise; la nota Shopify non è stata aggiornata.",
          "error",
        );
      } else {
        showPushToast(
          "Modifica salvata",
          `Collaboratrice aggiornata: ${nextTeam.map((mate) => mate.name).join(", ")}.`,
        );
      }
      return true;
    } catch (error) {
      console.error("Failed to save appointment team:", error);
      setTeamByBooking((current) => ({
        ...current,
        [booking.id]: previousTeam,
      }));
      showPushToast(
        "Modifica non salvata",
        error instanceof Error
          ? error.message
          : "Non sono riuscito a salvare il team. Riprova.",
        "error",
      );
      return false;
    } finally {
      setSavingTeamId(null);
    }
  }

  async function selectCollaboratorAndOpenControl(
    booking: AppointmentRecord,
    teammate: Pick<BookingTeammate, "id" | "name" | "photoUrl">,
  ) {
    if (isPC && !pcActiveWorker) {
      setPcScreenLocked(true);
      return;
    }
    const saved = await executeTeamChange(
      booking,
      [teammate.id],
      isPC ? pcActiveWorker?.name : undefined,
    );
    if (!saved) return;
    await openClientControlForBooking(booking, teammate);
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
    const customerUpdate = liveCustomerUpdates[booking.id] || booking.customerUpdate;
    const timing = statusTimingByBooking[booking.id] || {};
    const elapsedSeconds = Math.max(0, Number(timing.elapsedSeconds || 0));

    return (
      <div
        className="flex flex-col gap-1"
        onPointerDown={(event) => event.stopPropagation()}
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
        {status === "INIZIATO" ? (
          <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-[14px] border border-[#E5C1D4] bg-[linear-gradient(135deg,#211820,#38212F)] px-3 py-2 text-white shadow-[0_8px_20px_rgba(54,24,42,0.16)]">
            <span className="grid size-7 place-items-center rounded-full bg-white/10 text-[#FFB9D8]">
              <Clock3 className="size-4" />
            </span>
            <span>
              <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-white/55">
                Tempo trascorso
              </span>
              <span className="block font-mono text-sm font-black tabular-nums tracking-[0.08em]">
                <LiveAppointmentTimer
                  startedAt={timing.startedAt}
                  elapsedSeconds={elapsedSeconds}
                />
              </span>
            </span>
          </div>
        ) : null}
        {status !== "INIZIATO" && elapsedSeconds > 0 ? (
          <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-black/8 bg-white px-2.5 py-1 text-[10px] font-black text-black/55">
            <Clock3 className="size-3.5 text-[#B83D7F]" />
            Tempo trascorso {formatAppointmentTimer(elapsedSeconds)}
          </span>
        ) : null}
        {customerUpdate ? (
          <div
            role="status"
            aria-live="polite"
            title={customerUpdate.message || "Aggiornamento ricevuto via WhatsApp"}
            className="mt-1 flex max-w-[300px] items-start gap-2.5 rounded-[18px] border border-[#D5E9DD] bg-[linear-gradient(135deg,rgba(250,255,252,0.96),rgba(239,249,243,0.94))] px-3.5 py-3 text-left shadow-[0_8px_24px_rgba(24,92,55,0.07)] backdrop-blur-xl"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[#B9DEC8] bg-white/90 text-[#16864A] shadow-[0_3px_10px_rgba(22,134,74,0.08)]">
              <WhatsAppMark className="size-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3D7655]">
                Aggiornamento WhatsApp
              </span>
              <span className="mt-1 block text-xs font-semibold leading-4 text-[#173C27]">
                {customerUpdate.delayMinutes
                  ? `Sta arrivando · ${customerUpdate.delayMinutes} min di ritardo`
                  : "Sta arrivando"}
              </span>
              {customerUpdate.message ? (
                <span className="mt-1 block line-clamp-2 text-[11px] font-normal leading-4 text-[#52705E]">
                  “{customerUpdate.message}”
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>
    );
  };

  const ClientControlStaffPicker = ({ booking }: { booking: AppointmentRecord }) => {
    const assignedIds = new Set(getBookingTeam(booking).map((mate) => mate.id));
    const candidates = corsoTeamOptions.map((option) => ({
      id: option.id,
      name: option.name,
      photoUrl: option.photoUrl,
    }));

    return (
      <div className="rounded-[24px] border border-[#F1D7E2] bg-[#FFF9FC] p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#FCE5F1] text-[#B83D7F]">
            <UsersRound className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#B83D7F]">
              Controllo Cliente
            </p>
            <h4 className="text-lg font-black text-[#171717]">
              Seleziona la collaboratrice
            </h4>
            <p className="mt-1 text-xs font-semibold leading-5 text-black/50">
              La scelta viene salvata in Paradise Staff Hub, resta valida dopo ogni sincronizzazione e viene annotata sull’ordine Shopify.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {candidates.map((mate) => (
            <button
              key={mate.id}
              type="button"
              disabled={savingTeamId === booking.id}
              onClick={() => void selectCollaboratorAndOpenControl(booking, mate)}
              className={[
                "group flex min-h-16 items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:border-[#E88AC5] hover:bg-[#FFF1F8] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-55",
                assignedIds.has(mate.id) ? "border-[#E88AC5] ring-2 ring-[#FCE5F1]" : "border-black/5",
              ].join(" ")}
            >
              <Avatar name={mate.name} photoUrl={mate.photoUrl} size="size-11" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-[#171717]">
                  {mate.name}
                </span>
                <span className="mt-0.5 block text-[11px] font-bold text-black/40">
                  {assignedIds.has(mate.id) ? "Assegnata in Paradise" : "Assegna e apri controllo"}
                </span>
              </span>
              {savingTeamId === booking.id ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-[#B83D7F]" />
              ) : assignedIds.has(mate.id) ? (
                <Check className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-[#B83D7F] transition group-hover:translate-x-0.5" />
              )}
            </button>
          ))}
        </div>

        {!candidates.length ? (
          <button
            type="button"
            onClick={() => void openClientControlForBooking(booking)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#B83D7F] px-4 py-3 text-sm font-black text-white"
          >
            <UserRound className="size-4" />
            Apri e scegli collaboratrice
          </button>
        ) : null}
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
    <div className="relative min-h-screen bg-transparent text-[#1C1C1C]">
      {/* Floating Push Toast Notification Banner */}
      {toastNotification.show && (
        <div
          className={`fixed top-5 right-5 sm:right-8 z-[200] flex items-center gap-3.5 rounded-2xl border px-5 py-4 text-white shadow-[0_20px_50px_rgba(0,0,0,0.25)] animate-in fade-in slide-in-from-top-5 duration-300 ${
            toastNotification.type === "success"
              ? "border-emerald-400 bg-[#059669]"
              : "border-red-400 bg-red-600"
          }`}
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/20">
            {toastNotification.type === "success" ? (
              <Check className="size-5 text-white" strokeWidth={3} />
            ) : (
              <X className="size-5 text-white" strokeWidth={3} />
            )}
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-white/90">
              {toastNotification.title}
            </p>
            <p className="text-sm font-bold text-white">
              {toastNotification.message}
            </p>
          </div>
        </div>
      )}

      {clientControlOpen ? (
        <div className="fixed inset-0 z-[120] isolate bg-white text-[#171717]">
          <div className="relative z-10 flex h-dvh w-full flex-col overflow-hidden bg-white">
            {/* Header */}
            <div className="shrink-0 border-b border-neutral-200 bg-white px-6 pt-6 pb-5 shadow-[0_8px_24px_rgba(17,17,17,0.04)] sm:px-10 lg:px-14">
              <div className="mx-auto flex w-full max-w-[1480px] items-start justify-between gap-4">
                <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#B83D7F] px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                  Store manager
                </span>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-[#1F1F1F] sm:text-4xl">
                  {clientControlForm.clientName || "Sara Capelli Lisci"}
                </h2>
                <p className="mt-1 text-sm font-semibold text-black/45">
                  {clientControlExistingId ? "Modifica controllo cliente" : "Nuovo controllo cliente"}
                </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setClientControlOpen(false);
                    setIsStaffDropdownOpen(false);
                  }}
                  className="grid size-11 shrink-0 place-items-center rounded-full border border-neutral-200 bg-white text-black/70 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 active:scale-95"
                  aria-label="Torna agli appuntamenti"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
              <div className="mx-auto w-full max-w-[1480px] space-y-6 px-5 py-7 sm:px-8 lg:px-12">
              {/* Info cliente da Card */}
              <section className="rounded-[28px] border border-neutral-200 bg-[#FAFAFA] p-5 shadow-[0_10px_30px_rgba(17,17,17,0.04)]">
                <div className="flex items-center gap-2 text-xs font-bold text-black/60">
                  <User className="size-4 text-[#D96B94]" />
                  <span className="uppercase tracking-wider font-black text-[11px] text-[#B83D7F]">Info cliente & Ordini Shopify</span>
                </div>
                <div className="mt-3.5 flex flex-wrap gap-2.5">
                  <span className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-black text-[#1F1F1F] shadow-2xs">
                    <Receipt className="size-3.5 text-[#D96B94]" />
                    <span>Codice Acconto: #{clientControlForm.shopifyOrder || "---"}</span>
                    {clientControlForm.shopifyOrder && (
                      <a
                        href={getShopifyAdminOrderUrl(clientControlForm.shopifyOrder, selectedOrderDetails?.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 text-[10px] text-[#B83D7F] underline font-extrabold hover:text-black"
                      >
                        Vedi ↗
                      </a>
                    )}
                  </span>
                  {clientControlForm.secondShopifyOrder ? (
                    <span className="inline-flex items-center gap-2 rounded-2xl border border-[#D96B94] bg-[#FFF4F8] px-4 py-2.5 text-xs font-black text-[#B83D7F] shadow-2xs">
                      <ShoppingBag className="size-3.5 text-[#D96B94]" />
                      <span>Codice Ordine Finale: #{clientControlForm.secondShopifyOrder}</span>
                      <a
                        href={getShopifyAdminOrderUrl(clientControlForm.secondShopifyOrder, secondOrderDetails?.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 text-[10px] text-[#B83D7F] underline font-extrabold hover:text-black"
                      >
                        Vedi ↗
                      </a>
                    </span>
                  ) : null}
                  {clientControlForm.email ? (
                    <span className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-black text-[#1F1F1F] shadow-2xs">
                      <Mail className="size-3.5 text-[#D96B94]" />
                      <span className="truncate max-w-[200px]">{clientControlForm.email}</span>
                    </span>
                  ) : null}
                  {clientControlForm.phone ? (
                    <span className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-black text-[#1F1F1F] shadow-2xs">
                      <Phone className="size-3.5 text-[#D96B94]" />
                      <span>{clientControlForm.phone}</span>
                    </span>
                  ) : null}
                  {clientControlForm.serviceTitle ? (
                    <span className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-black text-[#1F1F1F] shadow-2xs">
                      <CalendarDays className="size-3.5 text-[#D96B94]" />
                      <span className="truncate max-w-[280px]">{clientControlForm.serviceTitle}</span>
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-black text-[#1F1F1F] shadow-2xs">
                    <AtSign className="size-3.5 text-[#D96B94]" />
                    <input
                      type="text"
                      value={clientControlForm.instagramTag}
                      onChange={(e) =>
                        setClientControlForm((prev) => ({
                          ...prev,
                          instagramTag: e.target.value,
                        }))
                      }
                      placeholder="@cliente"
                      className="bg-transparent outline-none w-24 text-xs font-black text-[#D96B94]"
                    />
                  </span>
                </div>
              </section>

              {/* 1° e 2° Ordine Shopify Card */}
              <div className="relative space-y-3 rounded-[28px] border border-neutral-200 bg-white p-4 shadow-[0_10px_30px_rgba(17,17,17,0.04)] sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#D96B94]">
                    <ShoppingBag className="size-4 text-[#D96B94]" /> ORDINI SHOPIFY (ACCONTO + ORDINE FINALE)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTodayOrdersDropdown((prev) => !prev);
                      if (!showTodayOrdersDropdown) void fetchTodayShopifyOrders();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-3.5 py-1 text-[10px] font-black text-white shadow-2xs hover:opacity-95 transition active:scale-95"
                    title="Mostra tutto lo storico ordini Shopify della cliente"
                  >
                    <Sparkles className="size-3 text-white" />
                    <span>{loadingTodayOrders ? "Carico..." : `TUTTI GLI ORDINI${todayOrdersList.length ? ` (${todayOrdersList.length})` : ""}`}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Codice Ordine Acconto */}
                  <div className="rounded-2xl border border-neutral-200 bg-[#FAFAFA] p-3 shadow-2xs">
                    {(() => {
                      const isDepositLocked = Boolean(
                        (selectedBooking?.bookingStr || (clientControlForm.shopifyOrder && clientControlForm.shopifyOrder.trim() !== "")) &&
                          !isDepositUnlockedManually
                      );
                      return (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase text-black/60 tracking-wider">
                              1° Codice Ordine (Acconto Booking)
                            </span>
                            {Boolean(selectedBooking?.bookingStr || clientControlForm.shopifyOrder) && (
                              <button
                                type="button"
                                onClick={() => setIsDepositUnlockedManually((prev) => !prev)}
                                className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md border transition cursor-pointer hover:scale-105 active:scale-95 ${
                                  isDepositLocked
                                    ? "text-[#B83D7F] bg-[#FFF0F6] border-[#F6C6DE]"
                                    : "text-emerald-700 bg-emerald-50 border-emerald-300 shadow-2xs"
                                }`}
                                title={isDepositLocked ? "Clicca per sbloccare e modificare il codice acconto" : "Clicca per ribloccare"}
                              >
                                {isDepositLocked ? "🔒 Bloccato" : "🔓 Sbloccato (Clicca per bloccare)"}
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={clientControlForm.shopifyOrder}
                            readOnly={isDepositLocked}
                            onChange={(event) => {
                              if (isDepositLocked) return;
                              setClientControlForm((prev) => ({
                                ...prev,
                                shopifyOrder: event.target.value,
                              }));
                            }}
                            className={`h-11 w-full rounded-xl border px-3.5 text-xs font-black outline-none transition shadow-2xs ${
                              isDepositLocked
                                ? "border-[#F6C6DE] bg-[#FFF0F6] text-black/70 cursor-not-allowed"
                                : "border-emerald-300 bg-white text-black/90 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                            }`}
                            placeholder="N° Acconto (es. 22831)"
                          />
                          {suggestedAccontoOrder && (
                            <button
                              type="button"
                              onClick={() => selectShopifyOrderFromList(suggestedAccontoOrder, "first")}
                              className="mt-2 flex w-full items-center justify-between rounded-xl border border-[#F6C6DE] bg-[#FFF0F6] px-3 py-1.5 text-[11px] font-black text-[#B83D7F] hover:bg-[#FCE5F3] transition active:scale-95 shadow-2xs"
                              title="Clicca per inserire il codice dell'acconto booking"
                            >
                              <span className="flex items-center gap-1">
                                <Sparkles className="size-3.5 text-[#D96B94]" />
                                <span>Suggerito Acconto: #{suggestedAccontoOrder.orderName.replace(/^#/, "")}</span>
                              </span>
                              <span className="font-extrabold text-xs">€{suggestedAccontoOrder.totalPrice.toFixed(2)}</span>
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Codice Ordine Finale (Pagamento Totale) */}
                  <div className="rounded-2xl border border-[#D96B94]/40 bg-white p-3 shadow-2xs ring-2 ring-[#D96B94]/10">
                    {(() => {
                      const isSecondLocked = Boolean(
                        secondOrderDetails &&
                        (clientControlForm.secondShopifyOrder && clientControlForm.secondShopifyOrder.trim() !== "") &&
                          !isSecondUnlockedManually
                      );
                      return (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase text-[#B83D7F] tracking-wider flex items-center gap-1">
                              ⭐ 2° Codice Ordine (Pagamento Totale Finale)
                            </span>
                            {Boolean(clientControlForm.secondShopifyOrder) ? (
                              <button
                                type="button"
                                onClick={() => setIsSecondUnlockedManually((prev) => !prev)}
                                className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md border transition cursor-pointer hover:scale-105 active:scale-95 ${
                                  isSecondLocked
                                    ? "text-[#B83D7F] bg-[#FFF0F6] border-[#F6C6DE]"
                                    : "text-emerald-700 bg-emerald-50 border-emerald-300 shadow-2xs"
                                }`}
                                title={isSecondLocked ? "Clicca per sbloccare e modificare il codice saldo" : "Clicca per ribloccare"}
                              >
                                {isSecondLocked ? "🔒 Bloccato" : "🔓 Sbloccato (Clicca per bloccare)"}
                              </button>
                            ) : (
                              <span className="text-[9px] font-extrabold text-[#D96B94] uppercase">Principale</span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={clientControlForm.secondShopifyOrder || ""}
                            readOnly={isSecondLocked}
                            onChange={(event) => {
                              if (isSecondLocked) return;
                              setManualPaymentMethod(null);
                              setSecondOrderDetails(null);
                              setClientControlForm((prev) => ({
                                ...prev,
                                secondShopifyOrder: event.target.value,
                              }));
                            }}
                            onFocus={() => {
                              setShowTodayOrdersDropdown(true);
                              if (!showTodayOrdersDropdown) void fetchTodayShopifyOrders();
                            }}
                            className={`h-11 w-full rounded-xl border px-3.5 text-xs font-black outline-none transition shadow-2xs ${
                              isSecondLocked
                                ? "border-[#F6C6DE] bg-[#FFF0F6] text-black/70 cursor-not-allowed"
                                : "border-[#D96B94]/50 bg-white text-[#1F1F1F] focus:border-[#B83D7F] focus:ring-2 focus:ring-[#D96B94]/30"
                            }`}
                            placeholder="N° Ordine Finale Salone (es. 25344)"
                          />
                          {secondShopifyLookupLoading ? (
                            <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-[#B83D7F]">Verifica pagamento Shopify in corso...</p>
                          ) : null}
                          {suggestedSaldoOrder && (
                            <button
                              type="button"
                              onClick={() => selectShopifyOrderFromList(suggestedSaldoOrder, "second")}
                              className="mt-2 flex w-full items-center justify-between rounded-xl border border-[#D96B94] bg-[#FFF0F6] px-3 py-1.5 text-[11px] font-black text-[#B83D7F] hover:bg-[#FCE5F3] transition active:scale-95 shadow-2xs"
                              title="Clicca per inserire il codice del saldo finale salone"
                            >
                              <span className="flex items-center gap-1">
                                <Sparkles className="size-3.5 text-[#D96B94]" />
                                <span>Suggerito Saldo: #{suggestedSaldoOrder.orderName.replace(/^#/, "")}</span>
                              </span>
                              <span className="font-extrabold text-xs">€{suggestedSaldoOrder.totalPrice.toFixed(2)}</span>
                            </button>
                          )}
                          {secondOrderDetails ? (
                            <>
                              <div className={`mt-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wide ${
                                String(secondOrderDetails.financialStatus || "").toLowerCase() === "paid" &&
                                (secondOrderDetails.paymentMethod !== "DA_VERIFICARE" || manualPaymentMethod)
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : "border-amber-200 bg-amber-50 text-amber-800"
                              }`}>
                                {String(secondOrderDetails.financialStatus || "").toLowerCase() === "paid"
                                  ? manualPaymentMethod
                                    ? `Metodo dichiarato · ${manualPaymentMethod === "CARTA" ? "Carta" : manualPaymentMethod === "SHOPIFY" ? "Shopify" : "Contanti"}`
                                    : `Pagamento verificato · ${secondOrderDetails.paymentMethod === "MISTO" ? "Misto" : secondOrderDetails.paymentMethod === "CASHMATIC" ? "Cashmatic" : secondOrderDetails.paymentMethod === "CONTANTI" ? "Contanti" : secondOrderDetails.paymentMethod === "CARTA" ? "Carta" : "Metodo da verificare"}`
                                  : `Ordine non pagato · ${secondOrderDetails.financialStatus || "stato assente"}`}
                                {secondOrderDetails.paymentGateways?.length ? (
                                  <span className="ml-1 opacity-60">({secondOrderDetails.paymentGateways.join(", ")})</span>
                                ) : null}
                                {secondOrderDetails.paymentReference ? (
                                  <span className="mt-1 block normal-case tracking-normal opacity-60">ID pagamento: {secondOrderDetails.paymentReference}</span>
                                ) : null}
                              </div>

                              {String(secondOrderDetails.financialStatus || "").toLowerCase() === "paid" &&
                              !["CARTA", "CASHMATIC", "CONTANTI", "MISTO"].includes(String(secondOrderDetails.paymentMethod || "")) &&
                              !manualPaymentMethod ? (
                                <div className="mt-3 rounded-2xl border-2 border-[#D96B94] bg-[#FFF5FA] p-4 shadow-sm">
                                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#B83D7F]">
                                    Metodo di pagamento obbligatorio
                                  </p>
                                  <p className="mt-1 text-sm font-black text-[#171717]">
                                    Come ha pagato la cliente?
                                  </p>
                                  <div className="mt-3 grid grid-cols-3 gap-2">
                                    {([
                                      { value: "CARTA" as const, label: "Carta", icon: CreditCard },
                                      { value: "SHOPIFY" as const, label: "Shopify", icon: ShoppingBag },
                                      { value: "CONTANTI" as const, label: "Contanti", icon: Coins },
                                    ]).map((option) => {
                                      const Icon = option.icon;
                                      return (
                                        <button
                                          key={option.value}
                                          type="button"
                                          onClick={() => setManualPaymentMethod(option.value)}
                                          className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-2 py-3 text-center text-[11px] font-black text-[#171717] transition hover:border-[#D96B94] hover:bg-[#FCE5F1] active:scale-[0.98]"
                                        >
                                          <Icon className="size-5 text-[#B83D7F]" />
                                          <span>{option.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Dropdown list for today's orders */}
                {showTodayOrdersDropdown && (
                  <div className="absolute left-0 top-full z-50 mt-1.5 w-full max-w-[680px] rounded-2xl border border-[#F6E1EB] bg-white p-3.5 shadow-2xl animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-black/5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#D96B94]">
                        STORICO COMPLETO ORDINI ({sortedTodayOrdersList.length})
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowTodayOrdersDropdown(false)}
                        className="text-[10px] font-extrabold text-neutral-400 hover:text-black"
                      >
                        Chiudi ✕
                      </button>
                    </div>
                    {clientOrderProfile ? (
                      <div className="mt-3 rounded-2xl border border-[#F6C6DE] bg-[#FFF8FB] p-3.5">
                        <div className="flex items-start gap-3">
                          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#D96B94] text-white">
                            <UserRound className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-[#1F1F1F]">{clientOrderProfile.fullName}</p>
                            <div className="mt-2 grid gap-1.5 text-[11px] font-bold text-black/55 sm:grid-cols-2">
                              {clientOrderProfile.email ? (
                                <p className="flex min-w-0 items-center gap-1.5">
                                  <Mail className="size-3.5 shrink-0 text-[#D96B94]" />
                                  <span className="truncate">{clientOrderProfile.email}</span>
                                </p>
                              ) : null}
                              {clientOrderProfile.phone ? (
                                <p className="flex items-center gap-1.5">
                                  <Phone className="size-3.5 shrink-0 text-[#D96B94]" />
                                  <span>{clientOrderProfile.phone}</span>
                                </p>
                              ) : null}
                              {clientOrderProfile.address ? (
                                <p className="flex items-start gap-1.5 sm:col-span-2">
                                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#D96B94]" />
                                  <span>{clientOrderProfile.address}</span>
                                </p>
                              ) : (
                                <p className="text-black/35 sm:col-span-2">Indirizzo non presente su Shopify</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="max-h-80 overflow-y-auto mt-3 space-y-2 pr-0.5">
                      {loadingTodayOrders ? (
                        <p className="p-4 text-center text-xs text-neutral-400 font-semibold animate-pulse">
                          Caricamento ordini cliente...
                        </p>
                      ) : sortedTodayOrdersList.length > 0 ? (
                        sortedTodayOrdersList.map((order) => {
                          const isAccontoSuggested = Boolean(
                            suggestedAccontoOrder &&
                              (order.id === suggestedAccontoOrder.id || order.orderName === suggestedAccontoOrder.orderName)
                          );
                          const isSaldoSuggested = Boolean(
                            suggestedSaldoOrder &&
                              (order.id === suggestedSaldoOrder.id || order.orderName === suggestedSaldoOrder.orderName)
                          );
                          return (
                            <div
                              key={order.id}
                              className={`w-full p-3 rounded-2xl border transition flex flex-col gap-2 ${
                                isAccontoSuggested || isSaldoSuggested
                                  ? "border-[#D96B94] bg-[#FFF0F6] shadow-sm"
                                  : "border-black/5 bg-[#FFF8FB] hover:bg-[#FCE5F3]"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-black text-[#1F1F1F] flex items-center gap-1.5 flex-wrap">
                                  {order.clientName}
                                  {isAccontoSuggested && (
                                    <span className="rounded-md bg-[#D96B94] px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                                      Suggerito Acconto
                                    </span>
                                  )}
                                  {isSaldoSuggested && (
                                    <span className="rounded-md bg-[#B83D7F] px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                                      Suggerito Saldo
                                    </span>
                                  )}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {order.createdAt && (
                                    <span className="text-[10px] font-extrabold text-[#B83D7F]/80 bg-white/90 px-2 py-0.5 rounded-md border border-[#F6C6DE]/60">
                                      {formatOrderDate(order.createdAt)}
                                    </span>
                                  )}
                                  <span className="text-xs font-black text-[#D96B94]">
                                    #{order.orderName.replace(/^#/, "")}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-xs font-bold text-neutral-600 pt-1 border-t border-black/5">
                                <span className="truncate max-w-[260px] text-black/80">{order.serviceTitle || "Servizio Shopify"}</span>
                                <span className="text-sm font-black text-[#D96B94] shrink-0">
                                  €{order.totalPrice.toFixed(2)}
                                </span>
                              </div>
                              <div className="grid gap-1 text-[10px] font-semibold text-black/45 sm:grid-cols-2">
                                {order.email ? (
                                  <span className="flex min-w-0 items-center gap-1">
                                    <Mail className="size-3 shrink-0" />
                                    <span className="truncate">{order.email}</span>
                                  </span>
                                ) : null}
                                {order.addressLine || order.city ? (
                                  <span className="flex min-w-0 items-center gap-1">
                                    <MapPin className="size-3 shrink-0" />
                                    <span className="truncate">{[order.addressLine, order.city].filter(Boolean).join(" · ")}</span>
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex items-center justify-end gap-2 pt-1 border-t border-black/5">
                                <button
                                  type="button"
                                  onClick={() => selectShopifyOrderFromList(order, "first")}
                                  className="rounded-xl bg-white border border-[#F6C6DE] px-3 py-1.5 text-[10px] font-black text-[#D96B94] hover:bg-[#FFF0F6] active:scale-95 transition shadow-2xs"
                                  title="Inserisci nel 1° Codice Ordine (Acconto)"
                                >
                                  + 1° Acconto
                                </button>
                                <button
                                  type="button"
                                  onClick={() => selectShopifyOrderFromList(order, "second")}
                                  className="rounded-xl bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-3.5 py-1.5 text-[10px] font-black text-white hover:opacity-95 active:scale-95 transition shadow-2xs"
                                  title="Inserisci nel 2° Codice Ordine (Saldo Finale)"
                                >
                                  + 2° Saldo
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="p-3 text-center text-xs text-neutral-400 font-semibold">
                          Nessun ordine recente trovato.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Acconto, Pagato & Collaboratrice - Griglia a 3 Colonne Perfettamente Bilanciata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-black/50 mb-1">
                    <Coins className="size-3.5 text-[#D96B94]" /> ACCONTO PAGATO (€)
                  </span>
                  <input
                    type="text"
                    value={clientControlForm.depositPaid}
                    onChange={(event) =>
                      setClientControlForm((prev) => ({
                        ...prev,
                        depositPaid: event.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-2xl border border-[#F4D3E2] bg-white px-4 text-xs font-bold text-[#1F1F1F] outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20 transition shadow-2xs"
                    placeholder="0.00"
                  />
                </label>

                <label className="block">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-black/50 mb-1">
                    <CreditCard className="size-3.5 text-[#D96B94]" /> PAGATO (€)
                  </span>
                  <input
                    type="text"
                    value={clientControlForm.paid}
                    readOnly
                    className="h-12 w-full cursor-not-allowed rounded-2xl border border-[#F4D3E2] bg-[#FFF0F6] px-4 text-xs font-black text-[#1F1F1F] outline-none shadow-2xs"
                    placeholder="Importato dal 2° ordine"
                  />
                </label>

                <div className="relative block">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-black/50 mb-1">
                    <User className="size-3.5 text-[#D96B94]" /> COLLABORATRICE
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsStaffDropdownOpen((prev) => !prev)}
                    className="flex h-12 w-full items-center justify-between rounded-2xl border border-[#F4D3E2] bg-white px-4 text-xs font-bold text-[#1F1F1F] outline-none focus:border-[#D96B94] shadow-2xs"
                  >
                    <span className="truncate">
                      {clientControlForm.staffIds.length
                        ? filteredClientControlEmployees
                            .filter((e) => clientControlForm.staffIds.includes(e.id))
                            .map((e) => e.name)
                            .join(", ")
                        : "Seleziona..."}
                    </span>
                    <ChevronDown className={`size-4 text-black/50 transition-transform ${isStaffDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {/* Dropdown Popover */}
                  {isStaffDropdownOpen ? (
                    <div className="absolute left-0 right-0 top-18 z-50 max-h-56 overflow-y-auto rounded-2xl border border-black/10 bg-white p-2.5 shadow-2xl space-y-1">
                      {filteredClientControlEmployees.map((employee) => {
                        const selected = clientControlForm.staffIds.includes(employee.id);
                        return (
                          <button
                            key={employee.id}
                            type="button"
                            onClick={() =>
                              setClientControlForm((prev) => ({
                                ...prev,
                                staffIds: selected
                                  ? prev.staffIds.filter((id) => id !== employee.id)
                                  : [...prev.staffIds, employee.id],
                              }))
                            }
                            className={[
                              "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition",
                              selected
                                ? "bg-[#FCE5F3] text-[#B83D7F]"
                                : "text-black/75 hover:bg-black/5",
                            ].join(" ")}
                          >
                            <span className="truncate">{employee.name}</span>
                            <span
                              className={`grid size-4 shrink-0 place-items-center rounded-md border ${
                                selected
                                  ? "border-[#B83D7F] bg-[#B83D7F] text-white"
                                  : "border-black/20 bg-white"
                              }`}
                            >
                              {selected && <Check className="size-3" strokeWidth={3} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Details for 1° Ordine (Acconto) if available */}
              {selectedOrderDetails && (
                <div className="rounded-[24px] border border-[#F6C6DE] bg-gradient-to-r from-[#FFF0F6] to-[#FFEBF4] p-4 sm:p-5 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-xl bg-[#D96B94] px-3 py-1 text-xs font-black text-white uppercase tracking-wider shadow-2xs">
                        {selectedOrderDetails.orderName}
                      </span>
                      <span className="text-xs font-black text-[#1F1F1F]">
                        {selectedOrderDetails.clientName}
                      </span>
                    </div>
                    <a
                      href={getShopifyAdminOrderUrl(selectedOrderDetails.orderName, selectedOrderDetails.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#F6C6DE] px-4 py-1.5 text-xs font-black text-[#D96B94] hover:bg-[#FFF0F6] shadow-2xs transition active:scale-95"
                    >
                      <span>Vedi su Shopify</span>
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-[#F6C6DE]/60">
                    <div>
                      <span className="text-black/50 text-[10px] font-bold block">DATA ORDINE</span>
                      <span className="font-extrabold text-[#1F1F1F] block text-xs">{formatOrderDate(selectedOrderDetails.createdAt) || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-black/50 text-[10px] font-bold block">SERVIZIO ACCONTO</span>
                      <span className="font-extrabold text-[#1F1F1F] block text-xs truncate max-w-[140px]">{selectedOrderDetails.serviceTitle || "Acconto Booking"}</span>
                    </div>
                    <div>
                      <span className="text-black/50 text-[10px] font-bold block">IMPORTO</span>
                      <span className="text-[#D96B94] font-black block text-xs">€{selectedOrderDetails.totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Details for 2° Ordine (Saldo Finale) if available */}
              {secondOrderDetails && (
                <div className="rounded-[24px] border border-[#B83D7F] bg-gradient-to-r from-[#FFEBF4] to-[#FFF0F6] p-4 sm:p-5 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-xl bg-gradient-to-r from-[#B83D7F] to-[#D96B94] px-3 py-1 text-xs font-black text-white uppercase tracking-wider shadow-2xs flex items-center gap-1">
                        ⭐ {secondOrderDetails.orderName} (Saldo Totale)
                      </span>
                      <span className="text-xs font-black text-[#1F1F1F]">
                        {secondOrderDetails.clientName}
                      </span>
                    </div>
                    <a
                      href={getShopifyAdminOrderUrl(secondOrderDetails.orderName, secondOrderDetails.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#B83D7F]/40 px-4 py-1.5 text-xs font-black text-[#B83D7F] hover:bg-[#FFF0F6] shadow-2xs transition active:scale-95"
                    >
                      <span>Vedi su Shopify</span>
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-[#B83D7F]/30">
                    <div>
                      <span className="text-black/50 text-[10px] font-bold block">DATA ORDINE</span>
                      <span className="font-extrabold text-[#1F1F1F] block text-xs">{formatOrderDate(secondOrderDetails.createdAt) || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-black/50 text-[10px] font-bold block">SERVIZIO SALONE</span>
                      <span className="font-extrabold text-[#1F1F1F] block text-xs truncate max-w-[140px]">{secondOrderDetails.serviceTitle || "Servizio Salone"}</span>
                    </div>
                    <div>
                      <span className="text-black/50 text-[10px] font-bold block">PAGATO IN SALONE</span>
                      <span className="text-[#B83D7F] font-black block text-xs">€{secondOrderDetails.totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Nuova Sezione Dettagli Extension & Cliente */}
              <section className="rounded-[24px] border border-[#F6E1EB] bg-[#FFF8FB] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-black/5 pb-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#D96B94]">
                    <Pencil className="size-3.5 text-[#D96B94]" /> DETTAGLI APPOINTMENT & CLIENTE
                  </span>
                  <button
                    type="button"
                    onClick={polishClientControlNote}
                    disabled={!hasClientControlNoteContext() || clientControlPolishing}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#D96B94] px-4 py-1.5 text-[11px] font-bold text-white shadow-2xs transition active:scale-95 hover:bg-[#C85982] disabled:opacity-45"
                  >
                    <Sparkles className="size-3.5" />
                    {clientControlPolishing ? "Sistemo..." : "Sistema IA"}
                  </button>
                </div>

                {/* 1. Quanti grammi? */}
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-black/50 mb-1.5">
                    QUANTI GRAMMI?
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {["100g", "150g", "200g"].map((gram) => {
                      const selected = selectedGrammi === gram;
                      return (
                        <button
                          key={gram}
                          type="button"
                          onClick={() => {
                            const next = selected ? "" : gram;
                            setSelectedGrammi(next);
                            updateShopifyNote({ grammi: next });
                          }}
                          className={`rounded-full px-4 py-1.5 text-xs font-black transition active:scale-95 border ${
                            selected
                              ? "bg-[#D96B94] text-white border-[#D96B94] shadow-2xs"
                              : "bg-white text-[#B83D7F] border-[#F3B5D4] hover:bg-[#FCE5F3]"
                          }`}
                        >
                          {gram}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        const isCustom = selectedGrammi === "custom";
                        const next = isCustom ? "" : "custom";
                        setSelectedGrammi(next);
                        updateShopifyNote({ grammi: next === "custom" ? customGrammiInput : next });
                      }}
                      className={`rounded-full px-4 py-1.5 text-xs font-black transition active:scale-95 border ${
                        selectedGrammi === "custom"
                          ? "bg-[#D96B94] text-white border-[#D96B94] shadow-2xs"
                          : "bg-white text-[#B83D7F] border-[#F3B5D4] hover:bg-[#FCE5F3]"
                      }`}
                    >
                      Personalizzato
                    </button>
                    {selectedGrammi === "custom" && (
                      <input
                        type="text"
                        value={customGrammiInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomGrammiInput(val);
                          updateShopifyNote({ grammi: val });
                        }}
                        placeholder="es. 250g"
                        className="h-8 w-24 rounded-full border border-[#D96B94] bg-white px-3 text-xs font-bold text-[#1F1F1F] outline-none focus:ring-2 focus:ring-[#D96B94]/20"
                      />
                    )}
                  </div>
                </div>

                {/* 2. Lunghezza */}
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-black/50 mb-1.5">
                    LUNGHEZZA
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {["50cm", "55cm", "65cm", "75cm"].map((len) => {
                      const selected = selectedLunghezza === len;
                      return (
                        <button
                          key={len}
                          type="button"
                          onClick={() => {
                            const next = selected ? "" : len;
                            setSelectedLunghezza(next);
                            updateShopifyNote({ lunghezza: next });
                          }}
                          className={`rounded-full px-4 py-1.5 text-xs font-black transition active:scale-95 border ${
                            selected
                              ? "bg-[#D96B94] text-white border-[#D96B94] shadow-2xs"
                              : "bg-white text-[#B83D7F] border-[#F3B5D4] hover:bg-[#FCE5F3]"
                          }`}
                        >
                          {len}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Quante fasce? */}
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-black/50 mb-1.5">
                    QUANTE FASCE?
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {["1", "2", "3", "4", "5"].map((num) => {
                      const selected = selectedFasce === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            const next = selected ? "" : num;
                            setSelectedFasce(next);
                            updateShopifyNote({ fasce: next });
                          }}
                          className={`size-9 rounded-xl text-xs font-black transition active:scale-95 border grid place-items-center ${
                            selected
                              ? "bg-[#D96B94] text-white border-[#D96B94] shadow-2xs"
                              : "bg-white text-[#B83D7F] border-[#F3B5D4] hover:bg-[#FCE5F3]"
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        const isCustom = selectedFasce === "custom";
                        const next = isCustom ? "" : "custom";
                        setSelectedFasce(next);
                        updateShopifyNote({ fasce: next === "custom" ? customFasceInput : next });
                      }}
                      className={`h-9 rounded-xl px-3 text-xs font-black transition active:scale-95 border grid place-items-center ${
                        selectedFasce === "custom"
                          ? "bg-[#D96B94] text-white border-[#D96B94] shadow-2xs"
                          : "bg-white text-[#B83D7F] border-[#F3B5D4] hover:bg-[#FCE5F3]"
                      }`}
                    >
                      Personalizzato
                    </button>
                    {selectedFasce === "custom" && (
                      <input
                        type="text"
                        value={customFasceInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomFasceInput(val);
                          updateShopifyNote({ fasce: val });
                        }}
                        placeholder="es. 6"
                        className="h-9 w-20 rounded-xl border border-[#D96B94] bg-white px-3 text-xs font-bold text-[#1F1F1F] outline-none focus:ring-2 focus:ring-[#D96B94]/20"
                      />
                    )}
                  </div>
                </div>

                {/* 4. Come era la cliente? */}
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-black/50 mb-1.5">
                    COME ERA LA CLIENTE?
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Tranquilla", emoji: "😌" },
                      { label: "Simpatica", emoji: "😊" },
                      { label: "Esigente", emoji: "🧐" },
                      { label: "Pretenziosa", emoji: "💅" },
                    ].map((att) => {
                      const selected = selectedAtteggiamento === att.label;
                      return (
                        <button
                          key={att.label}
                          type="button"
                          onClick={() => {
                            const next = selected ? "" : att.label;
                            setSelectedAtteggiamento(next);
                            updateShopifyNote({ atteggiamento: next });
                          }}
                          className={`rounded-full px-4 py-1.5 text-xs font-black transition active:scale-95 border flex items-center gap-1.5 ${
                            selected
                              ? "bg-[#D96B94] text-white border-[#D96B94] shadow-2xs"
                              : "bg-white text-[#B83D7F] border-[#F3B5D4] hover:bg-[#FCE5F3]"
                          }`}
                        >
                          <span>{att.emoji}</span>
                          <span>{att.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Note Extra (con limite di caratteri) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-black/50">
                      NOTE EXTRA (MAX 250 CARATTERI)
                    </span>
                    <span className="text-[10px] font-extrabold text-black/40">
                      {extraNoteText.length}/250
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={250}
                    value={extraNoteText}
                    onChange={(e) => {
                      const text = e.target.value;
                      setExtraNoteText(text);
                      updateShopifyNote({ extraNote: text });
                    }}
                    className="h-11 w-full rounded-2xl border border-[#F3B5D4] bg-white px-3.5 text-xs font-bold text-[#1F1F1F] outline-none focus:border-[#D96B94]"
                    placeholder="Scrivi qui eventuali note extra per la cliente..."
                  />
                </div>
              </section>

              {/* NOTA SHOPIFY (Read-only) */}
              <div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-black/50">
                  <FileText className="size-4 text-[#D96B94]" /> NOTA SHOPIFY COMPILATA
                </span>
                <textarea
                  value={clientControlForm.customNoteText}
                  readOnly={true}
                  rows={3}
                  className="mt-1.5 w-full rounded-2xl border border-[#F4D3E2] bg-neutral-50 p-4 text-xs font-bold text-[#1F1F1F] shadow-2xs outline-none cursor-not-allowed select-none"
                  placeholder="La nota formattata per Shopify viene generata automaticamente dalle selezioni sopra..."
                />
              </div>

              <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_10px_30px_rgba(17,17,17,0.04)] sm:p-6">
                <div className="flex items-center justify-between gap-3 border-b border-black/5 pb-4">
                  <div>
                    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#8E536F]">
                      <Clock3 className="size-4 text-[#D96B94]" />
                      Note e tempo del processo
                    </span>
                    <p className="mt-1 text-xs font-semibold text-black/45">
                      Cronologia completa di stati, tempi, assegnazioni e salvataggi.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-black/5 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-black/45">
                      Solo lettura
                    </span>
                    <span className="rounded-full bg-[#FFF0F6] px-3 py-1.5 text-[10px] font-black text-[#B83D7F]">
                      {clientControlAppointmentComments.length}
                    </span>
                  </div>
                </div>
                {clientControlAppointmentComments.length ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {[...clientControlAppointmentComments].reverse().map((comment) => (
                      <article
                        key={comment.id}
                        className="rounded-[20px] border border-neutral-200 bg-[#FAFAFA] px-4 py-4"
                      >
                        <p className="text-sm font-bold leading-6 text-[#332A2F]">
                          {comment.message}
                        </p>
                        <p className="mt-2 text-[11px] font-semibold text-black/40">
                          {comment.user_name} · {formatDateTime(comment.created_at)}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl border border-neutral-200 bg-[#FAFAFA] px-4 py-5 text-sm font-semibold text-black/40">
                    Nessuna modifica registrata per questo appuntamento.
                  </p>
                )}
              </section>

              {/* Spunte di Verifica (I 5 Checkbox) */}
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">
                  VERIFICHE E CONTROLLI
                </span>
                <div className="mt-2.5 flex flex-wrap gap-2.5">
                  {[
                    ["notes", "Note Shopify"],
                    ["beforeMedia", "Prima foto/video"],
                    ["afterMedia", "Dopo foto/video"],
                    ["products", "Prodotti"],
                    ["review", "Recensione"],
                  ].map(([fieldKey, fieldLabel]) => {
                    const checked = Boolean((clientControlForm as any)[fieldKey]);
                    return (
                      <label
                        key={fieldKey}
                        className={[
                          "flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-black transition active:scale-95 shadow-2xs",
                          checked
                            ? "border-[#D96B94] bg-gradient-to-r from-[#D96B94] to-[#B83D7F] text-white shadow-xs"
                            : "border-black/10 bg-white text-black/70 hover:bg-neutral-50",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setClientControlForm((prev) => ({
                              ...prev,
                              [fieldKey]: event.target.checked,
                            }))
                          }
                          className="size-4 accent-[#D96B94]"
                        />
                        <span>{fieldLabel}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {clientControlMessage ? (
                <p
                  className={`rounded-2xl px-5 py-3.5 text-xs font-extrabold ${
                    clientControlMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {clientControlMessage.text}
                </p>
              ) : null}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="shrink-0 border-t border-neutral-200 bg-white px-5 py-4 shadow-[0_-8px_24px_rgba(17,17,17,0.04)] sm:px-8 lg:px-14">
              <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  setClientControlOpen(false);
                  setIsStaffDropdownOpen(false);
                }}
                className="rounded-2xl border border-black/10 bg-neutral-100 px-8 py-3.5 text-xs font-black text-black/70 transition hover:bg-neutral-200 active:scale-95"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => void submitClientControlForm()}
                disabled={clientControlSubmitting || clientControlLoading}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-8 py-3.5 text-xs font-black text-white shadow-md transition hover:opacity-95 active:scale-95 disabled:opacity-60"
              >
                <Save className="size-4" />
                <span>
                  {clientControlSubmitting
                    ? "Salvataggio..."
                    : clientControlExistingId
                    ? "Salva modifiche"
                    : "Salva appuntamento"}
                </span>
              </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full">
        <main className="relative min-w-0 space-y-5 overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_5%_0%,rgba(255,197,226,0.34),transparent_30%),radial-gradient(circle_at_95%_8%,rgba(224,213,255,0.4),transparent_28%)] p-2 sm:p-3 lg:p-4">
          <section className={`relative overflow-visible rounded-[28px] border border-white/80 bg-white/72 p-5 shadow-[0_22px_60px_rgba(88,45,66,0.10)] backdrop-blur-2xl sm:p-7 ${isDatePickerOpen ? "z-40" : "z-10"}`}>
            <div>
              <div>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-[18px] border border-white bg-[linear-gradient(145deg,#FFD5E9,#F3E9FF)] text-[#B83D7F] shadow-[0_10px_28px_rgba(185,61,127,0.16)]">
                      <CalendarCheck className="size-6" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h1 className="text-3xl font-black tracking-[-0.04em] text-[#171717] sm:text-4xl">
                          {pageTitle}
                        </h1>
                        <span className="rounded-full border border-[#F0C4D7] bg-[#FFF2F8] px-3 py-1 text-xs font-black tabular-nums text-[#A93469]">
                          {activeBookingsCount} attivi
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-black/48">
                        {pageSubtitle}
                      </p>
                    </div>
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
              </div>
            </div>

            <div className="mt-7 overflow-x-auto rounded-[20px] border border-white/90 bg-[#F8F3F7]/85 p-1.5 shadow-inner">
              <div className="flex min-w-max gap-1">
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
                      "inline-flex min-h-11 items-center gap-2.5 rounded-[15px] px-4 py-3 text-xs font-black transition",
                      tab.active
                        ? "border border-white bg-white text-[#9E3262] shadow-[0_6px_18px_rgba(89,45,65,0.10)]"
                        : "border border-transparent text-black/55 hover:bg-white/70 hover:text-black/75",
                    ].join(" ")}
                  >
                    {tab.label}
                    <span className="min-w-6 rounded-full bg-[#F5D5E4] px-2 py-0.5 text-center text-[10px] text-[#8D2E59]">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-[minmax(320px,1fr)_210px_190px_120px_150px]">
              <div className="relative h-[52px]">
                <span className="pointer-events-none absolute inset-y-0 left-0 z-10 grid w-12 place-items-center text-[#B44D79]">
                  <Search className="size-5" />
                </span>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Cerca per nome cliente, email o servizio..."
                  className="h-[52px] w-full rounded-[17px] border border-white bg-white/90 pl-12 pr-4 text-sm font-semibold text-black shadow-[0_8px_24px_rgba(81,43,60,0.07)] outline-none transition placeholder:text-black/35 focus:border-[#D86B9B] focus:ring-4 focus:ring-[#F7D9E7]"
                />
              </div>
              <div className="relative h-[52px]">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen((current) => !current)}
                  className="flex h-[52px] w-full items-center justify-between rounded-[17px] border border-white bg-white/90 px-4 text-sm font-bold text-black shadow-[0_8px_24px_rgba(81,43,60,0.07)] transition hover:border-[#D86B9B]"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <CalendarDays className="size-4 shrink-0 text-[#A56A42]" />
                    <span className="truncate">{dateFilterLabel}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 rotate-90" />
                </button>
                {isDatePickerOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 min-w-[260px] rounded-2xl border border-black/10 bg-white/95 p-3 shadow-[0_20px_60px_rgba(45,25,35,0.22)] backdrop-blur-xl">
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
                            const nextFilter = {
                              mode: option.mode,
                              from: option.from,
                              to: option.to,
                            };
                            setDateFilter(nextFilter);
                            setIsDatePickerOpen(false);
                            navigateToAppointmentRange(view, anchorDate, {
                              from: option.from,
                              to: option.to,
                              scopeAll: option.mode === "all",
                            });
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
                        onClick={() => {
                          setIsDatePickerOpen(false);
                          navigateToAppointmentRange(view, anchorDate, {
                            from: dateFilter.from,
                            to: dateFilter.to,
                          });
                        }}
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
                className="h-[52px] rounded-[17px] border border-white bg-white/90 px-4 text-sm font-bold text-black shadow-[0_8px_24px_rgba(81,43,60,0.07)] outline-none focus:border-[#D86B9B] focus:ring-4 focus:ring-[#F7D9E7]"
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
                  className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-[17px] border px-4 text-sm font-black transition ${
                    activeAdvancedFilterCount > 0
                      ? "border-[#D86B9B] bg-[#FFF0F7] text-[#A93469]"
                      : "border-white bg-white/90 text-black shadow-[0_8px_24px_rgba(81,43,60,0.07)] hover:border-[#D86B9B]"
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
                  navigateToAppointmentRange(view, anchorDate, {
                    from: dateFilter.from,
                    to: dateFilter.to,
                    scopeAll: dateFilter.mode === "all",
                    forceRefresh: true,
                  });
                }}
                className="flex h-[52px] items-center justify-center gap-2 rounded-[17px] border border-[#1C1820] bg-[#1C1820] px-5 text-xs font-black text-white shadow-[0_10px_26px_rgba(28,24,32,0.20)] transition hover:-translate-y-0.5 hover:bg-[#A93469] disabled:opacity-50"
              >
                <RefreshCw className={`size-4 text-[#FFD8E9] ${isRefreshing ? "animate-spin" : ""}`} />
                <span>{isRefreshing ? "Sincronizzo..." : "Sincronizza"}</span>
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/76 shadow-[0_22px_60px_rgba(88,45,66,0.10)] backdrop-blur-2xl">
            <div className="hidden grid-cols-[1.05fr_0.92fr_1.35fr_0.86fr_0.5fr_0.9fr_48px] gap-5 border-b border-[#EEDCE5] bg-[linear-gradient(90deg,#FFF4F9,#F7F2FF)] px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#7D5266] xl:grid">
              <span>Appuntamento</span>
              <span>Cliente</span>
              <span>Servizio</span>
              <span>Collaboratrice</span>
              <span>Prezzo</span>
              <span>Stato</span>
              <span />
            </div>

            <div className="divide-y divide-[#F0E4EA]">
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
                        void openClientControlForBooking(booking);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        void openClientControlForBooking(booking);
                      }}
                      className={[
                        "group grid w-full cursor-pointer gap-5 px-5 py-5 text-left transition duration-200 xl:grid-cols-[1.05fr_0.92fr_1.35fr_0.86fr_0.5fr_0.9fr_48px] xl:items-center",
                        isSelected
                          ? "bg-[linear-gradient(90deg,#FFF0F7,#FBF8FF)] shadow-[inset_4px_0_0_#D93B8F]"
                          : "bg-white/82 hover:bg-[#FFFAFC] hover:shadow-[inset_4px_0_0_#F2B6D1]",
                      ].join(" ")}
                    >
                      <div className="flex gap-3">
                        <span className="grid size-12 shrink-0 place-items-center rounded-[17px] border border-white bg-[linear-gradient(145deg,#FFE1EF,#F1E9FF)] text-[#A93469] shadow-sm">
                          <CalendarDays className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-[#211A1E]">
                            {formatDate(booking.startDate)}
                          </p>
                          <p className="mt-1 text-sm font-black tabular-nums text-[#211A1E]">
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

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void openClientControlForBooking(booking);
                        }}
                        className="group/staff min-w-0 rounded-[18px] border border-[#F3E8ED] bg-[#FFFBFD] p-3 text-left transition hover:border-[#E88AC5] hover:bg-[#FFF1F8] xl:border-transparent xl:bg-transparent xl:p-2"
                        title="Cambia collaboratrice"
                      >
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
                          <span className="ml-auto shrink-0 text-[10px] font-black uppercase tracking-[0.08em] text-[#B83D7F] opacity-0 transition group-hover/staff:opacity-100">
                            Cambia
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs font-medium text-[#7A5B4B]">
                          {getSalonLabel(booking.inferredSalon)}
                        </p>
                      </button>

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
                        {getPaymentLabel(booking) ? (
                          <span className="mt-2 inline-flex rounded-full border border-[#F1A7C3] bg-[#FFF1F6] px-2.5 py-1 text-[10px] font-black text-[#B9476D]">
                            {getPaymentLabel(booking)}
                          </span>
                        ) : null}
                      </div>

                      <div
                        className="space-y-1.5"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <StatusControl booking={booking} compact />
                        {booking.isCanceled ? (
                          <span className="inline-flex rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                            Annullato
                          </span>
                        ) : null}
                        <WhatsAppSheetNote booking={booking} compact />
                      </div>

                      <button
                        type="button"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          void openClientControlForBooking(booking);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="grid size-11 place-items-center rounded-[15px] border border-[#EAD8E1] bg-white text-[#A14770] shadow-sm transition group-hover:border-[#E88AC5] group-hover:bg-[#FFF1F8] hover:scale-105"
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
              <div className="grid gap-3 border-t border-[#E8D8CF] p-5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((current) => current + appointmentsPageSize)
                  }
                  className="w-full rounded-2xl border border-[#E8D8CF] bg-white px-4 py-3 text-sm font-black text-[#4E382C] transition hover:bg-[#FFF7F3]"
                >
                  Carica altri {Math.min(appointmentsPageSize, filteredBookings.length - tableBookings.length)}
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleCount(filteredBookings.length)}
                  className="w-full rounded-2xl bg-[#171717] px-4 py-3 text-sm font-black text-white transition hover:bg-[#D93B8F]"
                >
                  Mostra tutti ({filteredBookings.length})
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
                  <ClientControlStaffPicker booking={selectedBooking} />
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
                onClick={() => {
                  setView(option.value);
                  const range = rangeForView(option.value, anchorDate);
                  setDateFilter({ mode: "custom", ...range });
                  navigateToAppointmentRange(option.value, anchorDate, range);
                }}
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
              onClick={() => {
                const nextDate = getPrevDate(view, anchorDate);
                const range = rangeForView(view, nextDate);
                setAnchorDate(nextDate);
                setDateFilter({ mode: "custom", ...range });
                navigateToAppointmentRange(view, nextDate, range);
              }}
              className="grid size-10 place-items-center rounded-full text-black/60 transition hover:bg-white hover:text-black"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="min-w-[180px] px-3 text-center text-sm font-black capitalize text-[#171717]">
              {getRangeLabel(view, anchorDate)}
            </div>
            <button
              type="button"
              onClick={() => {
                const nextDate = getNextDate(view, anchorDate);
                const range = rangeForView(view, nextDate);
                setAnchorDate(nextDate);
                setDateFilter({ mode: "custom", ...range });
                navigateToAppointmentRange(view, nextDate, range);
              }}
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
                            onClick={() => void openClientControlForBooking(booking)}
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
                              const range = rangeForView("day", date);
                              setDateFilter({ mode: "custom", ...range });
                              navigateToAppointmentRange("day", date, range);
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
                          onClick={() => void openClientControlForBooking(booking)}
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
                    onClick={() => void openClientControlForBooking(booking)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        void openClientControlForBooking(booking);
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
                    onClick={() => void openClientControlForBooking(booking)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        void openClientControlForBooking(booking);
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
                      {getPaymentLabel(booking) ? (
                        <span className="mt-2 inline-flex rounded-full border border-[#F1A7C3] bg-[#FFF1F6] px-2.5 py-1 text-[10px] font-black text-[#B9476D]">
                          {getPaymentLabel(booking)}
                        </span>
                      ) : null}
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
                        void openClientControlForBooking(booking);
                      }}
                      className="grid size-10 place-items-center rounded-full border border-black/5 bg-white text-black/45 transition hover:border-[#F1A7C3] hover:text-[#C66170]"
                      aria-label="Apri controllo cliente"
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
          <div className="grid gap-3 border-t border-black/5 p-5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                setVisibleCount((current) => current + appointmentsPageSize)
              }
              className="w-full rounded-[18px] border border-black/8 bg-white px-4 py-3 text-sm font-black text-[#171717] transition hover:border-[#F1A7C3] hover:bg-[#FFF8FB]"
            >
              Carica altri {Math.min(appointmentsPageSize, recentBookings.length - visibleRecentBookings.length)}
            </button>
            <button
              type="button"
              onClick={() => setVisibleCount(recentBookings.length)}
              className="w-full rounded-[18px] bg-[#171717] px-4 py-3 text-sm font-black text-white transition hover:bg-[#D93B8F]"
            >
              Mostra tutti ({recentBookings.length})
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
                      readOnly
                      className="mt-1 h-12 w-full cursor-not-allowed rounded-2xl border border-[#F4D3E2] bg-[#FFF0F6] px-4 text-sm font-black outline-none"
                      placeholder="Importato dal 2° ordine"
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
                  onClick={() => void submitClientControlForm()}
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

      {paymentMethodPrompt.open || paymentMethodNeedsChoice ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-method-title"
            className="w-full max-w-xl overflow-hidden rounded-[28px] border border-[#F1BED8] bg-white shadow-2xl"
          >
            <div className="border-b border-black/5 bg-[#FFF5FA] px-6 py-6 sm:px-8">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#C05282]">
                    Metodo non rilevato
                  </p>
                  <h3 id="payment-method-title" className="mt-2 text-2xl font-black text-[#171717] sm:text-3xl">
                    Come ha pagato la cliente?
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-black/55">
                    Shopify non ha indicato chiaramente il metodo. Scegli quello effettivamente utilizzato per completare il controllo.
                  </p>
                </div>
                {!paymentMethodNeedsChoice ? (
                  <button
                    type="button"
                    onClick={() => setPaymentMethodPrompt({ open: false, gateways: [], resumeSubmit: false })}
                    className="grid size-10 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-black/60 transition hover:bg-black/5 active:scale-95"
                    aria-label="Chiudi scelta metodo pagamento"
                  >
                    <X className="size-5" />
                  </button>
                ) : null}
              </div>
              {(paymentMethodPrompt.gateways.length
                ? paymentMethodPrompt.gateways
                : secondOrderDetails?.paymentGateways || []).length ? (
                <p className="mt-4 rounded-xl border border-[#F1BED8] bg-white px-4 py-3 text-xs font-bold text-black/55">
                  Informazione ricevuta da Shopify: {(paymentMethodPrompt.gateways.length
                    ? paymentMethodPrompt.gateways
                    : secondOrderDetails?.paymentGateways || []).join(", ")}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 p-6 sm:grid-cols-3 sm:p-8">
              {([
                { value: "CARTA" as const, label: "Carta", detail: "POS o carta", icon: CreditCard },
                { value: "SHOPIFY" as const, label: "Shopify", detail: "Pagamento online", icon: ShoppingBag },
                { value: "CONTANTI" as const, label: "Contanti", detail: "Pagamento cash", icon: Coins },
              ]).map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={clientControlSubmitting}
                    onClick={() => {
                      const shouldResumeSubmit = paymentMethodPrompt.resumeSubmit;
                      setManualPaymentMethod(option.value);
                      setPaymentMethodPrompt({ open: false, gateways: [], resumeSubmit: false });
                      if (shouldResumeSubmit) void submitClientControlForm(option.value);
                    }}
                    className="group flex min-h-32 flex-col items-center justify-center rounded-2xl border border-black/10 bg-white px-4 py-5 text-center transition hover:border-[#D96B94] hover:bg-[#FFF5FA] active:scale-[0.98] disabled:opacity-50"
                  >
                    <span className="grid size-11 place-items-center rounded-full bg-[#FCE5F1] text-[#B83D7F] transition group-hover:bg-[#D96B94] group-hover:text-white">
                      <Icon className="size-5" />
                    </span>
                    <span className="mt-3 text-sm font-black text-[#171717]">{option.label}</span>
                    <span className="mt-1 text-[11px] font-bold text-black/45">{option.detail}</span>
                  </button>
                );
              })}
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
                  <div className="mt-4">
                    <ClientControlStaffPicker booking={selectedBooking!} />
                  </div>
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
