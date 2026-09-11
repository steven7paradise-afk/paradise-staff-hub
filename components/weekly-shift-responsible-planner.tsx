"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";

type Candidate = {
  id: string;
  name: string;
  photoUrl: string | null;
  roleLabel: string;
  shifts: Record<string, string>;
};

type DayOption = {
  date: string;
  weekday: string;
  dayNumber: string;
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function WeeklyShiftResponsiblePlanner({
  days,
  candidates,
  initialAssignments,
  previousWeekHref,
  nextWeekHref,
  weekLabel,
  embedded = false,
}: {
  days: DayOption[];
  candidates: Candidate[];
  initialAssignments: Record<string, string>;
  previousWeekHref: string;
  nextWeekHref: string;
  weekLabel: string;
  embedded?: boolean;
}) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [assignments, setAssignments] = useState(initialAssignments);
  const [activeDay, setActiveDay] = useState(days.some((day) => day.date === today) ? today : days[0]?.date);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();
  const dayButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const selectedDay = days.find((day) => day.date === activeDay);

  useEffect(() => {
    if (activeDay) dayButtons.current[activeDay]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeDay]);

  function saveAssignments(nextAssignments: Record<string, string>) {
    setStatus("Salvataggio automatico…");
    startTransition(async () => {
      try {
        const response = await fetch("/api/shift-responsibles", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignments: Object.fromEntries(days.map((day) => [day.date, nextAssignments[day.date] || ""])),
          }),
        });
        if (!response.ok) throw new Error("Errore durante il salvataggio");
        setStatus("Programmazione aggiornata");
      } catch {
        setStatus("Salvataggio non riuscito. Riprova la selezione.");
      }
    });
  }

  const assignedDays = days.filter((day) => assignments[day.date]).length;

  return (
    <div className={embedded ? "w-full" : "w-full bg-[#f4f1fa] px-2 pb-10 pt-8 sm:px-5 xl:px-8 xl:pt-[9vh] 2xl:px-12"}>
      <div className="mx-auto w-full">
        <div className="w-full">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E0E4] px-4 py-4 sm:px-5">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#A33B68]">Settimana da organizzare</p>
              <p className="mt-1 text-sm font-black text-[#2B2227]">{weekLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`mr-1 rounded-full px-3 py-1.5 text-[9px] font-black ${assignedDays === days.length ? "bg-[#E9F8EE] text-[#267744]" : "bg-[#FFF3DF] text-[#94621E]"}`}>
                {assignedDays}/{days.length} assegnati
              </span>
              <Link href={previousWeekHref} aria-label="Settimana precedente" className="grid size-9 place-items-center rounded-xl border border-[#E2D9DE] bg-white text-[#65575E] shadow-sm transition hover:border-[#B9507B] hover:text-[#A33B68]">
              <ArrowLeft className="size-3.5" />
              </Link>
              <Link href={nextWeekHref} aria-label="Settimana successiva" className="grid size-9 place-items-center rounded-xl border border-[#E2D9DE] bg-white text-[#65575E] shadow-sm transition hover:border-[#B9507B] hover:text-[#A33B68]">
              <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          <section className="flex w-full snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain p-4 sm:p-5 xl:grid xl:grid-cols-7" aria-label="Programmazione della settimana">
            {days.map((day) => {
              const selected = candidates.find((candidate) => candidate.id === assignments[day.date]);
              const isActive = day.date === activeDay;
              return (
                <button
                  key={day.date}
                  ref={(node) => { dayButtons.current[day.date] = node; }}
                  type="button"
                  onClick={() => {
                    setActiveDay(day.date);
                    setPickerOpen((open) => day.date === activeDay ? !open : true);
                  }}
                  aria-pressed={isActive}
                  className={`group relative flex w-[132px] shrink-0 snap-center flex-col items-center rounded-[20px] border px-3 py-4 text-center transition xl:w-auto ${isActive ? "border-[#C54B7D] bg-[#FFF3F8] shadow-[0_8px_24px_rgba(164,58,103,0.12)]" : selected ? "border-[#E5DDE1] bg-white hover:border-[#CDB8C2] hover:shadow-md" : "border-[#E7C99C] bg-[#FFF9ED] hover:border-[#D5A861]"}`}
                >
                  <span className={`whitespace-nowrap text-[9px] font-black uppercase tracking-[0.12em] ${isActive ? "text-[#A33B68]" : "text-[#76656E]"}`}>
                    {day.weekday.slice(0, 3)}
                  </span>
                  <span className="mt-1 text-xl font-black leading-none text-[#2B2227]">{day.dayNumber}</span>
                  <span className={`mt-3 grid size-14 place-items-center overflow-hidden rounded-full border-[3px] bg-[#F0ECEE] text-xs font-black text-[#83757C] ${selected ? isActive ? "border-[#C54B7D]" : "border-[#69B77F]" : "border-[#DAB87F]"}`}>
                    {selected?.photoUrl ? (
                      <img src={resolveDrivePhotoUrl(selected.photoUrl)} alt={`Foto di ${selected.name}`} className="size-full object-cover" />
                    ) : selected ? initials(selected.name) : "—"}
                  </span>
                  <span className={`mt-2 line-clamp-2 min-h-8 w-full text-[10px] font-black leading-tight ${selected ? "text-[#2B2227]" : "text-[#9A6821]"}`}>
                    {selected?.name || "Da scegliere"}
                  </span>
                  <span className="mt-1 min-h-4 whitespace-nowrap text-[8px] font-bold text-[#85777E]">
                    {selected?.shifts[day.date] || "Tocca per assegnare"}
                  </span>
                  <span className={`mt-3 rounded-lg px-2.5 py-1 text-[8px] font-black ${isActive ? "bg-[#A33B68] text-white" : "bg-[#F3EEF1] text-[#71636A] opacity-0 transition group-hover:opacity-100"}`}>{selected ? "Modifica" : "Assegna"}</span>
                </button>
              );
            })}
          </section>
        </div>

        {status ? <p role="status" className={`border-t border-[#EEE5E9] px-5 py-3 text-[10px] font-bold ${status.startsWith("Salvataggio non") ? "bg-red-50 text-red-600" : "bg-[#F7FBF8] text-[#39724B]"}`}>{status}</p> : null}
      </div>

      {pickerOpen && selectedDay ? (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-6">
          <button
            type="button"
            className="responsible-sheet-backdrop absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={() => setPickerOpen(false)}
            aria-label="Chiudi selezione"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="responsible-picker-title"
            className="responsible-sheet relative z-10 max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-[30px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+110px)] pt-5 shadow-[0_-24px_70px_rgba(0,0,0,0.2)] sm:max-w-3xl sm:rounded-[30px] sm:p-7"
          >
            <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-black/10 sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#a45a7d]">{selectedDay.weekday} {selectedDay.dayNumber}</p>
                <h2 id="responsible-picker-title" className="mt-1 text-xl font-black tracking-[-0.025em] text-[#1d1d1f] sm:text-2xl">Scegli il responsabile</h2>
                <p className="mt-1 text-xs font-semibold text-black/45">Tocca una persona per assegnarla al turno.</p>
              </div>
              <button type="button" onClick={() => setPickerOpen(false)} aria-label="Chiudi" className="grid size-10 shrink-0 place-items-center rounded-full bg-black/5 text-black/55 transition hover:bg-black/10">
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {candidates.map((candidate) => {
                const selected = assignments[selectedDay.date] === candidate.id;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      const nextAssignments = { ...assignments, [selectedDay.date]: candidate.id };
                      setAssignments(nextAssignments);
                      setPickerOpen(false);
                      saveAssignments(nextAssignments);
                    }}
                    className={`relative flex min-h-40 flex-col items-center justify-center rounded-[22px] border p-3 text-center transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 ${selected ? "border-[#D94C88] bg-[#fff1f7] shadow-[0_10px_30px_rgba(217,76,136,0.14)]" : "border-black/8 bg-[#fafafa] hover:border-black/15 hover:bg-white"}`}
                  >
                    {selected ? <span className="absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full bg-[#D94C88] text-white"><Check className="size-3" /></span> : null}
                    <span className={`grid size-16 place-items-center overflow-hidden rounded-full border-[3px] bg-[#eeeeee] text-sm font-black text-black/45 sm:size-20 ${selected ? "border-[#D94C88]" : "border-[#b8b8b8]"}`}>
                      {candidate.photoUrl ? <img src={resolveDrivePhotoUrl(candidate.photoUrl)} alt={`Foto di ${candidate.name}`} className="size-full object-cover" /> : initials(candidate.name)}
                    </span>
                    <span className="mt-2 line-clamp-2 text-[9px] font-black uppercase leading-tight text-black/80 sm:text-[10px]">{candidate.name}</span>
                    <span className="mt-1 text-[8px] font-semibold text-black/40">{candidate.roleLabel}</span>
                    <span className="mt-1 text-[8px] font-bold text-black/55">{candidate.shifts[selectedDay.date] || "Turno non programmato"}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
