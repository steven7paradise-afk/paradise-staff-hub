"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  CalendarDays, 
  Fingerprint, 
  Briefcase, 
  ShieldAlert, 
  MapPin, 
  ChevronRight, 
  FileText, 
  LockKeyhole, 
  Camera, 
  Download,
  X,
  FileCheck,
  Award,
  Clock
} from "lucide-react";
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
  clientPhotos: Array<{
    id: string;
    orderNumber: string;
    url: string;
    date: string;
  }>;
  documentsList?: Array<{
    id: string;
    title: string;
    fileUrl: string;
    type: string;
    month: number | null;
    year: number | null;
    createdAt: string;
  }>;
  settingsNode: React.ReactNode;
};

export function ClientProfile({
  user,
  colleagues,
  stats,
  pointsStats,
  unreadNotifications,
  clientPhotos,
  documentsList = [],
  settingsNode
}: ClientProfileProps) {
  const [userPhoto, setUserPhoto] = useState(user.photoUrl);
  const [activeTab, setActiveTab] = useState<"points" | "info" | "security">("points");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

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
  const workerGoal = pointsStats?.workerGoal ?? 150; // default is 150 based on mockup "72 / 150 SCHEDE"
  const salonSchedeCount = pointsStats?.salonSchedeCount ?? 0;
  const salonGoal = pointsStats?.salonGoal ?? 500;

  const workerPercent = Math.min(100, Math.round((schedeCount / (workerGoal || 1)) * 100));
  const salonPercent = Math.min(100, Math.round((salonSchedeCount / (salonGoal || 1)) * 100));

  const isEmployee = user.role === "DIPENDENTE";

  const details = [
    { label: "Nome e Cognome", value: user.name, icon: User },
    { label: "Email di Servizio", value: user.email, icon: Mail, copyable: true },
    { label: "Data di Nascita", value: user.birthDateLabel, icon: CalendarDays },
    { label: "Codice Fiscale / ID", value: user.fiscalCode, icon: Fingerprint, copyable: true },
    { label: "Inizio Contratto", value: user.contractStartLabel, icon: Briefcase },
    { label: "Scadenza Contratto", value: user.contractEndLabel, icon: ShieldAlert },
    { label: "Salone Primario", value: user.locationName, icon: MapPin },
  ];

  return (
    <div className="profile-liquid-page relative isolate min-h-dvh w-full space-y-5 overflow-hidden px-3 pb-16 pt-[calc(env(safe-area-inset-top)+80px)] font-sans text-neutral-900 antialiased selection:bg-neutral-200 sm:space-y-8 sm:px-6 sm:pb-20 lg:px-10 xl:pt-24">
      
      {/* 🖤 DIOR ESTHETIQUE HERO CONTAINER */}
      <div className="profile-identity-glass profile-glass-hero mx-auto max-w-none space-y-6 rounded-[28px] border border-white/55 bg-white/75 p-5 shadow-[0_24px_80px_rgba(44,24,15,0.18)] backdrop-blur-2xl sm:space-y-8 md:rounded-[36px] md:p-10">
        <div className="flex flex-col items-center justify-between gap-5 md:flex-row md:items-start md:gap-8">
          
          {/* Left Side: Avatar & Name */}
          <div className="flex flex-col items-center gap-4 text-center md:flex-row md:gap-6 md:text-left">
            <div className="relative group shrink-0">
              <div className="relative flex size-24 items-center justify-center overflow-hidden rounded-[26px] border border-white/70 bg-white/40 text-3xl font-serif text-neutral-800 shadow-[0_16px_40px_rgba(35,18,10,0.16)] sm:size-28 md:size-36 md:rounded-[38px] md:text-4xl">
                {userPhoto ? (
                  <img src={resolveDrivePhotoUrl(userPhoto)} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.slice(0, 2).toUpperCase()
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-500 bg-neutral-100 border border-neutral-200/60 px-3 py-1 rounded-full">
                  {isEmployee ? "Collaboratore" : user.role.replace("_", " ")}
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-500 bg-neutral-50 border border-neutral-200/60 px-3 py-1 rounded-full flex items-center gap-1">
                  <MapPin size={9} className="text-neutral-400" />
                  {user.locationName}
                </span>
              </div>

              <h1 className="break-words text-2xl font-serif font-light uppercase tracking-wide text-neutral-900 sm:text-3xl md:text-4xl">
                {user.name}
              </h1>

              <p className="break-all text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400 sm:text-[11px] sm:tracking-[0.2em]">
                {user.email}
              </p>
            </div>
          </div>

          {/* Right Side: Luxury Points Display */}
          <Link href="/points" className="flex flex-col items-center md:items-end justify-center gap-1 border-t md:border-t-0 pt-6 md:pt-0 w-full md:w-auto shrink-0 md:pl-8 border-neutral-100 group">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400 group-hover:text-neutral-600 transition">SALDO PUNTI PREMIUM</span>
            <span className="text-4xl md:text-5xl font-serif font-light text-neutral-900 mt-1 group-hover:underline decoration-neutral-300">
              {availablePoints} <span className="text-xs font-sans font-bold tracking-[0.2em] text-neutral-500 uppercase ml-1">Punti</span>
            </span>
            <div className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase mt-1 flex items-center gap-1 group-hover:text-neutral-600 transition">
              <span>Disponibili per il riscatto</span>
              <span className="underline font-black text-[9px] tracking-wide ml-1">DETTAGLIO</span>
            </div>
          </Link>
        </div>

        {/* Premium Underlined Navigation Tabs (Dior Style) */}
        <div className="flex items-center gap-5 overflow-x-auto border-b border-neutral-200 pb-px sm:gap-8">
          {[
            { id: "points", label: "Punti & Traguardi" },
            { id: "info", label: "Informazioni & Documenti" },
            { id: "security", label: "Impostazioni & Sicurezza" }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "min-h-11 py-3 text-[10px] font-bold uppercase tracking-[0.18em] border-b-2 transition duration-200 whitespace-nowrap -mb-px sm:py-4 sm:text-xs sm:tracking-[0.25em]",
                  isActive 
                    ? "border-neutral-900 text-neutral-900 font-black" 
                    : "border-transparent text-neutral-400 hover:text-neutral-600"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 🔴 TAB 1: PUNTI & TRAGUARDI */}
      {activeTab === "points" && (
        <div className="space-y-5 animate-in fade-in duration-200 sm:space-y-8">
          
          {/* Target Progress Section */}
          <div className="profile-glass-section border border-neutral-200 bg-white p-5 sm:p-8 rounded-[28px] shadow-2xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-neutral-100">
              <div className="space-y-1.5 text-left">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">OBIETTIVI MENSILI</span>
                <h2 className="text-xl font-serif font-light text-neutral-900 uppercase">
                  Andamento & Premi
                </h2>
              </div>
              
              <div className="text-xs font-bold text-neutral-400 tracking-[0.1em] uppercase flex flex-wrap gap-4">
                <span>Bonus Extra: <strong className="text-neutral-900 font-extrabold">+{pointsStats?.manualBonusPoints ?? 0}P</strong></span>
                <span className="opacity-50">|</span>
                <span>Riscattati: <strong className="text-neutral-900 font-extrabold">-{pointsStats?.redeemedPoints ?? 0}P</strong></span>
              </div>
            </div>

            {/* Target Progress Cards */}
            <div className={cn("grid gap-4 md:gap-8", isEmployee ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
              
              {/* OBIETTIVO PERSONALE */}
              <div className="profile-glass-inset p-5 sm:p-6 bg-neutral-50 border border-neutral-200 rounded-[22px] space-y-4 text-left">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-400 block">DIPENDENTE</span>
                    <span className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                      Obiettivo Personale ({user.name.split(" ")[0]})
                    </span>
                  </div>
                  <span className="text-sm font-serif font-light text-neutral-900">
                    {schedeCount} / {workerGoal} <span className="text-[10px] font-sans font-bold tracking-wider text-neutral-500 uppercase">Schede</span>
                  </span>
                </div>

                {/* Sleek Minimalist Black Progress Bar */}
                <div className="w-full h-1 bg-neutral-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neutral-900 transition-all duration-700"
                    style={{ width: `${workerPercent}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold tracking-wider uppercase">
                  <span className="text-neutral-400">{workerPercent}% RAGGIUNTO</span>
                  <span className={pointsStats?.workerEarned ? "text-neutral-900 font-black" : "text-amber-700"}>
                    {pointsStats?.workerEarned ? "🎉 TRAGUARDO SBLOCCATO (+10P)" : "IN CORSO (+10P)"}
                  </span>
                </div>
              </div>

              {/* OBIETTIVO SALONE - ONLY visible for non-employees (e.g. admins) */}
              {!isEmployee && (
                <div className="profile-glass-inset p-5 sm:p-6 bg-neutral-50 border border-neutral-200 rounded-[22px] space-y-4 text-left">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-400 block">STRUTTURA</span>
                      <span className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                        Obiettivo Salone
                      </span>
                    </div>
                    <span className="text-sm font-serif font-light text-neutral-900">
                      {salonSchedeCount} / {salonGoal} <span className="text-[10px] font-sans font-bold tracking-wider text-neutral-500 uppercase">Schede</span>
                    </span>
                  </div>

                  {/* Sleek Minimalist Progress Bar */}
                  <div className="w-full h-1 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-500 transition-all duration-700"
                      style={{ width: `${salonPercent}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-bold tracking-wider uppercase">
                    <span className="text-neutral-400">{salonPercent}% RAGGIUNTO</span>
                    <span className={pointsStats?.salonEarned ? "text-neutral-900 font-black" : "text-amber-700"}>
                      {pointsStats?.salonEarned ? "🎉 TRAGUARDO SBLOCCATO (+10P)" : "IN CORSO (+10P)"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Redeem Action Row */}
            <div className="pt-6 border-t border-neutral-100 flex justify-end">
              {availablePoints >= 10 ? (
                <Link
                  href="/requests"
                  className="w-full md:w-auto bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-[0.2em] px-8 py-4 rounded-xl shadow-xs transition duration-200 text-center active:scale-98"
                >
                  Riscatta Premio (10 Punti)
                </Link>
              ) : (
                <div className="w-full md:w-auto text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400 bg-neutral-50 border border-neutral-200 px-6 py-3 rounded-xl text-center">
                  Raggiungi 10 punti per riscattare un premio
                </div>
              )}
            </div>
          </div>

          {/* 📸 GALLERY FEED (INSTAGRAM STYLE LUXURY) */}
          <div className="profile-glass-section border border-neutral-200 bg-white p-5 sm:p-8 rounded-[28px] shadow-2xs space-y-6">
            <div className="border-b border-neutral-100 pb-5 text-left">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">GALLERIA IMMAGINI</span>
              <h2 className="text-xl font-serif font-light text-neutral-900 uppercase mt-1">
                Lavori Eseguiti Cliente
              </h2>
              <p className="text-xs text-neutral-400 mt-1 font-medium">
                I tuoi servizi registrati con documentazione fotografica frontale.
              </p>
            </div>

            {clientPhotos.length > 0 ? (
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 md:gap-4">
                {clientPhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhotoIndex(index)}
                    className="aspect-square relative overflow-hidden rounded-xl bg-neutral-50 group cursor-pointer border border-neutral-200 hover:scale-[1.01] transition-all duration-300"
                  >
                    <img
                      src={photo.url}
                      alt={`Lavoro ${photo.orderNumber}`}
                      className="size-full object-cover select-none pointer-events-none"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-neutral-955/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-300">ORDINE</span>
                      <span className="text-sm font-semibold tracking-wider">#{photo.orderNumber}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-neutral-200 rounded-2xl bg-neutral-50 p-6">
                <Camera size={24} className="text-neutral-400 mb-2" />
                <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Nessun lavoro registrato</p>
                <p className="text-[11px] text-neutral-400 mt-1 max-w-xs">
                  Carica le foto prima/dopo durante la compilazione degli ordini cliente.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 👤 TAB 2: INFORMAZIONI PERSONALI & DOCUMENTI PROPRI */}
      {activeTab === "info" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-200">
          
          {/* Personal Info Column (1/3) */}
          <div className="profile-glass-section border border-neutral-200 bg-white p-5 sm:p-8 rounded-[28px] shadow-2xs space-y-6 lg:col-span-1 h-fit text-left">
            <div className="border-b border-neutral-100 pb-4">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">DATI REGISTRATI</span>
              <h2 className="text-lg font-serif font-light text-neutral-900 uppercase mt-0.5">
                Dati Anagrafici
              </h2>
            </div>

            <div className="space-y-5">
              {details.map(({ label, value, copyable }) => (
                <div key={label} className="group border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">{label}</span>
                    {copyable && (
                      <button
                        onClick={() => handleCopy(value, label)}
                        className="text-neutral-400 hover:text-neutral-900 transition-colors p-1"
                        title="Copia"
                      >
                        {copiedField === label ? <span className="text-[8px] font-black text-emerald-600 tracking-wider">COPIATO</span> : <span className="text-[9px] hover:underline">COPIA</span>}
                      </button>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-neutral-800 block mt-1">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Documents Column (2/3) */}
          <div className="profile-glass-section border border-neutral-200 bg-white p-5 sm:p-8 rounded-[28px] shadow-2xs space-y-6 lg:col-span-2 text-left">
            <div className="border-b border-neutral-100 pb-4">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">ARCHIVIO UFFICIALE</span>
              <h2 className="text-lg font-serif font-light text-neutral-900 uppercase mt-0.5">
                I Miei Documenti Propri
              </h2>
              <p className="text-xs text-neutral-400 mt-1 font-medium">
                Visualizza e scarica i tuoi cedolini, contratti e altri documenti emessi.
              </p>
            </div>

            {documentsList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-100 text-left text-xs">
                  <thead>
                    <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 border-b border-neutral-100">
                      <th className="py-3 pr-4">Titolo Documento</th>
                      <th className="py-3 px-4">Tipologia</th>
                      <th className="py-3 px-4">Periodo</th>
                      <th className="py-3 px-4">Data Emissione</th>
                      <th className="py-3 pl-4 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-semibold text-neutral-700">
                    {documentsList.map((doc) => {
                      const isCedolino = doc.type === "CEDOLINO";
                      const isContratto = doc.type === "CONTRATTO";

                      // Month Label mapping
                      const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
                      const periodLabel = isCedolino && doc.month !== null && doc.year
                        ? `${months[doc.month - 1]} ${doc.year}`
                        : "—";

                      return (
                        <tr key={doc.id} className="hover:bg-neutral-50/50 transition duration-150">
                          <td className="py-4 pr-4 font-bold text-neutral-900 flex items-center gap-2.5">
                            {isContratto ? (
                              <FileCheck size={15} className="text-neutral-400 shrink-0" />
                            ) : (
                              <FileText size={15} className="text-neutral-400 shrink-0" />
                            )}
                            <span className="truncate max-w-[180px] sm:max-w-xs">{doc.title}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                              isContratto && "bg-neutral-900 border-neutral-900 text-white",
                              isCedolino && "bg-zinc-50 border-neutral-300 text-neutral-700",
                              !isContratto && !isCedolino && "bg-neutral-50 border-neutral-200 text-neutral-400"
                            )}>
                              {doc.type}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-neutral-500 font-mono text-[11px]">{periodLabel}</td>
                          <td className="py-4 px-4 text-neutral-400">
                            {new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(doc.createdAt))}
                          </td>
                          <td className="py-4 pl-4 text-right">
                            <a
                              href={`/api/documents/${doc.id}/download`}
                              className="inline-flex size-8 items-center justify-center rounded-full border border-neutral-200 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white transition duration-200 text-neutral-500 active:scale-95"
                              title="Scarica documento"
                              download
                            >
                              <Download size={13} />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-neutral-200 rounded-2xl bg-neutral-50 p-6">
                <FileText size={24} className="text-neutral-300 mb-2" />
                <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Nessun documento disponibile</p>
                <p className="text-[11px] text-neutral-400 mt-1 max-w-xs">
                  Quando l'amministrazione caricherà i tuoi contratti o cedolini, appariranno in questo elenco.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🔒 TAB 3: IMPOSTAZIONI & SICUREZZA */}
      {activeTab === "security" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="profile-glass-section border border-neutral-200 bg-white p-5 sm:p-8 rounded-[28px] shadow-2xs space-y-6 text-left">
            <div className="border-b border-neutral-100 pb-4">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400">PREFERENZE</span>
              <h2 className="text-lg font-serif font-light text-neutral-900 uppercase mt-0.5">
                Sicurezza & Account
              </h2>
            </div>

            {settingsNode}

            <div className="pt-6 border-t border-neutral-100 flex justify-end">
              <LogoutButton className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-[0.2em] px-8 py-3.5 rounded-xl transition duration-200 text-center active:scale-98" />
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ INSTAGRAM POST LIGHTBOX MODAL */}
      {selectedPhotoIndex !== null && clientPhotos[selectedPhotoIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 md:p-6 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white rounded-[24px] overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]">
            
            {/* Close Button */}
            <button
              onClick={() => setSelectedPhotoIndex(null)}
              className="absolute top-4 right-4 z-10 size-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition active:scale-95"
            >
              <X size={18} />
            </button>

            {/* Left/Right Navigation Arrows */}
            {clientPhotos.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPhotoIndex((prev) => (prev !== null ? (prev - 1 + clientPhotos.length) % clientPhotos.length : null));
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 size-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition active:scale-95"
                >
                  <ArrowLeft size={18} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPhotoIndex((prev) => (prev !== null ? (prev + 1) % clientPhotos.length : null));
                  }}
                  className="absolute right-16 md:right-4 top-1/2 -translate-y-1/2 z-10 size-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition active:scale-95"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            {/* Image container */}
            <div className="flex-1 bg-neutral-950 flex items-center justify-center min-h-[300px] md:min-h-0 aspect-square md:aspect-auto">
              <img
                src={clientPhotos[selectedPhotoIndex].url}
                alt={`Ordine ${clientPhotos[selectedPhotoIndex].orderNumber}`}
                className="max-h-[50vh] md:max-h-[80vh] w-auto object-contain"
              />
            </div>

            {/* Details panel */}
            <div className="w-full md:w-[320px] shrink-0 p-6 flex flex-col justify-between bg-white text-left">
              <div className="space-y-5">
                {/* Author Info */}
                <div className="flex items-center gap-3 pb-4 border-b border-neutral-100">
                  <div className="size-9 rounded-full overflow-hidden border border-neutral-200 bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-800">
                    {userPhoto ? (
                      <img src={resolveDrivePhotoUrl(userPhoto)} alt={user.name} className="size-full object-cover" />
                    ) : (
                      user.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-neutral-900 leading-tight">{user.name}</p>
                    <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">{isEmployee ? "Collaboratore" : user.role}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-neutral-400 uppercase tracking-wider text-[9px]">Ordine Cliente</span>
                    <span className="font-bold text-neutral-800 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-[10px]">#{clientPhotos[selectedPhotoIndex].orderNumber}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-neutral-400 uppercase tracking-wider text-[9px]">Data Caricamento</span>
                    <span className="font-medium text-neutral-600 flex items-center gap-1">
                      <Clock size={12} className="opacity-75" />
                      {new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(clientPhotos[selectedPhotoIndex].date))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom message */}
              <div className="mt-8 pt-4 border-t border-neutral-100 text-[8px] text-center text-neutral-400 font-bold uppercase tracking-[0.25em]">
                Lavoro eseguito in salone
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
