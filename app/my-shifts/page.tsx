import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Coffee, Timer } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { monthlyPersonalHours } from "@/lib/personal-hours";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

function hours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toLocaleString("it-IT", { maximumFractionDigits: 2 });
}

function timeRange(entry?: { category: { start_time: string | null; end_time: string | null } }) {
  if (!entry?.category.start_time || !entry.category.end_time) return "Nessun orario";
  return `${entry.category.start_time} - ${entry.category.end_time}`;
}

export default async function MyShiftsPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "DIPENDENTE") redirect("/dashboard");

  const values = await searchParams;
  const today = new Date();
  const requestedMonth = Number(values.month);
  const requestedYear = Number(values.year);
  const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth - 1 : today.getMonth();
  const year = Number.isInteger(requestedYear) && requestedYear >= 2020 && requestedYear <= 2100 ? requestedYear : today.getFullYear();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));

  const [user, schedules, logs, records] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, include: { location: true } }),
    prisma.scheduleEntry.findMany({ where: { user_id: session.user.id, date: { gte: start, lt: end } }, include: { category: true }, orderBy: { date: "asc" } }),
    prisma.attendanceLog.findMany({ where: { user_id: session.user.id, date: { gte: start, lt: end } }, select: { date: true, type: true, timestamp: true }, orderBy: { timestamp: "asc" } }),
    prisma.workHourRecord.findMany({ where: { user_id: session.user.id, date: { gte: start, lt: end } } }),
  ]);
  if (!user) redirect("/login");

  const rows = monthlyPersonalHours(year, month, schedules, logs, records);
  const planned = rows.reduce((total, row) => total + row.plannedHours, 0);
  const worked = rows.reduce((total, row) => total + row.workedHours, 0);
  const breaks = rows.reduce((total, row) => total + row.breakHours, 0);
  const recordedDays = rows.filter((row) => row.workedHours > 0).length;
  const previous = new Date(Date.UTC(year, month - 1, 1));
  const next = new Date(Date.UTC(year, month + 1, 1));

  return (
    <AppShell title="I miei turni" subtitle={`Planning e ore registrate per ${user.name}${user.location ? ` - ${user.location.name}` : ""}.`} role="DIPENDENTE">
      <div className="mb-5 flex items-center justify-between rounded-2xl border border-black/5 bg-white p-3">
        <Link className="grid size-11 place-items-center rounded-xl hover:bg-paradise-nude" href={`/my-shifts?month=${previous.getUTCMonth() + 1}&year=${previous.getUTCFullYear()}`} aria-label="Mese precedente"><ChevronLeft className="size-5" /></Link>
        <p className="text-center text-lg font-semibold">{monthNames[month]} {year}</p>
        <Link className="grid size-11 place-items-center rounded-xl hover:bg-paradise-nude" href={`/my-shifts?month=${next.getUTCMonth() + 1}&year=${next.getUTCFullYear()}`} aria-label="Mese successivo"><ChevronRight className="size-5" /></Link>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary icon={CalendarDays} label="Ore previste" value={hours(planned)} />
        <Summary icon={Timer} label="Ore lavorate" value={hours(worked)} accent />
        <Summary icon={Coffee} label="Pause rilevate" value={hours(breaks)} />
        <Summary icon={Clock3} label="Giorni timbrati" value={String(recordedDays)} />
      </section>

      <Card className="mt-5 p-0">
        <div className="border-b border-black/5 px-4 py-4 sm:px-6">
          <h2 className="font-semibold">Dettaglio del mese</h2>
          <p className="mt-1 text-xs text-black/50">Le ore lavorate arrivano dalle timbrature; eventuali correzioni admin sono incluse.</p>
        </div>
        <div className="space-y-3 p-3 sm:hidden">
          {rows.map((row) => (
            <div key={row.date.toISOString()} className="rounded-xl border border-black/5 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(row.date)}</p>
                {row.schedule ? <Badge>{row.schedule.category.code}</Badge> : <span className="text-xs text-black/35">Non pianificato</span>}
              </div>
              <p className="mt-2 text-sm">{row.schedule?.category.name ?? "Nessun turno inserito"} {row.schedule ? `- ${timeRange(row.schedule)}` : ""}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-paradise-nude p-2 text-sm">
                <span className="text-black/50">Previste <strong className="text-black">{hours(row.plannedHours)} h</strong></span>
                <span className="text-black/50">Lavorate <strong className="text-black">{hours(row.workedHours)} h</strong></span>
              </div>
              {row.firstEntry || row.lastExit ? <p className="mt-2 text-xs text-black/50">Timbratura: {row.firstEntry ?? "--:--"} - {row.lastExit ?? "in corso"}</p> : null}
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-paradise-nude text-left">
                <th className="px-5 py-3">Giorno</th>
                <th className="px-5 py-3">Turno assegnato</th>
                <th className="px-5 py-3">Timbratura</th>
                <th className="px-5 py-3 text-right">Previste</th>
                <th className="px-5 py-3 text-right">Lavorate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date.toISOString()} className="border-t border-black/5">
                  <td className="whitespace-nowrap px-5 py-3 font-medium">{new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" }).format(row.date)}</td>
                  <td className="px-5 py-3">
                    {row.schedule ? <span>{row.schedule.category.name} <span className="text-black/45">{timeRange(row.schedule)}</span></span> : <span className="text-black/35">Non pianificato</span>}
                  </td>
                  <td className="px-5 py-3 text-black/55">{row.firstEntry ? `${row.firstEntry} - ${row.lastExit ?? "in corso"}` : "--"}</td>
                  <td className="px-5 py-3 text-right">{hours(row.plannedHours)} h</td>
                  <td className="px-5 py-3 text-right font-semibold">{hours(row.workedHours)} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}

function Summary({ icon: Icon, label, value, accent = false }: { icon: typeof CalendarDays; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-[#dba0a7] p-4" : "p-4"}>
      <Icon className="size-5 text-[#B85B68]" />
      <p className="mt-3 text-xs text-black/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value} <span className="text-sm font-normal text-black/45">{label.includes("Ore") || label.includes("Pause") ? "h" : ""}</span></p>
    </Card>
  );
}
