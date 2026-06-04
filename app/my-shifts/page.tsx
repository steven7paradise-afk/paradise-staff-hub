import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Coffee, Timer, Sparkles, Share2 } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { monthlyPersonalHours } from "@/lib/personal-hours";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

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
      {/* Premium month navigation widget */}
      <div className="mb-6 flex items-center justify-between rounded-[24px] border border-white/60 bg-gradient-to-r from-paradise-softPink/20 via-white/80 to-paradise-nude/30 p-3.5 backdrop-blur-xl shadow-soft">
        <Link 
          className="grid size-12 place-items-center rounded-2xl border border-black/5 bg-white shadow-sm transition-all duration-200 hover:bg-paradise-nude hover:scale-105 active:scale-95 hover:border-black/10" 
          href={`/my-shifts?month=${previous.getUTCMonth() + 1}&year=${previous.getUTCFullYear()}`} 
          aria-label="Mese precedente"
        >
          <ChevronLeft className="size-5 text-paradise-noir/70" />
        </Link>
        
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold tracking-wider text-[#B85B68] uppercase">Calendario Turni</span>
          <p className="text-lg font-bold text-paradise-noir tracking-wide">
            {monthNames[month]} {year}
          </p>
        </div>
        
        <Link 
          className="grid size-12 place-items-center rounded-2xl border border-black/5 bg-white shadow-sm transition-all duration-200 hover:bg-paradise-nude hover:scale-105 active:scale-95 hover:border-black/10" 
          href={`/my-shifts?month=${next.getUTCMonth() + 1}&year=${next.getUTCFullYear()}`} 
          aria-label="Mese successivo"
        >
          <ChevronRight className="size-5 text-paradise-noir/70" />
        </Link>
      </div>

      {/* Styled Summary Cards Grid */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Summary icon={CalendarDays} label="Ore previste" value={hours(planned)} />
        <Summary icon={Timer} label="Ore lavorate" value={hours(worked)} accent />
        <Summary icon={Coffee} label="Pause rilevate" value={hours(breaks)} />
        <Summary icon={Clock3} label="Giorni timbrati" value={String(recordedDays)} />
      </section>

      {/* Main detail card container */}
      <Card className="mt-6 overflow-hidden border border-white/50 bg-white/90 p-0 shadow-soft">
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

        {/* Mobile-Friendly Premium Cards List */}
        <div className="space-y-4 p-4 sm:hidden">
          {rows.map((row) => {
            const isWeekend = row.date.getDay() === 0 || row.date.getDay() === 6;
            const cat = row.schedule?.category;
            const matches = row.workedHours >= row.plannedHours && row.plannedHours > 0;
            
            return (
              <div 
                key={row.date.toISOString()} 
                className="relative overflow-hidden rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition-all active:scale-[0.98]"
              >
                {/* Side accent bar linked to category color */}
                {cat?.color && (
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1.5" 
                    style={{ backgroundColor: cat.color }} 
                  />
                )}
                
                <div className="flex items-center justify-between gap-2 pl-2">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "flex flex-col items-center justify-center size-11 rounded-xl font-bold border text-xs shadow-sm",
                      isWeekend
                        ? "bg-paradise-gold/15 border-paradise-gold/30 text-[#9E7A3B]"
                        : "bg-paradise-nude/40 border-black/5 text-paradise-noir"
                    )}>
                      <span className="text-[9px] uppercase font-bold text-black/40">
                        {new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(row.date).slice(0, 3)}
                      </span>
                      <span className="text-base font-extrabold leading-none">
                        {new Intl.DateTimeFormat("it-IT", { day: "2-digit" }).format(row.date)}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-black/45">
                        {new Intl.DateTimeFormat("it-IT", { month: "long" }).format(row.date)}
                      </p>
                      {cat ? (
                        <p className="text-sm font-extrabold text-paradise-noir mt-0.5">
                          {cat.name}
                        </p>
                      ) : (
                        <p className="text-xs font-semibold text-black/30 mt-0.5">
                          Non pianificato
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {cat && (
                    <Badge tone={cat.code === "RIPOSO" ? "gold" : "pink"}>
                      {cat.code}
                    </Badge>
                  )}
                </div>

                {cat && (
                  <div className="mt-3.5 flex items-center gap-1.5 text-xs text-black/50 pl-2">
                    <Clock3 className="size-3.5 text-black/40" />
                    <span>Orario previsto: <strong className="text-black font-semibold">{timeRange(row.schedule)}</strong></span>
                  </div>
                )}

                {/* Log entries details */}
                {row.firstEntry && (
                  <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-neutral-50 border border-neutral-100 p-2.5 text-xs pl-2">
                    <span className="font-bold text-black/40">Timbrato:</span>
                    <span className="inline-flex items-center rounded bg-emerald-500/10 px-1.5 py-0.5 font-bold text-emerald-700">
                      {row.firstEntry}
                    </span>
                    <span className="text-black/30">→</span>
                    {row.lastExit ? (
                      <span className="inline-flex items-center rounded bg-neutral-200/50 px-1.5 py-0.5 font-bold text-neutral-700">
                        {row.lastExit}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 font-bold text-amber-700 animate-pulse">
                        In corso
                      </span>
                    )}
                  </div>
                )}

                {/* Hours split metrics */}
                <div className="mt-3.5 grid grid-cols-2 gap-2 pl-2">
                  <div className="rounded-xl border border-black/5 bg-neutral-50/50 p-2 text-center">
                    <p className="text-[10px] font-bold text-black/40 uppercase">Ore Previste</p>
                    <p className="text-sm font-extrabold text-neutral-700 mt-0.5">
                      {row.plannedHours > 0 ? `${hours(row.plannedHours)} h` : "—"}
                    </p>
                  </div>
                  <div className={cn(
                    "rounded-xl border p-2 text-center",
                    row.workedHours > 0
                      ? (matches ? "bg-emerald-500/5 border-emerald-500/10" : "bg-paradise-nude/40 border-paradise-pink/20")
                      : "bg-neutral-50/50 border-black/5"
                  )}>
                    <p className="text-[10px] font-bold text-black/40 uppercase">Ore Lavorate</p>
                    <p className={cn(
                      "text-sm font-extrabold mt-0.5",
                      row.workedHours > 0
                        ? (matches ? "text-emerald-700" : "text-paradise-noir")
                        : "text-black/30"
                    )}>
                      {row.workedHours > 0 ? `${hours(row.workedHours)} h` : "—"}
                    </p>
                  </div>
                </div>
                
                {row.note && (
                  <p className="mt-2 text-[10px] text-amber-600 font-medium italic pl-2">
                    Nota: {row.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop-Friendly Premium Structured Table */}
        <div className="hidden overflow-x-auto sm:block">
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
                const matches = row.workedHours >= row.plannedHours && row.plannedHours > 0;

                return (
                  <tr key={row.date.toISOString()} className="border-t border-black/5 hover:bg-paradise-nude/20 transition-all duration-150">
                    <td className="whitespace-nowrap px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "flex flex-col items-center justify-center size-10 rounded-xl font-bold border text-xs shadow-sm",
                          isWeekend
                            ? "bg-paradise-gold/15 border-paradise-gold/30 text-[#9E7A3B]"
                            : "bg-paradise-nude/40 border-black/5 text-paradise-noir"
                        )}>
                          <span className="text-[9px] uppercase font-bold text-black/40 leading-none mb-0.5">
                            {new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(row.date).slice(0, 3)}
                          </span>
                          <span className="text-sm font-extrabold leading-tight">
                            {new Intl.DateTimeFormat("it-IT", { day: "2-digit" }).format(row.date)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      {cat ? (
                        <div className="flex items-center gap-2">
                          <span 
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold tracking-wide shadow-sm"
                            style={{ 
                              backgroundColor: cat.color ? cat.color + '15' : 'rgba(255, 168, 221, 0.15)',
                              color: cat.text_color || '#B85B68',
                              border: `1px solid ${cat.color ? cat.color + '30' : 'rgba(255, 168, 221, 0.3)'}`
                            }}
                          >
                            <span className="size-2 rounded-full" style={{ backgroundColor: cat.color || '#FFA8DD' }} />
                            {cat.name}
                          </span>
                          <span className="text-xs font-semibold text-black/40">
                            {timeRange(row.schedule)}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium bg-neutral-100 text-neutral-400 border border-neutral-200/50">
                          Nessun turno pianificato
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      {row.firstEntry ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-700 border border-emerald-500/20">
                            {row.firstEntry}
                          </span>
                          <span className="text-black/30">→</span>
                          {row.lastExit ? (
                            <span className="inline-flex items-center rounded-lg bg-neutral-100 px-2 py-1 text-xs font-bold text-neutral-600 border border-neutral-200">
                              {row.lastExit}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-extrabold text-amber-700 border border-amber-500/30 animate-pulse">
                              In corso
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-black/35">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right text-black/60 font-semibold">
                      {row.plannedHours > 0 ? `${hours(row.plannedHours)} h` : "—"}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className={cn(
                        "font-extrabold text-sm",
                        row.workedHours > 0 
                          ? (matches ? "text-emerald-600" : "text-paradise-noir") 
                          : "text-black/30"
                      )}>
                        {row.workedHours > 0 ? `${hours(row.workedHours)} h` : "—"}
                      </span>
                      {row.note && (
                        <p className="text-[10px] text-amber-600 font-medium italic mt-0.5 truncate max-w-[150px] ml-auto" title={row.note}>
                          {row.note}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
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

