import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WeeklyShiftResponsiblePlanner } from "@/components/weekly-shift-responsible-planner";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { normalizeShiftResponsibleAssignments, WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY, weekDays } from "@/lib/weekly-shift-responsibles";

export const dynamic = "force-dynamic";
const adminRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

function shiftedWeek(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset * 7);
  return weekDays(date.toISOString().slice(0, 10))[0];
}

function weekOfMonth(day: string) {
  return Math.ceil(new Date(`${day}T12:00:00.000Z`).getUTCDate() / 7);
}

export default async function OrganizzaTurniPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!adminRoles.has(session.user.role)) redirect("/responsabile-di-turno");
  const query = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const dates = weekDays(query.week || today);
  const [people, setting] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, employee_status: { not: "Ex dipendente" }, mansione: { contains: "responsabile salone", mode: "insensitive" } },
      select: { id: true, name: true, photo_url: true, mansione: true, schedule_entries: { where: { date: { in: dates.map((date) => new Date(`${date}T00:00:00.000Z`)) } }, select: { date: true, start_time: true, end_time: true, category: { select: { name: true, start_time: true, end_time: true } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.setting.findUnique({ where: { key: WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY } }),
  ]);
  const assignments = normalizeShiftResponsibleAssignments(setting?.value);

  return (
    <AppShell title="Organizza i turni" role={session.user.role as Role} edgeToEdgeMain>
      <main className="min-h-screen bg-[#f4f1fa]">
        <div className="px-3 pt-5 sm:px-6 xl:px-10 xl:pt-20"><Link href="/programmazione-responsabile-di-turno" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 text-[10px] font-black text-[#874363] shadow-sm"><ArrowLeft className="size-4" />Torna al controllo</Link></div>
        <WeeklyShiftResponsiblePlanner
          days={dates.map((date) => { const value = new Date(`${date}T12:00:00.000Z`); return { date, weekday: new Intl.DateTimeFormat("it-IT", { weekday: "long", timeZone: "UTC" }).format(value), dayNumber: new Intl.DateTimeFormat("it-IT", { day: "2-digit", timeZone: "UTC" }).format(value) }; })}
          candidates={people.map((person) => ({ id: person.id, name: person.name, photoUrl: person.photo_url, roleLabel: person.mansione?.toLocaleLowerCase("it-IT").includes("vice responsabile") ? "Vice responsabile" : "Responsabile", shifts: Object.fromEntries(person.schedule_entries.map((entry) => { const start = entry.start_time || entry.category.start_time; const end = entry.end_time || entry.category.end_time; return [entry.date.toISOString().slice(0, 10), start && end ? `${start}–${end}` : entry.category.name]; })) }))}
          initialAssignments={Object.fromEntries(dates.map((date) => [date, assignments[date] || ""]))}
          previousWeekHref={`/programmazione-responsabile-di-turno/turni?week=${shiftedWeek(dates[0], -1)}`}
          nextWeekHref={`/programmazione-responsabile-di-turno/turni?week=${shiftedWeek(dates[0], 1)}`}
          weekLabel={`Settimana ${weekOfMonth(dates[3])}`}
        />
      </main>
    </AppShell>
  );
}
