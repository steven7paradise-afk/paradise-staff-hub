"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, Target } from "lucide-react";
import {
  buildDailyClientControlTarget,
  type DailyControlResponse,
  DAILY_CLIENT_CONTROL_TARGET,
  romeDateKey,
} from "@/lib/client-control-daily-target";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";

type StaffProfile = { name: string; photoUrl: string | null };
type MonthWeek = { startDay: number; endDay: number; dateKeys: string[] };

function dateKeyFor(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthWeeks(year: number, month: number): MonthWeek[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: MonthWeek[] = [];
  let startDay = 1;
  while (startDay <= daysInMonth) {
    const weekday = new Date(Date.UTC(year, month, startDay)).getUTCDay();
    const daysUntilSunday = weekday === 0 ? 0 : 7 - weekday;
    const endDay = Math.min(startDay + daysUntilSunday, daysInMonth);
    weeks.push({
      startDay,
      endDay,
      dateKeys: Array.from({ length: endDay - startDay + 1 }, (_, index) => dateKeyFor(year, month, startDay + index)),
    });
    startDay = endDay + 1;
  }
  return weeks;
}

function defaultWeekIndex(year: number, month: number) {
  const weeks = monthWeeks(year, month);
  const todayKey = romeDateKey(new Date());
  const selectedMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
  const day = todayKey.startsWith(selectedMonth) ? Number(todayKey.slice(-2)) : new Date(year, month + 1, 0).getDate();
  return Math.max(0, weeks.findIndex((week) => day >= week.startDay && day <= week.endDay));
}

function weekLabel(week: MonthWeek, year: number, month: number) {
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month, 1)));
  return `${week.startDay}–${week.endDay} ${monthLabel} ${year}`;
}

function dayParts(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat("it-IT", { weekday: "long", timeZone: "UTC" }).format(date),
    date: new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" }).format(date),
  };
}

function StaffPhoto({ profile }: { profile: StaffProfile }) {
  const photoUrl = resolveDrivePhotoUrl(profile.photoUrl);
  return photoUrl ? (
    <span
      role="img"
      aria-label={`Foto di ${profile.name}`}
      className="size-12 shrink-0 rounded-full bg-cover bg-center shadow-sm ring-2 ring-white"
      style={{ backgroundImage: `url(${photoUrl})` }}
    />
  ) : (
    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#FCEBF4] text-xs font-black text-[#A43E70] ring-2 ring-white">
      {profile.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
    </span>
  );
}

export function DailyTargetList({
  responses,
  employeeNames,
  corsoStaffNames,
  staffProfiles = [],
  selectedMonth,
  selectedYear,
  selectedWorkerName,
}: {
  responses: DailyControlResponse[];
  employeeNames: string[];
  corsoStaffNames: string[];
  staffProfiles: StaffProfile[];
  selectedMonth: number;
  selectedYear: number;
  selectedWorkerName: string;
}) {
  const weeks = useMemo(() => monthWeeks(selectedYear, selectedMonth), [selectedMonth, selectedYear]);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(() => defaultWeekIndex(selectedYear, selectedMonth));
  const daysScrollerRef = useRef<HTMLDivElement>(null);
  const selectedWeek = weeks[selectedWeekIndex] ?? weeks[0];
  const profileByName = useMemo(() => new Map(staffProfiles.map((profile) => [profile.name, profile])), [staffProfiles]);

  useEffect(() => {
    setSelectedWeekIndex(defaultWeekIndex(selectedYear, selectedMonth));
  }, [selectedMonth, selectedYear]);

  useLayoutEffect(() => {
    if (daysScrollerRef.current) daysScrollerRef.current.scrollLeft = 0;
  }, [selectedWeekIndex]);

  const days = useMemo(() => (selectedWeek?.dateKeys ?? []).map((dateKey) => {
    const report = buildDailyClientControlTarget({
      responses,
      employeeNames,
      dateKey,
      salon: "Salone Buenos Aires",
      selectedWorkerName,
      allowedStaffNames: corsoStaffNames,
    });
    return {
      dateKey,
      ...dayParts(dateKey),
      isFuture: dateKey > romeDateKey(new Date()),
      totalControls: report.totalControls,
      workers: report.workers
        .filter((worker) => worker.controls > 0)
        .sort((a, b) => Number(b.reachedTarget) - Number(a.reachedTarget) || b.controls - a.controls || a.name.localeCompare(b.name, "it"))
        .map((worker) => ({ ...worker, profile: profileByName.get(worker.name) ?? { name: worker.name, photoUrl: null } })),
    };
  }), [corsoStaffNames, employeeNames, profileByName, responses, selectedWeek, selectedWorkerName]);

  const reachedCount = days.reduce((sum, day) => sum + day.workers.filter((worker) => worker.reachedTarget).length, 0);
  const belowTargetCount = days.reduce((sum, day) => sum + day.workers.filter((worker) => !worker.reachedTarget).length, 0);

  return (
    <section className="overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-black/10 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#FCEBF4] text-[#B94778]"><CalendarRange className="size-5" /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B94778]">Obiettivo giornaliero</p>
            <h2 className="mt-1 text-2xl font-black text-[#171717]">Obiettivo 5 appuntamenti</h2>
            <p className="mt-1 text-sm font-semibold text-black/45">Verde: obiettivo raggiunto · giallo: appuntamenti fatti, ma meno di 5.</p>
          </div>
        </div>

        <div className="flex w-full items-center rounded-xl border border-black/10 bg-[#FAF8F9] p-1 lg:w-auto">
          <button type="button" onClick={() => setSelectedWeekIndex((current) => Math.max(0, current - 1))} disabled={selectedWeekIndex === 0} className="grid size-11 shrink-0 place-items-center rounded-lg text-black/55 transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-25" aria-label="Settimana precedente"><ChevronLeft className="size-4" /></button>
          <div className="min-w-0 flex-1 px-3 text-center lg:min-w-56">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-black/35">Settimana {selectedWeekIndex + 1} di {weeks.length}</p>
            <p className="mt-0.5 truncate text-sm font-black capitalize text-[#292329]">{selectedWeek ? weekLabel(selectedWeek, selectedYear, selectedMonth) : "Nessuna settimana"}</p>
          </div>
          <button type="button" onClick={() => setSelectedWeekIndex((current) => Math.min(weeks.length - 1, current + 1))} disabled={selectedWeekIndex >= weeks.length - 1} className="grid size-11 shrink-0 place-items-center rounded-lg text-black/55 transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-25" aria-label="Settimana successiva"><ChevronRight className="size-4" /></button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] bg-[#FCFAFB] px-5 py-3 text-xs font-bold text-black/45 sm:px-6">
        <span>Scorri i giorni verso destra</span>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="size-4" />{reachedCount} da 5+</span>
          <span className="inline-flex items-center gap-1.5 text-amber-700"><Target className="size-4" />{belowTargetCount} sotto obiettivo</span>
        </div>
      </div>

      <div ref={daysScrollerRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto p-4 [scrollbar-color:#D9CAD1_transparent] sm:p-5">
        {days.map((day) => (
          <article key={day.dateKey} className="min-h-72 w-[min(82vw,290px)] shrink-0 snap-start overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm sm:w-72">
            <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] bg-[#FCFAFB] px-4 py-3">
              <div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#B94778]">{day.weekday}</p><p className="mt-0.5 text-lg font-black capitalize text-[#211D20]">{day.date}</p></div>
              <div className="text-right"><p className="text-xl font-black text-[#211D20]">{day.totalControls}</p><p className="text-[9px] font-black uppercase tracking-wide text-black/35">Appuntamenti</p></div>
            </div>
            <div className="space-y-3 p-4">
              {day.workers.length ? day.workers.map((worker) => (
                <div key={worker.name} className={cn("flex items-center gap-3 rounded-xl border p-3", worker.reachedTarget ? "border-emerald-100 bg-emerald-50/70" : "border-amber-200 bg-amber-50/80")}>
                  <StaffPhoto profile={worker.profile} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#211D20]">{worker.name}</p>
                    <p className={cn("mt-0.5 text-xs font-bold", worker.reachedTarget ? "text-emerald-700" : "text-amber-800")}>
                      {worker.reachedTarget ? "Obiettivo raggiunto" : `Mancano ${worker.remaining} appuntamenti`}
                    </p>
                  </div>
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-black text-white", worker.reachedTarget ? "bg-emerald-600" : "bg-amber-500")}>{worker.controls}</span>
                </div>
              )) : (
                <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-black/10 bg-[#FAF8F9] px-5 text-center"><div><Target className="mx-auto size-6 text-black/20" /><p className="mt-3 text-sm font-black text-black/50">{day.isFuture ? "Giorno da svolgere" : "Nessun appuntamento"}</p><p className="mt-1 text-xs font-semibold text-black/35">{day.isFuture ? "Il risultato sarà disponibile al termine della giornata." : "Non risultano appuntamenti attribuiti al personale."}</p></div></div>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 border-t border-black/[0.06] px-4 py-3">
        {weeks.map((week, index) => (
          <button key={`${week.startDay}-${week.endDay}`} type="button" onClick={() => setSelectedWeekIndex(index)} className={cn("h-1.5 rounded-full transition-all", selectedWeekIndex === index ? "w-7 bg-black" : "w-2 bg-black/15 hover:bg-black/30")} aria-label={`Apri settimana ${index + 1}`} />
        ))}
      </div>
    </section>
  );
}
