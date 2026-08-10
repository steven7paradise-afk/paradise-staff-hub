"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  CalendarDays,
  Clock, 
  Zap, 
  Settings,
  Bell,
  ExternalLink,
  Award,
  Gift,
  Check,
  Megaphone,
  FileText,
  Camera,
  BookOpen,
  ArrowRight,
  MapPin,
  Sparkles
} from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";

type Promo = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  expirationDate: string;
  ctaText: string;
  ctaUrl: string;
  materialeGraficoUrl?: string;
  active: boolean;
  image?: string;
};

type SideCard = {
  category: string;
  title: string;
  badge: string;
  description: string;
  url: string;
};

type ProductOfMonth = {
  title: string;
  subtitle: string;
  description: string;
  originalPrice: number;
  discountPrice: number;
  badge: string;
  image?: string;
};

type Communication = {
  id: string;
  title: string;
  detail: string;
  tag: string;
};

type AppointmentItem = {
  id: string;
  time: string;
  clientName: string;
  services: string;
  status: string;
};

type WorkerPointItem = {
  id: string;
  name: string;
  points: number;
  manualBonusPoints?: number;
  redeemedPoints?: number;
  totalEarnedPoints?: number;
  availablePoints?: number;
};

type Props = {
  currentUser: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    photo_url?: string | null;
    locationName?: string | null;
    sedeId?: string | null;
  };
  salonGoal?: number;
  workerGoal?: number;
  currentSalonPoints?: number;
  currentWorkerPoints?: number;
  allWorkerPoints?: WorkerPointItem[];
  promos?: Promo[];
  sideCard1?: SideCard;
  sideCard2?: SideCard;
  productOfMonth?: ProductOfMonth;
  communications?: Communication[];
  unreadCommunications?: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    createdAt: string;
  }>;
  unreadNotifications?: number;
  todayAppointmentsCount?: { total: number; completed: number; pending: number };
  appointmentsTimeline?: AppointmentItem[];
  teamInTurno?: { id: string; name?: string | null; photo_url?: string | null }[];
  todayShiftTime?: string;
  workedHoursFormatted?: string;
  recentLogs?: any[];
  breakDurationMinutes?: number;
  todayShiftStartTime?: string | null;
  todayShiftAssignedHours?: number;
};

export function DashboardRedesignClient({
  currentUser = { id: "", name: "Paradise Staff", role: "DIPENDENTE" },
  salonGoal = 500,
  workerGoal = 100,
  currentSalonPoints = 0,
  currentWorkerPoints = 0,
  allWorkerPoints = [],
  promos = [],
  sideCard1 = {
    category: "PORTA UN'AMICA",
    title: "PIEGA IN OMAGGIO",
    badge: "x2",
    description: "NUOVA CLIENTE PRESENTATA = PIEGA GRATIS",
    url: "/client-control"
  },
  sideCard2 = {
    category: "LOYALTY · PARADISE CARD",
    title: "PUNTI DOPPI",
    badge: "◆",
    description: "SU TUTTI I PRODOTTI RETAIL FINO A DOMENICA",
    url: "/tables"
  },
  productOfMonth = {
    title: "PRO-GLOW SERUM",
    subtitle: "CONSIGLIATO • UPSELL",
    description: "Siero termoprotettivo. Perfetto da abbinare a ogni cheratina.",
    originalPrice: 32,
    discountPrice: 26,
    badge: "RETAIL",
  },
  communications = [],
  unreadCommunications = [],
  unreadNotifications = 0,
  todayAppointmentsCount = { total: 16, completed: 0, pending: 16 },
  appointmentsTimeline = [],
  teamInTurno = [],
  todayShiftTime = "Nessun turno oggi",
  workedHoursFormatted = "00:00",
  recentLogs = [],
  breakDurationMinutes = 60,
  todayShiftStartTime = null,
  todayShiftAssignedHours = 8,
}: Props) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthName = new Intl.DateTimeFormat("it-IT", { month: "long" }).format(new Date()).toUpperCase();

  const userName = currentUser?.name || "Paradise Staff";
  const userRole = currentUser?.role || "DIPENDENTE";

  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [activeComms, setActiveComms] = useState<any[]>([]);
  const [claimedBonusPoints, setClaimedBonusPoints] = useState(0);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const [currentStatus, setCurrentStatus] = useState<"IN_TURNO" | "IN_PAUSA" | "NON_IN_TURNO">("NON_IN_TURNO");
  const [workedSeconds, setWorkedSeconds] = useState(0);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [lastLogTime, setLastLogTime] = useState<string | null>(null);

  useEffect(() => {
    if (!recentLogs || recentLogs.length === 0) {
      setCurrentStatus("NON_IN_TURNO");
      setWorkedSeconds(0);
      setBreakSeconds(0);
      return;
    }

    const sortedLogs = [...recentLogs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const lastLog = sortedLogs[sortedLogs.length - 1];
    let status: "IN_TURNO" | "IN_PAUSA" | "NON_IN_TURNO" = "NON_IN_TURNO";
    if (lastLog.type === "ENTRATA" || lastLog.type === "RIENTRO") {
      status = "IN_TURNO";
    } else if (lastLog.type === "PAUSA") {
      status = "IN_PAUSA";
    } else if (lastLog.type === "USCITA") {
      status = "NON_IN_TURNO";
    }
    setCurrentStatus(status);
    setLastLogTime(lastLog.time || null);

    let totalWorkedMs = 0;
    let totalBreakMs = 0;
    
    let lastEntryTime: number | null = null;
    let lastPauseTime: number | null = null;

    for (let i = 0; i < sortedLogs.length; i++) {
      const log = sortedLogs[i];
      const logMs = new Date(log.timestamp).getTime();

      if (log.type === "ENTRATA" || log.type === "RIENTRO") {
        lastEntryTime = logMs;
        if (lastPauseTime !== null) {
          totalBreakMs += logMs - lastPauseTime;
          lastPauseTime = null;
        }
      } else if (log.type === "PAUSA") {
        lastPauseTime = logMs;
        if (lastEntryTime !== null) {
          totalWorkedMs += logMs - lastEntryTime;
          lastEntryTime = null;
        }
      } else if (log.type === "USCITA") {
        if (lastEntryTime !== null) {
          totalWorkedMs += logMs - lastEntryTime;
          lastEntryTime = null;
        }
      }
    }

    const updateTimes = () => {
      const now = Date.now();
      let currentWorkedSecs = Math.floor(totalWorkedMs / 1000);
      let currentBreakSecs = Math.floor(totalBreakMs / 1000);

      if (status === "IN_TURNO" && lastEntryTime !== null) {
        currentWorkedSecs += Math.floor((now - lastEntryTime) / 1000);
      } else if (status === "IN_PAUSA" && lastPauseTime !== null) {
        currentBreakSecs += Math.floor((now - lastPauseTime) / 1000);
      }

      setWorkedSeconds(currentWorkedSecs);
      setBreakSeconds(currentBreakSecs);
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);

    return () => clearInterval(interval);
  }, [recentLogs]);

  const formatSeconds = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const formatSecondsHM = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  // Sync unread communications state
  useEffect(() => {
    if (unreadCommunications) {
      setActiveComms(unreadCommunications);
    }
  }, [unreadCommunications]);

  useEffect(() => {
    if (allWorkerPoints && allWorkerPoints.length > 0) {
      const myMatch = allWorkerPoints.find((w) => 
        w.id === currentUser.id || 
        w.name.toLowerCase().includes(userName.toLowerCase()) || 
        userName.toLowerCase().includes(w.name.toLowerCase())
      );
      if (myMatch) {
        setSelectedWorkerId(myMatch.id);
      } else {
        const aurora = allWorkerPoints.find((w) => w.name.toLowerCase().includes("aurora"));
        setSelectedWorkerId(aurora ? aurora.id : allWorkerPoints[0].id);
      }
    }
  }, [currentUser.id, userName, allWorkerPoints]);

  const selectedWorker = (allWorkerPoints || []).find((w) => w.id === selectedWorkerId) || {
    id: currentUser.id,
    name: userName,
    points: currentWorkerPoints,
    availablePoints: currentWorkerPoints,
    manualBonusPoints: 0,
    redeemedPoints: 0,
  };

  const activeWorkerPoints = selectedWorker ? selectedWorker.points : currentWorkerPoints;
  const activeWorkerPercent = Math.min(100, Math.round((activeWorkerPoints / Math.max(1, workerGoal)) * 100));

  // Filter valid active promos (not expired)
  const activePromos = (promos || []).filter((p) => p && p.active && (!p.expirationDate || p.expirationDate >= todayStr));
  
  // Carousel State
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  useEffect(() => {
    if (activePromos.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % activePromos.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [activePromos.length]);

  const hasActivePromos = activePromos.length > 0;
  const activePromo = hasActivePromos ? activePromos[currentSlideIndex] || activePromos[0] : null;

  const isProductOfMonthActive = !!(
    productOfMonth &&
    (productOfMonth as any).active !== false &&
    productOfMonth.title &&
    productOfMonth.title.trim() !== "" &&
    productOfMonth.title.trim() !== "." &&
    productOfMonth.title !== "PRO-GLOW SERUM"
  );

  const salonPercent = Math.min(100, Math.round((currentSalonPoints / Math.max(1, salonGoal)) * 100));
  const isSuperAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";

  const handleClaimPoint = async (commId: string) => {
    setClaimingId(commId);
    try {
      const res = await fetch(`/api/notifications/${commId}/claim-point`, {
        method: "POST",
      });
      if (res.ok) {
        setClaimedBonusPoints((prev) => prev + 1);
        setActiveComms((prev) => prev.filter((c) => c.id !== commId));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setClaimingId(null);
    }
  };

  const renderTitle = (title: string) => {
    const parts = (title || "").split(" ");
    return parts.map((part, i) => {
      const isHighlighted = part.toUpperCase().includes("GLOW") || part.includes("-20%") || part.toUpperCase().includes("CHERATINA");
      return (
        <span key={i} className={isHighlighted ? "text-[#dc2626]" : "text-white"}>
          {part}{" "}
        </span>
      );
    });
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "PS";

  const matUrl = activePromo?.materialeGraficoUrl || "/documents";
  const isMatExternal = matUrl.startsWith("http://") || matUrl.startsWith("https://");

  const safeComms = (communications && communications.length > 0)
    ? communications
    : [
        { id: "comm-1", title: "Nuovo protocollo cheratina", detail: "Da oggi si usa la linea Pro-Glow. Scheda tecnica nei documenti.", tag: "DIREZIONE • 2 ORE FA" },
        { id: "comm-2", title: "Riunione staff venerdì 25", detail: "Ore 18:30 dopo chiusura. Presenza obbligatoria.", tag: "DIREZIONE • IERI" },
      ];

  const displayedAvailablePoints = (selectedWorker?.availablePoints ?? 0) + claimedBonusPoints;
  const displayedManualBonus = (selectedWorker?.manualBonusPoints ?? 0) + claimedBonusPoints;

  const isCard1Empty = !sideCard1 || !sideCard1.title || sideCard1.title.trim() === "." || sideCard1.title.trim() === "";
  const isCard2Empty = !sideCard2 || !sideCard2.title || sideCard2.title.trim() === "." || sideCard2.title.trim() === "";

  return (
    <div className="min-h-screen bg-[#fff8fc] pb-12 text-[#171717] antialiased">
      <div className="mx-auto w-full max-w-[1480px] space-y-5 px-3 py-4 sm:px-5 lg:px-8">
        <div className="border border-[#efb7d9] bg-[#f5c1e2] px-5 py-4 text-center sm:px-8">
          <p className="font-serif text-3xl font-bold italic leading-none text-black">Paradise</p>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-black/70">Beauty · Staff Hub</p>
        </div>

        <section className="border border-[#ecc6dc] bg-white p-5 shadow-[0_8px_30px_rgba(96,30,67,0.05)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border border-[#efb7d9] bg-[#fff3fa] text-sm font-black">
                {currentUser?.photo_url ? <img src={resolveDrivePhotoUrl(currentUser.photo_url)} alt={userName} className="size-full object-cover" /> : initials}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#bd527f]">Dashboard personale</p>
                <h1 className="truncate text-2xl font-black sm:text-3xl">Ciao, {userName.split(" ")[0]}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-bold text-black/55">
                  <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-[#c66170]" />{currentUser?.locationName || "Salone Buenos Aires"}</span>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5 text-[#c66170]" />{new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "long" }).format(new Date())}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={cn("inline-flex min-h-10 items-center gap-2 border px-3 text-xs font-black uppercase", currentStatus === "IN_TURNO" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : currentStatus === "IN_PAUSA" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-black/10 bg-[#fafafa] text-black/45")}>
                <span className={cn("size-2 rounded-full", currentStatus === "IN_TURNO" ? "bg-emerald-500" : currentStatus === "IN_PAUSA" ? "bg-amber-500" : "bg-black/20")} />
                {currentStatus === "IN_TURNO" ? "In turno" : currentStatus === "IN_PAUSA" ? "In pausa" : "Fuori turno"}
              </div>
              {isSuperAdmin && <Link href="/settings/dashboard" className="inline-flex min-h-10 items-center gap-2 bg-black px-4 text-xs font-black uppercase text-white transition hover:bg-[#c66170]"><Settings className="size-4" />Gestisci</Link>}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 border border-[#efcfdf] bg-[#fffafd] sm:grid-cols-4">
            <div className="border-b border-r border-[#efcfdf] p-4 sm:border-b-0"><p className="text-[10px] font-black uppercase text-black/40">Clienti oggi</p><p className="mt-1 text-2xl font-black">{todayAppointmentsCount.total}</p></div>
            <div className="border-b border-[#efcfdf] p-4 sm:border-b-0 sm:border-r"><p className="text-[10px] font-black uppercase text-black/40">Da completare</p><p className="mt-1 text-2xl font-black text-[#c66170]">{todayAppointmentsCount.pending}</p></div>
            <div className="border-r border-[#efcfdf] p-4"><p className="text-[10px] font-black uppercase text-black/40">Completate</p><p className="mt-1 text-2xl font-black text-emerald-700">{todayAppointmentsCount.completed}</p></div>
            <div className="p-4"><p className="text-[10px] font-black uppercase text-black/40">Ore presenza</p><p className="mt-1 font-mono text-xl font-black">{currentStatus === "IN_PAUSA" ? formatSeconds(breakSeconds) : formatSeconds(workedSeconds)}</p></div>
          </div>
        </section>

        {activeComms.length > 0 && <section className="border border-[#e8a2c8] bg-[#fff0f8] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2"><Bell className="size-4 text-[#c66170]" /><h2 className="text-xs font-black uppercase tracking-[0.14em]">Comunicazioni da leggere</h2></div>
          <div className="divide-y divide-[#edc6dc]">{activeComms.map((comm) => <div key={comm.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black">{comm.title}</p><p className="mt-1 text-sm text-black/60">{comm.message}</p></div><button disabled={claimingId === comm.id} onClick={() => handleClaimPoint(comm.id)} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 bg-black px-4 text-xs font-black uppercase text-white disabled:opacity-50"><Check className="size-4" />Ho compreso (+1)</button></div>)}</div>
        </section>}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.65fr)]">
          <div className="space-y-5">
            {(hasActivePromos || !isCard1Empty || !isCard2Empty) && <section className="border border-[#ecc6dc] bg-white">
              <div className="flex items-center justify-between border-b border-[#ecc6dc] bg-[#f5c1e2] px-5 py-3"><h2 className="text-xs font-black uppercase tracking-[0.14em]">Promo e campagne attive</h2><span className="text-xs font-black">{activePromos.length}</span></div>
              <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.6fr)]">
                {hasActivePromos && activePromo ? <div className="relative flex min-h-[280px] flex-col justify-between overflow-hidden bg-black p-6 text-white sm:p-8">
                  {activePromo.image ? <img src={resolveDrivePhotoUrl(activePromo.image)} alt="" className="absolute inset-0 size-full object-cover opacity-30" /> : null}
                  <div className="relative z-10 max-w-2xl"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f5c1e2]">{activePromo.subtitle || "Promo della settimana"}</p><h3 className="mt-3 text-3xl font-black uppercase leading-tight sm:text-4xl">{renderTitle(activePromo.title || "")}</h3><p className="mt-4 max-w-xl text-sm leading-6 text-white/65">{activePromo.description}</p></div>
                  <div className="relative z-10 mt-7 flex flex-wrap gap-2"><Link href={`/promos/${activePromo.id}`} className="inline-flex min-h-11 items-center gap-2 bg-white px-4 text-xs font-black uppercase text-black">Dettagli <ArrowRight className="size-4" /></Link>{activePromo.ctaUrl ? <Link href={activePromo.ctaUrl} className="inline-flex min-h-11 items-center border border-white/30 px-4 text-xs font-black uppercase text-white">{activePromo.ctaText || "Condividi"}</Link> : null}{isMatExternal ? <a href={matUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 border border-white/30 px-4 text-xs font-black uppercase text-white">Materiale <ExternalLink className="size-3.5" /></a> : <Link href={matUrl} className="inline-flex min-h-11 items-center border border-white/30 px-4 text-xs font-black uppercase text-white">Materiale</Link>}</div>
                </div> : <div className="grid min-h-40 place-items-center p-6 text-sm font-bold text-black/40">Nessuna promo principale attiva</div>}
                <div className="divide-y divide-[#ecc6dc] border-t border-[#ecc6dc] lg:border-l lg:border-t-0">
                  {!isCard1Empty && <Link href={sideCard1?.url || "/client-control"} className="flex min-h-32 flex-col justify-center p-5 transition hover:bg-[#fff7fb]"><div className="flex items-start justify-between gap-4"><p className="text-[10px] font-black uppercase text-[#bd527f]">{sideCard1.category}</p><span className="font-black">{sideCard1.badge}</span></div><h3 className="mt-2 text-lg font-black uppercase">{sideCard1.title}</h3><p className="mt-2 text-xs font-bold uppercase leading-5 text-black/45">{sideCard1.description}</p></Link>}
                  {!isCard2Empty && <Link href={sideCard2?.url || "/tables"} className="flex min-h-32 flex-col justify-center p-5 transition hover:bg-[#fff7fb]"><div className="flex items-start justify-between gap-4"><p className="text-[10px] font-black uppercase text-[#bd527f]">{sideCard2.category}</p><span className="font-black">{sideCard2.badge}</span></div><h3 className="mt-2 text-lg font-black uppercase">{sideCard2.title}</h3><p className="mt-2 text-xs font-bold uppercase leading-5 text-black/45">{sideCard2.description}</p></Link>}
                </div>
              </div>
            </section>}

            <section className="border border-[#ecc6dc] bg-white">
              <div className="flex items-center justify-between border-b border-[#ecc6dc] bg-[#f5c1e2] px-5 py-3"><h2 className="text-xs font-black uppercase tracking-[0.14em]">Rendiconto e traguardi</h2><Sparkles className="size-4" /></div>
              <div className={cn("grid divide-y divide-[#ecd5e1] md:divide-x md:divide-y-0", isSuperAdmin ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3")}>
                {isSuperAdmin && <div className="bg-black p-5 text-white"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase text-white/50">Obiettivo salone · {currentMonthName}</p><Zap className="size-4 text-[#f5c1e2]" /></div><p className="mt-4 text-3xl font-black">{currentSalonPoints}<span className="ml-2 text-xs text-white/45">/ {salonGoal} schede</span></p><div className="mt-5 h-2 bg-white/15"><div className="h-full bg-[#f5c1e2] transition-all" style={{ width: `${salonPercent}%` }} /></div><p className="mt-2 text-[10px] font-black uppercase text-white/55">{salonPercent}% raggiunto</p></div>}
                <div className="p-5"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase text-black/40">Obiettivo personale</p><Award className="size-4 text-[#c66170]" /></div>{isSuperAdmin && allWorkerPoints.length > 0 ? <select value={selectedWorkerId} onChange={(e) => setSelectedWorkerId(e.target.value)} className="mt-3 h-9 w-full border border-[#e8c6d9] bg-white px-2 text-xs font-bold outline-none">{allWorkerPoints.map((worker) => <option key={worker.id} value={worker.id}>{worker.name} ({worker.points})</option>)}</select> : <p className="mt-2 text-xs font-bold text-black/50">{userName}</p>}<p className="mt-4 text-3xl font-black">{activeWorkerPoints}<span className="ml-2 text-xs text-black/35">/ {workerGoal} schede</span></p><div className="mt-5 h-2 bg-[#f8e8f1]"><div className="h-full bg-[#c66170] transition-all" style={{ width: `${activeWorkerPercent}%` }} /></div><p className={cn("mt-2 text-[10px] font-black uppercase", activeWorkerPercent >= 100 ? "text-emerald-700" : "text-black/40")}>{activeWorkerPercent >= 100 ? "Completato (+10 punti)" : `${activeWorkerPercent}% raggiunto`}</p></div>
                <div className="p-5"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase text-black/40">Saldo punti</p><Gift className="size-4 text-[#c66170]" /></div><p className="mt-4 text-3xl font-black">{displayedAvailablePoints}<span className="ml-2 text-xs text-emerald-700">disponibili</span></p><p className="mt-2 text-xs text-black/45">Riscattati {selectedWorker?.redeemedPoints ?? 0} · Extra +{displayedManualBonus}</p>{displayedAvailablePoints >= 10 ? <Link href="/requests" className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 bg-black px-3 text-xs font-black uppercase text-white"><Gift className="size-4" />Riscatta premio</Link> : <Link href="/points" className="mt-5 inline-flex min-h-10 w-full items-center justify-center border border-[#e8c6d9] px-3 text-xs font-black uppercase">Vedi dettaglio</Link>}</div>
                <div className={cn("p-5", currentStatus === "IN_TURNO" ? "bg-emerald-50/50" : currentStatus === "IN_PAUSA" ? "bg-amber-50" : "bg-white")}><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase text-black/40">{currentStatus === "IN_PAUSA" ? "Pausa di oggi" : "Presenza di oggi"}</p><Clock className={cn("size-4", currentStatus === "IN_TURNO" ? "text-emerald-600" : currentStatus === "IN_PAUSA" ? "text-amber-600" : "text-black/30")} /></div><p className="mt-4 font-mono text-3xl font-black">{currentStatus === "IN_PAUSA" ? formatSeconds(breakSeconds) : formatSeconds(workedSeconds)}</p><p className="mt-2 text-xs font-bold text-black/45">Turno: {todayShiftTime}</p><p className="mt-1 text-[10px] font-black uppercase text-black/35">{currentStatus === "IN_PAUSA" ? `In pausa dalle ${lastLogTime || "--:--"}` : currentStatus === "IN_TURNO" ? `Pausa accumulata ${Math.floor(breakSeconds / 60)} min` : `Ore registrate ${workedHoursFormatted}`}</p></div>
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="border border-[#ecc6dc] bg-white">
              <div className="flex items-center justify-between border-b border-[#ecc6dc] bg-[#f5c1e2] px-4 py-3"><h2 className="text-xs font-black uppercase tracking-[0.14em]">Team in turno</h2><span className="text-xs font-black">{teamInTurno.length}</span></div>
              <div className="flex flex-wrap gap-3 p-4">{teamInTurno.length > 0 ? teamInTurno.map((worker) => <div key={worker.id} className="flex w-[calc(50%-0.375rem)] min-w-0 items-center gap-2 border border-[#f0dae6] p-2"><div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#fff0f8] text-xs font-black">{worker.photo_url ? <img src={resolveDrivePhotoUrl(worker.photo_url)} alt="" className="size-full object-cover" /> : (worker.name || "S").slice(0, 1)}</div><div className="min-w-0"><p className="truncate text-xs font-black">{worker.name}</p><p className="mt-0.5 text-[9px] font-black uppercase text-emerald-700">Attivo</p></div></div>) : <p className="py-4 text-sm font-bold text-black/40">Nessun collega registrato.</p>}</div>
            </section>

            <section className="border border-[#ecc6dc] bg-white">
              <div className="flex items-center justify-between border-b border-[#ecc6dc] px-4 py-3"><h2 className="text-xs font-black uppercase tracking-[0.14em]">Agenda di oggi</h2><Link href="/appointments" className="text-[10px] font-black uppercase text-[#bd527f]">Apri agenda</Link></div>
              <div className="max-h-[360px] divide-y divide-[#f0dde7] overflow-auto">{appointmentsTimeline.length > 0 ? appointmentsTimeline.slice(0, 8).map((appointment) => <div key={appointment.id} className="grid grid-cols-[52px_1fr_auto] items-center gap-3 px-4 py-3"><p className="font-mono text-sm font-black">{appointment.time}</p><div className="min-w-0"><p className="truncate text-sm font-black">{appointment.clientName}</p><p className="truncate text-[10px] font-bold uppercase text-black/40">{appointment.services}</p></div><span className={cn("size-2 rounded-full", appointment.status === "APPROVED" || appointment.status === "COMPLETED" ? "bg-emerald-500" : "bg-[#d86c9e]")} /></div>) : <p className="p-5 text-sm font-bold text-black/40">Nessun appuntamento disponibile.</p>}</div>
            </section>

            <section className="border border-[#ecc6dc] bg-white p-4"><div className="flex items-center justify-between"><h2 className="text-xs font-black uppercase tracking-[0.14em]">Bacheca direzione</h2><Link href="/notifications" className="text-[10px] font-black uppercase text-[#bd527f]">Vedi tutto</Link></div><div className="mt-3 divide-y divide-[#f0dde7]">{safeComms.slice(0, 3).map((comm, idx) => <div key={comm.id || idx} className="py-3 first:pt-0 last:pb-0"><div className="flex gap-2"><Megaphone className="mt-0.5 size-3.5 shrink-0 text-[#c66170]" /><div><p className="text-xs font-black uppercase">{comm.title}</p><p className="mt-1 text-xs leading-5 text-black/50">{comm.detail}</p></div></div></div>)}</div></section>
          </aside>
        </div>

        <div className={cn("grid gap-5", isProductOfMonthActive ? "lg:grid-cols-[1fr_320px]" : "grid-cols-1")}>
          <section className="border border-[#ecc6dc] bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-xs font-black uppercase tracking-[0.14em]">Schema punti</h2><BookOpen className="size-4 text-[#c66170]" /></div><div className="mt-4 grid gap-px bg-[#ecd5e1] sm:grid-cols-2 lg:grid-cols-5">{[{ title: "Foto prima/dopo", pts: "+1", icon: Camera }, { title: "Note e qualità", pts: "Qualità", icon: FileText }, { title: "Target personale", pts: "+10", icon: Award }, { title: "Target salone", pts: "+10", icon: Zap }, { title: "Lettura avvisi", pts: "+1", icon: Bell }].map((rule) => <div key={rule.title} className="flex items-center gap-3 bg-white p-3"><rule.icon className="size-4 text-[#c66170]" /><div><p className="text-xs font-black">{rule.title}</p><p className="text-[10px] font-black uppercase text-emerald-700">{rule.pts} punti</p></div></div>)}</div></section>
          {isProductOfMonthActive ? <section className="border border-[#ecc6dc] bg-white p-5"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase text-[#bd527f]">Prodotto del mese</p><span className="text-[9px] font-black uppercase">{productOfMonth.badge}</span></div><div className="mt-3 flex items-center gap-4">{productOfMonth.image ? <img src={resolveDrivePhotoUrl(productOfMonth.image)} alt={productOfMonth.title} className="size-20 object-contain" /> : <div className="grid size-20 place-items-center bg-[#fff0f8] font-serif text-2xl font-black">P</div>}<div><h3 className="text-sm font-black uppercase">{productOfMonth.title}</h3><p className="mt-1 text-xs text-black/45">{productOfMonth.description}</p><p className="mt-2 text-sm font-black">€{productOfMonth.discountPrice}</p></div></div></section> : null}
        </div>

        <p className="py-3 text-center text-[9px] font-black uppercase tracking-[0.18em] text-black/35">Paradise Beauty · Staff Hub</p>
      </div>
    </div>
  );
}
