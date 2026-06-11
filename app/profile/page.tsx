import Link from "next/link";
import { CalendarDays, ChevronRight, FileCheck2, FileText, IdCard, LockKeyhole, User, Mail, Fingerprint, Briefcase, ShieldAlert, MapPin, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LogoutButton } from "@/components/logout-button";
import { ProfileSettings } from "@/components/profile-settings";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { monthlyPersonalHours } from "@/lib/personal-hours";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function displayDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(value)
    : "Non impostata";
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { location: true } });
  if (!user) redirect("/login");
  
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 1));
  
  const [schedules, logs, records, openRequests, documents] = await Promise.all([
    prisma.scheduleEntry.findMany({ where: { user_id: user.id, date: { gte: monthStart, lt: monthEnd } }, include: { category: true } }),
    prisma.attendanceLog.findMany({ where: { user_id: user.id, date: { gte: monthStart, lt: monthEnd } }, select: { date: true, type: true, timestamp: true }, orderBy: { timestamp: "asc" } }),
    prisma.workHourRecord.findMany({ where: { user_id: user.id, date: { gte: monthStart, lt: monthEnd } } }),
    prisma.leaveRequest.count({ where: { user_id: user.id, status: "PENDING" } }),
    prisma.document.count({ where: { user_id: user.id } }),
  ]);
  
  const hours = monthlyPersonalHours(year, month, schedules, logs, records);
  const plannedHours = hours.reduce((total, row) => total + row.plannedHours, 0);
  const workedHours = hours.reduce((total, row) => total + row.workedHours, 0);

  const details = [
    { label: "Nome e Cognome", value: user.name, icon: User },
    { label: "Email di Servizio", value: user.email, icon: Mail },
    { label: "Data di Nascita", value: displayDate(user.birth_date), icon: CalendarDays },
    { label: "Codice Fiscale", value: user.fiscal_code ?? "Non impostato", icon: Fingerprint },
    { label: "Inizio Contratto", value: displayDate(user.contract_start), icon: Briefcase },
    { label: "Scadenza Contratto", value: displayDate(user.contract_end), icon: ShieldAlert },
    { label: "Salone Primario", value: user.location?.name ?? "Non assegnato", icon: MapPin },
  ];

  return (
    <AppShell title="Profilo" role={session.user.role as Role} hideHeader>
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        
        {/* Left Side Profile Card */}
        <Card className="p-6 border border-black/5 dark:border-white/10 bg-white/95 dark:bg-neutral-900 shadow-soft h-fit">
          <div className="flex flex-col items-center text-center">
            {/* Elegant avatar placeholder with glowing rings */}
            <div className="relative group select-none">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-paradise-pink to-paradise-gold opacity-45 blur group-hover:opacity-75 transition duration-500" />
              <div className="relative grid size-24 place-items-center overflow-hidden rounded-full border-4 border-white dark:border-neutral-800 bg-paradise-nude text-3xl font-extrabold text-paradise-noir shadow-md">
                {user.photo_url ? (
                  <img src={user.photo_url} alt={user.name} className="size-full object-cover rounded-full select-none pointer-events-none" />
                ) : (
                  user.name.slice(0, 1).toUpperCase()
                )}
              </div>
            </div>
            
            <h2 className="mt-4 text-xl font-extrabold text-[color:var(--text)] tracking-tight">{user.name}</h2>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-black/45 dark:text-white/40">
              <MapPin className="size-3.5 text-[#B85B68] dark:text-paradise-pink" />
              {user.location?.name ?? "Nessun salone assegnato"}
            </p>
            <div className="mt-3">
              <Badge tone="pink">{session.user.role === "DIPENDENTE" ? "Collaboratore" : session.user.role}</Badge>
            </div>
          </div>
          
          {/* Summary widgets inside an elegant glassmorphic grid with thin borders */}
          <div className="mt-6 grid grid-cols-3 divide-x divide-black/5 dark:divide-white/10 rounded-2xl border border-black/5 dark:border-white/10 bg-white/40 dark:bg-white/5 py-4 text-center shadow-sm">
            <ProfileStat label="Previste" value={`${plannedHours.toLocaleString("it-IT", { maximumFractionDigits: 1 })} h`} tone="pink" />
            <ProfileStat label="Lavorate" value={`${workedHours.toLocaleString("it-IT", { maximumFractionDigits: 1 })} h`} tone="gold" />
            <ProfileStat label="In Attesa" value={String(openRequests)} tone="dark" />
          </div>
          
          {/* Transition interactive lists structured as a list-group */}
          <div className="mt-6 divide-y divide-black/5 dark:divide-white/5 rounded-2xl border border-black/5 dark:border-white/10 bg-white/45 dark:bg-white/5 overflow-hidden">
            <ProfileLink icon={IdCard} label="Informazioni personali" href="#dati-personali" />
            <ProfileLink icon={CalendarDays} label="I miei turni" href="/my-shifts" />
            <ProfileLink icon={FileCheck2} label="Le mie richieste" href="/requests" />
            <ProfileLink icon={FileText} label={`Buste paga e documenti (${documents})`} href="/documents" />
            <ProfileLink icon={LockKeyhole} label="Sicurezza e impostazioni" href="#sicurezza" />
          </div>
          
          <div className="mt-6 xl:hidden">
            <LogoutButton />
          </div>
        </Card>
        
        {/* Right Side Cards */}
        <div className="space-y-6">
          <Card id="dati-personali" className="border border-black/5 dark:border-white/10 bg-white/95 dark:bg-neutral-900 shadow-soft">
            <div className="mb-4 flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3">
              <Sparkles className="size-5 text-[#B85B68] dark:text-paradise-pink animate-pulse" />
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
          
          <section id="sicurezza">
            <ProfileSettings
              photoUrl={user.photo_url}
              name={user.name}
              role={user.role}
              calendarSync={user.google_calendar_sync}
              calendarId={user.google_calendar_id}
            />
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function ProfileStat({ label, value, tone = "pink" }: { label: string; value: string; tone?: "pink" | "gold" | "dark" }) {
  const tones = {
    pink: "text-[#B85B68] dark:text-[#F4A3C4]",
    gold: "text-[#9E7A3B] dark:text-[#EAC27D]",
    dark: "text-paradise-noir dark:text-white"
  };
  return (
    <div className="px-1.5">
      <p className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-wide">{label}</p>
      <p className={cn("mt-1 text-sm font-extrabold tracking-tight", tones[tone])}>{value}</p>
    </div>
  );
}

function ProfileLink({ icon: Icon, label, href }: { icon: typeof IdCard; label: string; href: string }) {
  return (
    <Link 
      href={href} 
      className="flex items-center gap-3 px-3 py-3 text-sm font-bold text-paradise-noir dark:text-white/80 hover:text-[#B85B68] dark:hover:text-paradise-pink hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 group active:scale-[0.98]"
    >
      <div className="flex size-8 items-center justify-center rounded-lg bg-paradise-softPink/40 dark:bg-white/10 text-[#B85B68] dark:text-paradise-pink transition duration-200 group-hover:scale-105">
        <Icon className="size-4" />
      </div>
      <span className="flex-1 truncate">{label}</span>
      <ChevronRight className="size-4 text-black/35 dark:text-white/40 transition duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}
