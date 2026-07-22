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
  Gift
} from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";

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

  useEffect(() => {
    if (allWorkerPoints && allWorkerPoints.length > 0) {
      // Check if current user matches a worker in allWorkerPoints
      const myMatch = allWorkerPoints.find((w) => 
        w.id === currentUser.id || 
        w.name.toLowerCase().includes(userName.toLowerCase()) || 
        userName.toLowerCase().includes(w.name.toLowerCase())
      );
      if (myMatch) {
        setSelectedWorkerId(myMatch.id);
      } else {
        // Default to Aurora Dassisti if present, or first worker
        const aurora = allWorkerPoints.find((w) => w.name.toLowerCase().includes("aurora"));
        setSelectedWorkerId(aurora ? aurora.id : allWorkerPoints[0].id);
      }
    }
  }, [currentUser.id, userName, allWorkerPoints]);

  const selectedWorker = (allWorkerPoints || []).find((w) => w.id === selectedWorkerId) || {
    id: currentUser.id,
    name: userName,
    points: currentWorkerPoints,
  };

  const activeWorkerPoints = selectedWorker ? selectedWorker.points : currentWorkerPoints;
  const activeWorkerPercent = Math.min(100, Math.round((activeWorkerPoints / Math.max(1, workerGoal)) * 100));
  const activeWorkerRemaining = Math.max(0, workerGoal - activeWorkerPoints);

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

  // Salon Points Calculation (% and remaining)
  const salonPercent = Math.min(100, Math.round((currentSalonPoints / Math.max(1, salonGoal)) * 100));
  const salonRemaining = Math.max(0, salonGoal - currentSalonPoints);

  // Worker Points Calculation (% and remaining)
  const workerPercent = Math.min(100, Math.round((currentWorkerPoints / Math.max(1, workerGoal)) * 100));
  const workerRemaining = Math.max(0, workerGoal - currentWorkerPoints);

  const isSuperAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";

  // Helper for title styling (split words to highlight red/pink if GLOW or -20%)
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

  const teamNamesStr = (teamInTurno || []).length > 0 
    ? teamInTurno.slice(0, 3).map((w) => (w?.name || "Staff").split(" ")[0].toUpperCase()).join(" · ") + (teamInTurno.length > 3 ? ` +${teamInTurno.length - 3}` : "")
    : "MIRIAM · GIUSEPPE · AURORA +22";

  // Materiale Grafico Action Link
  const matUrl = activePromo?.materialeGraficoUrl || "/documents";
  const isMatExternal = matUrl.startsWith("http://") || matUrl.startsWith("https://");

  const safeTimeline = (appointmentsTimeline && appointmentsTimeline.length > 0)
    ? appointmentsTimeline
    : [
        { id: "app-1", time: "11:14", clientName: "ILARIA DEL MONACO", services: "CONTROLLO CLIENTE", status: "SCHEDULED" },
        { id: "app-2", time: "14:30", clientName: "GIULIA MARINO", services: "TAGLIO + PIEGA • 45 MIN", status: "SCHEDULED" },
        { id: "app-3", time: "15:30", clientName: "ELENA COSTA", services: "COLORE + CHERATINA", status: "SCHEDULED" },
      ];

  const safeComms = (communications && communications.length > 0)
    ? communications
    : [
        { id: "comm-1", title: "Nuovo protocollo cheratina", detail: "Da oggi si usa la linea Pro-Glow. Scheda tecnica nei documenti.", tag: "DIREZIONE • 2 ORE FA" },
        { id: "comm-2", title: "Riunione staff venerdì 25", detail: "Ore 18:30 dopo chiusura. Presenza obbligatoria.", tag: "DIREZIONE • IERI" },
      ];

  return (
    <div className="bg-white min-h-screen text-[#111111] font-sans antialiased pb-12 -m-6 p-6">
      <div className="max-w-[1280px] mx-auto space-y-7">

        {/* TOP HEADER BAR (EXACT MOCKUP STYLE) */}
        <div className="bg-white border border-zinc-200/80 rounded-none px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Avatar Initials Box */}
            <div className="w-10 h-10 bg-black text-white font-extrabold text-xs tracking-wider flex items-center justify-center shrink-0">
              {currentUser?.photo_url ? (
                <img src={resolveDrivePhotoUrl(currentUser.photo_url)} alt={userName} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>

            {/* Name & Role */}
            <div>
              <h1 className="text-sm font-black text-black tracking-wider uppercase leading-none">
                {userName}
              </h1>
              <p className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase mt-1">
                {userRole === "DIPENDENTE" ? "HAIR STYLIST" : userRole.replace("_", " ")}
              </p>
            </div>

            {/* Location Pill Badge */}
            <div className="ml-2 inline-flex items-center gap-1.5 bg-[#dc2626] text-white px-3 py-1 text-[10px] font-black tracking-wider uppercase">
              <span>◆</span>
              <span>{currentUser?.locationName ? currentUser.locationName.toUpperCase() : "SALONE BUENOS AIRES"}</span>
            </div>

            {/* In Turno Status */}
            <div className="hidden sm:flex items-center gap-2 border-l border-zinc-200 pl-4 text-[11px] font-extrabold uppercase tracking-wider text-black">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>IN TURNO</span>
              <span className="text-zinc-400 font-normal">·</span>
              <span className="font-mono">{workedHoursFormatted || "00:00"}</span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <Link 
                href="/settings/dashboard"
                className="text-[10px] font-black uppercase tracking-wider bg-black text-white px-3.5 py-2 hover:bg-zinc-800 transition flex items-center gap-1.5"
              >
                <Settings size={13} />
                <span>GESTITORE OBIETTIVI</span>
              </Link>
            )}

            <button className="p-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-600 transition">
              <Bell size={16} />
            </button>
          </div>
        </div>

        {/* SECTION 1: PROMO & CAMPAGNE ATTIVE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-300 pb-2">
            <h2 className="text-xs font-black uppercase tracking-[0.18em] text-black">
              PROMO & CAMPAGNE ATTIVE
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              {activePromos.length} ATTIVE · DA PROPORRE IN CASSA
            </span>
          </div>

          {/* Promo Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            
            {/* Main Featured Promo Card (Black Box) */}
            <div className="lg:col-span-2 bg-black text-white p-7 md:p-9 flex flex-col justify-between min-h-[290px] relative overflow-hidden">
              {/* Subtle background circle decoration */}
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-80 h-80 rounded-full border border-zinc-800/60 pointer-events-none" />

              <div className="space-y-4 relative z-10">
                {/* Red dot header */}
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#dc2626]">
                  <span className="w-2 h-2 rounded-full bg-[#dc2626]" />
                  <span>{activePromo.subtitle || "PROMO DELLA SETTIMANA"}</span>
                </div>

                {/* Big Bold Promo Title */}
                <h3 className="text-2xl md:text-4xl font-black tracking-tight leading-none uppercase">
                  {renderTitle(activePromo.title || "")}
                </h3>

                {/* Promo Description */}
                <p className="text-xs md:text-sm text-zinc-300 max-w-xl leading-relaxed font-normal">
                  {activePromo.description}
                </p>
              </div>

              {/* Buttons & Indicators Footer */}
              <div className="pt-6 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800/80 relative z-10 mt-6">
                <div className="flex flex-wrap items-center gap-3">
                  {activePromo.ctaUrl && (
                    <Link
                      href={activePromo.ctaUrl}
                      className="bg-white hover:bg-zinc-100 text-black text-xs font-black uppercase tracking-wider px-5 py-3 flex items-center gap-2 transition"
                    >
                      <Upload size={14} className="rotate-90" />
                      <span>{activePromo.ctaText || "CONDIVIDI COL CLIENTE"}</span>
                    </Link>
                  )}

                  {isMatExternal ? (
                    <a
                      href={matUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border border-zinc-700 hover:border-zinc-500 text-white text-xs font-black uppercase tracking-wider px-5 py-3 transition flex items-center gap-1.5"
                    >
                      <span>MATERIALE GRAFICO</span>
                      <ExternalLink size={13} />
                    </a>
                  ) : (
                    <Link
                      href={matUrl}
                      className="border border-zinc-700 hover:border-zinc-500 text-white text-xs font-black uppercase tracking-wider px-5 py-3 transition"
                    >
                      MATERIALE GRAFICO
                    </Link>
                  )}

                  {activePromo.badge && (
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-2">
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
                          i === currentSlideIndex ? "w-8 bg-white" : "w-3 bg-zinc-700"
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
                className="bg-white border border-zinc-200/80 p-6 flex flex-col justify-between flex-1 shadow-sm hover:border-zinc-400 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      {sideCard1?.category || "PORTA UN'AMICA"}
                    </span>
                    <h4 className="text-base font-black text-black tracking-tight uppercase mt-1">
                      {sideCard1?.title || "PIEGA IN OMAGGIO"}
                    </h4>
                  </div>
                  <span className="text-lg font-black text-[#dc2626]">
                    {sideCard1?.badge || "x2"}
                  </span>
                </div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mt-3">
                  {sideCard1?.description || "NUOVA CLIENTE PRESENTATA = PIEGA GRATIS"}
                </p>
              </Link>

              {/* Card 2: Loyalty */}
              <Link 
                href={sideCard2?.url || "/tables"}
                className="bg-white border border-zinc-200/80 p-6 flex flex-col justify-between flex-1 shadow-sm hover:border-zinc-400 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      {sideCard2?.category || "LOYALTY · PARADISE CARD"}
                    </span>
                    <h4 className="text-base font-black text-black tracking-tight uppercase mt-1">
                      {sideCard2?.title || "PUNTI DOPPI"}
                    </h4>
                  </div>
                  <div className="text-[#dc2626] font-bold text-sm">
                    {sideCard2?.badge || "◆"}
                  </div>
                </div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mt-3">
                  {sideCard2?.description || "SU TUTTI I PRODOTTI RETAIL FINO A DOMENICA"}
                </p>
              </Link>

            </div>

          </div>
        </div>

        {/* SECTION 2: OGGI IN SALONE & CONNECTED ROW BAR */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-300 pb-2">
            <h2 className="text-xs font-black uppercase tracking-[0.18em] text-black">
              OGGI IN SALONE
            </h2>
          </div>

          {/* 4 Connected KPI Boxes Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border border-zinc-300 bg-white shadow-sm divide-y md:divide-y-0 md:divide-x divide-zinc-200">
            
            {/* BOX 1: OBIETTIVO SALONE (BLACK BOX) */}
            <div className="bg-black text-white p-6 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                    OBIETTIVO SALONE · {currentMonthName}
                  </span>
                  <Zap size={15} className="text-white" />
                </div>

                <div className="text-2xl md:text-3xl font-black tracking-tight text-white mt-2">
                  {currentSalonPoints} <span className="text-xs font-normal text-zinc-400">/ {salonGoal} SCHEDE</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="w-full h-1.5 bg-zinc-800">
                  <div 
                    className="h-full bg-[#dc2626] transition-all duration-700" 
                    style={{ width: `${salonPercent}%` }} 
                  />
                </div>
                <div className="flex justify-between items-center text-[9px] font-black tracking-widest uppercase">
                  <span className="text-zinc-400">{salonPercent}% RAGGIUNTO</span>
                  <span className={salonPercent >= 100 ? "text-emerald-400 font-extrabold" : "text-amber-400"}>
                    {salonPercent >= 100 ? "🎉 +10 PUNTI GUADAGNATI!" : "+10 PUNTI AL TRAGUARDO"}
                  </span>
                </div>
              </div>
            </div>

            {/* BOX 2: OBIETTIVO PERSONALE */}
            <div className="p-6 space-y-4 flex flex-col justify-between bg-white">
              <div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                    OBIETTIVO PERSONALE
                  </span>
                  <Award size={15} className="text-zinc-400 shrink-0" />
                </div>

                {/* For Super Admin / Admin: show worker selector dropdown. For normal staff: private personal view only */}
                {isSuperAdmin && allWorkerPoints && allWorkerPoints.length > 0 ? (
                  <div className="mt-1.5">
                    <select
                      value={selectedWorkerId}
                      onChange={(e) => setSelectedWorkerId(e.target.value)}
                      className="w-full text-[11px] font-black uppercase tracking-wider bg-zinc-50 border border-zinc-200 px-2 py-1 focus:outline-none focus:border-black cursor-pointer text-black"
                    >
                      {allWorkerPoints.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name.toUpperCase()} ({w.points} SCHEDE)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-pink-500 font-extrabold mt-1">
                    IL TUO OBIETTIVO ({userName.split(" ")[0].toUpperCase()})
                  </div>
                )}

                <div className="text-2xl md:text-3xl font-black tracking-tight text-black mt-2">
                  {activeWorkerPoints} <span className="text-xs font-normal text-zinc-400">/ {workerGoal} SCHEDE</span>
                </div>
              </div>

              {/* Personal Progress bar */}
              <div className="space-y-2">
                <div className="w-full h-1.5 bg-zinc-200">
                  <div 
                    className="h-full bg-black transition-all duration-700" 
                    style={{ width: `${activeWorkerPercent}%` }} 
                  />
                </div>
                <div className="flex justify-between items-center text-[9px] font-black tracking-widest uppercase">
                  <span className="text-zinc-400">{activeWorkerPercent}% PERSONALE</span>
                  <span className={activeWorkerPercent >= 100 ? "text-emerald-600 font-extrabold" : "text-amber-600 font-bold"}>
                    {activeWorkerPercent >= 100 ? "🎉 +10 PUNTI GUADAGNATI!" : "+10 PUNTI AL TRAGUARDO"}
                  </span>
                </div>
              </div>
            </div>

            {/* BOX 3: SALDO PUNTI & RISCATTO PREMI */}
            <div className="p-6 space-y-4 flex flex-col justify-between bg-white">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                  SALDO PUNTI & PREMI
                </span>
                <Gift size={15} className="text-[#dc2626]" />
              </div>

              <div>
                <div className="text-3xl md:text-4xl font-black text-black">
                  {selectedWorker?.availablePoints ?? (activeWorkerPercent >= 100 ? 10 : 0)} <span className="text-xs font-black uppercase tracking-wider text-emerald-600">PUNTI DISPONIBILI</span>
                </div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-1">
                  TRAGUARDO SALONE (10P) + PERSONALE (10P)
                </div>
              </div>

              {/* Action Button: RISCATTA PREMIO */}
              <div className="pt-2 border-t border-zinc-100 space-y-1.5">
                {(selectedWorker?.availablePoints ?? (activeWorkerPercent >= 100 ? 10 : 0)) >= 10 ? (
                  <Link
                    href="/requests"
                    className="w-full bg-[#dc2626] hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider py-2 px-3 flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <Gift size={13} />
                    <span>RISCATTA PREMIO (10 PUNTI)</span>
                  </Link>
                ) : (
                  <div className="text-[9px] font-extrabold uppercase text-zinc-400 text-center py-1 bg-zinc-50 border border-zinc-100">
                    RAGGIUNGI 10 PUNTI PER RISCATTARE IL PREMIO
                  </div>
                )}

                <div className="flex justify-between text-[9px] font-bold text-zinc-500 uppercase pt-0.5">
                  <span>RISCATTATI: {selectedWorker?.redeemedPoints ?? 0}P</span>
                  <span>BONUS EXTRA ADMIN: +{selectedWorker?.manualBonusPoints ?? 0}P</span>
                </div>
              </div>
            </div>

            {/* BOX 4: ORE LAVORATE */}
            <div className="p-6 space-y-4 flex flex-col justify-between bg-white">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                  ORE LAVORATE OGGI
                </span>
                <Clock size={15} className="text-zinc-400" />
              </div>

              <div className="text-3xl md:text-4xl font-black text-black flex items-center gap-2">
                <span>{workedHoursFormatted || "00:00"}</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" />
              </div>

              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                PAUSA {breakDurationMinutes} / 60 MIN
              </p>
            </div>

          </div>
        </div>

        {/* SECTION 3: BOTTOM 3-COLUMN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: COMUNICAZIONI DIREZIONE */}
          <div className="bg-white border border-zinc-200/80 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="text-xs font-black uppercase tracking-[0.18em] text-black">
                COMUNICAZIONI DIREZIONE
              </h3>
              <Link href="/notifications" className="text-[10px] font-black uppercase tracking-wider text-[#dc2626] hover:underline">
                VEDI TUTTO
              </Link>
            </div>

            <div className="space-y-4 pt-1">
              {safeComms.slice(0, 3).map((comm, idx) => (
                <div key={comm.id || idx} className="space-y-1 border-b border-zinc-100 pb-3 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#dc2626] shrink-0" />
                    <h4 className="text-xs font-black text-black uppercase tracking-wide">
                      {comm.title}
                    </h4>
                  </div>
                  <p className="text-xs text-zinc-500 pl-4 font-normal leading-relaxed">
                    {comm.detail}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 pl-4 pt-0.5">
                    {comm.tag}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: PROSSIMO CLIENTE */}
          <div className="bg-white border border-zinc-200/80 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="text-xs font-black uppercase tracking-[0.18em] text-black">
                PROSSIMO CLIENTE
              </h3>
              <Link href="/appointments" className="text-[10px] font-black uppercase tracking-wider text-[#dc2626] hover:underline">
                AGENDA
              </Link>
            </div>

            <div className="space-y-3 pt-1">
              {safeTimeline.map((item, idx) => (
                <div 
                  key={item.id || idx}
                  className={`p-4 flex items-center justify-between transition ${
                    idx === 0 
                      ? "bg-black text-white" 
                      : "bg-white border border-zinc-200 text-black"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-black tracking-wider ${idx === 0 ? "text-white" : "text-black"}`}>
                      {item.time}
                    </span>
                    <div>
                      <div className={`text-xs font-black uppercase tracking-wide ${idx === 0 ? "text-white" : "text-black"}`}>
                        {item.clientName}
                      </div>
                      <div className={`text-[9px] font-bold uppercase tracking-wider ${idx === 0 ? "text-zinc-400" : "text-zinc-400"}`}>
                        {item.services}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: PRODOTTO DEL MESE */}
          <div className="bg-white border border-zinc-200/80 p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-black">
                  PRODOTTO DEL MESE
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#dc2626]">
                  {productOfMonth?.badge || "RETAIL"}
                </span>
              </div>

              {/* Product Placeholder Image Box */}
              <div className="mt-4 border border-zinc-200 h-32 bg-zinc-50 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,#000_25%,transparent_25%,transparent_50%,#000_50%,#000_75%,transparent_75%,transparent)] bg-[length:16px_16px]" />
                <div className="w-8 h-16 border-2 border-zinc-300 rounded-b-lg relative z-10 flex items-center justify-center">
                  <span className="text-zinc-300 text-[10px] font-black">P</span>
                </div>
              </div>

              {/* Product Details */}
              <div className="mt-4 text-center space-y-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#dc2626]">
                  ◆ {productOfMonth?.subtitle || "CONSIGLIATO · UPSELL"}
                </span>
                <h4 className="text-sm font-black uppercase text-black tracking-wider">
                  {productOfMonth?.title || "PRO-GLOW SERUM"}
                </h4>
                <p className="text-xs text-zinc-500 font-normal leading-relaxed">
                  {productOfMonth?.description || "Siero termoprotettivo. Perfetto da abbinare a ogni cheratina."}
                </p>

                <div className="pt-2 flex items-center justify-center gap-3 text-xs font-black">
                  {(productOfMonth?.originalPrice || 0) > 0 && (
                    <span className="text-zinc-400 line-through">€{productOfMonth?.originalPrice}</span>
                  )}
                  <span className="text-black text-sm">€{productOfMonth?.discountPrice || 26}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM FOOTER BRANDING LINE */}
        <div className="pt-6 text-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
          PARADISE — STAFF HUB — PROMO EDITION · CONCEPT DI REDESIGN
        </div>

      </div>
    </div>
  );
}
