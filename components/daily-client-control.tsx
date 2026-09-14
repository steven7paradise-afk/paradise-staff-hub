"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Camera, Check, ChevronLeft, ChevronRight, CircleAlert, ClipboardCheck, FileText, Search, UsersRound } from "lucide-react";

export type DailyClientControlItem = {
  id: string;
  customerName: string;
  serviceTitle: string;
  startDate: string;
  endDate: string | null;
  salon: "duomo" | "buenos-aires" | "altro";
  control: {
    exists: boolean;
    isDraft: boolean;
    noteDone: boolean;
    beforeMediaDone: boolean;
    afterMediaDone: boolean;
    staffNames: string[];
    noteText: string;
  } | null;
};

function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDay(day: string) {
  return new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${day}T12:00:00`));
}

function moveDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function missingItems(control: DailyClientControlItem["control"]) {
  if (!control?.exists) return ["Scheda controllo", "Collaboratrice", "Nota", "Foto prima", "Foto dopo"];
  return [
    control.staffNames.length ? "" : "Collaboratrice",
    control.noteDone ? "" : "Nota",
    control.beforeMediaDone ? "" : "Foto prima",
    control.afterMediaDone ? "" : "Foto dopo",
    control.isDraft ? "Confermare scheda" : "",
  ].filter(Boolean);
}

function CheckBadge({ done, label, photo = false }: { done: boolean; label: string; photo?: boolean }) {
  const Icon = photo ? Camera : FileText;
  return (
    <span data-done={done ? "true" : "false"} className={`daily-control-check inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-wide ${done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
      {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
      {label}
    </span>
  );
}

export function DailyClientControl({ day, salon, items }: { day: string; salon: string; items: DailyClientControlItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase("it");
  const filteredItems = useMemo(() => items.filter((item) => !normalizedSearch || `${item.customerName} ${item.serviceTitle} ${item.control?.staffNames.join(" ") || ""}`.toLocaleLowerCase("it").includes(normalizedSearch)), [items, normalizedSearch]);
  const completed = items.filter((item) => missingItems(item.control).length === 0).length;
  const incomplete = items.length - completed;

  function navigate(nextDay = day, nextSalon = salon) {
    router.push(`/client-control/giornata?day=${encodeURIComponent(nextDay)}&salone=${encodeURIComponent(nextSalon)}`);
  }

  return (
    <main className="daily-client-control mx-auto min-h-[calc(100vh-120px)] max-w-[1500px] space-y-4 p-2 sm:p-5 lg:p-7">
      <section className="daily-control-header overflow-hidden rounded-[26px] border border-[#E8DCE2] bg-white shadow-[0_18px_50px_rgba(70,35,50,0.08)]">
        <div className="daily-control-heading flex flex-wrap items-start justify-between gap-4 bg-[linear-gradient(135deg,#FFF4F9,#FFFCF8)] px-5 py-6 sm:px-8">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#FCE5F1] text-[#B83D7F]"><ClipboardCheck className="size-6" /></span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#A93469]">Controllo operativo giornaliero</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-[#211A1E] sm:text-3xl">Clienti della giornata</h1>
              <p className="mt-1 text-xs font-semibold capitalize text-black/45">{formatDay(day)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700">{completed} complete</span>
            <span className={`rounded-full border px-3 py-2 text-[10px] font-black ${incomplete ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{incomplete} da completare</span>
          </div>
        </div>

        <div className="daily-control-toolbar grid gap-2 border-t border-[#EEE2E8] bg-[#FBF7F9] p-3 sm:grid-cols-[auto_minmax(180px,230px)_minmax(180px,240px)_1fr_auto] sm:items-center sm:p-4">
          <button type="button" onClick={() => navigate(moveDay(day, -1))} className="daily-control-field hidden size-11 place-items-center rounded-xl border border-[#E5D7DE] bg-white text-[#7B5367] sm:grid" aria-label="Giorno precedente"><ChevronLeft className="size-5" /></button>
          <label className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A93469]" />
            <input type="date" value={day} onChange={(event) => navigate(event.target.value)} className="daily-control-field h-11 w-full rounded-xl border border-[#E5D7DE] bg-white pl-10 pr-3 text-xs font-black text-[#33252C] outline-none focus:border-[#D86B9B] focus:ring-4 focus:ring-[#F7D9E7]" />
          </label>
          <select value={salon} onChange={(event) => navigate(day, event.target.value)} className="daily-control-field h-11 rounded-xl border border-[#E5D7DE] bg-white px-3 text-xs font-black text-[#33252C] outline-none focus:border-[#D86B9B]">
            <option value="tutti">Tutti i saloni</option>
            <option value="duomo">Duomo</option>
            <option value="buenos-aires">Buenos Aires</option>
          </select>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A93469]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca cliente o collaboratrice" className="daily-control-field h-11 w-full rounded-xl border border-[#E5D7DE] bg-white pl-10 pr-3 text-xs font-bold text-[#33252C] outline-none focus:border-[#D86B9B] focus:ring-4 focus:ring-[#F7D9E7]" />
          </label>
          <button type="button" onClick={() => navigate(moveDay(day, 1))} className="daily-control-field hidden size-11 place-items-center rounded-xl border border-[#E5D7DE] bg-white text-[#7B5367] sm:grid" aria-label="Giorno successivo"><ChevronRight className="size-5" /></button>
        </div>
      </section>

      {filteredItems.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Controlli clienti della giornata">
          {filteredItems.map((item) => {
            const missing = missingItems(item.control);
            const isComplete = missing.length === 0;
            const staffNames = item.control?.staffNames || [];
            return (
              <article data-control-state={isComplete ? "complete" : item.control?.isDraft ? "draft" : "incomplete"} key={item.id} className={`daily-control-card flex flex-col rounded-[22px] border p-4 shadow-sm ${isComplete ? "border-emerald-200 bg-[linear-gradient(145deg,#FFFFFF,#F5FFF8)]" : "border-amber-200 bg-[linear-gradient(145deg,#FFFFFF,#FFFBF1)]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h2 className="truncate text-lg font-black text-[#211A1E]">{item.customerName}</h2><p className="mt-1 text-[11px] font-bold text-[#6F5662]">{formatTime(item.startDate)}–{formatTime(item.endDate)} · {item.serviceTitle}</p></div>
                  <span className={`daily-control-status shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${isComplete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : item.control?.isDraft ? "border-sky-200 bg-sky-50 text-sky-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{isComplete ? "Completo" : item.control?.isDraft ? "Bozza" : item.control?.exists ? `Mancano ${missing.length}` : "Da compilare"}</span>
                </div>
                <div className="daily-control-staff mt-3 flex items-center gap-2 rounded-xl border border-black/[0.05] bg-white/80 px-3 py-2.5"><UsersRound className="size-4 shrink-0 text-[#B83D7F]" /><div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-wider text-black/35">Chi ha seguito la cliente</p><p className={`truncate text-xs font-black ${staffNames.length ? "text-[#30242A]" : "text-amber-700"}`}>{staffNames.join(", ") || "Collaboratrice non indicata"}</p></div></div>
                <div className="mt-3 flex flex-wrap gap-1.5"><CheckBadge done={Boolean(item.control?.noteDone)} label="Nota" /><CheckBadge done={Boolean(item.control?.beforeMediaDone)} label="Foto prima" photo /><CheckBadge done={Boolean(item.control?.afterMediaDone)} label="Foto dopo" photo /></div>
                {missing.length ? <div className="daily-control-result mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900"><CircleAlert className="mt-0.5 size-4 shrink-0" /><p className="text-[10px] font-bold leading-4"><strong>Da completare:</strong> {missing.join(" · ")}</p></div> : <div className="daily-control-result mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[10px] font-black text-emerald-800"><Check className="size-4" /> Tutto completato</div>}
                {item.control?.noteText ? <p className="mt-3 line-clamp-3 text-[10px] font-semibold leading-4 text-black/50">Nota: {item.control.noteText}</p> : null}
                <Link href={`/appointments?booking=${encodeURIComponent(item.id)}&from=${day}&to=${day}`} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#211A1E] px-4 text-xs font-black text-white transition hover:bg-[#A93469]">{isComplete ? "Apri controllo" : "Completa controllo"}</Link>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="daily-control-empty grid min-h-64 place-items-center rounded-[24px] border border-dashed border-[#DECBD4] bg-white p-8 text-center"><div><CalendarDays className="mx-auto size-8 text-[#CFA8BA]" /><h2 className="mt-3 text-lg font-black text-[#33252C]">Nessuna cliente trovata</h2><p className="mt-1 text-xs font-semibold text-black/45">Cambia giorno, salone oppure ricerca.</p></div></section>
      )}
    </main>
  );
}
