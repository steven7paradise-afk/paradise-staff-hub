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

  return (
    <div className={embedded ? "w-full bg-transparent pb-2 pt-5" : "w-full bg-[#f4f1fa] px-2 pb-10 pt-8 sm:px-5 xl:px-8 xl:pt-[9vh] 2xl:px-12"}>
      <div className="mx-auto w-full">
        <div className="relative w-full pt-7 sm:pt-9 2xl:pt-12">
          <div className={`absolute left-1/2 top-0 z-10 flex h-9 -translate-x-1/2 items-center gap-1 rounded-t-xl px-2 sm:h-11 sm:min-w-48 sm:justify-center 2xl:h-14 2xl:min-w-60 ${embedded ? "bg-white text-[#303833]" : "bg-white"}`}>
            <Link href={previousWeekHref} aria-label="Settimana precedente" className="grid size-7 place-items-center rounded-full text-black/55 transition hover:bg-black/5 sm:size-8">
              <ArrowLeft className="size-3.5" />
            </Link>
            <span className="whitespace-nowrap px-1 text-[8px] font-bold uppercase tracking-[0.08em] text-black/75 sm:px-3 sm:text-[10px] 2xl:text-xs">{weekLabel}</span>
            <Link href={nextWeekHref} aria-label="Settimana successiva" className="grid size-7 place-items-center rounded-full text-black/55 transition hover:bg-black/5 sm:size-8">
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <section className={`flex w-full snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain px-2 pb-3 pt-3 sm:gap-2 sm:px-3 sm:pb-4 sm:pt-4 2xl:px-8 2xl:pb-6 2xl:pt-7 ${embedded ? "border-y border-black/[0.08] bg-white" : "bg-white"}`} aria-label="Programmazione della settimana">
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
                  className={`flex w-[88px] shrink-0 snap-center flex-col items-center rounded-2xl border px-1.5 py-2 text-center transition sm:w-[116px] sm:px-2 xl:min-w-0 xl:flex-1 ${isActive ? "border-[#2ed65d]/45 bg-[#f1fcf4]" : "border-transparent hover:bg-black/[0.025]"}`}
                >
                  <span className="whitespace-nowrap text-[6px] font-medium uppercase text-black/80 min-[390px]:text-[7px] sm:text-[10px] 2xl:text-xs">
                    {day.weekday.slice(0, 3)} {day.dayNumber}
                  </span>
                  <span className={`mt-1 grid size-10 place-items-center overflow-hidden rounded-full border-[2px] bg-[#eeeeee] text-[9px] font-black text-black/45 sm:size-16 sm:border-[3px] sm:text-sm 2xl:mt-2 2xl:size-24 2xl:text-lg ${selected ? "border-[#2ed65d]" : "border-[#b8b8b8]"}`}>
                    {selected?.photoUrl ? (
                      <img src={resolveDrivePhotoUrl(selected.photoUrl)} alt={`Foto di ${selected.name}`} className="size-full object-cover" />
                    ) : selected ? initials(selected.name) : "—"}
                  </span>
                  <span className="mt-1.5 line-clamp-2 min-h-3 w-full text-[5.5px] font-black uppercase leading-[1.05] text-black min-[390px]:text-[6px] sm:min-h-5 sm:text-[8px] 2xl:mt-2 2xl:min-h-6 2xl:text-[11px]">
                    {selected?.name || "Da scegliere"}
                  </span>
                  <span className="mt-0.5 whitespace-nowrap text-[5px] font-medium text-black/55 min-[390px]:text-[5.5px] sm:text-[7px] 2xl:text-[10px]">
                    {selected?.shifts[day.date] || "—"}
                  </span>
                  <span className={`mt-1 min-h-4 rounded-md px-1.5 py-0.5 text-[5.5px] font-bold sm:min-h-5 sm:px-2 sm:text-[7px] 2xl:mt-2 2xl:min-h-7 2xl:px-3 2xl:py-1 2xl:text-[9px] ${isActive ? "bg-[#ffd978] text-[#342b18]" : "invisible"}`}>Modifica</span>
                </button>
              );
            })}
          </section>
        </div>

        {status ? <p role="status" className={`mt-3 text-center text-[9px] font-bold ${status.startsWith("Salvataggio non") ? "text-red-500" : "text-black/45"}`}>{status}</p> : null}
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
                    className={`relative flex min-h-40 flex-col items-center justify-center rounded-[22px] border p-3 text-center transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 ${selected ? "border-[#14c800] bg-[#f3fff1] shadow-[0_10px_30px_rgba(20,200,0,0.1)]" : "border-black/8 bg-[#fafafa] hover:border-black/15 hover:bg-white"}`}
                  >
                    {selected ? <span className="absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full bg-[#14c800] text-white"><Check className="size-3" /></span> : null}
                    <span className={`grid size-16 place-items-center overflow-hidden rounded-full border-[3px] bg-[#eeeeee] text-sm font-black text-black/45 sm:size-20 ${selected ? "border-[#14c800]" : "border-[#b8b8b8]"}`}>
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
