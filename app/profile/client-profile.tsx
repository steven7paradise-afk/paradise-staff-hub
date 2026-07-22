"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Bell, 
  User, 
  Mail, 
  CalendarDays, 
  Fingerprint, 
  Briefcase, 
  ShieldAlert, 
  MapPin, 
  ChevronRight, 
  FileCheck2, 
  FileText, 
  LockKeyhole, 
  Sparkles,
  BadgeCheck,
  Gift,
  Trophy,
  Award,
  TrendingUp,
  Copy,
  Check,
  Zap,
  Clock
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

type ClientProfileProps = {
  user: {
    id: string;
    name: string;
    email: string;
    birthDateLabel: string;
    fiscalCode: string;
    contractStartLabel: string;
    contractEndLabel: string;
    photoUrl: string | null;
    locationName: string;
    role: string;
  };
  colleagues: Array<{
    id: string;
    name: string;
    photo_url: string | null;
  }>;
  stats: {
    plannedHours: number;
    workedHours: number;
    openRequests: number;
    documents: number;
    taskInProgress: number;
  };
  pointsStats?: {
    schedeCount: number;
    workerGoal: number;
    salonSchedeCount: number;
    salonGoal: number;
    salonEarned: boolean;
    workerEarned: boolean;
    manualBonusPoints: number;
    redeemedPoints: number;
    availablePoints: number;
    totalEarnedPoints: number;
  };
  unreadNotifications: number;
  settingsNode: React.ReactNode;
};

export function ClientProfile({
  user,
  colleagues,
  stats,
  pointsStats,
  unreadNotifications,
  settingsNode
}: ClientProfileProps) {
  const [userPhoto, setUserPhoto] = useState(user.photoUrl);
  const [activeTab, setActiveTab] = useState<"points" | "info" | "security">("points");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setUserPhoto(user.photoUrl);
  }, [user.photoUrl]);

  useEffect(() => {
    const handlePhotoChange = (e: any) => {
      setUserPhoto(e.detail);
    };
    window.addEventListener("photo-change", handlePhotoChange);
    return () => {
      window.removeEventListener("photo-change", handlePhotoChange);
    };
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const availablePoints = pointsStats?.availablePoints ?? 0;
  const schedeCount = pointsStats?.schedeCount ?? 0;
  const workerGoal = pointsStats?.workerGoal ?? 100;
  const salonSchedeCount = pointsStats?.salonSchedeCount ?? 0;
  const salonGoal = pointsStats?.salonGoal ?? 500;

  const workerPercent = Math.min(100, Math.round((schedeCount / (workerGoal || 1)) * 100));
  const salonPercent = Math.min(100, Math.round((salonSchedeCount / (salonGoal || 1)) * 100));

  const details = [
    { label: "Nome e Cognome", value: user.name, icon: User, color: "border-l-pink-500" },
    { label: "Email di Servizio", value: user.email, icon: Mail, copyable: true, color: "border-l-rose-500" },
    { label: "Data di Nascita", value: user.birthDateLabel, icon: CalendarDays, color: "border-l-purple-500" },
    { label: "Codice Fiscale / ID", value: user.fiscalCode, icon: Fingerprint, copyable: true, color: "border-l-amber-500" },
    { label: "Inizio Contratto", value: user.contractStartLabel, icon: Briefcase, color: "border-l-emerald-500" },
    { label: "Scadenza Contratto", value: user.contractEndLabel, icon: ShieldAlert, color: "border-l-indigo-500" },
    { label: "Salone Primario", value: user.locationName, icon: MapPin, color: "border-l-teal-500" },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-16">
      
      {/* 🌸 LUXURY PARADISE HERO BANNER (REFINED ELEGANT DESIGN) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#FFF5F7] via-[#FDF0F4] to-[#FFFFFF] border border-pink-200/80 p-6 md:p-8 text-zinc-900 shadow-[0_10px_40px_rgba(244,114,182,0.08)]">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-pink-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-amber-100/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          {/* Avatar & Main Identity */}
          <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
            <div className="relative group">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-pink-400 via-rose-300 to-amber-300 opacity-60 blur group-hover:opacity-90 transition duration-500" />
              <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-4 border-white bg-zinc-100 flex items-center justify-center text-3xl font-black text-zinc-800 shadow-lg">
                {userPhoto ? (
                  <img src={resolveDrivePhotoUrl(userPhoto)} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.slice(0, 2).toUpperCase()
                )}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-pink-500/10 text-pink-700 border border-pink-200 px-3 py-1 rounded-full shadow-2xs">
                  {user.role === "DIPENDENTE" ? "COLLABORATORE PARADISE" : user.role}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest bg-zinc-900 text-white px-3 py-1 rounded-full shadow-2xs flex items-center gap-1">
                  <MapPin size={10} className="text-pink-400" />
                  {user.locationName}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-zinc-900 uppercase mt-2">
                {user.name}
              </h1>

              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                {user.email}
              </p>
            </div>
          </div>

          {/* Points & Stats High-Impact Badges */}
          <div className="grid grid-cols-3 gap-3 w-full md:w-auto shrink-0">
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-center rounded-2xl shadow-xs">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 block">PUNTI DISPONIBILI</span>
              <span className="text-xl md:text-2xl font-black text-emerald-600 block mt-0.5">{availablePoints} P</span>
            </div>

            <div className="bg-white border border-zinc-200/80 p-3.5 text-center rounded-2xl shadow-xs">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block">SCHEDE MESE</span>
              <span className="text-xl md:text-2xl font-black text-zinc-900 block mt-0.5">{schedeCount}</span>
            </div>

            <div className="bg-pink-500/10 border border-pink-500/20 p-3.5 text-center rounded-2xl shadow-xs">
              <span className="text-[9px] font-black uppercase tracking-widest text-pink-600 block">ORE LAVORATE</span>
              <span className="text-xl md:text-2xl font-black text-pink-700 block mt-0.5">{stats.workedHours}h</span>
            </div>
          </div>
        </div>

        {/* UX Navigation Tabs */}
        <div className="flex items-center gap-2 mt-8 pt-4 border-t border-pink-200/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab("points")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition rounded-xl flex items-center gap-2 whitespace-nowrap ${
              activeTab === "points"
                ? "bg-zinc-900 text-white shadow-sm"
                : "bg-white/80 border border-zinc-200 text-zinc-600 hover:text-black hover:bg-white"
            }`}
          >
            <Gift size={15} className={activeTab === "points" ? "text-pink-400" : "text-zinc-500"} />
            <span>Punti & Traguardi</span>
            <span className="bg-emerald-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">{availablePoints}P</span>
          </button>

          <button
            onClick={() => setActiveTab("info")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition rounded-xl flex items-center gap-2 whitespace-nowrap ${
              activeTab === "info"
                ? "bg-zinc-900 text-white shadow-sm"
                : "bg-white/80 border border-zinc-200 text-zinc-600 hover:text-black hover:bg-white"
            }`}
          >
            <User size={15} />
            <span>Informazioni Personali</span>
          </button>

          <button
            onClick={() => setActiveTab("security")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition rounded-xl flex items-center gap-2 whitespace-nowrap ${
              activeTab === "security"
                ? "bg-zinc-900 text-white shadow-sm"
                : "bg-white/80 border border-zinc-200 text-zinc-600 hover:text-black hover:bg-white"
            }`}
          >
            <LockKeyhole size={15} />
            <span>Impostazioni & Password</span>
          </button>
        </div>
      </div>

      {/* 🟢 TAB 1: PUNTI & TRAGUARDI PARADISE */}
      {activeTab === "points" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main Points Card */}
          <div className="bg-white border border-zinc-200 p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center font-black shadow-sm">
                  <Gift size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-black">
                    Saldo Punti & Riscatto Premi
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Accumuli 10 Punti quando raggiungi l'obiettivo personale e 10 Punti quando il salone raggiunge il suo target!
                  </p>
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 px-5 py-3 text-right rounded-xl">
                <div className="text-3xl font-black text-black">
                  {availablePoints} <span className="text-xs font-black text-emerald-600 uppercase">PUNTI</span>
                </div>
                <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">
                  PRONTI DA RISCATTARE
                </div>
              </div>
            </div>

            {/* Target Progress Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Goal */}
              <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-xs font-black uppercase">
                  <span className="text-zinc-600">Obiettivo Personale ({user.name.split(" ")[0]})</span>
                  <span className="text-black font-extrabold">{schedeCount} / {workerGoal} SCHEDE</span>
                </div>

                <div className="w-full h-2.5 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black transition-all duration-700"
                    style={{ width: `${workerPercent}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-zinc-400">{workerPercent}% RAGGIUNTO</span>
                  <span className={pointsStats?.workerEarned ? "text-emerald-600 font-extrabold" : "text-amber-600"}>
                    {pointsStats?.workerEarned ? "🎉 TRAGUARDO SBLOCCATO (+10P)" : "IN CORSO (+10P)"}
                  </span>
                </div>
              </div>

              {/* Salon Goal */}
              <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-xs font-black uppercase">
                  <span className="text-zinc-600">Obiettivo Salone</span>
                  <span className="text-black font-extrabold">{salonSchedeCount} / {salonGoal} SCHEDE</span>
                </div>

                <div className="w-full h-2.5 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 transition-all duration-700"
                    style={{ width: `${salonPercent}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-zinc-400">{salonPercent}% RAGGIUNTO</span>
                  <span className={pointsStats?.salonEarned ? "text-emerald-600 font-extrabold" : "text-amber-600"}>
                    {pointsStats?.salonEarned ? "🎉 TRAGUARDO SBLOCCATO (+10P)" : "IN CORSO (+10P)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Redeem Reward Button */}
            <div className="pt-4 border-t border-zinc-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-xs font-bold text-zinc-500 space-x-4">
                <span>Bonus Extra Admin: <strong className="text-black">+{pointsStats?.manualBonusPoints ?? 0}P</strong></span>
                <span>·</span>
                <span>Punti Riscattati: <strong className="text-red-600">-{pointsStats?.redeemedPoints ?? 0}P</strong></span>
              </div>

              {availablePoints >= 10 ? (
                <Link
                  href="/requests"
                  className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition transform active:scale-95"
                >
                  <Gift size={18} />
                  <span>RISCATTA PREMIO (10 PUNTI)</span>
                </Link>
              ) : (
                <div className="w-full md:w-auto text-xs font-black uppercase text-zinc-400 bg-zinc-100 px-4 py-2.5 rounded-xl border border-zinc-200 text-center">
                  RAGGIUNGI 10 PUNTI PER RISCATTARE UN PREMIO
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 👤 TAB 2: INFORMAZIONI PERSONALI */}
      {activeTab === "info" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white border border-zinc-200 p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-4">
              <User className="text-pink-600" size={20} />
              <h2 className="text-base font-black uppercase tracking-wider text-black">
                Dettagli & Dati Personali
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {details.map(({ label, value, icon: Icon, copyable, color }) => (
                <div
                  key={label}
                  className={`p-4 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-between gap-3 border-l-4 ${color}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-700 shrink-0">
                      <Icon size={18} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{label}</span>
                      <span className="text-xs font-bold text-black block mt-0.5">{value}</span>
                    </div>
                  </div>

                  {copyable && (
                    <button
                      onClick={() => handleCopy(value, label)}
                      className="text-zinc-400 hover:text-black p-2 transition"
                      title="Copia"
                    >
                      {copiedField === label ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🔒 TAB 3: SICUREZZA & PASSWORD */}
      {activeTab === "security" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white border border-zinc-200 p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-4">
              <LockKeyhole className="text-purple-600" size={20} />
              <h2 className="text-base font-black uppercase tracking-wider text-black">
                Sicurezza, Foto & Password
              </h2>
            </div>

            {settingsNode}

            <div className="pt-4 border-t border-zinc-100">
              <LogoutButton className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
