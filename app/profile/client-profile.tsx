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
  Users,
  ListChecks
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

const profileAccent = {
  text: "text-[color:var(--primary)]",
  border: "border-l-[color:var(--primary)]",
  secondaryBg: "bg-[color:var(--secondary)]",
};

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
  unreadNotifications: number;
  settingsNode: React.ReactNode;
};

export function ClientProfile({
  user,
  colleagues,
  stats,
  unreadNotifications,
  settingsNode
}: ClientProfileProps) {
  const [userPhoto, setUserPhoto] = useState(user.photoUrl);

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

  const details = [
    { label: "Nome e Cognome", value: user.name, icon: User },
    { label: "Email di Servizio", value: user.email, icon: Mail },
    { label: "Data di Nascita", value: user.birthDateLabel, icon: CalendarDays },
    { label: "Codice", value: user.fiscalCode, icon: Fingerprint },
    { label: "Inizio Contratto", value: user.contractStartLabel, icon: Briefcase },
    { label: "Scadenza Contratto", value: user.contractEndLabel, icon: ShieldAlert },
    { label: "Salone Primario", value: user.locationName, icon: MapPin },
  ];

  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="w-full">
      {/* MOBILE PREMIUM VIEW (xl:hidden) */}
      <div className="xl:hidden -mx-4 -mt-3 space-y-6">
        
        {/* Fullscreen-style Hero Banner Container */}
        <div className="relative min-h-[92vh] flex flex-col justify-between overflow-hidden p-6 isolate bg-[radial-gradient(circle_at_20%_15%,rgba(255,168,221,0.42),transparent_34%),linear-gradient(145deg,#fff7fb,#f8eff4_55%,#ffffff)]">
          
          <div className="absolute inset-x-8 top-24 -z-10 h-72 rounded-full bg-white/70 blur-3xl" />

          {/* Floating Top Controls (Mockup styled) */}
          <div className="flex items-center justify-between w-full">
            <Link 
              href="/dashboard"
              className="flex size-11 items-center justify-center rounded-full bg-white text-black shadow-md transition active:scale-95"
            >
              <ArrowLeft className="size-5" />
            </Link>
            
            <Link 
              href="/notifications"
              className="relative flex size-11 items-center justify-center rounded-full bg-white text-black shadow-md transition active:scale-95"
            >
              <Bell className="size-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-black text-black ring-2 ring-white shadow-sm animate-pulse-soft">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </Link>
          </div>

          {/* Glass profile photo card */}
          <div className="my-auto flex flex-col items-center">
            <div className="w-full max-w-[360px] rounded-[38px] border border-white/80 bg-white/48 p-2 shadow-[0_28px_70px_rgba(31,31,31,0.16)] backdrop-blur-2xl">
              <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-[#EFF3F1] aspect-[4/4.35]">
                {userPhoto ? (
                  <img src={userPhoto} alt={user.name} className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center bg-paradise-softPink text-7xl font-black text-paradise-noir">
                    {user.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/88 via-white/62 to-transparent p-5 pt-20 backdrop-blur-[2px]">
                  <h2 className="flex items-center gap-2 text-left text-[28px] font-black leading-none text-paradise-noir">
                    {user.name}
                    <BadgeCheck className="size-7 fill-emerald-500 text-white" />
                  </h2>
                  <p className="mt-3 text-left text-sm font-semibold leading-relaxed text-black/65">
                    {user.role === "DIPENDENTE" ? "Collaboratore" : user.role} · {user.locationName}
                  </p>
                  <div className="mt-7 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-sm font-black text-black/80">
                      <Users className="size-4 text-black/45" />
                      {colleagues.length + 1}
                      <span className="text-xs font-semibold text-black/45">dipendenti</span>
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm font-black text-black/80">
                      <ListChecks className="size-4 text-black/45" />
                      {stats.taskInProgress}
                      <span className="text-xs font-semibold text-black/45">task in corso</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Glassmorphic Panel at the Bottom */}
          <div className="rounded-[28px] bg-white/72 dark:bg-black/25 border border-white/80 backdrop-blur-xl p-5 shadow-2xl space-y-4">
            
            {/* Quick stats banner */}
            <div className="grid grid-cols-3 divide-x divide-white/15 pb-1 text-center">
              <div>
                <p className="text-[10px] font-black text-black/40 uppercase tracking-wider">Previste</p>
                <p className={cn("mt-1 text-sm font-black", profileAccent.text)}>{stats.plannedHours.toLocaleString("it-IT", { maximumFractionDigits: 1 })}h</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-black/40 uppercase tracking-wider">Lavorate</p>
                <p className="mt-1 text-sm font-black text-[#9E7A3B]">{stats.workedHours.toLocaleString("it-IT", { maximumFractionDigits: 1 })}h</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-black/40 uppercase tracking-wider">Task</p>
                <p className="mt-1 text-sm font-black text-paradise-noir">{stats.taskInProgress}</p>
              </div>
            </div>

            {/* Immersive List Links */}
            <div className="border-t border-white/10 pt-3 space-y-1">
              <button
                onClick={() => handleScrollTo("mobile-personal-info")}
                className="w-full flex items-center justify-between text-left px-3 py-2.5 text-xs font-bold text-paradise-noir hover:bg-black/5 rounded-xl transition duration-200"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex size-7.5 items-center justify-center rounded-lg border border-black/5 bg-white/70 text-paradise-noir shadow-sm">
                    <User className="size-4" />
                  </span>
                  Dettagli personali & Salone
                </span>
                <ChevronRight className="size-4 text-black/40" />
              </button>

              <Link
                href="/my-shifts"
                className="w-full flex items-center justify-between text-left px-3 py-2.5 text-xs font-bold text-paradise-noir hover:bg-black/5 rounded-xl transition duration-200"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex size-7.5 items-center justify-center rounded-lg border border-black/5 bg-white/70 text-paradise-noir shadow-sm">
                    <CalendarDays className="size-4" />
                  </span>
                  Gestione Turni di Lavoro
                </span>
                <ChevronRight className="size-4 text-black/40" />
              </Link>

              <button
                onClick={() => handleScrollTo("mobile-security")}
                className="w-full flex items-center justify-between text-left px-3 py-2.5 text-xs font-bold text-paradise-noir hover:bg-black/5 rounded-xl transition duration-200"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex size-7.5 items-center justify-center rounded-lg border border-black/5 bg-white/70 text-paradise-noir shadow-sm">
                    <LockKeyhole className="size-4" />
                  </span>
                  Sicurezza & Password
                </span>
                <ChevronRight className="size-4 text-black/40" />
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Cards on Scroll */}
        <div className="px-4 space-y-6 pb-20">
          
          {/* Personal Information list card */}
          <Card id="mobile-personal-info" className="border border-black/5 dark:border-white/10 bg-white/95 dark:bg-neutral-900 shadow-soft p-5 scroll-mt-6">
            <div className="mb-4 flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3">
              <Sparkles className={cn("size-5", profileAccent.text)} />
              <h2 className="text-xs font-bold uppercase tracking-wider text-black/75 dark:text-white/80">
                Informazioni Personali
              </h2>
            </div>
            
            <div className="grid gap-3">
              {details.map(({ label, value, icon: Icon }) => (
                <div 
                  key={label} 
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border border-black/5 dark:border-white/10 bg-white/50 dark:bg-white/5 p-4 transition duration-200", 
                    "border-l-4", profileAccent.border
                  )}
                >
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm", profileAccent.secondaryBg, profileAccent.text)}>
                    <Icon className="size-4.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40 leading-none">{label}</p>
                    <p className="mt-2 font-bold text-sm text-[color:var(--text)] leading-snug">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Settings Node Card */}
          <div id="mobile-security" className="scroll-mt-6">
            {settingsNode}
          </div>

          {/* Floating Logout button at the end of the page */}
          <div className="pt-2">
            <LogoutButton className="flex w-full items-center justify-center gap-3 rounded-2xl border border-black/5 bg-[#C66170] hover:bg-[#A74758] px-4 py-3.5 text-sm font-extrabold text-white transition active:scale-95 shadow-md" />
          </div>
        </div>

      </div>

      {/* DESKTOP VIEW (hidden xl:grid) */}
      <div className="hidden xl:grid gap-6 xl:grid-cols-[380px_1fr]">
        
        {/* Left Side Profile Card */}
        <Card className="p-6 border border-black/5 dark:border-white/10 bg-white/95 dark:bg-neutral-900 shadow-soft h-fit">
          <div className="flex flex-col items-center text-center">
            {/* Elegant avatar placeholder with dynamic accent color ring */}
            <div className="relative group select-none">
              <div
                className="absolute -inset-1 rounded-full opacity-45 blur transition duration-500 group-hover:opacity-75"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--gradient))" }}
              />
              <div className="relative grid size-24 place-items-center overflow-hidden rounded-full border-4 border-white dark:border-neutral-800 bg-paradise-nude text-3xl font-extrabold text-paradise-noir shadow-md">
                {userPhoto ? (
                  <img src={userPhoto} alt={user.name} className="size-full object-cover rounded-full select-none pointer-events-none" />
                ) : (
                  user.name.slice(0, 1).toUpperCase()
                )}
              </div>
            </div>
            
            <h2 className="mt-4 text-xl font-extrabold text-[color:var(--text)] tracking-tight">{user.name}</h2>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-black/45 dark:text-white/40">
              <MapPin className={cn("size-3.5", profileAccent.text)} />
              {user.locationName}
            </p>
            <div className="mt-3">
              <Badge tone="pink">{user.role === "DIPENDENTE" ? "Collaboratore" : user.role}</Badge>
            </div>
          </div>
          
          {/* Summary widgets */}
          <div className="mt-6 grid grid-cols-3 divide-x divide-black/5 dark:divide-white/10 rounded-2xl border border-black/5 dark:border-white/10 bg-white/40 dark:bg-white/5 py-4 text-center shadow-sm">
            <div className="px-1.5">
              <p className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-wide">Previste</p>
              <p className={cn("mt-1 text-sm font-extrabold tracking-tight", profileAccent.text)}>{stats.plannedHours.toLocaleString("it-IT", { maximumFractionDigits: 1 })} h</p>
            </div>
            <div className="px-1.5">
              <p className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-wide">Lavorate</p>
              <p className="mt-1 text-sm font-extrabold tracking-tight text-[#9E7A3B] dark:text-[#EAC27D]">{stats.workedHours.toLocaleString("it-IT", { maximumFractionDigits: 1 })} h</p>
            </div>
            <div className="px-1.5">
              <p className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-wide">Task</p>
              <p className="mt-1 text-sm font-extrabold tracking-tight text-paradise-noir dark:text-white">{stats.taskInProgress}</p>
            </div>
          </div>
          
          {/* Transition interactive lists */}
          <div className="mt-6 divide-y divide-black/5 dark:divide-white/5 rounded-2xl border border-black/5 dark:border-white/10 bg-white/45 dark:bg-white/5 overflow-hidden">
            <button
              onClick={() => handleScrollTo("desktop-personal-info")}
              className="w-full flex items-center gap-3 px-3 py-3 text-sm font-bold text-paradise-noir dark:text-white/80 hover:text-[#B85B68] dark:hover:text-paradise-pink hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 group active:scale-[0.98]"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-paradise-softPink/40 dark:bg-white/10 text-[#B85B68] dark:text-paradise-pink transition duration-200 group-hover:scale-105">
                <User className="size-4" />
              </div>
              <span className="flex-1 text-left truncate">Informazioni personali</span>
              <ChevronRight className="size-4 text-black/35 dark:text-white/40 transition duration-200 group-hover:translate-x-0.5" />
            </button>

            <Link 
              href="/my-shifts" 
              className="flex items-center gap-3 px-3 py-3 text-sm font-bold text-paradise-noir dark:text-white/80 hover:text-[#B85B68] dark:hover:text-paradise-pink hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 group active:scale-[0.98]"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-paradise-softPink/40 dark:bg-white/10 text-[#B85B68] dark:text-paradise-pink transition duration-200 group-hover:scale-105">
                <CalendarDays className="size-4" />
              </div>
              <span className="flex-1 truncate">I miei turni</span>
              <ChevronRight className="size-4 text-black/35 dark:text-white/40 transition duration-200 group-hover:translate-x-0.5" />
            </Link>

            <Link 
              href="/requests" 
              className="flex items-center gap-3 px-3 py-3 text-sm font-bold text-paradise-noir dark:text-white/80 hover:text-[#B85B68] dark:hover:text-paradise-pink hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 group active:scale-[0.98]"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-paradise-softPink/40 dark:bg-white/10 text-[#B85B68] dark:text-paradise-pink transition duration-200 group-hover:scale-105">
                <FileCheck2 className="size-4" />
              </div>
              <span className="flex-1 truncate">Le mie richieste</span>
              <ChevronRight className="size-4 text-black/35 dark:text-white/40 transition duration-200 group-hover:translate-x-0.5" />
            </Link>

            <Link 
              href="/documents" 
              className="flex items-center gap-3 px-3 py-3 text-sm font-bold text-paradise-noir dark:text-white/80 hover:text-[#B85B68] dark:hover:text-paradise-pink hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 group active:scale-[0.98]"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-paradise-softPink/40 dark:bg-white/10 text-[#B85B68] dark:text-paradise-pink transition duration-200 group-hover:scale-105">
                <FileText className="size-4" />
              </div>
              <span className="flex-1 truncate">Buste paga e documenti ({stats.documents})</span>
              <ChevronRight className="size-4 text-black/35 dark:text-white/40 transition duration-200 group-hover:translate-x-0.5" />
            </Link>

            <button
              onClick={() => handleScrollTo("desktop-security")}
              className="w-full flex items-center gap-3 px-3 py-3 text-sm font-bold text-paradise-noir dark:text-white/80 hover:text-[#B85B68] dark:hover:text-paradise-pink hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 group active:scale-[0.98]"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-paradise-softPink/40 dark:bg-white/10 text-[#B85B68] dark:text-paradise-pink transition duration-200 group-hover:scale-105">
                <LockKeyhole className="size-4" />
              </div>
              <span className="flex-1 text-left truncate">Sicurezza e impostazioni</span>
              <ChevronRight className="size-4 text-black/35 dark:text-white/40 transition duration-200 group-hover:translate-x-0.5" />
            </button>
          </div>
          
          <div className="mt-6">
            <LogoutButton />
          </div>
        </Card>
        
        {/* Right Side Cards */}
        <div className="space-y-6">
          <Card id="desktop-personal-info" className="border border-black/5 dark:border-white/10 bg-white/95 dark:bg-neutral-900 shadow-soft p-6 scroll-mt-6">
            <div className="mb-4 flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3">
              <Sparkles className={cn("size-5 animate-pulse", profileAccent.text)} />
              <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">
                Informazioni Personali
              </h2>
            </div>
            
            <div className="grid gap-3 sm:grid-cols-2">
              {details.map(({ label, value, icon: Icon }, idx) => {
                const borderColors = [
                  "border-l-4 border-l-paradise-pink",
                  "border-l-4 border-l-paradise-pink",
                  "border-l-4 border-l-[#A370F4]",
                  "border-l-4 border-l-amber-500",
                  "border-l-4 border-l-[#d4af37]",
                  "border-l-4 border-l-[#d4af37]",
                  "border-l-4 border-l-emerald-500"
                ];
                const borderColor = borderColors[idx % borderColors.length];
                return (
                  <div 
                    key={label} 
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border border-black/5 dark:border-white/10 bg-white/50 dark:bg-white/5 p-4 transition duration-200 hover:border-paradise-pink/30 dark:hover:border-white/20 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm", 
                      borderColor
                    )}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paradise-softPink/40 dark:bg-white/10 text-[#B85B68] dark:text-paradise-pink shadow-sm">
                      <Icon className="size-4.5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40 leading-none">{label}</p>
                      <p className="mt-2 font-bold text-sm text-[color:var(--text)] leading-snug">{value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          
          <section id="desktop-security" className="scroll-mt-6">
            {settingsNode}
          </section>
        </div>
      </div>
    </div>
  );
}
