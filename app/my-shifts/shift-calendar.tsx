'use client';

import {useRef, useState} from 'react';
import type {MonthlyCalendarDay} from './client-components';
import './shift-calendar.css';

const hours=(n:number)=>`${n.toLocaleString('it-IT',{maximumFractionDigits:2})} h`;
export function ShiftCalendar({days,today,monthLabel}:{days:MonthlyCalendarDay[];today:string;monthLabel:string}) {
 const [selected,setSelected]=useState(days.find(d=>d.dateIso.slice(0,10)===today)?.dateIso||days[0]?.dateIso||'');
 const [view,setView]=useState<'calendar'|'list'>('calendar');
 const detailRef=useRef<HTMLElement>(null);
 const day=days.find(d=>d.dateIso===selected);
 const offset=days[0]?(new Date(days[0].dateIso).getUTCDay()+6)%7:0;
 const label=(d:MonthlyCalendarDay)=>/riposo|ferie|malattia|permesso|chius/i.test(d.shiftName)?d.shiftName:d.shiftTime==='Nessun orario'?d.shiftName:d.shiftTime;
 return <section className="shift-calendar-section">
  <header className="shift-calendar-heading"><div><h2>{monthLabel}</h2><p>Seleziona un giorno per vedere turno e timbrature.</p></div><div className="shift-view-switch" aria-label="Vista turni"><button aria-pressed={view==='calendar'} onClick={()=>setView('calendar')}>Calendario</button><button aria-pressed={view==='list'} onClick={()=>setView('list')}>Elenco</button></div></header>
  <div className="shift-calendar-layout"><div>
   <div className={`shift-days ${view}`}>
    {view==='calendar'&&<>{['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(w=><div className="shift-weekday" key={w}>{w}</div>)}{Array.from({length:offset},(_,i)=><div className="shift-empty" key={i}/>)}</>}
    {days.map(d=>{const isToday=d.dateIso.slice(0,10)===today;const rest=/riposo|ferie|malattia|permesso|chius/i.test(d.shiftName);return <button key={d.dateIso} className={`shift-day ${isToday?'today':''} ${rest?'rest':''}`} aria-pressed={selected===d.dateIso} aria-label={`${d.dayName} ${d.dayNum} ${d.monthName}, ${label(d)}${isToday?', oggi':''}`} onClick={()=>{setSelected(d.dateIso);if(window.matchMedia("(max-width:1100px)").matches)requestAnimationFrame(()=>{detailRef.current?.scrollIntoView({block:"start",behavior:"auto"});detailRef.current?.focus({preventScroll:true});});}}><span className="shift-day-date"><b>{d.dayNum}</b><span>{view==='list'?d.dayName:''}{isToday?' Oggi':''}</span></span><strong>{label(d)}</strong><small>{rest?'':d.shiftTime!=='Nessun orario'?d.shiftName:'Nessun turno assegnato'}</small>{d.firstEntry&&<span className="shift-clock-badge">✓ Timbrato</span>}</button>;})}
   </div>
   <p className="shift-calendar-legend"><span>● Oggi</span><span>● Riposo e assenze programmate</span><span>✓ Timbrature consultabili nel dettaglio</span></p>
  </div>
  <aside ref={detailRef} tabIndex={-1} className="shift-day-detail" aria-label="Dettaglio del giorno selezionato" aria-live="polite">{day?<>
   <span className="shift-eyebrow">Giorno selezionato</span><h3>{day.dayName} {day.dayNum} {day.monthName}</h3><div className="shift-detail-schedule"><strong>{label(day)}</strong><p>{day.shiftName}</p></div>
   <h4>Timbrature</h4><dl className="shift-clock-grid">{[['Entrata',day.firstEntry],['Inizio pausa',day.firstPause],['Fine pausa',day.lastReturn],['Uscita',day.lastExit]].map(([title,value])=><div key={title}><dt>{title}</dt><dd>{value||'—'}</dd></div>)}</dl>
   {!day.firstEntry&&<p className="shift-detail-help">{day.dateIso.slice(0,10)>today?'Le timbrature compariranno dopo il turno.':'Nessuna timbratura registrata per questo giorno.'}</p>}
   <dl className="shift-hours-detail"><div><dt>Ore previste</dt><dd>{hours(day.plannedHours)}</dd></div><div><dt>Ore conteggiate</dt><dd>{hours(day.workedHours)}</dd></div><div><dt>Pausa registrata</dt><dd>{hours(day.breakHours)}</dd></div><div><dt>Pausa pagata</dt><dd>{day.paidBreak?"Sì · non sottratta":"No"}</dd></div></dl>
   {day.note&&<div className="shift-detail-note"><h4>Nota</h4><p>{day.note}</p></div>}
   <p className="shift-detail-help">Le ore conteggiate seguono le regole di timbratura e le eventuali correzioni approvate.</p>
  </>:<p>Nessun giorno disponibile.</p>}</aside></div>
 </section>;
}
