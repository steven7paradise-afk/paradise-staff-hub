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
        <Card className="p-6 border border-white/50 bg-white/95 shadow-soft h-fit">
          <div className="flex flex-col items-center text-center">
            {/* Elegant avatar placeholder with glowing rings */}
            <div className="relative group select-none">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-paradise-pink to-paradise-gold opacity-45 blur group-hover:opacity-75 transition duration-500" />
              <div className="relative grid size-24 place-items-center overflow-hidden rounded-full border-4 border-white bg-paradise-nude text-3xl font-extrabold text-paradise-noir shadow-md">
                {user.photo_url ? (
                  <img src={user.photo_url} alt={user.name} className="size-full object-cover" />
                ) : (
                  user.name.slice(0, 1).toUpperCase()
                )}
              </div>
            </div>
            
            <h2 className="mt-4 text-xl font-extrabold text-paradise-noir tracking-tight">{user.name}</h2>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-black/45">
              <MapPin className="size-3.5 text-[#B85B68]" />
              {user.location?.name ?? "Nessun salone assegnato"}
            </p>
            <div className="mt-3">
              <Badge tone="pink">{session.user.role === "DIPENDENTE" ? "Collaboratore" : session.user.role}</Badge>
            </div>
          </div>
          
          {/* Summary widgets inside a premium burgundy gradient block */}
          <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#B85B68] via-[#a34a56] to-[#913b46] py-4 text-center text-white border border-[#B85B68]/30 shadow-md">
            <ProfileStat label="Previste" value={`${plannedHours.toLocaleString("it-IT", { maximumFractionDigits: 1 })} h`} />
            <ProfileStat label="Lavorate" value={`${workedHours.toLocaleString("it-IT", { maximumFractionDigits: 1 })} h`} />
            <ProfileStat label="In Attesa" value={String(openRequests)} />
          </div>
          
          {/* Transition interactive lists */}
          <div className="mt-6 space-y-1">
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
          <Card id="dati-personali" className="border border-white/50 bg-white/95 shadow-soft">
            <div className="mb-4 border-b border-black/5 pb-4">
              <h2 className="text-base font-bold text-paradise-noir flex items-center gap-2">
                <Sparkles className="size-5 text-[#B85B68]" />
                Informazioni Personali
              </h2>
            </div>
            
            <div className="grid gap-3 sm:grid-cols-2">
              {details.map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-start gap-3 rounded-2xl border border-black/5 bg-neutral-50/50 p-4 transition duration-200 hover:border-paradise-pink/30 hover:bg-white hover:shadow-sm">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paradise-pink/15 text-[#B85B68] shadow-sm">
                    <Icon className="size-4.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-black/40 leading-none">{label}</p>
                    <p className="mt-2 font-bold text-sm text-paradise-noir leading-snug">{value}</p>
                  </div>
                </div>
              ))}
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

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-white/20 px-1.5 last:border-0">
      <p className="text-[10px] font-bold text-white/70 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm font-extrabold tracking-tight">{value}</p>
    </div>
  );
}

function ProfileLink({ icon: Icon, label, href }: { icon: typeof IdCard; label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-paradise-noir hover:text-[#B85B68] hover:bg-paradise-nude/40 transition-all duration-200 group active:scale-[0.98]">
      <div className="flex size-8 items-center justify-center rounded-lg bg-paradise-pink/15 text-[#B85B68] transition duration-200 group-hover:bg-[#B85B68] group-hover:text-white">
        <Icon className="size-4" />
      </div>
      <span className="flex-1 truncate">{label}</span>
      <ChevronRight className="size-4 text-black/35 transition duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}
