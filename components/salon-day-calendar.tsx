"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";

type SalonCalendarEntry = {
  id: string;
  userId: string;
  userName: string;
  date: string;
  categoryName: string;
  categoryCode: string;
  color: string;
  textColor: string;
  startTime?: string | null;
  endTime?: string | null;
};

function monthDays(year: number, month: number) {
  return Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => index + 1);
}

function mondayOffset(year: number, month: number) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function displayTime(entry: SalonCalendarEntry) {
  if (!entry.startTime || !entry.endTime) return entry.categoryName;
  return `${entry.startTime} - ${entry.endTime}`;
}

export function SalonDayCalendar({ month, entries }: { month: string; entries: SalonCalendarEntry[] }) {
  const baseDate = useMemo(() => new Date(month), [month]);
  const year = baseDate.getFullYear();
  const monthIndex = baseDate.getMonth();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const monthKeys = monthDays(year, monthIndex).map((day) => dateKey(year, monthIndex, day));
  const [selectedKey, setSelectedKey] = useState(monthKeys.includes(todayKey) ? todayKey : monthKeys[0]);
  const byDay = useMemo(() => {
    const map = new Map<string, SalonCalendarEntry[]>();
    entries.forEach((entry) => {
      const key = entry.date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), entry]);
    });
    return map;
  }, [entries]);
  const selectedEntries = (byDay.get(selectedKey) ?? []).sort((a, b) => {
    const timeA = a.startTime ?? "99:99";
    const timeB = b.startTime ?? "99:99";
    return timeA.localeCompare(timeB) || a.userName.localeCompare(b.userName);
  });
  const selectedDate = new Date(`${selectedKey}T00:00:00`);

  return (
    <div className="mb-4 rounded-2xl border border-black/5 bg-white/70 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/35">Calendario salone</p>
          <p className="text-sm font-semibold">{new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(baseDate)}</p>
        </div>
        <Badge tone="gold">{selectedEntries.length} in turno</Badge>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-black/40">
        {["L", "M", "M", "G", "V", "S", "D"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: mondayOffset(year, monthIndex) }, (_, index) => <div key={`empty-${index}`} />)}
        {monthDays(year, monthIndex).map((day) => {
          const key = dateKey(year, monthIndex, day);
          const dayEntries = byDay.get(key) ?? [];
          const selected = selectedKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              className={`min-h-11 rounded-xl border px-1 py-1 text-center text-xs font-semibold transition active:scale-95 ${
                selected ? "border-[#C66170] bg-paradise-softPink text-paradise-noir" : "border-black/5 bg-white hover:border-black/15"
              }`}
            >
              <span>{day}</span>
              {dayEntries.length > 0 ? <span className="mx-auto mt-1 block size-1.5 rounded-full bg-[#C66170]" /> : null}
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold">
          {new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(selectedDate)}
        </p>
        <div className="space-y-2">
          {selectedEntries.length === 0 ? <p className="rounded-xl bg-paradise-nude p-3 text-sm text-black/50">Nessun turno programmato in questo giorno.</p> : null}
          {selectedEntries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white p-3">
              <div>
                <p className="text-sm font-semibold">{entry.userName}</p>
                <p className="text-xs text-black/50">{displayTime(entry)}</p>
              </div>
              <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: entry.color, color: entry.textColor }}>
                {entry.categoryCode}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
