"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Upload, 
  Calendar, 
  Clock, 
  Users, 
  Zap, 
  Settings,
  Bell,
  ExternalLink,
  Award,
  TrendingUp,
  Gift,
  Check,
  Megaphone,
  FileText,
  Camera,
  Star,
  BookOpen
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

  const activePromo = activePromos[currentSlideIndex] || {
    id: "default-promo",
    title: "LUGLIO GLOW -20% CHERATINA",
    subtitle: "PROMO DELLA SETTIMANA",
    description: "Tutti i trattamenti di cheratina e ristrutturazione a -20%. Proponilo alle clienti con colore o schiariture: massimo effetto, upsell naturale.",
    badge: "VALIDA FINO AL 31 LUGLIO",
    ctaText: "CONDIVIDI COL CLIENTE",
    ctaUrl: "/service-forms",
    materialeGraficoUrl: "/documents",
    active: true
  };

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

  const truthy = (val: any) => !!val;

  return (
    <div className="bg-transparent min-h-screen text-neutral-900 font-sans antialiased pb-16">
      <div className="max-w-[1280px] mx-auto space-y-8">

        {/* TOP HEADER BAR */}
        <div className="bg-white border border-neutral-200 px-6 py-4 rounded-[20px] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full overflow-hidden border border-neutral-200 bg-neutral-50 flex items-center justify-center text-sm font-bold text-neutral-800 shadow-xs shrink-0">
              {currentUser?.photo_url ? (
                <img src={resolveDrivePhotoUrl(currentUser.photo_url)} alt={userName} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>

            <div className="text-left">
              <h1 className="text-base font-serif font-light text-neutral-900 tracking-wide uppercase leading-none">
                {userName}
              </h1>
              <p className="text-[9px] font-black text-neutral-400 tracking-[0.2em] uppercase mt-1">
                {userRole === "DIPENDENTE" ? "HAIR STYLIST" : userRole.replace("_", " ")}
              </p>
            </div>

            <div className="ml-2 inline-flex items-center gap-1 bg-neutral-900 text-white px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase">
              <span>{currentUser?.locationName ? currentUser.locationName.toUpperCase() : "SALONE BUENOS AIRES"}</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 border-l border-neutral-200 pl-4 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>IN TURNO</span>
              <span className="text-neutral-300 font-normal">·</span>
              <span className="font-mono text-neutral-700">{workedHoursFormatted || "00:00"}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <Link 
                href="/settings/dashboard"
                className="text-[9px] font-black uppercase tracking-[0.18em] bg-neutral-900 text-white px-4 py-2.5 rounded-full hover:bg-neutral-800 transition duration-200 flex items-center gap-1.5 shadow-2xs"
              >
                <Settings size={12} />
                <span>Gestione Obiettivi</span>
              </Link>
            )}

            <Link href="/notifications" className="p-2.5 border border-neutral-200 hover:bg-neutral-50 rounded-full text-neutral-500 transition duration-200 relative">
              <Bell size={15} />
              {unreadNotifications > 0 && (
                <span className="absolute top-0.5 right-0.5 size-2 bg-red-600 rounded-full" />
              )}
            </Link>
          </div>
        </div>

        {/* 📢 AVVISI E COMUNICAZIONI DA FIRMARE (AT THE VERY TOP) */}
        {activeComms.length > 0 && (
          <div className="space-y-3">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-400 block text-left">COMUNICAZIONI IMPORTANTI DA LEGGERE</span>
            <div className="space-y-3">
              {activeComms.map((comm) => (
                <div 
                  key={comm.id}
                  className="bg-neutral-50 border border-neutral-200 p-5 md:p-6 rounded-[20px] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-left animate-in fade-in duration-200"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                      <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider">{comm.title}</h4>
                    </div>
                    <p className="text-xs text-neutral-600 pl-4 font-normal leading-relaxed">{comm.message}</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-neutral-400 pl-4 mt-0.5">
                      Inserito il {new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(comm.createdAt))}
                    </p>
                  </div>

                  <button
                    disabled={claimingId === comm.id}
                    onClick={() => handleClaimPoint(comm.id)}
                    className="shrink-0 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[9px] tracking-[0.18em] uppercase px-5 py-3 rounded-xl shadow-2xs transition duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Check size={12} />
                    <span>Ho compreso (+1 Punto)</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 1: PROMO & CAMPAGNE ATTIVE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400 text-left">
              PROMO & CAMPAGNE ATTIVE
            </h2>
            <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
              {activePromos.length} ATTIVE · IN CASSA
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Main Featured Promo Card */}
            <div className="lg:col-span-2 bg-neutral-950 text-white p-8 md:p-10 rounded-[24px] flex flex-col justify-between min-h-[290px] relative overflow-hidden shadow-soft">
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-80 h-80 rounded-full border border-neutral-800 pointer-events-none" />

              <div className="space-y-4 relative z-10 text-left">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.25em] text-[#dc2626]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]" />
                  <span>{activePromo.subtitle || "PROMO DELLA SETTIMANA"}</span>
                </div>

                <h3 className="text-2xl md:text-3xl font-serif font-light tracking-wide leading-none uppercase">
                  {renderTitle(activePromo.title || "")}
                </h3>

                <p className="text-xs md:text-sm text-neutral-400 max-w-xl leading-relaxed font-normal">
                  {activePromo.description}
                </p>
              </div>

              <div className="pt-6 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-800/80 relative z-10 mt-6">
                <div className="flex flex-wrap items-center gap-3">
                  {activePromo.ctaUrl && (
                    <Link
                      href={activePromo.ctaUrl}
                      className="bg-white hover:bg-neutral-100 text-neutral-900 text-[10px] font-black uppercase tracking-wider px-5 py-3 rounded-lg flex items-center gap-1.5 transition"
                    >
                      <Upload size={13} className="rotate-90" />
                      <span>{activePromo.ctaText || "CONDIVIDI"}</span>
                    </Link>
                  )}

                  {isMatExternal ? (
                    <a
                      href={matUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border border-neutral-700 hover:border-neutral-500 text-white text-[10px] font-black uppercase tracking-wider px-5 py-3 rounded-lg transition flex items-center gap-1.5"
                    >
                      <span>MATERIALE GRAFICO</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <Link
                      href={matUrl}
                      className="border border-neutral-700 hover:border-neutral-500 text-white text-[10px] font-black uppercase tracking-wider px-5 py-3 rounded-lg transition"
                    >
                      MATERIALE GRAFICO
                    </Link>
                  )}

                  {activePromo.badge && (
                    <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-[0.2em] ml-2">
                      {activePromo.badge}
                    </span>
                  )}
                </div>

                {/* Dashed Slide Indicators */}
                {activePromos.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    {activePromos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentSlideIndex(i)}
                        className={`h-0.5 transition-all duration-300 ${
                          i === currentSlideIndex ? "w-6 bg-white" : "w-2 bg-neutral-700"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Side Stacked Cards */}
            <div className="space-y-4 flex flex-col justify-between">
              
              {/* Card 1: Porta un'amica */}
              <Link 
                href={sideCard1?.url || "/client-control"}
                className="bg-white border border-neutral-200 p-6 flex flex-col justify-between flex-1 rounded-[20px] shadow-2xs hover:border-neutral-400 transition duration-200 text-left"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400">
                      {sideCard1?.category || "PORTA UN'AMICA"}
                    </span>
                    <h4 className="text-base font-serif font-light text-neutral-900 tracking-wide uppercase mt-1">
                      {sideCard1?.title || "PIEGA IN OMAGGIO"}
                    </h4>
                  </div>
                  <span className="text-sm font-black text-[#dc2626]">
                    {sideCard1?.badge || "x2"}
                  </span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mt-3 leading-relaxed">
                  {sideCard1?.description || "NUOVA CLIENTE PRESENTATA = PIEGA GRATIS"}
                </p>
              </Link>

              {/* Card 2: Loyalty */}
              <Link 
                href={sideCard2?.url || "/tables"}
                className="bg-white border border-neutral-200 p-6 flex flex-col justify-between flex-1 rounded-[20px] shadow-2xs hover:border-neutral-400 transition duration-200 text-left"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400">
                      {sideCard2?.category || "LOYALTY · PARADISE CARD"}
                    </span>
                    <h4 className="text-base font-serif font-light text-neutral-900 tracking-wide uppercase mt-1">
                      {sideCard2?.title || "PUNTI DOPPI"}
                    </h4>
                  </div>
                  <div className="text-[#dc2626] font-bold text-xs tracking-wider">
                    {sideCard2?.badge || "◆"}
                  </div>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mt-3 leading-relaxed">
                  {sideCard2?.description || "SU TUTTI I PRODOTTI RETAIL FINO A DOMENICA"}
                </p>
              </Link>

            </div>

          </div>
        </div>

        {/* SECTION 2: ORE & TARGETS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400 text-left">
              RENDICONTO & TRAGUARDI
            </h2>
          </div>

          {/* Connected KPI Boxes Row */}
          <div className={cn(
            "grid border border-neutral-200 bg-white shadow-2xs divide-y md:divide-y-0 md:divide-x divide-neutral-200 rounded-[24px] overflow-hidden",
            isSuperAdmin ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-3"
          )}>
            
            {/* BOX 1: OBIETTIVO SALONE (BLACK BOX) - ONLY visible for Admin */}
            {isSuperAdmin && (
              <div className="bg-neutral-955 text-white p-6 space-y-4 flex flex-col justify-between text-left">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-400">
                      OBIETTIVO SALONE · {currentMonthName}
                    </span>
                    <Zap size={13} className="text-white" />
                  </div>

                  <div className="text-2xl font-serif font-light tracking-wide text-white mt-3">
                    {currentSalonPoints} <span className="text-[10px] font-sans font-bold tracking-wider text-neutral-500 uppercase">/ {salonGoal} SCHEDE</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-neutral-400 transition-all duration-700" 
                      style={{ width: `${salonPercent}%` }} 
                    />
                  </div>
                  <div className="flex justify-between items-center text-[8px] font-black tracking-widest uppercase">
                    <span className="text-neutral-500">{salonPercent}% RAGGIUNTO</span>
                    <span className={salonPercent >= 100 ? "text-white font-extrabold" : "text-amber-500"}>
                      {salonPercent >= 100 ? "SBLOCCATO (+10P)" : "IN CORSO"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* BOX 2: OBIETTIVO PERSONALE */}
            <div className="p-6 space-y-4 flex flex-col justify-between bg-white text-left">
              <div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-400">
                    OBIETTIVO PERSONALE
                  </span>
                  <Award size={14} className="text-neutral-400 shrink-0" />
                </div>

                {isSuperAdmin && allWorkerPoints && allWorkerPoints.length > 0 ? (
                  <div className="mt-1.5">
                    <select
                      value={selectedWorkerId}
                      onChange={(e) => setSelectedWorkerId(e.target.value)}
                      className="w-full text-[10px] font-black uppercase tracking-wider bg-neutral-50 border border-neutral-200 px-2 py-1 rounded focus:outline-none focus:border-black cursor-pointer text-black"
                    >
                      {allWorkerPoints.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name.toUpperCase()} ({w.points} SCHEDE)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500 mt-1">
                    PERSONALE ({userName.split(" ")[0].toUpperCase()})
                  </div>
                )}

                <div className="text-2xl font-serif font-light tracking-wide text-neutral-900 mt-3">
                  {activeWorkerPoints} <span className="text-[10px] font-sans font-bold tracking-wider text-neutral-400 uppercase">/ {workerGoal} SCHEDE</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="w-full h-1 bg-neutral-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-neutral-900 transition-all duration-700" 
                    style={{ width: `${activeWorkerPercent}%` }} 
                  />
                </div>
                <div className="flex justify-between items-center text-[8px] font-black tracking-widest uppercase">
                  <span className="text-neutral-400">{activeWorkerPercent}% RAGGIUNTO</span>
                  <span className={activeWorkerPercent >= 100 ? "text-neutral-900 font-extrabold" : "text-amber-700"}>
                    {activeWorkerPercent >= 100 ? "🎉 COMPLETATO (+10P)" : "IN CORSO (+10P)"}
                  </span>
                </div>
              </div>
            </div>

            {/* BOX 3: SALDO PUNTI & RISCATTO PREMI */}
            <div className="p-6 space-y-4 flex flex-col justify-between bg-white text-left">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-400">
                  SALDO PUNTI PREMIUM
                </span>
                <Gift size={14} className="text-neutral-400" />
              </div>

               <div>
                <div className="text-3xl font-serif font-light text-neutral-900">
                  {displayedAvailablePoints} <span className="text-[10px] font-sans font-bold tracking-wider text-emerald-700 uppercase">PUNTI DISPONIBILI</span>
                </div>
                <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-widest text-neutral-400 mt-1">
                  <span>Traguardo personale & letture</span>
                  <Link href="/points" className="text-neutral-950 font-black tracking-wider underline hover:text-neutral-600 transition">
                    VEDI DETTAGLIO
                  </Link>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 space-y-2">
                {displayedAvailablePoints >= 10 ? (
                  <Link
                    href="/requests"
                    className="w-full bg-neutral-900 hover:bg-neutral-800 text-white text-[9px] font-black uppercase tracking-[0.18em] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition shadow-2xs"
                  >
                    <Gift size={12} />
                    <span>Riscatta Premio (10P)</span>
                  </Link>
                ) : (
                  <div className="text-[8px] font-black uppercase text-neutral-400 text-center py-1.5 bg-neutral-50 border border-neutral-200 rounded">
                    Mancano {10 - displayedAvailablePoints} punti al riscatto
                  </div>
                )}

                <div className="flex justify-between text-[8px] font-black tracking-wider text-neutral-400 uppercase pt-0.5">
                  <span>Riscattati: {selectedWorker?.redeemedPoints ?? 0}P</span>
                  <span>Extra Admin: +{displayedManualBonus}P</span>
                </div>
              </div>
            </div>

            {/* BOX 4: ORE LAVORATE */}
            <div className="p-6 space-y-4 flex flex-col justify-between bg-white text-left">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-400">
                  ORE PRESENZA OGGI
                </span>
                <Clock size={14} className="text-neutral-400" />
              </div>

              <div className="text-3xl font-serif font-light text-neutral-900 flex items-center gap-2">
                <span>{workedHoursFormatted || "00:00"}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-400 border-t border-neutral-100 pt-2">
                PAUSA {breakDurationMinutes} MINUTI REGISTRATI
              </p>
            </div>

          </div>
        </div>

        {/* SECTION 3: BOTTOM GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: COMUNICAZIONI DIREZIONE */}
          <div className="bg-white border border-neutral-200 p-6 space-y-5 rounded-[24px] shadow-2xs text-left">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-xs font-serif font-light text-neutral-900 tracking-wide uppercase">
                Bacheca Direzione
              </h3>
              <Link href="/notifications" className="text-[9px] font-black uppercase tracking-[0.18em] text-neutral-500 hover:text-neutral-900 transition">
                Vedi Tutto
              </Link>
            </div>

            <div className="space-y-4 pt-1">
              {safeComms.slice(0, 3).map((comm, idx) => (
                <div key={comm.id || idx} className="space-y-1.5 border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <Megaphone size={12} className="text-neutral-400 shrink-0" />
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                      {comm.title}
                    </h4>
                  </div>
                  <p className="text-xs text-neutral-500 pl-5 font-normal leading-relaxed">
                    {comm.detail}
                  </p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400 pl-5">
                    {comm.tag}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: SCHEMA PUNTI & REGOLAMENTO (REPLACED PROSSIMO CLIENTE) */}
          <div className="bg-white border border-neutral-200 p-6 space-y-5 rounded-[24px] shadow-2xs text-left">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-xs font-serif font-light text-neutral-900 tracking-wide uppercase">
                Schema Punti & Regolamento
              </h3>
              <BookOpen size={14} className="text-neutral-400" />
            </div>

            <div className="space-y-3.5 pt-1 text-xs">
              {[
                { title: "Foto Cliente Prima/Dopo", desc: "Carica 1 foto frontale prima e dopo il servizio per documentazione.", pts: "+1 Punto", icon: Camera },
                { title: "Controllo Note e Qualità", desc: "Compila accuratamente le note per ogni cliente su Controllo Cliente.", pts: "Qualità", icon: FileText },
                { title: "Obiettivo Personale", desc: "Raggiungi il tuo target mensile di schede compilate.", pts: "+10 Punti", icon: Award },
                { title: "Obiettivo Salone (Admin)", desc: "Collabora per raggiungere il target cumulativo del salone.", pts: "+10 Punti", icon: Zap },
                { title: "Lettura Avvisi Importanti", desc: "Leggi e firma gli avvisi in cima per dichiarare la comprensione.", pts: "+1 Punto", icon: Bell },
              ].map((rule, idx) => (
                <div key={idx} className="flex items-start gap-3 border-b border-neutral-100 pb-2.5 last:border-0 last:pb-0">
                  <div className="w-6 h-6 rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-center text-neutral-600 shrink-0 mt-0.5">
                    <rule.icon size={12} />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between font-bold text-neutral-900">
                      <span>{rule.title}</span>
                      <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider font-mono">{rule.pts}</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-normal">{rule.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: PRODOTTO DEL MESE */}
          <div className="bg-white border border-neutral-200 p-6 space-y-5 rounded-[24px] shadow-2xs flex flex-col justify-between text-left">
            <div>
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="text-xs font-serif font-light text-neutral-900 tracking-wide uppercase">
                  Prodotto Del Mese
                </h3>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#dc2626] bg-[#dc2626]/10 px-2 py-0.5 rounded-full border border-[#dc2626]/20">
                  {productOfMonth?.badge || "RETAIL"}
                </span>
              </div>

              {/* Minimal product box */}
              <div className="mt-4 border border-neutral-200 h-32 bg-neutral-50 flex items-center justify-center relative overflow-hidden rounded-xl">
                <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(45deg,#000_25%,transparent_25%,transparent_50%,#000_50%,#000_75%,transparent_75%,transparent)] bg-[length:16px_16px]" />
                <div className="w-8 h-16 border border-neutral-300 rounded-b-lg relative z-10 flex items-center justify-center">
                  <span className="text-neutral-400 text-[10px] font-black">P</span>
                </div>
              </div>

              <div className="mt-4 text-center space-y-1">
                <span className="text-[8px] font-black uppercase tracking-widest text-[#dc2626] block">
                  ◆ {productOfMonth?.subtitle || "CONSIGLIATO · UPSELL"}
                </span>
                <h4 className="text-sm font-serif font-light uppercase text-neutral-900 tracking-wider">
                  {productOfMonth?.title || "PRO-GLOW SERUM"}
                </h4>
                <p className="text-[11px] text-neutral-400 font-medium leading-relaxed max-w-xs mx-auto">
                  {productOfMonth?.description || "Siero termoprotettivo. Perfetto da abbinare a ogni cheratina."}
                </p>

                <div className="pt-2 flex items-center justify-center gap-3 text-xs font-bold text-neutral-800">
                  {(productOfMonth?.originalPrice || 0) > 0 && (
                    <span className="text-neutral-400 line-through">€{productOfMonth?.originalPrice}</span>
                  )}
                  <span className="text-neutral-900 text-sm font-mono">€{productOfMonth?.discountPrice || 26}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM FOOTER BRANDING LINE */}
        <div className="pt-8 text-center text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">
          PARADISE — STAFF HUB — DIOR EDITORIAL REDESIGN
        </div>

      </div>
    </div>
  );
}
