"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  LoaderCircle,
  MessageCircle,
  NotebookPen,
  Phone,
  Save,
  Search,
  ShoppingBag,
  UserRound,
  Video,
  X,
} from "lucide-react";

type ConsultationEvent = {
  uid: string;
  summary: string;
  description: string;
  startDate: string;
  endDate: string;
};

type ParsedEvent = ConsultationEvent & {
  customerName: string;
  customerPhone: string | null;
  orderNumber: string | null;
  serviceTitle: string;
  start: Date;
  end: Date;
};

type InternalNote = {
  note: string;
  updatedAt: string;
  updatedBy: string;
  orderNumber?: string | null;
};

type Props = {
  initialEvents: ConsultationEvent[];
  initialNotes?: Record<string, InternalNote>;
  serviceAccountEmail?: string;
};
const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function time(date: Date) {
  return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function fullDate(date: Date) {
  return date.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function cleanPhone(value?: string | null) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function cleanNotes(value: string) {
  return value
    .replace(/\[Cowlendar ID:[^\]]+\]/gi, "")
    .replace(/^\s*(Servizio|Cliente|Telefono|Ordine Shopify):.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function OnlineConsultationsBrowser({ initialEvents, initialNotes = {}, serviceAccountEmail }: Props) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"month" | "list">("month");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [internalNotes, setInternalNotes] = useState<Record<string, InternalNote>>(initialNotes);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteFeedback, setNoteFeedback] = useState<{ type: "success" | "warning" | "error"; message: string } | null>(null);

  const events = useMemo<ParsedEvent[]>(() => initialEvents.map((event) => {
    const description = event.description || "";
    const get = (label: string) => description.match(new RegExp(`^${label}:\\s*(.+)$`, "im"))?.[1]?.trim() || null;
    const summary = event.summary.replace(/^Consulenza Online\s*-\s*/i, "").trim();
    return {
      ...event,
      customerName: get("Cliente") || summary || "Cliente",
      customerPhone: get("Telefono"),
      orderNumber: get("Ordine Shopify"),
      serviceTitle: get("Servizio") || "Consulenza Online",
      start: new Date(event.startDate),
      end: new Date(event.endDate),
    };
  }).filter((event) => {
    const title = `${event.summary} ${event.serviceTitle}`.toLowerCase();
    const inSalonTerms = ["salone", "duomo", "buenos aires", "riapplicazione", "applicazione extension", "rimozione", "lavaggio", "piega"];
    return !Number.isNaN(event.start.getTime()) && !inSalonTerms.some((term) => title.includes(term));
  }).sort((a, b) => a.start.getTime() - b.start.getTime()), [initialEvents]);

  const filteredEvents = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return events;
    return events.filter((event) =>
      [event.customerName, event.customerPhone, event.orderNumber, event.summary, event.serviceTitle]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [events, query]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const now = new Date();
  const todayKey = dateKey(now);
  const monthEvents = useMemo(
    () => filteredEvents.filter((event) => event.start.getFullYear() === year && event.start.getMonth() === month),
    [filteredEvents, month, year],
  );
  const todayEvents = events.filter((event) => dateKey(event.start) === todayKey);
  const nextEvent = events.find((event) => event.end >= now) || events[0] || null;
  const selectedEvent = events.find((event) => event.uid === selectedId) || nextEvent;

  useEffect(() => {
    if (!selectedEvent) {
      setNoteDraft("");
      return;
    }
    setNoteDraft(internalNotes[selectedEvent.uid]?.note || "");
    setNoteFeedback(null);
  }, [selectedEvent?.uid]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const firstDayIndex = firstDay === 0 ? 6 : firstDay - 1;
  const cells = useMemo(() => {
    const result: Array<{ date: Date | null; events: ParsedEvent[] }> = [];
    for (let index = 0; index < firstDayIndex; index += 1) result.push({ date: null, events: [] });
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      result.push({ date, events: monthEvents.filter((event) => dateKey(event.start) === dateKey(date)) });
    }
    while (result.length % 7) result.push({ date: null, events: [] });
    return result;
  }, [daysInMonth, firstDayIndex, month, monthEvents, year]);

  const groups = useMemo(() => {
    const result = new Map<string, ParsedEvent[]>();
    monthEvents.forEach((event) => result.set(dateKey(event.start), [...(result.get(dateKey(event.start)) || []), event]));
    return [...result.entries()];
  }, [monthEvents]);

  const monthLabel = currentDate.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const selectedPhone = cleanPhone(selectedEvent?.customerPhone);
  const notes = selectedEvent ? cleanNotes(selectedEvent.description) : "";
  const savedInternalNote = selectedEvent ? internalNotes[selectedEvent.uid] : null;
  const noteChanged = Boolean(selectedEvent) && noteDraft.trim() !== (savedInternalNote?.note || "");

  async function saveInternalNote() {
    if (!selectedEvent || noteSaving) return;
    setNoteSaving(true);
    setNoteFeedback(null);

    try {
      const response = await fetch("/api/online-consultations/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentUid: selectedEvent.uid,
          orderNumber: selectedEvent.orderNumber || "",
          note: noteDraft,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Salvataggio non riuscito.");

      setInternalNotes((current) => {
        const next = { ...current };
        if (payload.note) next[selectedEvent.uid] = payload.note;
        else delete next[selectedEvent.uid];
        return next;
      });

      if (!noteDraft.trim()) {
        setNoteFeedback({ type: "success", message: "Nota interna rimossa." });
      } else if (payload.hasShopifyOrder && payload.shopifySynced) {
        setNoteFeedback({ type: "success", message: "Nota salvata internamente e aggiunta all’ordine Shopify." });
      } else if (payload.hasShopifyOrder) {
        setNoteFeedback({ type: "warning", message: "Nota salvata internamente. Shopify non è stato aggiornato: controlla il codice ordine." });
      } else {
        setNoteFeedback({ type: "success", message: "Nota salvata nel registro interno." });
      }
    } catch (error) {
      setNoteFeedback({ type: "error", message: error instanceof Error ? error.message : "Salvataggio non riuscito." });
    } finally {
      setNoteSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(125deg,rgba(255,255,255,.94),rgba(255,238,244,.88)_52%,rgba(238,231,248,.9))] shadow-[0_24px_70px_rgba(86,45,57,.10)]">
        <div className="grid gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-end lg:px-8 lg:py-7">
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#171319] text-white shadow-lg shadow-black/10 sm:size-14">
              <Video className="size-6" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A74758]">Agenda digitale</p>
              <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#171319] sm:text-3xl">Consulenze online</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-black/50">Appuntamenti, contatti e riferimenti ordine in un&apos;unica vista operativa.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Metric label="Oggi" value={String(todayEvents.length)} />
            <Metric label="Nel mese" value={String(monthEvents.length)} />
            <Metric label="Prossima" value={nextEvent ? time(nextEvent.start) : "—"} compact />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 overflow-hidden rounded-[28px] border border-black/[0.05] bg-white shadow-[0_18px_55px_rgba(75,42,54,.07)]">
          <div className="space-y-4 border-b border-black/[0.06] p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <NavButton label="Mese precedente" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}><ChevronLeft className="size-4" /></NavButton>
                <div className="min-w-[150px] px-2 text-center sm:min-w-[180px]">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-black/35">Calendario</p>
                  <h2 className="mt-0.5 text-lg font-black capitalize tracking-[-0.02em] text-[#171319]">{monthLabel}</h2>
                </div>
                <NavButton label="Mese successivo" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}><ChevronRight className="size-4" /></NavButton>
                <button type="button" onClick={() => setCurrentDate(new Date())} className="ml-1 hidden h-11 items-center rounded-2xl border border-black/[0.07] px-4 text-xs font-black text-black/65 transition hover:bg-black/[0.03] sm:flex">Oggi</button>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row lg:max-w-[530px] lg:justify-end">
                <label className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-black/30" />
                  <input type="search" placeholder="Cerca cliente, telefono o ordine" value={query} onChange={(event) => setQuery(event.target.value)} className="h-12 w-full rounded-2xl border border-black/[0.06] bg-[#FAF8F9] pl-11 pr-10 text-sm font-semibold text-[#171319] outline-none transition placeholder:text-black/30 focus:border-[#A74758]/35 focus:bg-white focus:ring-4 focus:ring-[#A74758]/5" />
                  {query && <button type="button" onClick={() => setQuery("")} aria-label="Cancella ricerca" className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-black/35 hover:bg-black/5 hover:text-black"><X className="size-3.5" /></button>}
                </label>
                <div className="flex h-12 shrink-0 rounded-2xl bg-black/[0.045] p-1">
                  <ViewButton active={viewMode === "month"} onClick={() => setViewMode("month")}><CalendarDays className="size-4" /> Mese</ViewButton>
                  <ViewButton active={viewMode === "list"} onClick={() => setViewMode("list")}><List className="size-4" /> Lista</ViewButton>
                </div>
              </div>
            </div>
            {query && <p className="text-xs font-semibold text-black/45">{monthEvents.length} {monthEvents.length === 1 ? "risultato" : "risultati"} in {monthLabel}</p>}
          </div>

          {viewMode === "month" ? (
            <div className="overflow-x-auto p-4 sm:p-5 lg:p-6">
              <div className="min-w-[820px]">
                <div className="mb-2 grid grid-cols-7 text-center">
                  {weekDays.map((day) => <div key={day} className="py-2 text-[10px] font-black uppercase tracking-[0.14em] text-black/35">{day}</div>)}
                </div>
                <div className="grid grid-cols-7 overflow-hidden rounded-[22px] border border-black/[0.07] bg-black/[0.035]">
                  {cells.map((cell, index) => (
                    <div key={`${cell.date?.toISOString() || "empty"}-${index}`} className={`min-h-[132px] border-b border-r border-black/[0.055] p-2.5 ${cell.date ? "bg-white" : "bg-[#F7F4F5]"}`}>
                      {cell.date && <div className="flex items-center justify-between">
                        <span className={`grid size-7 place-items-center rounded-full text-[11px] font-black ${dateKey(cell.date) === todayKey ? "bg-[#171319] text-white shadow-md" : "text-black/55"}`}>{cell.date.getDate()}</span>
                        {cell.events.length > 0 && <span className="rounded-full bg-[#A74758]/10 px-2 py-1 text-[9px] font-black text-[#A74758]">{cell.events.length}</span>}
                      </div>}
                      <div className="mt-2 space-y-1.5">
                        {cell.events.slice(0, 3).map((event) => <EventPill key={event.uid} event={event} active={selectedEvent?.uid === event.uid} onClick={() => setSelectedId(event.uid)} />)}
                        {cell.events.length > 3 && <button type="button" onClick={() => setViewMode("list")} className="w-full py-1 text-[9px] font-black text-black/35 hover:text-[#A74758]">+{cell.events.length - 3} altre</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-h-[720px] overflow-y-auto p-4 sm:p-5 lg:p-6">
              {groups.length === 0 ? <EmptyState searchActive={Boolean(query)} /> : <div className="space-y-7">
                {groups.map(([key, dayEvents]) => <div key={key}>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-2xl bg-[#171319] text-sm font-black text-white">{dayEvents[0].start.getDate()}</div>
                    <div><h3 className="text-sm font-black capitalize text-[#171319]">{fullDate(dayEvents[0].start)}</h3><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/35">{dayEvents.length} {dayEvents.length === 1 ? "consulenza" : "consulenze"}</p></div>
                  </div>
                  <div className="grid gap-2.5">{dayEvents.map((event) => <ListRow key={event.uid} event={event} active={selectedEvent?.uid === event.uid} onClick={() => setSelectedId(event.uid)} />)}</div>
                </div>)}
              </div>}
            </div>
          )}
        </div>

        <aside className="h-fit overflow-hidden rounded-[28px] border border-black/[0.05] bg-white shadow-[0_18px_55px_rgba(75,42,54,.07)] xl:sticky xl:top-5">
          {selectedEvent ? <>
            <div className="bg-[linear-gradient(145deg,#171319,#2A2027)] p-5 text-white sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div><span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/75"><Video className="size-3" /> Consulenza online</span><h2 className="mt-4 text-2xl font-black tracking-[-0.035em]">{selectedEvent.customerName}</h2><p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-white/55">{selectedEvent.serviceTitle}</p></div>
                <StatusBadge event={selectedEvent} now={now} />
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.07] p-4"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/40">Data e orario</p><p className="mt-1.5 text-sm font-extrabold capitalize">{fullDate(selectedEvent.start)}</p><p className="mt-1 text-lg font-black text-[#FFD8E1]">{time(selectedEvent.start)} <span className="text-white/25">—</span> {time(selectedEvent.end)}</p></div>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-2.5"><DetailRow icon={UserRound} label="Cliente" value={selectedEvent.customerName} /><DetailRow icon={Phone} label="Telefono" value={selectedEvent.customerPhone || "Non indicato"} /><DetailRow icon={ShoppingBag} label="Ordine Shopify" value={selectedEvent.orderNumber || "Non indicato"} /></div>
              {selectedPhone && <div className="grid grid-cols-2 gap-2.5"><a href={`tel:${selectedPhone}`} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#171319] text-xs font-black text-white hover:bg-black"><Phone className="size-4" /> Chiama</a><a href={`https://wa.me/${selectedPhone.replace(/^\+/, "")}`} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 text-xs font-black text-emerald-700 hover:bg-emerald-100"><MessageCircle className="size-4" /> WhatsApp</a></div>}
              {notes && <div className="border-t border-black/[0.06] pt-5"><p className="text-[9px] font-black uppercase tracking-[0.17em] text-black/35">Note appuntamento</p><p className="mt-2 whitespace-pre-wrap rounded-2xl bg-[#F8F5F6] p-4 text-xs font-medium leading-5 text-black/60">{notes}</p></div>}
              <div className="border-t border-black/[0.06] pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#A74758]/10 text-[#A74758]"><NotebookPen className="size-4" /></div>
                    <div><p className="text-[9px] font-black uppercase tracking-[0.17em] text-black/35">Note interne</p><p className="mt-1 text-[10px] leading-4 text-black/40">Visibili solo allo staff{selectedEvent.orderNumber ? "; saranno aggiunte anche all’ordine Shopify." : ". Nessun ordine Shopify collegato."}</p></div>
                  </div>
                  {savedInternalNote && <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-500" />}
                </div>
                <textarea
                  value={noteDraft}
                  onChange={(event) => { setNoteDraft(event.target.value); setNoteFeedback(null); }}
                  maxLength={4000}
                  rows={4}
                  placeholder="Scrivi una nota riservata allo staff…"
                  className="mt-3 w-full resize-y rounded-2xl border border-black/[0.07] bg-[#FAF8F9] px-4 py-3 text-sm font-medium leading-5 text-[#171319] outline-none transition placeholder:text-black/30 focus:border-[#A74758]/35 focus:bg-white focus:ring-4 focus:ring-[#A74758]/5"
                />
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {savedInternalNote && !noteFeedback && <p className="truncate text-[9px] font-semibold text-black/35">Ultima modifica: {savedInternalNote.updatedBy} · {new Date(savedInternalNote.updatedAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</p>}
                    {noteFeedback && <p className={`text-[10px] font-bold leading-4 ${noteFeedback.type === "error" ? "text-red-600" : noteFeedback.type === "warning" ? "text-amber-700" : "text-emerald-700"}`}>{noteFeedback.message}</p>}
                  </div>
                  <button type="button" onClick={saveInternalNote} disabled={!noteChanged || noteSaving} className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#171319] px-4 text-[11px] font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-35">
                    {noteSaving ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    {noteSaving ? "Salvataggio" : "Salva nota"}
                  </button>
                </div>
              </div>
              {serviceAccountEmail && <div className="flex items-start gap-2 border-t border-black/[0.06] pt-4 text-[10px] leading-4 text-black/35"><CalendarCheck2 className="mt-0.5 size-3.5 shrink-0" /> Agenda sincronizzata con il calendario aziendale.</div>}
            </div>
          </> : <EmptyDetails />}
        </aside>
      </div>
    </section>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return <div className="min-w-0 rounded-2xl border border-white/80 bg-white/65 px-3 py-3 backdrop-blur-xl sm:min-w-[112px] sm:px-4"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-black/35">{label}</p><p className={`mt-1 truncate font-black text-[#171319] ${compact ? "text-sm" : "text-xl"}`}>{value}</p></div>;
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} className="grid size-11 place-items-center rounded-2xl border border-black/[0.07] bg-white text-black/65 transition hover:border-black/15 hover:bg-black/[0.03]">{children}</button>;
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex min-w-[92px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition ${active ? "bg-white text-[#171319] shadow-sm" : "text-black/40 hover:text-black/70"}`}>{children}</button>;
}

function EventPill({ event, active, onClick }: { event: ParsedEvent; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`block w-full rounded-xl border px-2 py-1.5 text-left transition ${active ? "border-[#A74758]/30 bg-[#A74758] text-white shadow-sm" : "border-[#A74758]/10 bg-[#FFF6F8] text-[#7D3442] hover:border-[#A74758]/25 hover:bg-[#FDECF0]"}`}><span className={`block text-[8px] font-black ${active ? "text-white/65" : "text-[#A74758]/55"}`}>{time(event.start)}</span><span className="mt-0.5 block truncate text-[10px] font-extrabold">{event.customerName}</span></button>;
}

function ListRow({ event, active, onClick }: { event: ParsedEvent; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`group flex w-full items-center gap-4 rounded-[20px] border p-3.5 text-left transition sm:p-4 ${active ? "border-[#A74758]/25 bg-[#FFF2F5] shadow-sm" : "border-black/[0.055] bg-white hover:border-black/10 hover:bg-[#FCFAFB]"}`}><div className={`grid size-11 shrink-0 place-items-center rounded-2xl ${active ? "bg-[#A74758] text-white" : "bg-black/[0.04] text-black/45"}`}><Video className="size-4.5" /></div><div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><h4 className="truncate text-sm font-black text-[#171319]">{event.customerName}</h4><span className="shrink-0 text-xs font-black text-[#A74758]">{time(event.start)}–{time(event.end)}</span></div><p className="mt-1 truncate text-xs font-semibold text-black/40">{event.serviceTitle}</p></div><ChevronRight className="size-4 shrink-0 text-black/20 transition group-hover:translate-x-0.5 group-hover:text-[#A74758]" /></button>;
}

function StatusBadge({ event, now }: { event: ParsedEvent; now: Date }) {
  const isToday = dateKey(event.start) === dateKey(now);
  const past = event.end < now;
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.11em] ${isToday ? "bg-emerald-400/15 text-emerald-200" : past ? "bg-white/10 text-white/55" : "bg-[#F4B9C5]/15 text-[#FFDDE5]"}`}>{isToday ? "Oggi" : past ? "Conclusa" : "Programmata"}</span>;
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-black/[0.055] bg-[#FCFAFB] p-3.5"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#A74758] shadow-sm"><Icon className="size-4.5" /></div><div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-black/35">{label}</p><p className="mt-0.5 truncate text-sm font-extrabold text-[#171319] select-all">{value}</p></div></div>;
}

function EmptyState({ searchActive }: { searchActive: boolean }) {
  return <div className="grid min-h-[360px] place-items-center rounded-[22px] border border-dashed border-black/10 bg-[#FCFAFB] p-8 text-center"><div><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-black/25 shadow-sm"><Search className="size-5" /></div><h3 className="mt-4 text-base font-black text-[#171319]">{searchActive ? "Nessun risultato" : "Nessuna consulenza"}</h3><p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-black/40">{searchActive ? "Prova con un altro nome, telefono o numero d’ordine." : "Non risultano consulenze programmate per questo mese."}</p></div></div>;
}

function EmptyDetails() {
  return <div className="grid min-h-[420px] place-items-center p-8 text-center"><div><div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#A74758]/10 text-[#A74758]"><Clock3 className="size-7" strokeWidth={1.6} /></div><h3 className="mt-4 text-base font-black text-[#171319]">Nessuna consulenza selezionata</h3><p className="mx-auto mt-1.5 max-w-[240px] text-xs leading-5 text-black/40">Seleziona un appuntamento dal calendario per vedere contatti, ordine e note.</p></div></div>;
}
