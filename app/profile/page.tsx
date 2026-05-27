import Link from "next/link";
import { CalendarDays, ChevronRight, FileCheck2, FileText, IdCard, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LogoutButton } from "@/components/logout-button";
import { ProfileSettings } from "@/components/profile-settings";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { monthlyPersonalHours } from "@/lib/personal-hours";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

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
    ["Nome e cognome", user.name],
    ["Email", user.email],
    ["Data di nascita", displayDate(user.birth_date)],
    ["Codice fiscale", user.fiscal_code ?? "Non impostato"],
    ["Inizio contratto", displayDate(user.contract_start)],
    ["Scadenza contratto", displayDate(user.contract_end)],
    ["Salone", user.location?.name ?? "Non assegnato"],
  ];

  return (
    <AppShell title="Profilo" subtitle="Il tuo spazio personale e le preferenze dell'account." role={session.user.role as Role}>
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col items-center text-center">
            <div className="grid size-24 place-items-center overflow-hidden rounded-full border-4 border-paradise-softPink bg-paradise-nude text-3xl font-semibold">
              {user.photo_url ? <img src={user.photo_url} alt={user.name} className="size-full object-cover" /> : user.name.slice(0, 1)}
            </div>
            <h2 className="mt-4 text-xl font-semibold">{user.name}</h2>
            <p className="mt-1 text-sm text-black/50">{user.location?.name ?? "Nessun salone assegnato"}</p>
            <Badge tone="pink">{session.user.role === "DIPENDENTE" ? "Dipendente" : session.user.role}</Badge>
          </div>
          <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-xl bg-[#B85B68] py-4 text-center text-white">
            <ProfileStat label="Previste" value={`${plannedHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h`} />
            <ProfileStat label="Lavorate" value={`${workedHours.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h`} />
            <ProfileStat label="Richieste" value={String(openRequests)} />
          </div>
          <div className="mt-5 divide-y divide-black/5">
            <ProfileLink icon={IdCard} label="Informazioni personali" href="#dati-personali" />
            <ProfileLink icon={CalendarDays} label="I miei turni" href="/my-shifts" />
            <ProfileLink icon={FileCheck2} label="Le mie richieste" href="/requests" />
            <ProfileLink icon={FileText} label={`Documenti (${documents})`} href="/documents" />
            <ProfileLink icon={LockKeyhole} label="Password e foto profilo" href="#sicurezza" />
          </div>
          <div className="mt-2 xl:hidden">
            <LogoutButton />
          </div>
        </Card>
        <div className="space-y-5">
          <Card id="dati-personali">
            <h2 className="mb-4 text-lg font-semibold">Informazioni personali</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div key={label} className="rounded-xl bg-paradise-nude p-4">
                  <p className="text-xs font-semibold uppercase text-black/45">{label}</p>
                  <p className="mt-2 font-medium">{value}</p>
                </div>
              ))}
            </div>
          </Card>
          <section id="sicurezza">
            <ProfileSettings photoUrl={user.photo_url} name={user.name} />
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-white/30 px-2 last:border-0">
      <p className="text-[11px] text-white/75">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ProfileLink({ icon: Icon, label, href }: { icon: typeof IdCard; label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 py-3 text-sm font-medium transition hover:text-[#B85B68]">
      <Icon className="size-4 text-[#B85B68]" />
      <span>{label}</span>
      <ChevronRight className="ml-auto size-4 text-black/30" />
    </Link>
  );
}
