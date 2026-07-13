"use client";

import React, { useState, useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Phone, ShoppingCart, User, Info, Search, Calendar, List } from "lucide-react";

type OnlineConsultationsBrowserProps = {
  initialEvents: Array<{
    uid: string;
    summary: string;
    description: string;
    startDate: string;
    endDate: string;
  }>;
  serviceAccountEmail?: string;
};

export function OnlineConsultationsBrowser({
  initialEvents,
  serviceAccountEmail
}: OnlineConsultationsBrowserProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "list">("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Parse details from calendar description
  const parsedEvents = useMemo(() => {
    return initialEvents.map((evt) => {
      const desc = evt.description || "";
      
      const phoneMatch = desc.match(/Telefono:\s*(.+)/i);
      const orderMatch = desc.match(/Ordine Shopify:\s*(.+)/i);
      const clientMatch = desc.match(/Cliente:\s*(.+)/i);
      const serviceMatch = desc.match(/Servizio:\s*(.+)/i);

      // Clean the summary
      let cleanedSummary = evt.summary.replace(/^Consulenza Online - /i, "").trim();

      return {
        ...evt,
        customerName: clientMatch ? clientMatch[1].trim() : (cleanedSummary || "Cliente"),
        customerPhone: phoneMatch ? phoneMatch[1].trim() : null,
        orderNumber: orderMatch ? orderMatch[1].trim() : null,
        serviceTitle: serviceMatch ? serviceMatch[1].trim() : "Consulenza Online",
        start: new Date(evt.startDate),
        end: new Date(evt.endDate),
      };
    });
  }, [initialEvents]);

  // Search filter
  const filteredEvents = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return parsedEvents;
    return parsedEvents.filter((evt) => 
      evt.customerName.toLowerCase().includes(query) ||
      (evt.customerPhone && evt.customerPhone.includes(query)) ||
      (evt.orderNumber && evt.orderNumber.toLowerCase().includes(query)) ||
      evt.summary.toLowerCase().includes(query)
    );
  }, [parsedEvents, searchQuery]);

  const selectedEvent = useMemo(() => {
    return parsedEvents.find((e) => e.uid === selectedEventId) || null;
  }, [parsedEvents, selectedEventId]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  const firstDayIndex = useMemo(() => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust Monday to index 0
  }, [year, month]);

  const calendarGrid = useMemo(() => {
    const cells: Array<{ date: Date | null; isCurrentMonth: boolean; events: typeof parsedEvents }> = [];
    
    // Previous month padding
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ date: null, isCurrentMonth: false, events: [] });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      
      const dayEvents = filteredEvents.filter((evt) => {
        const d = evt.start;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return key === dateKey;
      });

      cells.push({
        date,
        isCurrentMonth: true,
        events: dayEvents,
      });
    }

    return cells;
  }, [year, month, daysInMonth, firstDayIndex, filteredEvents]);

  const listEventsGrouped = useMemo(() => {
    const sorted = [...filteredEvents].sort((a, b) => a.start.getTime() - b.start.getTime());
    
    const groups: { [key: string]: typeof parsedEvents } = {};
    for (const evt of sorted) {
      const dateStr = evt.start.toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(evt);
    }
    return Object.entries(groups);
  }, [filteredEvents]);

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const setToday = () => {
    setCurrentDate(new Date());
  };

  const monthLabel = currentDate.toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });

  const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  return (
    <div className="space-y-6">


      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Calendar Box */}
        <div className="rounded-[24px] bg-white p-5 shadow-sm space-y-4 border border-black/[0.02]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-black/5 pb-4">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="p-2 hover:bg-black/5 rounded-xl border border-black/5 transition">
                <ChevronLeft className="size-4" />
              </button>
              <h2 className="text-lg font-bold capitalize min-w-[140px] text-center text-black">{monthLabel}</h2>
              <button onClick={nextMonth} className="p-2 hover:bg-black/5 rounded-xl border border-black/5 transition">
                <ChevronRight className="size-4" />
              </button>
              <button onClick={setToday} className="px-3 py-1.5 hover:bg-black/5 rounded-xl border border-black/5 text-xs font-bold transition">
                Oggi
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-black/30" />
                <input
                  type="text"
                  placeholder="Cerca cliente o ordine..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-black/5 rounded-xl text-xs w-full sm:w-[200px] focus:outline-none focus:border-black/20"
                />
              </div>

              <div className="flex bg-black/5 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode("month")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    viewMode === "month" ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black/80"
                  }`}
                >
                  <Calendar className="size-3.5" />
                  Mese
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    viewMode === "list" ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black/80"
                  }`}
                >
                  <List className="size-3.5" />
                  Lista
                </button>
              </div>
            </div>
          </div>

          {viewMode === "month" ? (
            <div>
              <div className="grid grid-cols-7 text-center font-bold text-xs text-black/40 mb-2">
                {weekDays.map((day) => (
                  <div key={day} className="py-2">{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 border-t border-l border-black/5 rounded-2xl overflow-hidden bg-black/[0.01]">
                {calendarGrid.map((cell, idx) => {
                  const isToday = cell.date && cell.date.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={idx}
                      className={`min-h-[110px] p-2 border-r border-b border-black/5 transition relative ${
                        cell.isCurrentMonth ? "bg-white" : "bg-black/[0.02]"
                      }`}
                    >
                      {cell.date && (
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold size-6 flex items-center justify-center rounded-full ${
                              isToday ? "bg-[#A74758] text-white" : "text-black/60"
                            }`}
                          >
                            {cell.date.getDate()}
                          </span>
                          {cell.events.length > 0 && (
                            <span className="text-[9px] font-extrabold text-[#A74758] bg-[#A74758]/10 px-1.5 py-0.5 rounded-md">
                              {cell.events.length}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-2 space-y-1 overflow-hidden">
                        {cell.events.slice(0, 3).map((evt) => (
                          <button
                            key={evt.uid}
                            onClick={() => setSelectedEventId(evt.uid)}
                            className="w-full text-left truncate text-[10px] font-semibold bg-[#A74758]/5 hover:bg-[#A74758]/10 text-[#A74758] px-2 py-1 rounded border border-[#A74758]/10 block"
                          >
                            {evt.customerName}
                          </button>
                        ))}
                        {cell.events.length > 3 && (
                          <div className="text-[9px] font-bold text-black/35 text-center mt-1">
                            +{cell.events.length - 3} altri
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
              {listEventsGrouped.length === 0 ? (
                <div className="py-12 text-center text-sm text-black/45">
                  Nessuna consulenza programmata trovata.
                </div>
              ) : (
                listEventsGrouped.map(([dateLabel, evts]) => (
                  <div key={dateLabel} className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-black/40 border-b border-black/5 pb-1.5 capitalize">{dateLabel}</h3>
                    <div className="grid gap-2">
                      {evts.map((evt) => (
                        <div
                          key={evt.uid}
                          onClick={() => setSelectedEventId(evt.uid)}
                          className="flex items-center justify-between p-4 rounded-2xl border border-black/5 hover:border-black/10 hover:shadow-sm cursor-pointer transition bg-[#FBF7F9] hover:bg-white"
                        >
                          <div className="flex items-center gap-3">
                            <div className="grid size-10 place-items-center rounded-xl bg-[#A74758]/10 text-[#A74758]">
                              <CalendarDays className="size-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-black">{evt.customerName}</h4>
                              <p className="text-xs text-black/45 mt-0.5 flex items-center gap-1.5 font-semibold">
                                <Clock className="size-3.5 text-black/30" />
                                {evt.start.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} - {evt.end.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold bg-[#A74758]/10 text-[#A74758] px-2.5 py-1 rounded-xl">
                            {evt.orderNumber ? `Ordine ${evt.orderNumber}` : "Consulenza"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Details Panel */}
        <div className="rounded-[24px] bg-white p-5 shadow-sm border border-black/[0.02] flex flex-col justify-start h-fit">
          {selectedEvent ? (
            <div className="space-y-5">
              <div className="border-b border-black/5 pb-4">
                <span className="inline-block px-2.5 py-1 text-[9px] font-extrabold uppercase bg-[#A74758]/10 text-[#A74758] tracking-widest rounded-lg">
                  Scheda Consulenza
                </span>
                <h3 className="font-bold text-lg text-black mt-2 leading-snug">{selectedEvent.customerName}</h3>
                <p className="text-xs text-black/45 mt-1.5 flex items-center gap-1.5 font-semibold">
                  <Clock className="size-3.5 text-black/35" />
                  {selectedEvent.start.toLocaleDateString("it-IT")} · {selectedEvent.start.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} - {selectedEvent.end.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 place-items-center rounded-xl bg-black/[0.03] text-black/50 shrink-0">
                    <User className="size-4.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-black/35">Cliente</p>
                    <p className="text-sm font-bold text-black mt-0.5">{selectedEvent.customerName}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="grid size-9 place-items-center rounded-xl bg-black/[0.03] text-black/50 shrink-0">
                    <Phone className="size-4.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-black/35">Telefono</p>
                    <p className="text-sm font-bold text-black mt-0.5 select-all">
                      {selectedEvent.customerPhone || "Non indicato"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="grid size-9 place-items-center rounded-xl bg-black/[0.03] text-black/50 shrink-0">
                    <ShoppingCart className="size-4.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-black/35">Ordine Shopify</p>
                    <p className="text-sm font-bold text-black mt-0.5 select-all">
                      {selectedEvent.orderNumber || "Non indicato"}
                    </p>
                  </div>
                </div>
              </div>

              {selectedEvent.description && (
                <div className="pt-4 border-t border-black/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-black/35 mb-2">Note aggiuntive</p>
                  <pre className="text-xs bg-black/[0.02] p-3.5 rounded-2xl whitespace-pre-wrap font-sans text-black/70 leading-relaxed border border-black/[0.01] max-h-[180px] overflow-y-auto">
                    {selectedEvent.description.replace(/\[Cowlendar ID:[^\]]+\]/i, "").trim() || "Nessuna nota aggiuntiva."}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-black/45">
              <CalendarDays className="size-12 text-black/10 mb-3" />
              <p className="text-sm font-semibold">Nessun appuntamento selezionato</p>
              <p className="text-xs text-black/40 mt-1 max-w-[200px]">Seleziona un appuntamento per visualizzare i dettagli completi.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
