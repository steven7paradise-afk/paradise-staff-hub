"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
type Entry = { id:string; name:string; entry:string|null; scheduled:string|null; delay:number|null; scheduleLabel:string|null; pauses:{start:string; end:string|null; minutes:number|null}[] };
const Context = createContext<{data:Entry[]|null; error:boolean}>({data:null,error:false});
export function ShiftAttendanceProvider({day, children}:{day:string;children:ReactNode}) {
  const [state,setState] = useState<{data:Entry[]|null; error:boolean}>({data:null,error:false});
  useEffect(() => {
    const controller = new AbortController();
    setState({data:null,error:false});
    fetch(`/api/shift-attendance-comparison?day=${encodeURIComponent(day)}`, {signal:controller.signal}).then(async response => {if(!response.ok) throw new Error(); return response.json() as Promise<Entry[]>;}).then(data => setState({data,error:false})).catch(() => {if(!controller.signal.aborted) setState({data:null,error:true});});
    return () => controller.abort();
  },[day]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function ShiftAttendanceComparison({name, mode, declared}:{name:string;mode:"attendance"|"pause";declared:string[]}) {
  const {data,error} = useContext(Context);
  const matches = data?.filter(person => person.name.trim().toLocaleLowerCase("it-IT") === name.trim().toLocaleLowerCase("it-IT"));
  const record = matches?.length === 1 ? matches[0] : null;
  const mismatch = record && mode === "attendance" && ((declared.some(text => /puntuale/i.test(text)) && (record.delay ?? 0)>0) || (declared.some(text => /ritardo/i.test(text)) && record.delay === 0) || (declared.some(text => /assente/i.test(text)) && Boolean(record.entry)));
  return <div className="border-t border-black/5 bg-slate-50 px-3 py-3 text-xs"><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Timbrature app</p>{error ? <p>Dati non disponibili. Riprova più tardi.</p> : !data ? <p>Caricamento timbrature…</p> : !record ? <p>Nessun dato univoco disponibile per questa giornata.</p> : mode === "pause" ? record.pauses.length ? <div className="space-y-1">{record.pauses.map((pause,i) => <p key={i}>{pause.start} → {pause.end || "Rientro non registrato"}{pause.minutes !== null ? <strong> · {pause.minutes} min</strong> : null}</p>)}<p className="mt-2 font-semibold">Totale pause concluse: {record.pauses.reduce((sum,pause) => sum+(pause.minutes ?? 0),0)} min</p></div> : <p>Nessuna pausa registrata.</p> : <div className="space-y-1"><p>Ingresso previsto: {record.scheduled || "Non disponibile"}</p><p>Ingresso registrato: {record.entry || "Nessuna timbratura"}</p>{record.delay !== null ? <p className={record.delay > 0 ? "font-bold text-red-600" : "text-emerald-700"}>{record.delay > 0 ? `Ritardo: ${record.delay} min` : "In orario · 0 min di ritardo"}</p> : <p className="text-neutral-500">Ritardo non determinabile.</p>}{mismatch ? <p className="mt-2 font-semibold text-amber-700">La dichiarazione differisce dalle timbrature: da verificare.</p> : null}</div>}</div>;
}
