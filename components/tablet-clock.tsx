"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Coffee,
  Delete,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Volume2,
  VolumeX,
  X,
  Sun,
  Clock,
  HeartPulse,
  Calendar,
  ChevronDown,
  ChevronUp,
  Coins,
  BarChart3,
  Edit3,
  Check,
  ShoppingBag,
  ChevronRight,
  Mic,
  Camera,
  Trash2
} from "lucide-react";
import type { BrandingTheme } from "@/lib/branding";
import { cn } from "@/lib/utils";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CLIENT_CONTROL_FIELD_IDS } from "@/lib/client-control-form";

const clockActions = [
  { type: "ENTRATA", label: "Entrata", icon: LogIn, dark: true },
  { type: "PAUSA", label: "Pausa", icon: Coffee, dark: false },
  { type: "RIENTRO", label: "Rientro", icon: RefreshCw, dark: false },
  { type: "USCITA", label: "Uscita", icon: LogOut, dark: true },
] as const;

const requestTypes = [
  { value: "FERIE", label: "Ferie" },
  { value: "PERMESSO", label: "Permesso" },
  { value: "RIPOSO", label: "Riposo" },
  { value: "MALATTIA", label: "Malattia" },
];

type ClockStatus = "OUT" | "IN" | "BREAK";
type TabletDevice = { id: string; name: string; locationName: string };
type IdentifiedWorker = {
  id: string;
  name: string;
  status: ClockStatus;
  photoUrl?: string | null;
  role: string;
  mansione: string | null;
  todayShift: any;
};

const statusLabels: Record<ClockStatus, string> = {
  OUT: "Non entrato",
  IN: "In turno",
  BREAK: "In pausa",
};

const allowedActionsByStatus: Record<ClockStatus, string[]> = {
  OUT: ["ENTRATA"],
  IN: ["PAUSA", "USCITA"],
  BREAK: ["RIENTRO", "USCITA"],
};

function compressImage(file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new globalThis.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: "image/jpeg",
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function PinDots({ pin }: { pin: string }) {
  return (
    <div className="grid h-16 grid-cols-6 items-center rounded-[22px] border border-[#eadfd6] bg-white/58 px-8 sm:h-20">
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className={`mx-auto size-4 rounded-full border-2 ${
            pin.length > index ? "border-[#aa7b47] bg-[#aa7b47]" : "border-[#171717]"
          }`}
        />
      ))}
    </div>
  );
}

function Keypad({
  onDigit,
  onBackspace,
  onClear,
  disabled = false,
}: {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const btnClass =
    "h-14 rounded-xl border border-[#eadfd6] bg-white/72 text-xl font-semibold shadow-sm transition active:scale-[0.97] disabled:cursor-wait disabled:opacity-55 sm:h-[62px] touch-manipulation";

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          className={btnClass}
          onClick={() => onDigit(key)}
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        className={cn(btnClass, "grid place-items-center")}
        onClick={onBackspace}
      >
        <Delete className="size-5" />
      </button>
      <button
        type="button"
        disabled={disabled}
        className={btnClass}
        onClick={() => onDigit("0")}
      >
        0
      </button>
      <button
        type="button"
        disabled={disabled}
        className={cn(btnClass, "grid place-items-center")}
        onClick={onClear}
      >
        <X className="size-5" />
      </button>
    </div>
  );
}

type TabletBranding = {
  logo_url: string;
  background_color: string;
  card_color: string;
  text_color: string;
  accent_color: string;
  soft_color: string;
  button_color: string;
};

interface SmoothInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (val: string) => void;
}

function SmoothInput({ value, onChange, ...props }: SmoothInputProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <input
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => onChange(localValue)}
    />
  );
}

interface SmoothTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onChange: (val: string) => void;
}

function SmoothTextarea({ value, onChange, ...props }: SmoothTextareaProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <textarea
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => onChange(localValue)}
    />
  );
}

export function TabletClock({
  device,
  branding,
  tabletBranding,
  clientControlFormId,
  todayAppointments = [],
}: {
  device: TabletDevice | null;
  branding?: BrandingTheme;
  tabletBranding?: TabletBranding | null;
  clientControlFormId: string | null;
  todayAppointments?: any[];
}) {
  const router = useRouter();

  // Completed checkouts local filter
  const [completedAppointments, setCompletedAppointments] = useState<Set<string>>(new Set());
  const activeAppointments = todayAppointments.filter((app) => !completedAppointments.has(app.id));

  const [appointmentsExpanded, setAppointmentsExpanded] = useState(true);
  const [showAllAppointmentsModal, setShowAllAppointmentsModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());
  const [pin, setPin] = useState("");
  const [worker, setWorker] = useState<IdentifiedWorker | null>(null);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [showDashboard, setShowDashboard] = useState(false);
  const [clientControlOpen, setClientControlOpen] = useState(false);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<any | null>(null);
  const [dashboardFrameLoading, setDashboardFrameLoading] = useState(false);
  
  // Analytics and submissions
  const [clientAnalytics, setClientAnalytics] = useState<any | null>(null);
  const [clientAnalyticsLoading, setClientAnalyticsLoading] = useState(false);
  const [activeAnalyticsSalon, setActiveAnalyticsSalon] = useState("Tutti");
  const [appointmentMode, setAppointmentMode] = useState<"create" | "analytics">("analytics");
  const [appointmentForm, setAppointmentForm] = useState({
    salon: device?.locationName ?? "Salone Duomo",
    clientName: "",
    email: "",
    phone: "",
    serviceTitle: "",
    depositPaid: "",
    paid: "",
    staffIds: [] as string[],
    shopifyOrder: "",
    instagramTag: "",
    customNoteText: "", // Shopify Custom Note
    notes: false,
    beforeMedia: false,
    afterMedia: false,
    products: false,
    review: false,
    bookingId: null as string | null,
  });
  const [photoPrimaFronteFile, setPhotoPrimaFronteFile] = useState<File | null>(null);
  const [photoPrimaFrontePreview, setPhotoPrimaFrontePreview] = useState<string | null>(null);
  const [photoPrimaDietroFile, setPhotoPrimaDietroFile] = useState<File | null>(null);
  const [photoPrimaDietroPreview, setPhotoPrimaDietroPreview] = useState<string | null>(null);
  const [photoDopoFronteFile, setPhotoDopoFronteFile] = useState<File | null>(null);
  const [photoDopoFrontePreview, setPhotoDopoFrontePreview] = useState<string | null>(null);
  const [photoDopoDietroFile, setPhotoDopoDietroFile] = useState<File | null>(null);
  const [photoDopoDietroPreview, setPhotoDopoDietroPreview] = useState<string | null>(null);
  const [clientPhotoFile, setClientPhotoFile] = useState<File | null>(null);
  const [clientPhotoPreview, setClientPhotoPreview] = useState<string | null>(null);
  const [appointmentSubmitting, setAppointmentSubmitting] = useState(false);
  const [appointmentMessage, setAppointmentMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeCameraSlot, setActiveCameraSlot] = useState<string | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("environment");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Response details editing
  const [selectedClientResponse, setSelectedClientResponse] = useState<any | null>(null);
  const [clientResponseDraft, setClientResponseDraft] = useState<Record<string, any>>({});
  const [clientResponseLoading, setClientResponseLoading] = useState<string | null>(null);
  const [clientResponseSaving, setClientResponseSaving] = useState(false);

  // Exit conditions
  const [showEarlyExitConfirm, setShowEarlyExitConfirm] = useState(false);
  const [pendingExitMode, setPendingExitMode] = useState<string | null>(null);

  const dashboardFrameRef = useRef<HTMLIFrameElement | null>(null);
  const kioskIdleTimerRef = useRef<any | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);

  // Leave Request form states (from 614 version)
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<AudioContext | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestType, setRequestType] = useState("FERIE");
  const [startDate, setStartDate] = useState("2026-06-10");
  const [endDate, setEndDate] = useState("2026-06-10");
  const [reason, setReason] = useState("");
  const [startHour, setStartHour] = useState("");
  const [startMinute, setStartMinute] = useState("");
  const [endHour, setEndHour] = useState("");
  const [endMinute, setEndMinute] = useState("");
  const [requestMessage, setRequestMessage] = useState("Il PIN gia inserito conferma questa richiesta come firma.");

  const [message, setMessage] = useState("Inserisci il tuo codice personale");

  const visibleActions = worker ? clockActions.filter((action) => allowedActionsByStatus[worker.status].includes(action.type)) : [];

  // Shifts metrics computation
  const workerWorkdayMetrics = useMemo(() => {
    const sortedLogs = [...todayLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let activeStart: number | null = null;
    let activeBreakStart: number | null = null;
    let workMs = 0;
    let breakMs = 0;
    let lastInTime = "";
    let lastBreakTime = "";

    sortedLogs.forEach((log) => {
      const timeMs = new Date(log.timestamp).getTime();
      if (log.type === "ENTRATA" || log.type === "RIENTRO") {
        activeStart = timeMs;
        activeBreakStart = null;
        lastInTime = log.time;
      }
      if (log.type === "PAUSA") {
        if (activeStart !== null) {
          workMs += Math.max(0, timeMs - activeStart);
        }
        activeStart = null;
        activeBreakStart = timeMs;
        lastBreakTime = log.time;
      }
      if (log.type === "USCITA") {
        if (activeStart !== null) {
          workMs += Math.max(0, timeMs - activeStart);
        }
        if (activeBreakStart !== null) {
          breakMs += Math.max(0, timeMs - activeBreakStart);
        }
        activeStart = null;
        activeBreakStart = null;
      }
    });

    if (activeStart !== null) {
      workMs += Math.max(0, now.getTime() - activeStart);
    }
    if (activeBreakStart !== null) {
      breakMs += Math.max(0, now.getTime() - activeBreakStart);
    }

    return {
      workSeconds: Math.floor(workMs / 1000),
      breakSeconds: Math.floor(breakMs / 1000),
      lastEntryTime: lastInTime,
      lastPauseTime: lastBreakTime,
    };
  }, [todayLogs, now]);

  const currentMinutesRome = now.getHours() * 60 + now.getMinutes();
  const targetEndMinutesRome = useMemo(() => {
    if (!worker?.todayShift?.endTime) return null;
    const [h, m] = worker.todayShift.endTime.split(":");
    const hoursNum = Number(h);
    const minsNum = Number(m);
    return Number.isFinite(hoursNum) && Number.isFinite(minsNum) ? hoursNum * 60 + minsNum : null;
  }, [worker]);

  const remainingShiftMinutes = targetEndMinutesRome === null ? 0 : Math.max(0, targetEndMinutesRome - currentMinutesRome);
  const isShiftDurationPending = !!(worker && worker.status !== "OUT" && targetEndMinutesRome !== null && remainingShiftMinutes > 0);

  // Available salons based on employee list or branding
  const salonsList = ["Salone Duomo", "Salone Buenos Aires"];

  // Filtered employees for selected salon
  const filteredEmployeesForSalon = useMemo(() => {
    const selectedSalon = appointmentForm.salon;
    const cleanLocationName = (name: string) =>
      String(name ?? "")
        .toLowerCase()
        .replace(/^salone\s+/, "")
        .replace(/^corso\s+/, "")
        .replace(/\s+/g, " ")
        .trim();

    return (clientAnalytics?.employees ?? []).filter(
      (emp: any) => cleanLocationName(emp.locationName) === cleanLocationName(selectedSalon)
    );
  }, [appointmentForm.salon, clientAnalytics?.employees]);

  // Productivity metrics
  const activeSalonMetrics = useMemo(() => {
    if (!clientAnalytics?.salons?.length) return null;
    if (activeAnalyticsSalon === "Tutti") {
      const mergedStaff = new Map<string, any>();
      let totalResponses = 0;
      clientAnalytics.salons.forEach((salonData: any) => {
        totalResponses += salonData.responses;
        salonData.staff.forEach((staffData: any) => {
          const prev = mergedStaff.get(staffData.name) ?? {
            name: staffData.name,
            services: 0,
            notePhoto: 0,
            products: 0,
            reviews: 0,
            checks: 0,
          };
          prev.services += staffData.services;
          prev.notePhoto += staffData.notePhoto;
          prev.products += staffData.products;
          prev.reviews += staffData.reviews;
          prev.checks += staffData.checks;
          mergedStaff.set(staffData.name, prev);
        });
      });
      return {
        salon: "Tutti i saloni",
        responses: totalResponses,
        staff: Array.from(mergedStaff.values()).sort(
          (a, b) => b.services - a.services || b.checks - a.checks || a.name.localeCompare(b.name)
        ),
      };
    }
    return clientAnalytics.salons.find((s: any) => s.salon === activeAnalyticsSalon) ?? clientAnalytics.salons[0];
  }, [activeAnalyticsSalon, clientAnalytics]);

  const tabletStyle = {
    "--tablet-bg": tabletBranding?.background_color || branding?.background_color || "#fbf7f2",
    "--tablet-card": tabletBranding?.card_color || branding?.card_color || "#ffffff",
    "--tablet-text": tabletBranding?.text_color || branding?.text_color || "#171717",
    "--tablet-accent": tabletBranding?.accent_color || branding?.gradient_color || "#a77a49",
    "--tablet-soft": tabletBranding?.soft_color || branding?.secondary_color || "#f8ddd7",
    "--tablet-dark": tabletBranding?.button_color || branding?.text_color || "#1c1c1c",
  } as CSSProperties;

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1200);
  };

  const fetchAnalytics = () => {
    setClientAnalyticsLoading(true);
    fetch("/api/client-control/analytics", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setClientAnalytics(data);
        setActiveAnalyticsSalon("Tutti");
        const defaultSalon = device?.locationName || data?.salons?.[0]?.salon || "Salone Duomo";
        setAppointmentForm((prev) => ({
          ...prev,
          salon: salonsList.includes(defaultSalon) ? defaultSalon : "Salone Duomo",
        }));
      })
      .catch(() => setClientAnalytics(null))
      .finally(() => setClientAnalyticsLoading(false));
  };

  const loadResponseDetail = async (id: string) => {
    setClientResponseLoading(id);
    try {
      const res = await fetch(`/api/service-forms/responses/${id}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error || "Non riesco ad aprire questa scheda.");
      }
      setSelectedClientResponse(data);
      setClientResponseDraft(data.answers || {});
    } catch (err: any) {
      showFeedback("error", err.message || "Non riesco ad aprire questa scheda.");
      sound("error");
    } finally {
      setClientResponseLoading(null);
    }
  };

  const saveResponseDetail = async () => {
    if (!selectedClientResponse) return;
    setClientResponseSaving(true);
    try {
      const res = await fetch(`/api/service-forms/responses/${selectedClientResponse.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: clientResponseDraft }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error || "Errore durante il salvataggio.");
      }
      setSelectedClientResponse(data);
      setClientResponseDraft(data.answers || {});
      showFeedback("success", "Scheda cliente aggiornata correttamente.");
      sound("success");
      fetchAnalytics();
    } catch (err: any) {
      showFeedback("error", err.message || "Errore durante il salvataggio.");
      sound("error");
    } finally {
      setClientResponseSaving(false);
    }
  };

  const startCamera = async (facing: "user" | "environment" = "environment") => {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      setCameraStream(null);
      await new Promise((resolve) => setTimeout(resolve, 150)); // Wait for hardware to release

      const constraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
    } catch (err) {
      console.error("Failed to start camera with constraints:", err);
      // Fallback
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false
        });
        setCameraStream(stream);
      } catch (err2) {
        console.error("Fallback camera failed:", err2);
        setAppointmentMessage({ type: "error", text: "Impossibile accedere alla fotocamera. Controlla i permessi." });
        setActiveCameraSlot(null);
      }
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setActiveCameraSlot(null);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !activeCameraSlot) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], `${activeCameraSlot}_captured_${Date.now()}.jpg`, { type: "image/jpeg" });
        
        let setFile: any = null;
        let setPreview: any = null;
        let label = "";
        
        if (activeCameraSlot === "prima_fronte") {
          setFile = setPhotoPrimaFronteFile;
          setPreview = setPhotoPrimaFrontePreview;
          label = "Prima Fronte";
        } else if (activeCameraSlot === "prima_dietro") {
          setFile = setPhotoPrimaDietroFile;
          setPreview = setPhotoPrimaDietroPreview;
          label = "Prima Dietro";
        } else if (activeCameraSlot === "dopo_fronte") {
          setFile = setPhotoDopoFronteFile;
          setPreview = setPhotoDopoFrontePreview;
          label = "Dopo Fronte";
        } else if (activeCameraSlot === "dopo_dietro") {
          setFile = setPhotoDopoDietroFile;
          setPreview = setPhotoDopoDietroPreview;
          label = "Dopo Dietro";
        }
        
        if (setFile && setPreview) {
          try {
            setAppointmentMessage({ type: "success", text: `Elaborazione ${label}...` });
            const compressed = await compressImage(file, 2048, 2048, 0.9);
            setFile(compressed);
            setPreview(URL.createObjectURL(compressed));
            setAppointmentMessage(null);
          } catch (e) {
            console.error("Failed to compress captured photo:", e);
            setAppointmentMessage({ type: "error", text: "Elaborazione foto fallita." });
          }
        }
      }
      stopCamera();
    }, "image/jpeg", 0.95);
  };

  const submitAppointment = async () => {
    setAppointmentMessage(null);
    if (!appointmentForm.salon || !appointmentForm.clientName.trim() || !appointmentForm.shopifyOrder.trim() || appointmentForm.staffIds.length === 0) {
      setAppointmentMessage({ type: "error", text: "Completa tutti i campi obbligatori: sede, nome cliente, ordine Shopify e collaboratore." });
      sound("error");
      return;
    }
    setAppointmentSubmitting(true);
    try {
      let photoPrimaFronteBase64: string | null = null;
      if (photoPrimaFronteFile) {
        photoPrimaFronteBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(photoPrimaFronteFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
        });
      }

      let photoPrimaDietroBase64: string | null = null;
      if (photoPrimaDietroFile) {
        photoPrimaDietroBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(photoPrimaDietroFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
        });
      }

      let photoDopoFronteBase64: string | null = null;
      if (photoDopoFronteFile) {
        photoDopoFronteBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(photoDopoFronteFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
        });
      }

      let photoDopoDietroBase64: string | null = null;
      if (photoDopoDietroFile) {
        photoDopoDietroBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(photoDopoDietroFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
        });
      }

      let clientPhotoBase64: string | null = null;
      if (clientPhotoFile) {
        clientPhotoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(clientPhotoFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
        });
      }

      const payload = {
        ...appointmentForm,
        clientPhoto: clientPhotoBase64,
        photoPrimaFronte: photoPrimaFronteBase64,
        photoPrimaDietro: photoPrimaDietroBase64,
        photoDopoFronte: photoDopoFronteBase64,
        photoDopoDietro: photoDopoDietroBase64,
      };

      const res = await fetch("/api/client-control/tablet-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Errore durante il salvataggio.");
      }
      
      setPhotoPrimaFronteFile(null);
      if (photoPrimaFrontePreview) {
        URL.revokeObjectURL(photoPrimaFrontePreview);
        setPhotoPrimaFrontePreview(null);
      }
      setPhotoPrimaDietroFile(null);
      if (photoPrimaDietroPreview) {
        URL.revokeObjectURL(photoPrimaDietroPreview);
        setPhotoPrimaDietroPreview(null);
      }
      setPhotoDopoFronteFile(null);
      if (photoDopoFrontePreview) {
        URL.revokeObjectURL(photoDopoFrontePreview);
        setPhotoDopoFrontePreview(null);
      }
      setPhotoDopoDietroFile(null);
      if (photoDopoDietroPreview) {
        URL.revokeObjectURL(photoDopoDietroPreview);
        setPhotoDopoDietroPreview(null);
      }
      setClientPhotoFile(null);
      if (clientPhotoPreview) {
        URL.revokeObjectURL(clientPhotoPreview);
        setClientPhotoPreview(null);
      }
      // Auto-filter from appointments tray list if pre-filled from drawer or direct list buttons
      if (selectedBookingForDetails) {
        setCompletedAppointments((prev) => {
          const next = new Set(prev);
          next.add(selectedBookingForDetails.id);
          return next;
        });
      }
      if (currentBookingId) {
        setCompletedAppointments((prev) => {
          const next = new Set(prev);
          next.add(currentBookingId);
          return next;
        });
      }

      showFeedback("success", "Scheda controllo salvata ed eliminata dalla lista.");
      router.refresh();
      setClientControlOpen(false);
      setSelectedBookingForDetails(null);
      setCurrentBookingId(null);

      setAppointmentForm((prev) => ({
        ...prev,
        clientName: "",
        email: "",
        phone: "",
        serviceTitle: "",
        depositPaid: "",
        paid: "",
        staffIds: [],
        shopifyOrder: "",
        instagramTag: "",
        customNoteText: "", // Clear note text field
        notes: false,
        beforeMedia: false,
        afterMedia: false,
        products: false,
        review: false,
        bookingId: null,
      }));
      fetchAnalytics();
    } catch (err: any) {
      setAppointmentMessage({ type: "error", text: err.message || "Errore durante il salvataggio." });
      sound("error");
    } finally {
      setAppointmentSubmitting(false);
    }
  };

  const toggleSpeechRecognition = () => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setAppointmentMessage({ type: "error", text: "La registrazione vocale non è supportata da questo browser. Usa Safari o Chrome." });
      sound("error");
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "it-IT";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRecording(true);
      sound("tap");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAppointmentForm((prev) => ({
        ...prev,
        customNoteText: prev.customNoteText
          ? `${prev.customNoteText.trim()} ${transcript}`
          : transcript,
      }));
      sound("success");
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
      if (event.error !== "no-speech") {
        setAppointmentMessage({ type: "error", text: `Errore trascrizione vocale: ${event.error}` });
        sound("error");
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  function sound(kind: "tap" | "success" | "error", force = false) {
    if (!soundEnabled && !force) return;
    const AudioContextClass = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioRef.current ?? new AudioContextClass();
    audioRef.current = context;
    const play = () => {
      const notes: Array<[number, number, number, OscillatorType, number]> = kind === "tap"
        ? [[620, 0, 0.055, "sine", 0.35]]
        : kind === "success"
          ? [
              [523, 0, 0.14, "sine", 0.75],
              [659, 0.13, 0.18, "sine", 0.85],
              [880, 0.32, 0.24, "triangle", 0.95],
            ]
          : [
              [260, 0, 0.18, "triangle", 0.9],
              [196, 0.19, 0.22, "sine", 0.95],
            ];
      notes.forEach(([frequency, delay, duration, wave, volume]) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const filter = context.createBiquadFilter();
        
        oscillator.type = wave;
        oscillator.frequency.value = frequency;
        filter.type = "lowpass";
        filter.frequency.value = 3200;
        
        gain.gain.setValueAtTime(1e-4, context.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(1e-4, context.currentTime + delay + duration);
        
        oscillator.connect(filter).connect(gain).connect(context.destination);
        oscillator.start(context.currentTime + delay);
        oscillator.stop(context.currentTime + delay + duration + 0.03);
      });
    };
    if (context.state === "suspended") {
      void context.resume().then(play);
    } else {
      play();
    }
  }

  function showFeedback(type: "success" | "error" | "info", text: string) {
    setFeedback({ type, text });
    if (type === "success") navigator.vibrate?.([70, 35, 70]);
    if (type === "error") navigator.vibrate?.([180, 60, 180, 60, 180]);
  }

  async function identifyPin(pinToRead = pin) {
    if (!/^\d{4,6}$/.test(pinToRead) || !device || identifying) return;
    setIdentifying(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3000);
    try {
      setMessage("Riconoscimento in corso...");
      const response = await fetch("/api/attendance/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": device.id },
        body: JSON.stringify({ pin: pinToRead }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        setWorker(null);
        setMessage(data.error ?? "Codice personale non riconosciuto.");
        showFeedback("error", data.error ?? "Codice personale non riconosciuto.");
        sound("error");
        return;
      }
      setWorker({
        id: data.employeeId,
        name: data.employeeName,
        status: data.status as ClockStatus,
        photoUrl: data.employeePhotoUrl,
        role: data.employeeRole,
        mansione: data.employeeMansione || null,
        todayShift: data.todayShift ?? null,
      });
      setTodayLogs(Array.isArray(data.todayLogs) ? data.todayLogs : []);
      setMessage(`${data.employeeName}: ${statusLabels[data.status as ClockStatus]}`);
      showFeedback("success", `${data.employeeName} riconosciuta. Scegli l'azione.`);
      sound("success");
    } catch (error: unknown) {
      const timeoutError = error instanceof DOMException && error.name === "AbortError";
      setMessage(timeoutError ? "Lettura lenta. Riprova il PIN." : "Impossibile verificare il codice.");
      showFeedback("error", timeoutError ? "Lettura oltre 3 secondi. Riprova." : "Impossibile verificare il codice.");
      sound("error");
    } finally {
      window.clearTimeout(timeout);
      setIdentifying(false);
    }
  }

  function updatePin(next: string) {
    const cleaned = next.replace(/\D/g, "").slice(0, 6);
    if (cleaned !== pin) sound("tap");
    setPin(cleaned);
    setWorker(null);
    setFeedback(null);
    setMessage(
      cleaned.length < 4
        ? "Inserisci il tuo codice personale"
        : cleaned.length === 6
          ? "Riconoscimento automatico..."
          : "Premi Invia PIN per continuare"
    );
  }

  async function clock(type: string, bypassEarlyExitCheck = false) {
    if (!worker || !/^\d{4,6}$/.test(pin) || !device) return;
    
    if (type === "USCITA" && isShiftDurationPending && !bypassEarlyExitCheck) {
      setPendingExitMode("clock");
      setShowEarlyExitConfirm(true);
      return;
    }

    setLoading(type);
    try {
      const response = await fetch("/api/attendance/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": device.id },
        body: JSON.stringify({ employeeId: worker.id, pin, type, note: "Timbratura tablet" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Timbratura non registrata.");
        showFeedback("error", data.error ?? "Timbratura non registrata.");
        sound("error");
        return;
      }
      setTodayLogs((prev) => [
        ...prev,
        {
          id: data.id,
          type: data.type,
          timestamp: data.timestamp ?? new Date().toISOString(),
          time: data.time,
        },
      ]);
      const feedbackText = `${type} registrata alle ${data.time}${data.adjusted ? ` (ora rilevata ${data.actualTime})` : ""}.`;
      sound("success");
      showFeedback("success", feedbackText);
      setMessage(feedbackText);
      setWorker(null);
      setPin("");
    } catch {
      setMessage("Connessione non disponibile. Timbratura non registrata.");
      showFeedback("error", "Connessione non disponibile. Timbratura non registrata.");
      sound("error");
    } finally {
      setLoading(null);
    }
  }

  async function goToDashboard() {
    if (!worker || !/^\d{4,6}$/.test(pin) || !device) return;
    setLoading("DASHBOARD");
    try {
      const response = await signIn("credentials", {
        pin,
        redirect: false,
      });
      if (response?.error) {
        showFeedback("error", "Impossibile accedere alla dashboard.");
        sound("error");
        return;
      }
      sound("success");
      setDashboardFrameLoading(true);
      setShowDashboard(true);
    } catch {
      showFeedback("error", "Errore durante l'accesso.");
      sound("error");
    } finally {
      setLoading(null);
    }
  }

  async function openClientControl(mode: "create" | "analytics" = "analytics") {
    if (!device || !clientControlFormId) return;
    setLoading("CLIENT_CONTROL");
    try {
      sound("success");
      setAppointmentMode(mode);
      setAppointmentMessage(null);
      setClientControlOpen(true);
      fetchAnalytics();
    } catch {
      showFeedback("error", "Errore durante l'apertura del controllo cliente.");
      sound("error");
    } finally {
      setLoading(null);
    }
  }

  async function prefillFromBooking(booking: any) {
    if (!device || !clientControlFormId) return;
    setLoading("CLIENT_CONTROL");
    try {
      sound("success");
      setAppointmentMode("create");
      setAppointmentMessage(null);
      setCurrentBookingId(booking.id);

      let employees = clientAnalytics?.employees;
      let analyticsData = clientAnalytics;
      if (!analyticsData) {
        const res = await fetch("/api/client-control/analytics", { cache: "no-store" });
        if (res.ok) {
          analyticsData = await res.json();
          setClientAnalytics(analyticsData);
          employees = analyticsData?.employees;
          setActiveAnalyticsSalon("Tutti");
        }
      }

      // Map inferred salon key to Sede options list
      const mappedSalon = salonsList.find((salonName) => {
        const lower = salonName.toLowerCase();
        if (booking.inferredSalon === "duomo") return lower.includes("duomo");
        if (booking.inferredSalon === "buenos-aires") return lower.includes("buenos");
        return false;
      }) || device?.locationName || "Salone Duomo";

      const staffIds: string[] = [];
      if (booking.teammates && booking.teammates.length > 0 && employees) {
        const cleanString = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        for (const mate of booking.teammates) {
          const mateClean = cleanString(mate.name);
          const matched = employees.find((emp: any) => {
            const empClean = cleanString(emp.name);
            return empClean.includes(mateClean) || mateClean.includes(empClean);
          });
          if (matched) staffIds.push(matched.id);
        }
      }

      setAppointmentForm({
        salon: salonsList.includes(mappedSalon) ? mappedSalon : "Salone Duomo",
        clientName: booking.customerName || "",
        email: booking.customerEmail || "",
        phone: booking.customerPhone || "",
        serviceTitle: booking.serviceTitle || "",
        depositPaid: booking.priceAmount != null ? String(booking.priceAmount) : "",
        paid: "",
        staffIds,
        shopifyOrder: booking.isManual ? "" : (booking.bookingStr ? booking.bookingStr.replace(/^#/, "") : ""),
        instagramTag: "",
        customNoteText: "",
        notes: false,
        beforeMedia: false,
        afterMedia: false,
        products: false,
        review: false,
        bookingId: booking.id,
      });

      setClientControlOpen(true);
    } catch (err) {
      console.error("Error pre-filling booking:", err);
      showFeedback("error", "Errore durante l'apertura del controllo cliente.");
      sound("error");
    } finally {
      setLoading(null);
    }
  }

  async function handleKioskLogout(bypassEarlyExitCheck = false) {
    setLoading(bypassEarlyExitCheck ? "FINAL_SHIFT" : "LOGOUT");
    try {
      if (bypassEarlyExitCheck && worker && worker.status !== "OUT" && /^\d{4,6}$/.test(pin) && device) {
        const response = await fetch("/api/attendance/clock", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-device-id": device.id },
          body: JSON.stringify({ employeeId: worker.id, pin, type: "USCITA", note: "Fine turno da dashboard tablet" }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok && response.status !== 409) {
          showFeedback("error", data.error ?? "Fine turno non registrata.");
          setMessage(data.error ?? "Fine turno non registrata.");
          sound("error");
          return;
        }
        if (response.ok) {
          setTodayLogs((prev) => [
            ...prev,
            {
              id: data.id,
              type: data.type,
              timestamp: data.timestamp ?? new Date().toISOString(),
              time: data.time,
            },
          ]);
          sound("success");
        }
      }

      await signOut({ redirect: false });
      setWorker(null);
      setTodayLogs([]);
      setPin("");
      setFeedback(null);
      setMessage("Inserisci il tuo codice personale");
      setShowDashboard(false);
      setClientControlOpen(false);
      setShowEarlyExitConfirm(false);
      setPendingExitMode(null);
    } catch (error) {
      console.error("Errore durante il logout:", error);
    } finally {
      setLoading(null);
    }
  }

  // Keyboard hooks
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Refresh page data (bookings, etc.) every 10 minutes
  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      router.refresh();
    }, 10 * 60 * 1000);
    return () => window.clearInterval(refreshTimer);
  }, [router]);

  useEffect(() => {
    if (pin.length === 6 && device) void identifyPin(pin);
  }, [pin, device]);

  useEffect(() => {
    if (!worker && !requestOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }

        if (e.key >= "0" && e.key <= "9") {
          e.preventDefault();
          if (pin.length < 6) updatePin(pin + e.key);
        } else if (e.key === "Backspace") {
          e.preventDefault();
          updatePin(pin.slice(0, -1));
        } else if (e.key === "Escape") {
          e.preventDefault();
          updatePin("");
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (/^\d{4,6}$/.test(pin)) void identifyPin(pin);
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [worker, requestOpen, pin, device, identifying]);

  // Privacy timeout (closes identified worker screen after 30s)
  useEffect(() => {
    if (!worker || requestOpen) return;
    const privacyTimer = window.setTimeout(() => {
      setWorker(null);
      setPin("");
      setMessage("Inserisci il tuo codice personale");
      setFeedback(null);
    }, 30000);
    return () => window.clearTimeout(privacyTimer);
  }, [worker, requestOpen]);

  // Kiosk Inactive Auto Logout timer
  useEffect(() => {
    if (!showDashboard && !clientControlOpen) return;

    const resetIdleTimer = () => {
      if (kioskIdleTimerRef.current) window.clearTimeout(kioskIdleTimerRef.current);
      kioskIdleTimerRef.current = window.setTimeout(() => {
        handleKioskLogout();
      }, 60000); // 1 minute of inactivity triggers auto-logout
    };

    const activityEvents = ["pointerdown", "touchstart", "keydown", "wheel"];
    activityEvents.forEach((evName) => window.addEventListener(evName, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    // Track interactions in iframe if dashboard is active
    const frameWin = dashboardFrameRef.current?.contentWindow;
    const frameDoc = dashboardFrameRef.current?.contentDocument;
    activityEvents.forEach((evName) => {
      frameWin?.addEventListener(evName, resetIdleTimer, { passive: true });
      frameDoc?.addEventListener(evName, resetIdleTimer, { passive: true });
    });

    return () => {
      if (kioskIdleTimerRef.current) window.clearTimeout(kioskIdleTimerRef.current);
      activityEvents.forEach((evName) => window.removeEventListener(evName, resetIdleTimer));
      activityEvents.forEach((evName) => {
        frameWin?.removeEventListener(evName, resetIdleTimer);
        frameDoc?.removeEventListener(evName, resetIdleTimer);
      });
    };
  }, [showDashboard, clientControlOpen]);

  // Leave requests submission (from 614 version)
  async function sendLeaveRequest() {
    if (!worker || !device) return;
    setRequestMessage("Invio richiesta in corso...");
    const finalStartTime = startHour ? `${startHour}:${startMinute || "00"}` : "";
    const finalEndTime = endHour ? `${endHour}:${endMinute || "00"}` : "";
    try {
      const response = await fetch("/api/tablet-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": device.id },
        body: JSON.stringify({
          pin,
          type: requestType,
          startDate,
          endDate,
          reason,
          startTime: finalStartTime,
          endTime: finalEndTime,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRequestMessage(data.error ?? "Richiesta non inviata.");
        showFeedback("error", data.error ?? "Richiesta non inviata.");
        sound("error");
        return;
      }
      setRequestOpen(false);
      setReason("");
      setStartHour("");
      setStartMinute("");
      setEndHour("");
      setEndMinute("");
      sound("success");
      showFeedback("success", "Richiesta inviata e firmata con codice personale.");
      setMessage("Richiesta inviata e firmata con codice personale.");
      setWorker(null);
      setPin("");
    } catch {
      setRequestMessage("Connessione non disponibile. Richiesta non inviata.");
      showFeedback("error", "Connessione non disponibile. Richiesta non inviata.");
      sound("error");
    }
  }

  if (!device) {
    return (
      <main
        className="grid min-h-screen place-items-center bg-[color:var(--tablet-bg)] p-5 text-[color:var(--tablet-text)]"
        style={tabletStyle}
      >
        <div className="rounded-[28px] border border-[#eadfd6] bg-white/80 px-10 py-12 text-center shadow-lg">
          <ShieldCheck className="mx-auto size-12 text-red-500" />
          <p className="mt-5 text-xl font-semibold">Dispositivo non autorizzato alla timbratura</p>
        </div>
      </main>
    );
  }

  // Action button rendering helper
  function ActionCard({ action }: { action: (typeof clockActions)[number] }) {
    const Icon = action.icon;
    return (
      <button
        className={cn(
          "flex min-h-20 md:min-h-28 landscape:min-h-[105px] lg:min-h-[130px] flex-col items-center justify-center rounded-2xl border border-black/10 px-4 shadow-[0_12px_36px_rgba(0,0,0,0.10)] active:scale-[0.99] transition-transform duration-150",
          action.dark ? "bg-[color:var(--tablet-dark)] text-white" : "bg-[color:var(--tablet-card)]/72 text-[color:var(--tablet-text)]"
        )}
        disabled={loading !== null}
        onClick={() => clock(action.type)}
      >
        <Icon className="size-7 md:size-9 landscape:size-8 lg:size-12 text-[color:var(--tablet-accent)]" strokeWidth={1.4} />
        <p className="mt-2 text-xs md:text-sm uppercase tracking-[0.25em] landscape:mt-3 lg:text-base">
          {loading === action.type ? "Invio..." : action.label}
        </p>
      </button>
    );
  }

  // Large header Clock helper
  function KioskHeaderClock({ compact = false }: { compact?: boolean }) {
    const logoUrl = tabletBranding?.logo_url || branding?.logo_url || null;
    return (
      <div className="text-center">
        <div className={cn("mx-auto grid place-items-center overflow-hidden", compact ? "size-16 lg:size-20" : "size-36 lg:size-44")}>
          {logoUrl ? (
            <img src={logoUrl} alt="Paradise Beauty" className="size-full object-contain" />
          ) : (
            <p className={cn("font-serif italic leading-none text-[color:var(--tablet-accent)]", compact ? "text-5xl" : "text-[140px]")}>
              P
            </p>
          )}
        </div>
        <p className={cn("font-serif leading-none tracking-tight", compact ? "mt-1 text-5xl lg:text-6xl" : "mt-2 text-7xl lg:text-[112px]")}>
          {new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(now)}
        </p>
        <p className={cn("text-black/62", compact ? "mt-1 text-xs" : "mt-2 text-base lg:text-lg")}>
          {new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(now)}
        </p>
      </div>
    );
  }

  // Early Shift Logout Alert Confirm Dialog
  const earlyExitConfirmDialog =
    showEarlyExitConfirm && !showDashboard ? (
      <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
        <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] border border-black/10">
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600">
              <TriangleAlert className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#C661A0]">Conferma uscita</p>
              <h3 className="mt-1 text-2xl font-black text-[#171717]">Manca ancora tempo al turno</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-black/60">
                A <span className="font-black text-[#171717]">{worker?.name}</span> mancano ancora{" "}
                <span className="font-black text-red-600">{formatDuration(remainingShiftMinutes * 60)}</span> per completare il turno previsto
                {worker?.todayShift?.endTime ? (
                  <> fino alle <span className="font-black text-[#171717]">{worker.todayShift.endTime.slice(0, 5)}</span></>
                ) : null}.
              </p>
              {worker?.todayShift?.startTime || worker?.todayShift?.plannedHours ? (
                <p className="mt-2 text-xs font-bold text-black/45">
                  Turno previsto: {worker.todayShift?.startTime?.slice(0, 5) || "--:--"} - {worker.todayShift?.endTime?.slice(0, 5) || "--:--"} · {
                    (() => {
                      const hours = worker.todayShift?.plannedHours ?? 0;
                      if (!Number.isFinite(hours) || hours <= 0) return "0h";
                      const hrVal = Math.floor(hours);
                      const minVal = Math.round((hours - hrVal) * 60);
                      return minVal === 0 ? `${hrVal}h` : `${hrVal}h ${minVal}m`;
                    })()
                  }
                </p>
              ) : null}
              <p className="mt-3 text-sm font-semibold text-black/70">Sei sicura di voler timbrare l'uscita adesso?</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setShowEarlyExitConfirm(false);
                setPendingExitMode(null);
              }}
              className="rounded-2xl bg-black/[0.05] px-5 py-3 text-sm font-black text-black/65 active:scale-95 transition"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEarlyExitConfirm(false);
                if (pendingExitMode === "clock") {
                  void clock("USCITA", true);
                } else {
                  void handleKioskLogout(true);
                }
              }}
              className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-600/20 active:scale-95 transition"
            >
              Conferma uscita
            </button>
          </div>
        </div>
      </div>
    ) : null;

  // Render private dashboard view
  if (showDashboard) {
    return (
      <main className="h-[100svh] overflow-hidden bg-[color:var(--tablet-bg)] p-2 text-[color:var(--tablet-text)] sm:p-4" style={tabletStyle}>
        <div className="relative flex h-[calc(100svh-1rem)] sm:h-[calc(100svh-2rem)] flex-col rounded-[26px] border-[10px] border-black bg-[color:var(--tablet-card)] shadow-[0_20px_70px_rgba(0,0,0,0.2)] xl:border-[16px] overflow-hidden">
          {/* Dashboard Private Area Header */}
          <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 bg-[color:var(--tablet-card)] shadow-sm">
            <div className="flex items-center gap-3">
              {worker?.photoUrl ? (
                <div className="relative size-10 overflow-hidden rounded-full border-2 border-[color:var(--tablet-accent)] shadow-sm">
                  <img src={worker.photoUrl} alt="" className="size-full object-cover" />
                </div>
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full border-2 border-[color:var(--tablet-accent)] bg-[color:var(--tablet-soft)] text-sm font-black uppercase tracking-wider text-[color:var(--tablet-accent)] shadow-sm">
                  {worker?.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--tablet-accent)]">Area Riservata</p>
                <p className="text-sm font-bold tracking-tight text-[color:var(--tablet-text)]">{worker?.name}</p>
              </div>
            </div>
            
            <button
              className="flex h-11 items-center gap-2 rounded-xl bg-red-600 px-5 text-xs font-bold uppercase tracking-[0.15em] text-white shadow-md shadow-red-600/10 hover:bg-red-700 active:scale-[0.98] transition-all duration-200"
              onClick={() => {
                if (worker && worker.status !== "OUT" && isShiftDurationPending) {
                  setPendingExitMode("dashboard");
                  setShowEarlyExitConfirm(true);
                } else {
                  void handleKioskLogout(true);
                }
              }}
              disabled={loading === "LOGOUT" || loading === "FINAL_SHIFT"}
              children={
                <>
                  <LogOut className="size-4" />
                  <span>{loading === "FINAL_SHIFT" ? "Fine turno..." : loading === "LOGOUT" ? "Uscita..." : "Esci"}</span>
                </>
              }
            />
          </div>

          <div className="flex-1 w-full bg-[#fbf7f2] relative">
            {dashboardFrameLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#fbf7f2] z-50">
                <div className="text-center">
                  <div className="mx-auto size-12 border-4 border-[color:var(--tablet-accent)] border-t-transparent rounded-full animate-spin" />
                  <p className="mt-4 text-sm font-semibold text-black/60 uppercase tracking-widest">Caricamento Dashboard...</p>
                </div>
              </div>
            )}
            <iframe
              id="kiosk-dashboard-iframe"
              ref={dashboardFrameRef}
              title="Profilo privato"
              src="/dashboard"
              className="size-full border-0"
              onLoad={() => setDashboardFrameLoading(false)}
            />
          </div>
        </div>
        {earlyExitConfirmDialog}
      </main>
    );
  }

  // Render Kiosk clock/app screen
  return (
    <main className="h-[100svh] overflow-hidden bg-[color:var(--tablet-bg)] p-2 text-[color:var(--tablet-text)] sm:p-4" style={tabletStyle}>
      <div className="relative flex h-[calc(100svh-1rem)] sm:h-[calc(100svh-2rem)] flex-col overflow-hidden rounded-[26px] border-[10px] border-black bg-[color:var(--tablet-card)] px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.2)] sm:px-7 sm:py-6 xl:border-[16px]">
        
        {/* header info bar */}
        <header className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-black/10 bg-[color:var(--tablet-card)]/70">
              <MapPin className="size-4 text-[color:var(--tablet-accent)]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] sm:text-sm">{device.locationName}</p>
              <p className="text-xs text-black/60 sm:text-sm">{device.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {clientControlFormId && (
              <button
                type="button"
                aria-label="Appuntamenti"
                className="flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-[color:var(--tablet-card)]/78 px-3 text-xs font-bold uppercase text-[color:var(--tablet-accent)] shadow-sm active:scale-95 hover:bg-black/[0.01]"
                onClick={() => void openClientControl("create")}
                disabled={loading === "CLIENT_CONTROL"}
              >
                <Calendar className="size-5" />
                <span className="hidden sm:inline">{loading === "CLIENT_CONTROL" ? "Apro..." : "Crea appuntamenti"}</span>
              </button>
            )}

            <button
              aria-label={soundEnabled ? "Suono attivo" : "Suono disattivato"}
              className="flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-[color:var(--tablet-card)]/78 px-3 text-xs font-bold uppercase text-[color:var(--tablet-accent)] shadow-sm active:scale-95 hover:bg-black/[0.01]"
              onClick={() => {
                const nState = !soundEnabled;
                setSoundEnabled(nState);
                window.localStorage.setItem("paradise-tablet-sound", nState ? "on" : "off");
                if (nState) sound("success", true);
              }}
            >
              {soundEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
              <span className="hidden sm:inline">{soundEnabled ? "Suono" : "Muto"}</span>
            </button>

            <div className="flex items-center gap-1 rounded-xl border border-black/10 bg-[color:var(--tablet-card)]/78 px-3 py-2 text-xs font-bold uppercase text-emerald-600 sm:text-sm shadow-sm">
              <ShieldCheck className="size-4" />
              <span>Autorizzato</span>
            </div>
          </div>
        </header>

        {/* Worker identified detail or Kiosk main keypad */}
        {worker ? (
          <section className="relative z-10 mx-auto grid min-h-0 w-full max-w-[1250px] flex-1 items-center gap-4 overflow-hidden py-2 md:grid-cols-[minmax(320px,1fr)_300px] landscape:grid-cols-[minmax(320px,1fr)_300px] lg:grid-cols-[minmax(460px,1fr)_340px]">
            {/* Shifts Action buttons */}
            <div className="grid min-h-0 grid-cols-2 gap-3">
              <div className="col-span-2 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Tempo in turno</p>
                    <Clock className="size-5 text-emerald-500" />
                  </div>
                  <p className="mt-1 text-2xl font-black tabular-nums lg:text-3xl">{formatDuration(workerWorkdayMetrics.workSeconds)}</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    {workerWorkdayMetrics.lastEntryTime ? `Ultima entrata/rientro ${workerWorkdayMetrics.lastEntryTime}` : "Nessuna entrata oggi"}
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Pausa oggi</p>
                    <Coffee className="size-5 text-amber-500" />
                  </div>
                  <p className="mt-1 text-2xl font-black tabular-nums lg:text-3xl">{formatDuration(workerWorkdayMetrics.breakSeconds)}</p>
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    {workerWorkdayMetrics.lastPauseTime ? `Ultima pausa ${workerWorkdayMetrics.lastPauseTime}` : "Nessuna pausa timbrata"}
                  </p>
                </div>
              </div>

              {visibleActions.map((action) => (
                <ActionCard key={action.type} action={action} />
              ))}

              <div className="col-span-2 flex min-h-16 md:min-h-20 items-center justify-between rounded-2xl border border-black/10 bg-[color:var(--tablet-card)]/58 px-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--tablet-accent)]">Stato turno</p>
                <p className="text-base md:text-xl font-semibold">{statusLabels[worker.status]}</p>
              </div>
            </div>

            {/* Profile status column */}
            <div className="flex min-h-0 flex-col justify-center">
              <KioskHeaderClock compact />
              
              {feedback && (
                <div className={cn(
                  "mt-3 flex min-h-10 items-center justify-center gap-3 rounded-2xl border px-3 text-xs font-bold shadow-sm",
                  feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
                )}>
                  {feedback.type === "success" ? <CheckCircle2 className="size-5" /> : <TriangleAlert className="size-5" />}
                  <span>{feedback.text}</span>
                </div>
              )}

              <div className="mt-3 flex flex-col items-center">
                {worker.photoUrl ? (
                  <div className="relative size-16 overflow-hidden rounded-full border-4 border-[color:var(--tablet-accent)] shadow-md lg:size-20">
                    <img src={worker.photoUrl} alt={worker.name} className="size-full object-cover" />
                  </div>
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-full border-4 border-[color:var(--tablet-accent)] bg-[color:var(--tablet-soft)] text-xl font-black uppercase tracking-wider text-[color:var(--tablet-accent)] shadow-md lg:size-20">
                    {worker.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                  </div>
                )}
              </div>
              
              <p className="mt-2 truncate text-center text-base font-semibold">{worker.name}</p>

              <button
                className="mt-2 flex h-12 w-full items-center justify-between rounded-2xl bg-[color:var(--tablet-soft)] px-4 text-left shadow-sm transition-transform duration-200 active:scale-[0.98] border border-black/5"
                onClick={goToDashboard}
                disabled={loading !== null}
              >
                <div className="flex items-center gap-3">
                  <UserRound className="size-5 text-[color:var(--tablet-accent)]" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--tablet-text)]">Vedi Dashboard</p>
                    <p className="text-[11px] text-black/55">Profilo privato</p>
                  </div>
                </div>
                <ChevronRight className="size-5 text-[color:var(--tablet-accent)]" />
              </button>

              <button
                className="mt-2 h-9 w-full rounded-xl border border-black/10 bg-white/60 text-sm font-semibold hover:bg-white active:scale-95 transition"
                onClick={() => {
                  setWorker(null);
                  setPin("");
                  setFeedback(null);
                  setMessage("Inserisci il tuo codice personale");
                }}
              >
                Cambia lavoratore
              </button>
            </div>
          </section>
        ) : (
          /* Normal Pin Entry View */
          <div className={cn(
            "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden py-2",
            appointmentsExpanded ? "mb-0" : "mb-2"
          )}>
            <div className={cn(
              "mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-6 md:grid-cols-[440px_1fr] landscape:grid-cols-[440px_1fr] transition-all duration-300",
              appointmentsExpanded ? "opacity-90 scale-[0.98] py-1" : "py-4"
            )}>
              <div className="mx-auto w-full max-w-[440px]">
                <p className="mb-2 text-center text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--tablet-accent)]">Codice personale</p>
                <PinDots pin={pin} />
                <p className="my-2 text-center text-sm font-semibold text-black/55">
                  {identifying ? "Riconoscimento..." : pin.length === 6 ? "Lettura automatica in corso..." : "Inserisci il PIN e premi Invia."}
                </p>
                <Keypad
                  onDigit={(digit) => {
                    if (identifying) return;
                    const next = pin.length < 6 ? `${pin}${digit}` : pin;
                    updatePin(next);
                  }}
                  onBackspace={() => {
                    if (identifying) return;
                    updatePin(pin.slice(0, -1));
                  }}
                  onClear={() => {
                    if (identifying) return;
                    updatePin("");
                  }}
                  disabled={identifying}
                />
                
                <button
                  className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--tablet-dark)] text-sm font-bold uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-90 active:scale-95 transition"
                  disabled={!/^\d{4,6}$/.test(pin) || identifying}
                  onClick={() => void identifyPin()}
                >
                  <LogIn className="size-4 text-[color:var(--tablet-accent)]" />
                  <span>{identifying ? "Lettura..." : "Invia PIN"}</span>
                </button>
              </div>

              {/* Header Clock block */}
              <div className="hidden md:block landscape:block">
                <KioskHeaderClock />
                <div className="mx-auto mt-5 h-12 max-w-[460px]">
                  {feedback && (
                    <div className={cn(
                      "flex h-12 items-center justify-center gap-3 rounded-2xl border px-4 text-sm font-bold shadow-sm",
                      feedback.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-[#eadfd6] bg-white/70 text-black/70"
                    )}>
                      {feedback.type === "error" ? <TriangleAlert className="size-5" /> : <CheckCircle2 className="size-5" />}
                      <span className="truncate">{feedback.text}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom expandable tray showing appointments list */}
            <div className={cn(
              "relative mt-auto w-full rounded-[24px] border border-[#ff8bb2]/20 bg-white shadow-lg transition-all duration-300 flex flex-col",
              appointmentsExpanded ? "max-h-[50vh] sm:max-h-[42vh]" : "max-h-[52px]"
            )}>
              {/* Slider Toggle button */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAppointmentsExpanded(!appointmentsExpanded)}
                  className="flex h-7 items-center justify-center gap-1 rounded-full border border-[#ff8bb2]/30 bg-white px-4 text-[10px] font-black uppercase tracking-wider text-[#a74758] shadow-md hover:bg-[#fff2fa] transition-colors"
                >
                  {appointmentsExpanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
                  {appointmentsExpanded ? "Riduci" : "Mostra appuntamento"}
                </button>
                {activeAppointments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllAppointmentsModal(true)}
                    className="flex h-7 items-center justify-center gap-1.5 rounded-full border border-[#ff8bb2]/35 bg-gradient-to-r from-[#ff8bb2] to-[#a74758] px-4 text-[10px] font-black uppercase tracking-wider text-white shadow-md hover:opacity-95 active:scale-95 transition-all"
                  >
                    <CalendarDays className="size-3.5" />
                    <span>Mostra tutti</span>
                  </button>
                )}
              </div>

              <div
                onClick={() => {
                  if (activeAppointments.length > 0) {
                    setShowAllAppointmentsModal(true);
                  }
                }}
                className="flex h-[52px] cursor-pointer items-center justify-between px-6 border-b border-black/5 hover:bg-black/[0.01]"
              >
                <div className="flex items-center gap-2 text-[#E88AC5]">
                  <CalendarDays className="size-4.5" />
                  <span className="text-xs font-black uppercase tracking-[0.18em]">
                    {(() => {
                      if (activeAppointments.length === 0) return "Nessun appuntamento";
                      const hasToday = activeAppointments.some((b) => !b.isTomorrow);
                      const hasTomorrow = activeAppointments.some((b) => b.isTomorrow);
                      if (hasToday && hasTomorrow) return "Prossimo appuntamento di oggi o domani";
                      if (hasTomorrow) return "Prossimo appuntamento di domani";
                      return "Prossimo appuntamento di oggi";
                    })()}
                  </span>
                  <span className="ml-2 rounded-full bg-[#FFF0F2] px-2 py-0.5 text-[10px] font-black text-[#E88AC5] border border-[#FCDCE2]">
                    {activeAppointments.length}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-black/40">
                  {activeAppointments.length > 0 ? "Clicca per vedere tutti gli appuntamenti" : ""}
                </div>
              </div>              {/* Table rendering list of bookings */}
              <div className={cn("overflow-y-auto px-6 py-4 flex-1", !appointmentsExpanded && "hidden")}>
                {activeAppointments.length > 0 ? (
                  (() => {
                    const booking = activeAppointments[0];
                    const isConfirmed =
                      booking.status?.toLowerCase().includes("confermato") ||
                      booking.status === "confirmed" ||
                      booking.status === "confermata";

                    const isPending =
                      booking.status?.toLowerCase().includes("in arrivo") ||
                      booking.status === "pending";

                    const isArriving =
                      booking.status?.toLowerCase().includes("arrivando") ||
                      booking.status === "arrived";

                    return (
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-[22px] border border-pink-100/60 bg-[#FFFDFD] shadow-sm hover:border-[#ff8bb2]/30 transition duration-200">
                        {/* Time & Date */}
                        <div className="flex items-center gap-3.5 shrink-0">
                          <div className="grid size-12 place-items-center rounded-xl bg-pink-50 text-pink-500 border border-pink-100">
                            <Clock className="size-6 text-[#ff8bb2]" />
                          </div>
                          <div>
                            <span className="block text-xl font-black text-[#171717]">{booking.time}</span>
                            <span className="block text-xs font-bold text-black/45">
                              {new Intl.DateTimeFormat("it-IT", {
                                day: "2-digit",
                                month: "2-digit",
                                timeZone: "Europe/Rome",
                              }).format(new Date(booking.startDate))}
                            </span>
                            {booking.isTomorrow && (
                              <span className="mt-1 inline-flex items-center gap-1 rounded bg-[#EBF9EB] border border-[#D1F2D1] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#2E7D32]">
                                Domani
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Customer & Service info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            {booking.customerPhotoUrl ? (
                              <img
                                src={booking.customerPhotoUrl}
                                className="size-11 rounded-full object-cover border border-black/10 shadow-sm"
                                alt=""
                              />
                            ) : (
                              <div className="grid size-11 place-items-center rounded-full bg-[#ff8bb2]/15 text-[#a74758] border border-[#ff8bb2]/20 shadow-inner">
                                <UserRound className="size-5.5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-base font-black text-[#171717] truncate">{booking.customerName}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs font-semibold text-[#a74758] bg-[#a74758]/5 border border-[#a74758]/10 px-2.5 py-0.5 rounded-full">
                                  {booking.serviceTitle}
                                </span>
                                {booking.priceAmount !== null && booking.priceAmount > 0 && (
                                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                    Acconto: {booking.priceAmount.toLocaleString("it-IT", {
                                      style: "currency",
                                      currency: booking.priceCurrency,
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Salon & Teammates */}
                        <div className="flex flex-col gap-1.5 shrink-0 min-w-[150px] border-l border-black/[0.05] pl-4">
                          <div>
                            <span className="block text-[9px] font-black uppercase tracking-wider text-black/40">Sede</span>
                            <span className="text-xs font-bold text-black/75 capitalize">
                              {booking.inferredSalon === "buenos-aires" ? "Buenos Aires" : booking.inferredSalon}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[9px] font-black uppercase tracking-wider text-black/40 font-bold">Staff</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {booking.teammates.length > 0 ? (
                                booking.teammates.map((mate: any, idx: number) => (
                                  <span key={idx} className="inline-flex items-center gap-1 bg-black/[0.03] border border-black/5 rounded-full px-2 py-0.5 text-[10px] font-bold text-black/75">
                                    {mate.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-black/35 italic font-bold">Non assegnato</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons (Apri + State Actions) */}
                        <div className="flex items-center gap-2.5 flex-wrap md:flex-nowrap shrink-0 border-l border-black/[0.05] pl-4">
                          {/* Apri popup button */}
                          <button
                            type="button"
                            onClick={() => setSelectedBookingForDetails(booking)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-black/70 hover:bg-[#fff2fa] hover:border-[#ff8bb2]/30 active:scale-95 transition shadow-sm h-9"
                          >
                            <ChevronRight className="size-4 text-[#ff8bb2]" />
                            <span>Apri</span>
                          </button>

                          {/* Status badge or Action buttons */}
                          {isArriving ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FCDCE2] bg-[#FFF0F2] px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-[#E88AC5] h-9">
                              <span className="size-1.5 rounded-full bg-[#E88AC5] animate-pulse" />
                              Sta Arrivando
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FBEAD2] bg-[#FFF8EB] px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-[#F1A43A] h-9">
                              <span className="size-1.5 rounded-full bg-[#F1A43A]" />
                              In Arrivo
                            </span>
                          ) : isConfirmed ? (
                            <div className="flex gap-2 items-center">
                              <button
                                type="button"
                                onClick={() => void prefillFromBooking(booking)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-[#D1F2D1] bg-[#EBF9EB] px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-[#2E7D32] hover:bg-[#D8F3D8] hover:border-[#BCE8BC] active:scale-95 transition shadow-sm h-9"
                              >
                                <span className="size-1.5 rounded-full bg-[#2E7D32]" />
                                Crea appuntamento
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCompletedAppointments((prev) => {
                                    const next = new Set(prev);
                                    next.add(booking.id);
                                    return next;
                                  });
                                  sound("success");
                                  
                                  // Save No Show status in background database response
                                  void fetch("/api/client-control/tablet-submit", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      isFinito: true,
                                      isNoShow: true,
                                      bookingId: booking.id,
                                      clientName: booking.customerName,
                                      email: booking.customerEmail || "",
                                      phone: booking.customerPhone || "",
                                      depositPaid: booking.priceAmount != null ? booking.priceAmount : "",
                                      salon: device?.locationName,
                                      shopifyOrder: booking.bookingStr || "",
                                    }),
                                  }).then(() => {
                                    router.refresh();
                                  }).catch((err) => {
                                    console.error("Error saving No Show status:", err);
                                  });
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-red-600 hover:bg-red-100 active:scale-95 transition shadow-sm h-9"
                              >
                                No Show
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D5E5FA] bg-[#EDF4FC] px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-[#4E89E8] h-9">
                              <span className="size-1.5 rounded-full bg-[#4E89E8]" />
                              In Preparazione
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-sm font-bold text-black/35 gap-2">
                    <CalendarDays className="size-8 text-black/20" />
                    <span>Nessun appuntamento in programma per oggi in questo salone.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer info bar */}
        <footer className="relative z-10 flex shrink-0 flex-wrap items-center justify-end gap-6 border-t border-black/10 pt-4 text-xs text-black/58 sm:text-sm">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[color:var(--tablet-accent)]" />
            <span>Dispositivo autorizzato</span>
          </span>
          <div className="flex items-center gap-2">
            <span>
              Sincronizzazione:{" "}
              <strong>
                {new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now)}
              </strong>
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn(
                "flex size-7 items-center justify-center rounded-lg border border-black/10 bg-white hover:bg-black/[0.02] text-black/60 shadow-sm transition-all",
                refreshing && "animate-spin text-[color:var(--tablet-accent)]"
              )}
              title="Sincronizza e aggiorna appuntamenti"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        </footer>

        {/* Client Control Form Modal overlay */}
        {clientControlOpen && clientControlFormId && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-5">
            <div className="flex h-[92%] w-full max-w-[1500px] overflow-hidden rounded-[26px] border border-black/15 bg-white shadow-[0_30px_90px_rgba(0,0,0,0.35)] relative">
              <aside className="flex w-full min-w-0 flex-col bg-[#FAFAFA] p-5 sm:p-7">
                
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#E88AC5]">Store manager</p>
                    <h2 className="mt-1 text-2xl font-black text-[#171717] sm:text-3xl">Appuntamenti e controllo cliente</h2>
                    <p className="mt-1 text-xs font-semibold text-black/45">
                      Compila appuntamenti dal tablet e controlla l'andamento per salone.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setAppointmentMode("create")}
                        className={cn(
                          "rounded-full px-4 py-2 text-xs font-black transition",
                          appointmentMode === "create" ? "bg-[#171717] text-white" : "bg-black/5 text-black/55 hover:bg-black/10"
                        )}
                      >
                        Crea appuntamento
                      </button>
                      <button
                        type="button"
                        onClick={() => setAppointmentMode("analytics")}
                        className={cn(
                          "rounded-full px-4 py-2 text-xs font-black transition",
                          appointmentMode === "analytics" ? "bg-[#171717] text-white" : "bg-black/5 text-black/55 hover:bg-black/10"
                        )}
                      >
                        Analytics
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setClientControlOpen(false);
                      setAppointmentMessage(null);
                      setCurrentBookingId(null);
                      setPhotoPrimaFronteFile(null);
                      if (photoPrimaFrontePreview) {
                        URL.revokeObjectURL(photoPrimaFrontePreview);
                        setPhotoPrimaFrontePreview(null);
                      }
                      setPhotoPrimaDietroFile(null);
                      if (photoPrimaDietroPreview) {
                        URL.revokeObjectURL(photoPrimaDietroPreview);
                        setPhotoPrimaDietroPreview(null);
                      }
                      setPhotoDopoFronteFile(null);
                      if (photoDopoFrontePreview) {
                        URL.revokeObjectURL(photoDopoFrontePreview);
                        setPhotoDopoFrontePreview(null);
                      }
                      setPhotoDopoDietroFile(null);
                      if (photoDopoDietroPreview) {
                        URL.revokeObjectURL(photoDopoDietroPreview);
                        setPhotoDopoDietroPreview(null);
                      }
                      setClientPhotoFile(null);
                      if (clientPhotoPreview) {
                        URL.revokeObjectURL(clientPhotoPreview);
                        setClientPhotoPreview(null);
                      }
                    }}
                    className="grid size-11 place-items-center rounded-full border border-black/10 bg-white text-black shadow-sm active:scale-95 hover:bg-black/[0.02]"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Modal Content body scrollable */}
                <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 space-y-4">
                  {appointmentMode === "create" ? (
                    <div className="mb-4 rounded-[26px] border border-black/10 bg-white p-4 shadow-sm sm:p-5">
                      <div className="w-full">
                        <div className="space-y-4">
                          
                          {/* Sede selection options list restricted to Salone Duomo and Salone Buenos Aires */}
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">Sede *</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {salonsList.map((salonName) => (
                                <button
                                  key={salonName}
                                  type="button"
                                  onClick={() => setAppointmentForm((prev) => ({ ...prev, salon: salonName, staffIds: [] }))}
                                  className={cn(
                                    "rounded-full border px-3 py-2 text-xs font-black transition",
                                    appointmentForm.salon === salonName
                                      ? "border-[#E88AC5] bg-[#FCE5F3] text-[#B83D7F]"
                                      : "border-black/10 bg-white text-black/55 hover:bg-black/[0.02]"
                                  )}
                                >
                                  {salonName}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Client fields grid */}
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="block">
                              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">Nome cliente *</span>
                              <SmoothInput
                                value={appointmentForm.clientName}
                                onChange={(val) => setAppointmentForm((prev) => ({ ...prev, clientName: val }))}
                                className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]"
                                placeholder="Nome cliente"
                              />
                            </label>

                            <label className="block">
                              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">Email cliente</span>
                              <SmoothInput
                                value={appointmentForm.email}
                                onChange={(val) => setAppointmentForm((prev) => ({ ...prev, email: val }))}
                                className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]"
                                placeholder="email@esempio.com"
                              />
                            </label>

                            <label className="block">
                              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">Telefono cliente</span>
                              <SmoothInput
                                value={appointmentForm.phone}
                                onChange={(val) => setAppointmentForm((prev) => ({ ...prev, phone: val }))}
                                className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]"
                                placeholder="+39..."
                              />
                            </label>

                            <label className="block">
                              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">Servizio prenotato</span>
                              <input
                                value={appointmentForm.serviceTitle || ""}
                                readOnly
                                className="mt-1 h-12 w-full rounded-2xl border border-black/10 bg-black/[0.02] px-4 text-sm font-bold text-black/60 outline-none cursor-not-allowed"
                                placeholder="Nessun servizio precompilato"
                              />
                            </label>

                            <label className="block">
                              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">Ordine Shopify *</span>
                              <SmoothInput
                                value={appointmentForm.shopifyOrder}
                                onChange={(val) => setAppointmentForm((prev) => ({ ...prev, shopifyOrder: val }))}
                                className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]"
                                placeholder="Numero ordine (es. 22910)"
                              />
                            </label>

                            <label className="block">
                              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">Acconto pagato (€)</span>
                              <SmoothInput
                                inputMode="decimal"
                                value={appointmentForm.depositPaid}
                                onChange={(val) => setAppointmentForm((prev) => ({ ...prev, depositPaid: val }))}
                                className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]"
                                placeholder="0.00"
                              />
                            </label>

                            <label className="block">
                              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">Pagato (€)</span>
                              <SmoothInput
                                inputMode="decimal"
                                value={appointmentForm.paid}
                                onChange={(val) => setAppointmentForm((prev) => ({ ...prev, paid: val }))}
                                className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]"
                                placeholder="0.00"
                              />
                            </label>

                            <label className="block">
                              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">IG tag</span>
                              <SmoothInput
                                value={appointmentForm.instagramTag}
                                onChange={(val) => setAppointmentForm((prev) => ({ ...prev, instagramTag: val }))}
                                className="mt-1 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm font-bold outline-none focus:border-[#E88AC5]"
                                placeholder="@cliente"
                              />
                            </label>

                            {/* customNoteText Shopify textarea with warning/help text */}
                            <label className="block col-span-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">Testo Nota Shopify</span>
                                <button
                                  type="button"
                                  onClick={toggleSpeechRecognition}
                                  className={cn(
                                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition active:scale-95",
                                    isRecording
                                      ? "bg-red-500 text-white animate-pulse"
                                      : "bg-black/5 text-black/60 hover:bg-black/10"
                                  )}
                                >
                                  {isRecording ? (
                                    <>
                                      <span className="size-1.5 rounded-full bg-white animate-ping" />
                                      <span>Ascolto...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Mic className="size-3 text-[#ff8bb2]" />
                                      <span>Ditta a voce</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <SmoothTextarea
                                value={appointmentForm.customNoteText}
                                onChange={(val) => setAppointmentForm((prev) => ({ ...prev, customNoteText: val }))}
                                className="mt-1 min-h-20 w-full rounded-2xl border border-black/10 bg-white p-3 text-sm font-semibold outline-none focus:border-[#E88AC5]"
                                placeholder="Scrivi qui la nota da aggiungere o clicca 'Ditta a voce' per registrare"
                              />
                              <span className="text-[10px] font-semibold text-black/45 mt-1 block">
                                La nota verrà firmata con i nomi dei collaboratori selezionati (es: "Staff: Aurora e Melissa").
                              </span>
                            </label>
                          </div>

                          {/* Collaboratori selection */}
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">Collaboratori del salone *</p>
                            <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-2xl border border-black/10 bg-black/[0.02] p-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                              {filteredEmployeesForSalon.length ? (
                                filteredEmployeesForSalon.map((emp: any) => {
                                  const selected = appointmentForm.staffIds.includes(emp.id);
                                  return (
                                    <button
                                      key={emp.id}
                                      type="button"
                                      onClick={() =>
                                        setAppointmentForm((prev) => ({
                                          ...prev,
                                          staffIds: selected ? [] : [emp.id],
                                        }))
                                      }
                                      className={cn(
                                        "rounded-xl border px-3 py-2 text-left text-xs font-black transition",
                                        selected
                                          ? "border-[#E88AC5] bg-[#FCE5F3] text-[#B83D7F]"
                                          : "border-black/10 bg-white text-black/60 hover:bg-black/[0.02]"
                                      )}
                                    >
                                      {emp.name}
                                    </button>
                                  );
                                })
                              ) : (
                                <p className="p-3 text-sm font-bold text-black/40 col-span-full text-center">
                                  Nessun collaboratore trovato per questa sede.
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Checklist fields */}
                          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                            {[
                              ["notes", "Note Shopify"],
                              ["beforeMedia", "Prima foto/video"],
                              ["afterMedia", "Dopo foto/video"],
                              ["products", "Prodotti"],
                              ["review", "Recensione"],
                            ].map(([fieldKey, fieldLabel]) => (
                              <label
                                key={fieldKey}
                                className="flex min-h-12 items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 text-xs font-black text-black/60 cursor-pointer hover:bg-black/[0.01]"
                              >
                                <input
                                  type="checkbox"
                                  checked={!!(appointmentForm as any)[fieldKey]}
                                  onChange={(e) =>
                                    setAppointmentForm((prev) => ({
                                      ...prev,
                                      [fieldKey]: e.target.checked,
                                    }))
                                  }
                                  className="size-4 accent-[#E88AC5]"
                                />
                                <span>{fieldLabel}</span>
                              </label>
                            ))}
                          </div>

                          {/* Foto Controllo Cliente (4 Foto) */}
                          <div className="rounded-[26px] border border-black/10 bg-white p-4 shadow-sm space-y-4">
                            <div>
                              <h4 className="text-xs font-black uppercase tracking-wider text-black/60 font-bold">Foto Controllo Cliente</h4>
                              <p className="text-[10px] text-black/40 font-semibold mt-0.5">Carica le foto richieste per documentare il servizio prima e dopo.</p>
                            </div>

                            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                              {[
                                { key: "prima_fronte", label: "Prima Fronte", file: photoPrimaFronteFile, preview: photoPrimaFrontePreview, setFile: setPhotoPrimaFronteFile, setPreview: setPhotoPrimaFrontePreview },
                                { key: "prima_dietro", label: "Prima Dietro", file: photoPrimaDietroFile, preview: photoPrimaDietroPreview, setFile: setPhotoPrimaDietroFile, setPreview: setPhotoPrimaDietroPreview },
                                { key: "dopo_fronte", label: "Dopo Fronte", file: photoDopoFronteFile, preview: photoDopoFrontePreview, setFile: setPhotoDopoFronteFile, setPreview: setPhotoDopoFrontePreview },
                                { key: "dopo_dietro", label: "Dopo Dietro", file: photoDopoDietroFile, preview: photoDopoDietroPreview, setFile: setPhotoDopoDietroFile, setPreview: setPhotoDopoDietroPreview },
                              ].map((slot) => (
                                <div key={slot.key} className="flex flex-col items-center p-3 border border-black/5 rounded-2xl bg-black/[0.01] space-y-2 relative">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-black/45">{slot.label}</span>
                                  
                                  {slot.preview ? (
                                    <div className="relative size-24 rounded-xl overflow-hidden border border-black/10 bg-black/5 flex items-center justify-center group">
                                      <img src={slot.preview} alt={slot.label} className="size-full object-cover" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          slot.setFile(null);
                                          URL.revokeObjectURL(slot.preview!);
                                          slot.setPreview(null);
                                        }}
                                        className="absolute top-1 right-1 size-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-sm opacity-90 transition active:scale-95"
                                        title="Rimuovi"
                                      >
                                        <X className="size-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-1.5 size-24 shrink-0">
                                      {/* Option 1: Camera */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveCameraSlot(slot.key);
                                          startCamera("environment");
                                        }}
                                        className="flex-1 flex flex-col items-center justify-center rounded-xl border border-black/10 bg-white hover:bg-black/[0.02] active:scale-95 transition"
                                      >
                                        <Camera className="size-4 text-black/45" />
                                        <span className="text-[8px] font-black uppercase text-black/50 mt-0.5">Scatta</span>
                                      </button>

                                      {/* Option 2: Upload */}
                                      <label className="flex-1 flex flex-col items-center justify-center rounded-xl border border-black/10 border-dashed bg-black/[0.01] hover:bg-black/[0.03] active:scale-95 transition cursor-pointer">
                                        <svg className="size-3.5 text-black/35" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                        </svg>
                                        <span className="text-[8px] font-black uppercase text-black/45 mt-0.5">Sfoglia</span>
                                        <input
                                          type="file"
                                          accept="image/*,.heic,.HEIC,.heif,.HEIF"
                                          onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              let targetFile = file;
                                              const isHEIC = file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif") || file.type === "image/heic" || file.type === "image/heif";
                                              
                                              try {
                                                setAppointmentMessage({ type: "success", text: `Elaborazione ${slot.label}...` });
                                                
                                                if (isHEIC) {
                                                  const heic2any = (await import("heic2any")).default;
                                                  const convertedBlob = await heic2any({
                                                    blob: file,
                                                    toType: "image/jpeg",
                                                    quality: 0.8,
                                                  });
                                                  const convertedBlobSingle = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                                                  targetFile = new File([convertedBlobSingle], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
                                                    type: "image/jpeg",
                                                  });
                                                }
                                                
                                                const compressed = await compressImage(targetFile, 2048, 2048, 0.9);
                                                slot.setFile(compressed);
                                                slot.setPreview(URL.createObjectURL(compressed));
                                                setAppointmentMessage(null);
                                              } catch (err) {
                                                console.error("Image processing failed:", err);
                                                setAppointmentMessage({ type: "error", text: "Impossibile elaborare l'immagine. Riprova." });
                                              }
                                            }
                                          }}
                                          className="hidden"
                                        />
                                      </label>
                                    </div>
                                  )}
                                  
                                  {slot.file && (
                                    <span className="text-[8px] font-semibold text-black/45 truncate max-w-full text-center px-1">
                                      {slot.file.name}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Message banner */}
                          {appointmentMessage && (
                            <p className={cn(
                              "rounded-2xl px-4 py-3 text-sm font-black",
                              appointmentMessage.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                            )}>
                              {appointmentMessage.text}
                            </p>
                          )}

                          {/* Submit button */}
                          <button
                            type="button"
                            onClick={submitAppointment}
                            disabled={appointmentSubmitting}
                            className="h-13 w-full rounded-2xl bg-[#E88AC5] px-5 py-4 text-sm font-black text-white shadow-lg shadow-pink-200 active:scale-[0.99] disabled:opacity-60 transition duration-150"
                          >
                            {appointmentSubmitting ? "Salvataggio..." : "Salva appuntamento"}
                          </button>

                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Analytics Dashboard views inside modal */
                    clientAnalyticsLoading ? (
                      <div className="grid h-48 place-items-center text-sm font-bold text-black/45">
                        Carico analytics...
                      </div>
                    ) : clientAnalytics?.salons?.length ? (
                      <div className="space-y-4">
                        
                        {/* Salon filter tags */}
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {["Tutti", ...clientAnalytics.salons.map((s: any) => s.salon)].map((salonFilter) => (
                            <button
                              key={salonFilter}
                              type="button"
                              onClick={() => setActiveAnalyticsSalon(salonFilter)}
                              className={cn(
                                "shrink-0 rounded-full px-3 py-2 text-[11px] font-black transition",
                                activeAnalyticsSalon === salonFilter
                                  ? "bg-[#171717] text-white"
                                  : "bg-black/5 text-black/55 hover:bg-black/10"
                              )}
                            >
                              {salonFilter}
                            </button>
                          ))}
                        </div>

                        {/* Top Cards info */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="rounded-[18px] border border-black/10 bg-white p-4 shadow-sm">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-black/40">Schede mese</p>
                            <p className="mt-2 text-3xl font-black text-[#171717]">{activeSalonMetrics?.responses ?? 0}</p>
                            <p className="mt-1 truncate text-[11px] font-semibold text-black/40">{activeSalonMetrics?.salon}</p>
                          </div>
                          <div className="rounded-[18px] border border-black/10 bg-white p-4 shadow-sm">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-black/40">Collaboratori</p>
                            <p className="mt-2 text-3xl font-black text-[#171717]">{activeSalonMetrics?.staff?.length ?? 0}</p>
                            <p className="mt-1 text-[11px] font-semibold text-black/40">con check attivi</p>
                          </div>
                          <div className="rounded-[18px] border border-black/10 bg-white p-4 shadow-sm">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-black/40">Check totali</p>
                            <p className="mt-2 text-3xl font-black text-[#171717]">
                              {activeSalonMetrics?.staff?.reduce((acc: number, item: any) => acc + item.checks, 0) ?? 0}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold text-black/40">note, foto, prodotti</p>
                          </div>
                        </div>

                        {/* Charts and details */}
                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_260px]">
                          <div className="rounded-[22px] border border-black/10 bg-white p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/45">Produttività</p>
                              <Coins className="size-4 text-[#E88AC5]" />
                            </div>
                            <div className="space-y-2">
                              {(activeSalonMetrics?.staff ?? []).slice(0, 8).map((staffItem: any) => {
                                const maxServices = Math.max(
                                  ...(activeSalonMetrics?.staff ?? []).map((s: any) => s.services),
                                  1
                                );
                                return (
                                  <div key={staffItem.name} className="grid grid-cols-[120px_1fr_32px] items-center gap-2">
                                    <p className="truncate text-[11px] font-bold text-black/55">{staffItem.name}</p>
                                    <div className="h-2.5 overflow-hidden rounded-full bg-[#F7DFEB]">
                                      <div
                                        className="h-full rounded-full bg-[#E88AC5]"
                                        style={{ width: `${Math.max(5, (staffItem.services / maxServices) * 100)}%` }}
                                      />
                                    </div>
                                    <p className="text-right text-[11px] font-black text-black/55">{staffItem.services}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="rounded-[22px] border border-black/10 bg-white p-4 text-center shadow-sm flex flex-col justify-center">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/45">Schede per sede</p>
                            <div
                              className="mx-auto mt-4 grid size-28 place-items-center rounded-full"
                              style={{ background: "conic-gradient(#E88AC5 0deg 330deg, #F6DCE9 330deg 360deg)" }}
                            >
                              <div className="grid size-20 place-items-center rounded-full bg-white">
                                <div>
                                  <p className="text-3xl font-black">{activeSalonMetrics?.responses ?? 0}</p>
                                  <p className="text-[10px] font-bold text-black/40">Total</p>
                                </div>
                              </div>
                            </div>
                            <p className="mt-3 truncate text-[10px] font-bold text-black/40">{activeSalonMetrics?.salon}</p>
                          </div>
                        </div>

                        {/* Recent submissions list */}
                        <div className="rounded-[24px] border border-black/10 bg-white shadow-sm">
                          <div className="flex flex-col gap-2 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#E88AC5]">Cronologia</p>
                              <h3 className="text-xl font-black text-[#171717]">Moduli Controllo Cliente completati</h3>
                            </div>
                            <p className="rounded-full bg-black/5 px-3 py-1 text-xs font-black text-black/45">
                              {clientAnalytics.recent?.length ?? 0} recenti
                            </p>
                          </div>

                          <div className="max-h-[340px] overflow-y-auto">
                            {(clientAnalytics.recent ?? []).length ? (
                              <div className="divide-y divide-black/5">
                                {clientAnalytics.recent.map((response: any) => {
                                  const colorClass =
                                    response.correctness === "OK"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                      : response.correctness?.toLowerCase().includes("errore")
                                        ? "bg-rose-50 text-rose-700 border-rose-100"
                                        : "bg-amber-50 text-amber-700 border-amber-100";

                                  return (
                                    <article
                                      key={response.id}
                                      className="grid gap-4 p-4 text-sm lg:grid-cols-[160px_minmax(220px,1fr)_190px_220px] lg:items-center"
                                    >
                                      <div>
                                        <p className="font-black text-[#171717]">
                                          {new Intl.DateTimeFormat("it-IT", {
                                            day: "2-digit",
                                            month: "short",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          }).format(new Date(response.createdAt))}
                                        </p>
                                        <p className="text-xs font-bold text-black/40">{response.salon}</p>
                                      </div>

                                      <div className="min-w-0">
                                        <p className="truncate font-black text-[#171717]">{response.client || "Cliente senza nome"}</p>
                                        <p className="truncate text-xs font-semibold text-black/45">{response.staff.join(", ")}</p>
                                      </div>

                                      <div className="space-y-1 rounded-2xl bg-black/[0.03] px-3 py-2 text-xs font-bold text-black/50">
                                        <p className="flex items-center justify-between gap-3">
                                          <span>Pagato</span>
                                          <span className="shrink-0 text-[#171717]">
                                            {response.paid.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                                          </span>
                                        </p>
                                        <p className="flex items-center justify-between gap-3">
                                          <span>Acconto</span>
                                          <span className="shrink-0 text-[#171717]">
                                            {response.deposit.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                                          </span>
                                        </p>
                                      </div>

                                      <div className="flex flex-col gap-2 lg:items-end">
                                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                          <span className={cn(
                                            "rounded-full px-2.5 py-1 text-xs font-black",
                                            response.counts ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                                          )}>
                                            {response.checkCount}/5
                                          </span>
                                          <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-black text-black/45">
                                            {response.correctness}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => void loadResponseDetail(response.id)}
                                          disabled={clientResponseLoading === response.id}
                                          className="inline-flex items-center justify-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[10px] font-black text-black/60 transition hover:bg-[#fff2fa] hover:text-[#171717] disabled:opacity-60"
                                        >
                                          <Edit3 className="size-3" />
                                          <span>{clientResponseLoading === response.id ? "Apro..." : "Modifica"}</span>
                                        </button>
                                      </div>
                                    </article>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="p-6 text-center text-sm font-bold text-black/35">
                                Nessun modulo completato da mostrare.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid h-full place-items-center rounded-2xl border border-dashed border-black/10 p-6 text-center">
                        <p className="text-sm font-bold text-black/45">Nessuna scheda cliente per questo mese.</p>
                      </div>
                    )
                  )}
                </div>

              </aside>
            </div>
          </div>
        )}

        {/* Response detail modification edit modal overlay */}
        {selectedClientResponse && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-2xl flex flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-black/10 p-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#C661A0]">Modifica appuntamento</p>
                  <h3 className="text-2xl font-black">{String(clientResponseDraft[CLIENT_CONTROL_FIELD_IDS.clientName] || "Cliente senza nome")}</h3>
                  <p className="mt-1 text-xs font-semibold text-black/40">
                    Qui puoi correggere nome cliente, pagamento e tutti i campi del modulo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedClientResponse(null)}
                  className="grid size-11 place-items-center rounded-full bg-black/[0.04] hover:bg-black/[0.08]"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-6 flex-1 space-y-4">
                <div className="grid gap-4 rounded-[24px] border border-black/10 bg-black/[0.02] p-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-black/42">Nome cliente</span>
                    <input
                      value={String(clientResponseDraft[CLIENT_CONTROL_FIELD_IDS.clientName] || "")}
                      onChange={(e) =>
                        setClientResponseDraft((prev) => ({
                          ...prev,
                          [CLIENT_CONTROL_FIELD_IDS.clientName]: e.target.value,
                        }))
                      }
                      className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-black/42">Collaboratori</span>
                    <input
                      value={
                        Array.isArray(clientResponseDraft[CLIENT_CONTROL_FIELD_IDS.serviceStaff])
                          ? clientResponseDraft[CLIENT_CONTROL_FIELD_IDS.serviceStaff].join(", ")
                          : String(clientResponseDraft[CLIENT_CONTROL_FIELD_IDS.serviceStaff] || "")
                      }
                      onChange={(e) =>
                        setClientResponseDraft((prev) => ({
                          ...prev,
                          [CLIENT_CONTROL_FIELD_IDS.serviceStaff]: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        }))
                      }
                      className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {selectedClientResponse.form.fields.map((field: any) => {
                    if (field.id === CLIENT_CONTROL_FIELD_IDS.clientName || field.id === CLIENT_CONTROL_FIELD_IDS.serviceStaff) {
                      return null;
                    }
                    const val = clientResponseDraft[field.id];
                    return (
                      <label key={field.id} className={cn("block", field.type === "textarea" && "md:col-span-2")}>
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-black/42">{field.label}</span>
                        {field.type === "checkbox" ? (
                          <button
                            type="button"
                            onClick={() =>
                              setClientResponseDraft((prev) => ({
                                ...prev,
                                [field.id]: !val,
                              }))
                            }
                            className={cn(
                              "mt-2 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold",
                              val ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-black/10 bg-white text-black/55"
                            )}
                          >
                            <span className={cn(
                              "grid size-5 place-items-center rounded-md border",
                              val ? "border-emerald-500 bg-emerald-500 text-white" : "border-black/20"
                            )}>
                              {val && <Check className="size-3" />}
                            </span>
                            <span>{val ? "Fatto" : "Non fatto"}</span>
                          </button>
                        ) : field.type === "select" && field.options?.length ? (
                          <select
                            value={String(val ?? "")}
                            onChange={(e) =>
                              setClientResponseDraft((prev) => ({
                                ...prev,
                                [field.id]: e.target.value,
                              }))
                            }
                            className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none"
                          >
                            <option value="">Seleziona</option>
                            {field.options.map((opt: string) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.type === "textarea" ? (
                          <SmoothTextarea
                            value={String(val ?? "")}
                            onChange={(val) =>
                              setClientResponseDraft((prev) => ({
                                ...prev,
                                [field.id]: val,
                              }))
                            }
                            className="mt-2 min-h-28 w-full rounded-2xl border border-black/10 bg-white p-4 text-sm outline-none"
                          />
                        ) : (
                          <SmoothInput
                            value={Array.isArray(val) ? val.join(", ") : String(val ?? "")}
                            onChange={(val) =>
                              setClientResponseDraft((prev) => ({
                                ...prev,
                                [field.id]: field.type === "worker_multi" ? val.split(",").map((s) => s.trim()).filter(Boolean) : val,
                              }))
                            }
                            className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none"
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-black/10 p-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedClientResponse(null)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black/[0.05] px-5 py-3 text-sm font-black text-black/65 active:scale-95 transition"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={saveResponseDetail}
                  disabled={clientResponseSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#EA8CCD] px-6 py-3 text-sm font-black text-white disabled:opacity-60 active:scale-95 transition"
                >
                  {clientResponseSaving ? "Salvataggio..." : "Salva modifiche"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Appointment detail popup modal (opens on client name click in tray) */}
        {selectedBookingForDetails && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="flex flex-col max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.45)] border border-black/10">
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 border-b border-black/[0.06] p-6 bg-gradient-to-r from-pink-50/50 to-amber-50/20">
                <div className="flex items-center gap-4">
                  {selectedBookingForDetails.customerPhotoUrl ? (
                    <img
                      src={selectedBookingForDetails.customerPhotoUrl}
                      className="size-14 rounded-full object-cover border-2 border-white shadow-md"
                      alt=""
                    />
                  ) : (
                    <div className="grid size-14 place-items-center rounded-full bg-[#ff8bb2]/15 text-[#a74758] border border-[#ff8bb2]/20 shadow-inner">
                      <UserRound className="size-6" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black text-[#171717] tracking-tight">{selectedBookingForDetails.customerName}</h3>
                      {selectedBookingForDetails.isTomorrow && (
                        <span className="inline-flex items-center gap-1 rounded bg-[#EBF9EB] border border-[#D1F2D1] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#2E7D32]">
                          Domani
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-black/40 mt-0.5 flex items-center gap-1.5">
                      <Clock className="size-3.5 text-[#ff8bb2]" /> Appuntamento alle {selectedBookingForDetails.time}
                    </p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setSelectedBookingForDetails(null)}
                  className="grid size-10 place-items-center rounded-full bg-black/[0.04] text-black/60 hover:bg-black/[0.08] hover:text-black transition"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto p-6 space-y-6 flex-1 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Details */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-[#ff8bb2] border-b border-[#ff8bb2]/10 pb-1.5">
                      Dettagli Appuntamento
                    </h4>
                    <div className="grid grid-cols-1 gap-3.5">
                      <div className="flex items-start gap-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-black/[0.03] text-black/50 border border-black/5">
                          <ShoppingBag className="size-4" />
                        </div>
                        <div>
                          <span className="block text-[10px] font-black uppercase tracking-wider text-black/40">Servizio Prenotato</span>
                          <span className="text-sm font-black text-black/85">{selectedBookingForDetails.serviceTitle || "Servizio"}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-black/[0.03] text-black/50 border border-black/5">
                          <MapPin className="size-4" />
                        </div>
                        <div>
                          <span className="block text-[10px] font-black uppercase tracking-wider text-black/40">Sede</span>
                          <span className="text-sm font-bold text-black/85 capitalize">
                            {selectedBookingForDetails.inferredSalon === "buenos-aires" ? "Buenos Aires" : selectedBookingForDetails.inferredSalon}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-black/[0.03] text-black/50 border border-black/5">
                          <UserRound className="size-4" />
                        </div>
                        <div className="flex-1">
                          <span className="block text-[10px] font-black uppercase tracking-wider text-black/40">Teammate Assegnati</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {selectedBookingForDetails.teammates && selectedBookingForDetails.teammates.length > 0 ? (
                              selectedBookingForDetails.teammates.map((mate: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-1 bg-black/[0.03] border border-black/5 rounded-full pl-1 pr-2.5 py-0.5"
                                >
                                  {mate.photoUrl ? (
                                    <img src={mate.photoUrl} className="size-5 rounded-full object-cover" alt="" />
                                  ) : (
                                    <div className="grid size-5 place-items-center rounded-full bg-[#ff8bb2]/10 text-[#a74758] text-[9px] font-black">
                                      {mate.name.charAt(0)}
                                    </div>
                                  )}
                                  <span className="text-[11px] font-bold text-black/75">{mate.name}</span>
                                </div>
                              ))
                            ) : (
                              <span className="text-xs text-black/35 italic font-bold">Nessun operatore assegnato</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {selectedBookingForDetails.bookingStr && (
                        <div className="flex items-start gap-3">
                          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-black/[0.03] text-black/50 border border-black/5">
                            <ShoppingBag className="size-4" />
                          </div>
                          <div>
                            <span className="block text-[10px] font-black uppercase tracking-wider text-black/40">Shopify / Booking ID</span>
                            <span className="text-xs font-mono font-bold text-black/85 bg-black/[0.04] px-1.5 py-0.5 rounded border border-black/5">
                              {selectedBookingForDetails.bookingStr}
                            </span>
                          </div>
                        </div>
                      )}

                      {selectedBookingForDetails.priceAmount !== null && selectedBookingForDetails.priceAmount > 0 && (
                        <div className="flex items-start gap-3">
                          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <Coins className="size-4" />
                          </div>
                          <div>
                            <span className="block text-[10px] font-black uppercase tracking-wider text-emerald-800 font-bold">Acconto Ricevuto</span>
                            <span className="text-sm font-black text-emerald-700">
                              {selectedBookingForDetails.priceAmount.toLocaleString("it-IT", {
                                style: "currency",
                                currency: selectedBookingForDetails.priceCurrency,
                              })}
                            </span>
                          </div>
                        </div>
                      )}

                      {(selectedBookingForDetails.customerEmail || selectedBookingForDetails.customerPhone) && (
                        <div className="mt-2 pt-2 border-t border-black/[0.05] space-y-2">
                          {selectedBookingForDetails.customerEmail && (
                            <div className="flex items-center gap-2 text-xs font-semibold text-black/55">
                              <span className="font-bold text-black/40">Email:</span> {selectedBookingForDetails.customerEmail}
                            </div>
                          )}
                          {selectedBookingForDetails.customerPhone && (
                            <div className="flex items-center gap-2 text-xs font-semibold text-black/55">
                              <span className="font-bold text-black/40">Telefono:</span> {selectedBookingForDetails.customerPhone}
                            </div>
                          )}
                        </div>
                      )}

                      {selectedBookingForDetails.notes && (
                        <div className="mt-2 bg-amber-50/40 border border-amber-100/60 rounded-xl p-3.5 text-xs text-amber-900/80">
                          <span className="block font-black uppercase tracking-wider text-[9px] text-amber-800/60 mb-1">
                            Note Prenotazione
                          </span>
                          <p className="font-semibold leading-relaxed whitespace-pre-wrap">{selectedBookingForDetails.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: History */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-[#ff8bb2] border-b border-[#ff8bb2]/10 pb-1.5">
                      Cronologia Controlli Cliente
                    </h4>
                    <div className="space-y-3">
                      {(() => {
                        const clientNameClean = (selectedBookingForDetails.customerName || "").trim().toLowerCase();
                        const matchingResponses =
                          clientAnalytics?.recent?.filter((resp: any) => {
                            const name = (resp.client || "").trim().toLowerCase();
                            return name.includes(clientNameClean) || clientNameClean.includes(name);
                          }) || [];

                        return matchingResponses.length > 0 ? (
                          matchingResponses.map((resp: any) => {
                            const dateStr = new Intl.DateTimeFormat("it-IT", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Europe/Rome",
                            }).format(new Date(resp.createdAt));

                            const colorClass =
                              resp.correctness === "OK"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : resp.correctness?.toLowerCase().includes("errore")
                                  ? "bg-rose-50 text-rose-700 border-rose-100"
                                  : "bg-amber-50 text-amber-700 border-amber-100";

                            return (
                              <button
                                key={resp.id}
                                type="button"
                                onClick={() => {
                                  setSelectedBookingForDetails(null);
                                  void loadResponseDetail(resp.id);
                                }}
                                className="w-full text-left p-3.5 rounded-2xl border border-black/[0.06] hover:bg-black/[0.01] hover:border-black/15 transition-all duration-200 group flex items-start justify-between gap-3 bg-white hover:shadow-sm"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="size-3.5 text-black/35" />
                                    <span className="text-xs font-black text-black/75">{dateStr}</span>
                                  </div>
                                  <p className="text-[11px] font-semibold text-black/40">
                                    Gestito da:{" "}
                                    <span className="font-bold text-black/60">{resp.staff.join(", ") || "Nessuno"}</span>
                                  </p>
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-black/35 bg-black/[0.03] px-1.5 py-0.5 rounded">
                                      Sede: {resp.salon === "buenos-aires" ? "Buenos Aires" : resp.salon}
                                    </span>
                                    {resp.deposit > 0 && (
                                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50/50 px-1.5 py-0.5 rounded">
                                        Acc: €{resp.deposit}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${colorClass}`}>
                                    {resp.correctness}
                                  </span>
                                  <span className="text-[9px] font-bold text-[#ff8bb2] group-hover:underline flex items-center gap-0.5">
                                    Vedi/Modifica <ChevronRight className="size-3" />
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 text-center text-xs font-bold text-black/35 gap-2 border border-dashed border-black/10 rounded-2xl">
                            <TriangleAlert className="size-6 text-black/15" />
                            <span>Nessun controllo compilato questo mese.</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-black/[0.06] p-6 bg-black/[0.01] flex flex-wrap items-center justify-between gap-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedBookingForDetails(null)}
                  className="px-5 py-2.5 rounded-xl border border-black/10 hover:bg-black/[0.02] text-xs font-black uppercase tracking-wider text-black/60 transition active:scale-95"
                >
                  Chiudi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBookingForDetails(null);
                    void prefillFromBooking(selectedBookingForDetails);
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#ff8bb2] to-[#a74758] text-white text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 shadow-md hover:shadow-lg transition duration-200"
                >
                  <Calendar className="size-4" />
                  <span>Compila Scheda Controllo</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal showing all appointments list */}
        {showAllAppointmentsModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="flex flex-col max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.45)] border border-black/10">
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 border-b border-black/[0.06] p-6 bg-gradient-to-r from-pink-50/50 to-amber-50/20">
                <div className="flex items-center gap-2.5 text-[#E88AC5]">
                  <CalendarDays className="size-5" />
                  <h3 className="text-lg font-black uppercase tracking-[0.18em] text-[#171717]">
                    Tutti gli appuntamenti di oggi
                  </h3>
                  <span className="ml-1 rounded-full bg-[#FFF0F2] px-2 py-0.5 text-xs font-black text-[#E88AC5] border border-[#FCDCE2]">
                    {activeAppointments.length}
                  </span>
                </div>
                
                <button
                  type="button"
                  onClick={() => setShowAllAppointmentsModal(false)}
                  className="grid size-10 place-items-center rounded-full bg-black/[0.04] text-black/60 hover:bg-black/[0.08] hover:text-black transition"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Modal Body: Table of all active appointments */}
              <div className="overflow-y-auto px-6 py-4 flex-1 bg-white">
                {activeAppointments.length > 0 ? (
                  <div className="min-w-full inline-block align-middle">
                    <div className="overflow-hidden">
                      <table className="min-w-full divide-y divide-black/[0.06]">
                        <thead>
                          <tr className="text-left text-[10px] font-black uppercase tracking-[0.16em] text-black/45">
                            <th scope="col" className="pb-3 text-left">Orario</th>
                            <th scope="col" className="pb-3 text-left">Cliente</th>
                            <th scope="col" className="pb-3 text-left">Sede</th>
                            <th scope="col" className="pb-3 text-left">Staff</th>
                            <th scope="col" className="pb-3 text-right">Stato</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.04]">
                          {activeAppointments.map((booking) => {
                            const isConfirmed =
                              booking.status?.toLowerCase().includes("confermato") ||
                              booking.status === "confirmed" ||
                              booking.status === "confermata";

                            const isPending =
                              booking.status?.toLowerCase().includes("in arrivo") ||
                              booking.status === "pending";

                            const isArriving =
                              booking.status?.toLowerCase().includes("arrivando") ||
                              booking.status === "arrived";

                            return (
                              <tr key={booking.id} className="text-sm font-medium hover:bg-black/[0.01]">
                                <td className="py-3.5 whitespace-nowrap text-left">
                                  <div className="flex flex-col text-left">
                                    <div className="flex items-center gap-1.5 font-black text-[#171717]">
                                      <Clock className="size-4 text-[#ff8bb2]" />
                                      {booking.time}
                                    </div>
                                    <span className="text-[10px] font-bold text-black/45 pl-[22px] mt-0.5">
                                      {new Intl.DateTimeFormat("it-IT", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        timeZone: "Europe/Rome",
                                      }).format(new Date(booking.startDate))}
                                    </span>
                                    {booking.isTomorrow && (
                                      <span className="mt-0.5 inline-flex w-max items-center gap-1 rounded bg-[#EBF9EB] border border-[#D1F2D1] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#2E7D32]">
                                        Domani
                                      </span>
                                    )}
                                  </div>
                                </td>
                                
                                <td className="py-3.5 whitespace-nowrap text-left">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowAllAppointmentsModal(false);
                                      setSelectedBookingForDetails(booking);
                                    }}
                                    className="flex items-center gap-2.5 hover:opacity-80 transition text-left cursor-pointer outline-none group"
                                  >
                                    {booking.customerPhotoUrl ? (
                                      <img
                                        src={booking.customerPhotoUrl}
                                        className="size-8 rounded-full object-cover border border-black/10 group-hover:scale-105 transition duration-200"
                                        alt=""
                                      />
                                    ) : (
                                      <div className="grid size-8 place-items-center rounded-full bg-[#ff8bb2]/15 text-[#a74758] border border-[#ff8bb2]/20 group-hover:scale-105 transition duration-200">
                                        <UserRound className="size-4" />
                                      </div>
                                    )}
                                    <div className="flex flex-col">
                                      <div className="flex items-baseline gap-2 flex-wrap">
                                        <span className="text-sm font-black text-[#171717] group-hover:text-[#a74758] transition duration-200">
                                          {booking.customerName}
                                        </span>
                                        <span className="text-[11px] font-semibold text-[#a74758]/70 bg-[#a74758]/5 border border-[#a74758]/10 px-2.5 py-0.5 rounded-full">
                                          {booking.serviceTitle}
                                        </span>
                                      </div>
                                      {booking.priceAmount !== null && booking.priceAmount > 0 ? (
                                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100 w-max mt-1">
                                          Acconto: {booking.priceAmount.toLocaleString("it-IT", {
                                            style: "currency",
                                            currency: booking.priceCurrency,
                                          })}
                                        </span>
                                      ) : null}
                                    </div>
                                  </button>
                                </td>

                                <td className="py-3.5 whitespace-nowrap text-left text-xs font-semibold text-black/60 capitalize">
                                  {booking.inferredSalon === "buenos-aires" ? "Buenos Aires" : booking.inferredSalon}
                                </td>

                                <td className="py-3.5 whitespace-nowrap text-left">
                                  <div className="flex flex-wrap gap-1.5 items-center">
                                    {booking.teammates.length > 0 ? (
                                      booking.teammates.map((mate: any, idx: number) => (
                                        <div
                                          key={idx}
                                          className="flex items-center gap-1 bg-black/[0.03] border border-black/5 rounded-full pl-1 pr-2.5 py-0.5"
                                        >
                                          {mate.photoUrl ? (
                                            <img src={mate.photoUrl} className="size-5 rounded-full object-cover" alt="" />
                                          ) : (
                                            <div className="grid size-5 place-items-center rounded-full bg-[#ff8bb2]/10 text-[#a74758] text-[9px] font-black">
                                              {mate.name.charAt(0)}
                                            </div>
                                          )}
                                          <span className="text-[11px] font-bold text-black/75">{mate.name}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <span className="text-xs text-black/35 italic font-bold">Non assegnato</span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-3.5 whitespace-nowrap text-right">
                                  <div className="flex gap-2 justify-end items-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowAllAppointmentsModal(false);
                                        setSelectedBookingForDetails(booking);
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-black/60 hover:bg-[#fff2fa] hover:border-[#ff8bb2]/30 active:scale-95 transition shadow-sm h-8"
                                    >
                                      Apri
                                    </button>

                                    {isArriving ? (
                                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FCDCE2] bg-[#FFF0F2] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#E88AC5] h-8">
                                        Sta Arrivando
                                      </span>
                                    ) : isPending ? (
                                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FBEAD2] bg-[#FFF8EB] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#F1A43A] h-8">
                                        In Arrivo
                                      </span>
                                    ) : isConfirmed ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowAllAppointmentsModal(false);
                                            void prefillFromBooking(booking);
                                          }}
                                          className="inline-flex items-center gap-1.5 rounded-full border border-[#D1F2D1] bg-[#EBF9EB] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#2E7D32] hover:bg-[#D8F3D8] hover:border-[#BCE8BC] active:scale-95 transition shadow-sm h-8"
                                        >
                                          Crea appuntamento
                                        </button>

                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setCompletedAppointments((prev) => {
                                              const next = new Set(prev);
                                              next.add(booking.id);
                                              return next;
                                            });
                                            sound("success");
                                            
                                            // Save No Show status in background database response
                                            void fetch("/api/client-control/tablet-submit", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                isFinito: true,
                                                isNoShow: true,
                                                bookingId: booking.id,
                                                clientName: booking.customerName,
                                                email: booking.customerEmail || "",
                                                phone: booking.customerPhone || "",
                                                salon: device?.locationName,
                                                shopifyOrder: booking.bookingStr || "",
                                              }),
                                            }).then(() => {
                                              router.refresh();
                                            }).catch((err) => {
                                              console.error("Error saving No Show status:", err);
                                            });
                                          }}
                                          className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-600 hover:bg-red-100 active:scale-95 transition shadow-sm h-8"
                                        >
                                          No Show
                                        </button>
                                      </>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D5E5FA] bg-[#EDF4FC] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#4E89E8] h-8">
                                        In Preparazione
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-sm font-bold text-black/35 gap-2">
                    <CalendarDays className="size-8 text-black/20" />
                    <span>Nessun appuntamento in programma per oggi in questo salone.</span>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-black/[0.06] p-6 bg-black/[0.01] flex items-center justify-end gap-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAllAppointmentsModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-black/10 hover:bg-black/[0.02] text-xs font-black uppercase tracking-wider text-black/60 transition active:scale-95"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Early shift exit confirm overlay dialog */}
        {earlyExitConfirmDialog}

        {/* Modal fotocamera integrata */}
        {activeCameraSlot && (
          <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black backdrop-blur-md">
            {/* Anteprima video della fotocamera */}
            <div className="relative w-full max-w-lg aspect-[3/4] overflow-hidden bg-black md:rounded-3xl border border-white/10 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              {/* Overlay di centraggio */}
              <div className="absolute inset-4 border-2 border-dashed border-white/20 rounded-2xl pointer-events-none flex items-center justify-center">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 text-center px-4">
                  Inquadra ed assicurati che ci sia buona luce
                </span>
              </div>
            </div>

            {/* Controlli fotocamera */}
            <div className="w-full max-w-lg px-6 py-8 flex flex-col items-center justify-center gap-6">
              {/* Riferimento dello slot corrente */}
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff8bb2]">
                Scatto foto: {activeCameraSlot.replace("_", " ")}
              </p>

              <div className="flex items-center justify-between w-full max-w-[280px]">
                {/* Switch fotocamera (frontale/posteriore) */}
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = cameraFacingMode === "environment" ? "user" : "environment";
                    setCameraFacingMode(nextMode);
                    void startCamera(nextMode);
                  }}
                  className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/5 hover:bg-white/10 active:scale-95 text-white transition shadow-md"
                  title="Cambia fotocamera"
                >
                  <RefreshCw className="size-5" />
                </button>

                {/* Pulsante di scatto centrale */}
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="flex size-20 items-center justify-center rounded-full border-4 border-white bg-[#E88AC5] hover:bg-[#B83D7F] active:scale-90 transition duration-150 shadow-xl"
                  title="Scatta foto"
                >
                  <div className="size-14 rounded-full border border-black/5 bg-white" />
                </button>

                {/* Pulsante chiusura / cancella */}
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/5 hover:bg-white/10 active:scale-95 text-white transition shadow-md"
                  title="Chiudi fotocamera"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
