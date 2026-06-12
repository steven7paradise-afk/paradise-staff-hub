import Link from "next/link";
import { CalendarDays, CalendarClock, CalendarCheck, ChevronLeft, ChevronRight, Clock3, Coffee, Timer, Sparkles, Share2, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { monthlyPersonalHours, plannedHours } from "@/lib/personal-hours";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { calculateClockHours } from "@/lib/work-hours";
import { MonthSelector, CurrentlyAtWork, DailyDetailCard, DailyTableRow } from "./client-components";

export const dynamic = "force-dynamic";

const monthNames = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

function hours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toLocaleString("it-IT", { maximumFractionDigits: 2 });
}

function timeRange(entry?: { category: { start_time: string | null; end_time: string | null } }) {
  if (!entry?.category.start_time || !entry.category.end_time) return "Nessun orario";
  return `${entry.category.start_time} - ${entry.category.end_time}`;
}

export default async function MyShiftsPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string; weekOffset?: string }> }) {
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

  // Expand query range by 7 days on both ends to support week boundaries without boundary cuts
  const queryStart = new Date(start);
  queryStart.setUTCDate(queryStart.getUTCDate() - 7);
  const queryEnd = new Date(end);
  queryEnd.setUTCDate(queryEnd.getUTCDate() + 7);

  const [user, schedules, logs, records] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, include: { location: true } }),
    prisma.scheduleEntry.findMany({ where: { user_id: session.user.id, date: { gte: queryStart, lt: queryEnd } }, include: { category: true }, orderBy: { date: "asc" } }),
    prisma.attendanceLog.findMany({ where: { user_id: session.user.id, date: { gte: queryStart, lt: queryEnd } }, select: { date: true, type: true, timestamp: true }, orderBy: { timestamp: "asc" } }),
    prisma.workHourRecord.findMany({ where: { user_id: session.user.id, date: { gte: queryStart, lt: queryEnd } } }),
  ]);
  
  if (!user) redirect("/login");

  // Calculations for current month view
  const rows = monthlyPersonalHours(year, month, schedules, logs, records);
  const planned = rows.reduce((total, row) => total + row.plannedHours, 0);
  const worked = rows.reduce((total, row) => total + row.workedHours, 0);
  const breaks = rows.reduce((total, row) => total + row.breakHours, 0);
  const recordedDays = rows.filter((row) => row.workedHours > 0).length;
  
  const previous = new Date(Date.UTC(year, month - 1, 1));
  const next = new Date(Date.UTC(year, month + 1, 1));

  const percentage = planned > 0 ? Math.round((worked / planned) * 100) : 0;

  // Absences/Tardiness calculation: planned shift day in past, workedHours is 0, category code not RIPOSO
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const absences = rows.filter((r) => {
    const isPast = r.date < todayStart;
    const hasPlanned = r.plannedHours > 0;
    const isNotRest = r.schedule?.category?.code !== "RIPOSO";
    const didNotWork = r.workedHours === 0;
    return isPast && hasPlanned && isNotRest && didNotWork;
  }).length;

  // Active clock-in check
  const todayStr = today.toISOString().slice(0, 10);
  const todayLogs = logs.filter(log => log.date.toISOString().slice(0, 10) === todayStr);
  const latestEntrataLog = [...todayLogs]
    .reverse()
    .find(log => log.type === "ENTRATA");
  
  const isCurrentlyClockedIn = todayLogs.length > 0 && 
    (() => {
      const sorted = [...todayLogs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      let state = false;
      sorted.forEach(log => {
        if (log.type === "ENTRATA") state = true;
        if (log.type === "USCITA") state = false;
      });
      return state;
    })();
  
  const activeClockInTime = isCurrentlyClockedIn && latestEntrataLog ? latestEntrataLog.timestamp.toISOString() : null;

  // Weekly Calendar Navigation
  const weekOffset = Number(values.weekOffset) || 0;
  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear();
  let referenceDate = new Date(today);
  if (!isCurrentMonth) {
    referenceDate = new Date(Date.UTC(year, month, 1));
  }
  
  const refDay = referenceDate.getDay();
  const offsetToMonday = refDay === 0 ? -6 : 1 - refDay;
  const mondayDate = new Date(referenceDate);
  mondayDate.setDate(referenceDate.getDate() + offsetToMonday + (weekOffset * 7));
  mondayDate.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + i);
    return d;
  });

  const weekDaysData = weekDays.map((date) => {
    const key = date.toISOString().slice(0, 10);
    const daySchedule = schedules.find((s) => s.date.toISOString().slice(0, 10) === key);
    const dayRecord = records.find((r) => r.date.toISOString().slice(0, 10) === key);
    const dayLogs = logs.filter((l) => l.date.toISOString().slice(0, 10) === key);
    
    const clock = calculateClockHours(dayLogs);
    const automaticHours = dayRecord?.paid_break ? clock.grossHours : clock.netHours;
    const workedHours = dayRecord?.manual_override ? dayRecord.hours : automaticHours;
    const plannedHoursVal = plannedHours(daySchedule);

    return {
      date,
      schedule: daySchedule,
      plannedHours: plannedHoursVal,
      workedHours,
    };
  });

  // SVG sparkline points calculation (worked hours up to today)
  const sparklineDays = rows.filter((r) => r.date <= today);
  const sparklineData = sparklineDays.map((r) => r.workedHours);
  const svgWidth = 120;
  const svgHeight = 45;
  const maxVal = Math.max(...sparklineData, 4);
  const minVal = 0;
  const range = maxVal - minVal;

  const points = sparklineData.map((val, idx) => {
    const x = sparklineData.length > 1 ? (idx / (sparklineData.length - 1)) * svgWidth : 0;
    const y = svgHeight - 5 - ((val - minVal) / range) * (svgHeight - 10);
    return { x, y };
  });

  let dPath = "";
  let fillPath = "";
  if (points.length > 0) {
    dPath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
    fillPath = `${dPath} L ${points[points.length - 1].x} ${svgHeight} L ${points[0].x} ${svgHeight} Z`;
  }

  // 1. Worked Hours Card JSX
  const workedHoursCard = (
    <div className="rounded-[24px] border border-black/5 bg-gradient-to-br from-white via-white to-[#FFA8DD]/10 p-5 shadow-soft">
      <div className="flex justify-between items-start">
        <div className="flex gap-3">
          <div className="flex size-10.5 items-center justify-center rounded-2xl bg-paradise-pink/15 text-[#B85B68] shadow-sm">
            <Clock3 className="size-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-black/35 uppercase tracking-wider">
              Ore lavorate questo mese
            </p>
            <p className="text-2xl font-extrabold text-paradise-noir mt-1">
              {hours(worked)} h
            </p>
          </div>
        </div>
        
        {/* SVG Sparkline */}
        <div className="shrink-0 -mt-1 -mr-2">
          <svg className="w-[120px] h-[45px]" viewBox="0 0 120 45">
            <defs>
              <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFA8DD" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#FFA8DD" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {points.length > 1 && (
              <>
                <path d={fillPath} fill="url(#sparkline-grad)" />
                <path d={dPath} fill="none" stroke="#E0529C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill="#E0529C" />
                <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="6" fill="#E0529C" fillOpacity="0.25" className="animate-pulse" />
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Progress Bar & percentage */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-[10px] font-bold text-black/40 mb-1.5 uppercase">
          <span>{percentage}% del totale previsto</span>
          <span>{hours(worked)} / {hours(planned)} h</span>
        </div>
        <div className="w-full h-2 rounded-full bg-black/[0.04] overflow-hidden border border-black/5">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-paradise-pink to-[#E0529C]" 
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
      </div>
    </div>
  );

  // 2. Metrics Row/Grid JSX
  const metricsContainer = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
      {/* Card 1: Ore previste */}
      <div className="min-w-0 rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-paradise-gold/20 text-[#9E7A3B] shadow-sm">
          <CalendarClock className="size-5" />
        </div>
        <p className="text-[9px] font-bold text-black/35 uppercase tracking-wider mt-4">
          Ore previste
        </p>
        <p className="text-base font-extrabold text-paradise-noir mt-0.5">
          {hours(planned)} h
        </p>
        <p className="text-[9px] font-semibold text-black/40 mt-1">
          Mese di {monthNames[month].toLowerCase()}
        </p>
      </div>

      {/* Card 2: Giorni lavorati */}
      <div className="min-w-0 rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-sm">
          <CalendarCheck className="size-5" />
        </div>
        <p className="text-[9px] font-bold text-black/35 uppercase tracking-wider mt-4">
          Giorni lavorati
        </p>
        <p className="text-base font-extrabold text-paradise-noir mt-0.5">
          {recordedDays}
        </p>
        <p className="text-[9px] font-semibold text-black/40 mt-1">
          su {rows.length} giorni
        </p>
      </div>

      {/* Card 3: Assenze / ritardi */}
      <div className="min-w-0 rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#C66170]/10 text-[#C66170] shadow-sm">
          <ShieldCheck className="size-5" />
        </div>
        <p className="text-[9px] font-bold text-black/35 uppercase tracking-wider mt-4">
          Assenze / Ritardi
        </p>
        <p className="text-base font-extrabold text-paradise-noir mt-0.5">
          {absences}
        </p>
        <p className="text-[9px] font-bold text-emerald-600 mt-1">
          {absences === 0 ? "Perfetto! 🥳" : "Da controllare ⚠️"}
        </p>
      </div>

      {/* Card 4: Pause */}
      <div className="min-w-0 rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 shadow-sm">
          <Coffee className="size-5" />
        </div>
        <p className="text-[9px] font-bold text-black/35 uppercase tracking-wider mt-4">
          Pause
        </p>
        <p className="text-base font-extrabold text-paradise-noir mt-0.5">
          {hours(breaks)} h
        </p>
        <p className="text-[9px] font-semibold text-black/40 mt-1">
          Questo mese
        </p>
      </div>
    </div>
  );

  // 3. Currently At Work JSX
  const currentlyAtWorkWidget = (
    <CurrentlyAtWork activeClockInTime={activeClockInTime} />
  );

  // 4. Weekly strip calendar JSX
  const weeklyCalendarStrip = (
    <div className="space-y-2.5">
      {/* Title and Chevrons (Outside the card, aligned with it) */}
      <div className="flex items-center justify-between px-0">
        <h3 className="text-xs font-extrabold text-paradise-noir uppercase tracking-wider">Questa settimana</h3>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/my-shifts?month=${month + 1}&year=${year}&weekOffset=${weekOffset - 1}`}
            className="grid size-7 place-items-center rounded-lg border border-black/5 bg-white hover:bg-neutral-50 transition active:scale-95 shadow-sm"
          >
            <ChevronLeft className="size-3.5 text-black/60" />
          </Link>
          <Link
            href={`/my-shifts?month=${month + 1}&year=${year}&weekOffset=${weekOffset + 1}`}
            className="grid size-7 place-items-center rounded-lg border border-black/5 bg-white hover:bg-neutral-50 transition active:scale-95 shadow-sm"
          >
            <ChevronRight className="size-3.5 text-black/60" />
          </Link>
        </div>
      </div>

      {/* Weekly strip calendar Card */}
      <div className="rounded-[24px] border border-black/5 bg-white pt-5 pb-6 px-4.5 shadow-soft">
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDaysData.map(({ date, plannedHours, workedHours, schedule }) => {
            const isToday = date.toDateString() === today.toDateString();
            const dayName = new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(date).slice(0, 3).toUpperCase();
            const dayNum = new Intl.DateTimeFormat("it-IT", { day: "2-digit" }).format(date);
            
            let status: "check" | "cross" | "today" | "dash" = "dash";
            if (isToday) {
              status = "today";
            } else if (workedHours > 0) {
              status = "check";
            } else if (plannedHours > 0 && workedHours === 0 && date < todayStart && schedule?.category?.code !== "RIPOSO") {
              status = "cross";
            }

            return (
              <div key={date.toISOString()} className="flex flex-col items-center flex-1 min-w-0">
                {/* Row 1: Weekday name */}
                <span className="text-[9px] font-bold text-black/35 uppercase tracking-wider block h-4">
                  {dayName}
                </span>
                
                {/* Row 2: Day number container (Fixed height h-9 to align circles and numbers perfectly) */}
                <div className="mt-1.5 h-9 w-full flex items-center justify-center">
                  {isToday ? (
                    <div className="size-8 rounded-full bg-paradise-pink text-white font-extrabold text-xs flex items-center justify-center shadow-[0_3px_8px_rgba(255,168,221,0.4)] border border-paradise-pink">
                      {dayNum}
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-paradise-noir">
                      {dayNum}
                    </span>
                  )}
                </div>
                
                {/* Row 3: Status / label container (Fixed height h-6 to align 'Oggi' and status badges vertically) */}
                <div className="mt-1 h-6 w-full flex items-center justify-center">
                  {isToday ? (
                    <span className="text-[9px] font-extrabold text-[#E0529C] tracking-tight leading-none">
                      Oggi
                    </span>
                  ) : (
                    <>
                      {status === "check" && (
                        <div className="size-5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 flex items-center justify-center">
                          <svg className="size-2.5 stroke-[3.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      {status === "cross" && (
                        <div className="size-5 rounded-full bg-rose-500/10 text-[#E0529C] border-rose-500/25 flex items-center justify-center">
                          <svg className="size-2.5 stroke-[3.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      )}
                      {status === "dash" && (
                        <div className="size-5 rounded-full bg-neutral-50 text-neutral-300 border border-neutral-100 flex items-center justify-center">
                          <span className="font-extrabold text-[10px] leading-none">-</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // 5. Dettaglio del Mese Card JSX
  const dettaglioDelMeseCard = (
    <Card className="overflow-hidden border border-white/50 bg-white/90 p-0 shadow-soft">
      <div className="border-b border-black/5 bg-gradient-to-b from-white to-neutral-50/50 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-paradise-pink/15 text-[#B85B68] shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-paradise-noir">Dettaglio del Mese</h2>
            <p className="text-xs text-black/45">Le ore lavorate arrivano dalle timbrature; eventuali correzioni degli amministratori sono incluse.</p>
          </div>
        </div>
        <Link
          href={`/schedules/card?userId=${session.user.id}&month=${month + 1}&year=${year}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-paradise-softPink text-[#B85B68] border border-paradise-pink/20 px-4 py-2 text-xs font-bold shadow-sm transition-all duration-200 hover:scale-[1.02] hover:bg-[#F2D0D9] active:scale-[0.98]"
        >
          <Share2 className="size-3.5" /> Condividi Cartolina
        </Link>
      </div>

      {/* Desktop tabular view */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-paradise-softPink/15 via-paradise-nude/10 to-paradise-softPink/5 text-left border-b border-black/5">
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-black/60">Giorno</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-black/60">Turno Assegnato</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-black/60">Timbratura</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-black/60 text-right">Previste</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-black/60 text-right">Lavorate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isWeekend = row.date.getDay() === 0 || row.date.getDay() === 6;
              const cat = row.schedule?.category;

              let statusLabel = "Non prog.";
              let statusType: "completed" | "absent" | "inprogress" | "unprogrammed" = "unprogrammed";

              if (row.workedHours > 0) {
                if (row.lastExit) {
                  statusLabel = "✓ Completato";
                  statusType = "completed";
                } else {
                  statusLabel = "In corso";
                  statusType = "inprogress";
                }
              } else if (row.plannedHours > 0 && row.date < todayStart && cat?.code !== "RIPOSO") {
                statusLabel = "✗ Assente";
                statusType = "absent";
              } else if (cat?.code === "RIPOSO") {
                statusLabel = "Riposo";
                statusType = "unprogrammed";
              }

              return (
                <DailyTableRow
                  key={row.date.toISOString()}
                  dateIso={row.date.toISOString()}
                  dayName={new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(row.date).slice(0, 3).toUpperCase()}
                  dayNum={new Intl.DateTimeFormat("it-IT", { day: "2-digit" }).format(row.date)}
                  monthName={new Intl.DateTimeFormat("it-IT", { month: "short" }).format(row.date).slice(0, 3).toUpperCase()}
                  shiftName={cat?.name ?? "Non programmato"}
                  shiftTime={timeRange(row.schedule)}
                  firstEntry={row.firstEntry}
                  lastExit={row.lastExit}
                  workedHours={row.workedHours}
                  plannedHours={row.plannedHours}
                  note={row.note}
                  categoryColor={cat?.color}
                  categoryTextColor={cat?.text_color}
                  statusLabel={statusLabel}
                  statusType={statusType}
                  isWeekend={isWeekend}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list view */}
      <div className="lg:hidden p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-paradise-noir uppercase tracking-wider">Dettaglio giornaliero</h3>
          <span className="text-xs font-bold text-[#E0529C]">Vedi tutto</span>
        </div>

        <div className="space-y-3 pb-4">
          {rows.map((row) => {
            const dayName = new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(row.date).slice(0, 3).toUpperCase();
            const dayNum = new Intl.DateTimeFormat("it-IT", { day: "2-digit" }).format(row.date);
            const monthName = new Intl.DateTimeFormat("it-IT", { month: "short" }).format(row.date).slice(0, 3).toUpperCase();
            const cat = row.schedule?.category;

            let statusLabel = "Non prog.";
            let statusType: "completed" | "absent" | "inprogress" | "unprogrammed" = "unprogrammed";

            if (row.workedHours > 0) {
              if (row.lastExit) {
                statusLabel = "✓ Completato";
                statusType = "completed";
              } else {
                statusLabel = "In corso";
                statusType = "inprogress";
              }
            } else if (row.plannedHours > 0 && row.date < todayStart && cat?.code !== "RIPOSO") {
              statusLabel = "✗ Assente";
              statusType = "absent";
            } else if (cat?.code === "RIPOSO") {
              statusLabel = "Riposo";
              statusType = "unprogrammed";
            }

            return (
              <DailyDetailCard
                key={row.date.toISOString()}
                dateIso={row.date.toISOString()}
                dayName={dayName}
                dayNum={dayNum}
                monthName={monthName}
                shiftName={cat?.name ?? "Non programmato"}
                shiftTime={timeRange(row.schedule)}
                firstEntry={row.firstEntry}
                lastExit={row.lastExit}
                workedHours={row.workedHours}
                plannedHours={row.plannedHours}
                note={row.note}
                categoryColor={cat?.color}
                statusLabel={statusLabel}
                statusType={statusType}
              />
            );
          })}
        </div>
      </div>
    </Card>
  );

  return (
    <AppShell title="I miei turni" role="DIPENDENTE" hideHeader>
      <div className="mx-auto w-full max-w-7xl space-y-5 pb-8">
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-black/35">Paradise Beauty</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-paradise-noir sm:text-4xl">
            Ciao, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-black/55">
            I tuoi turni, le timbrature e le ore del mese{user.location ? ` in ${user.location.name}` : ""}.
          </p>
        </div>
        <div className="shrink-0">
          <MonthSelector currentMonth={month} currentYear={year} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-[26px] border border-white/70 bg-gradient-to-r from-paradise-softPink/20 via-white/90 to-paradise-nude/30 p-3 backdrop-blur-xl shadow-soft">
        <Link 
          className="grid size-11 place-items-center rounded-2xl border border-black/5 bg-white shadow-sm transition-all duration-200 hover:bg-paradise-nude hover:scale-105 active:scale-95 hover:border-black/10" 
          href={`/my-shifts?month=${previous.getUTCMonth() + 1}&year=${previous.getUTCFullYear()}`} 
          aria-label="Mese precedente"
        >
          <ChevronLeft className="size-5 text-paradise-noir/70" />
        </Link>
        
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-extrabold tracking-[0.18em] text-[#B85B68] uppercase">Calendario turni</span>
          <p className="text-base font-extrabold text-paradise-noir tracking-wide sm:text-lg">
            {monthNames[month]} {year}
          </p>
        </div>
        
        <Link 
          className="grid size-11 place-items-center rounded-2xl border border-black/5 bg-white shadow-sm transition-all duration-200 hover:bg-paradise-nude hover:scale-105 active:scale-95 hover:border-black/10" 
          href={`/my-shifts?month=${next.getUTCMonth() + 1}&year=${next.getUTCFullYear()}`} 
          aria-label="Mese successivo"
        >
          <ChevronRight className="size-5 text-paradise-noir/70" />
        </Link>
      </div>

      {/* Mobile Layout (lg:hidden) */}
      <div className="space-y-5 lg:hidden">
        {workedHoursCard}
        {metricsContainer}
        {currentlyAtWorkWidget}
        {weeklyCalendarStrip}
        {dettaglioDelMeseCard}
      </div>

      {/* Desktop Layout */}
      <div className="hidden space-y-5 lg:block">
        <div className="grid grid-cols-3 items-start gap-5">
          {/* Left Column (span 2) */}
          <div className="min-w-0 lg:col-span-2 space-y-5">
            {workedHoursCard}
            {weeklyCalendarStrip}
          </div>
          {/* Right Column (span 1) */}
          <div className="min-w-0 space-y-5">
            {metricsContainer}
            {currentlyAtWorkWidget}
          </div>
        </div>

        {dettaglioDelMeseCard}
      </div>
      </div>
    </AppShell>
  );
}

function Summary({ icon: Icon, label, value, accent = false }: { icon: typeof CalendarDays; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={cn(
      "relative overflow-hidden p-5 border border-white/50 backdrop-blur-md transition-all duration-300",
      accent 
        ? "bg-gradient-to-br from-white via-white to-paradise-softPink/30 border-paradise-pink/35 shadow-soft hover:shadow-luxury hover:border-paradise-pink/60" 
        : "bg-white/80 hover:border-paradise-pink/20 hover:shadow-soft"
    )}>
      <div className={cn(
        "absolute -right-6 -bottom-6 size-24 rounded-full blur-2xl opacity-15 transition-all duration-500",
        accent ? "bg-paradise-pink" : "bg-paradise-gold"
      )} />
      
      <div className="flex items-center justify-between">
        <div className={cn(
          "flex size-11 items-center justify-center rounded-2xl transition-all duration-300",
          accent ? "bg-paradise-pink/20 text-[#B85B68]" : "bg-paradise-gold/20 text-[#9E7A3B]"
        )}>
          <Icon className="size-5.5" />
        </div>
        {accent && (
          <span className="flex items-center gap-1 rounded-full bg-paradise-pink/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#B85B68] shadow-sm">
            Attivo
          </span>
        )}
      </div>
      
      <div className="relative z-10 mt-4">
        <p className="text-[10px] font-bold tracking-wider text-black/40 uppercase">{label}</p>
        <p className="mt-1 flex items-baseline gap-1 text-2xl font-extrabold tracking-tight text-paradise-noir">
          {value}
          <span className="text-xs font-semibold text-black/35">
            {label.toLowerCase().includes("ore") || label.toLowerCase().includes("pause") ? "h" : ""}
          </span>
        </p>
      </div>
    </Card>
  );
}
