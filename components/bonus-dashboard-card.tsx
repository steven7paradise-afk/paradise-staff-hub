'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MonthlyBonusData } from './monthly-bonus-client';
export function BonusDashboardCard(){
 const [data,setData]=useState<MonthlyBonusData|null>(null),[error,setError]=useState(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{const abort=new AbortController();fetch('/api/monthly-bonus',{cache:'no-store',signal:abort.signal}).then(async r=>{if(!r.ok)throw new Error('load');setData(await r.json());setError(false)}).catch(e=>{if(e.name!=='AbortError')setError(true)});return()=>abort.abort()},[refresh]);
 const own=data?.people.find(p=>p.id===data.actor.id),configured=data?.people.filter(p=>p.config)??[];
 const pts=data?.admin?configured.reduce((n,p)=>n+(p.balance?.points??0),0):own?.balance?.points;
 const fmt=(v:number)=>v.toLocaleString('it-IT');
 return <section aria-label="Centro Punti" className="my-5 rounded-3xl border border-pink-200 bg-white p-5 text-neutral-900 shadow-sm sm:p-6">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-pink-600">Centro Punti</p><h2 className="mt-1 text-xl font-bold">{data?.admin?'Punti dello staff':'Il tuo conto del mese'}</h2></div><Link href={data?.admin?'/points?section=settings':'/points'} className="rounded-xl bg-pink-600 px-4 py-3 text-sm font-bold text-white">{data?.admin?'Gestisci regole e quote':'Apri il mio conto'}</Link></div>
  {error?<p className="mt-4 text-sm" role="status">Conto momentaneamente non disponibile. <button onClick={()=>setRefresh(r=>r+1)} className="underline">Riprova</button></p>:!data?<p className="mt-4 text-sm text-neutral-500">Caricamento punti…</p>:<>
   <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-pink-50 p-4"><p className="text-xs text-neutral-500">{data.admin?'Totale conti configurati':'Saldo disponibile'}</p><strong className="mt-2 block text-3xl">{pts===undefined?'Da configurare':`${fmt(pts)} pt`}</strong>{data.admin&&<p className="mt-1 text-xs">{configured.length} persone configurate</p>}{data.showValue&&!data.admin&&own?.balance?.euros!==undefined&&<p className="mt-1">{own.balance.euros.toLocaleString('it-IT',{style:'currency',currency:'EUR'})}</p>}</div>
   <div className="rounded-2xl bg-neutral-50 p-4"><p className="text-xs text-neutral-500">Appuntamenti oltre quota</p><strong className="mt-2 block text-2xl">+{fmt(data.rules.extraAppointmentPoints)} pt ciascuno</strong><p className="mt-2 text-xs">{data.admin?'La quota mensile la imposti per persona in Gestione punti.':own?.config?.level==='JUNIOR'?'Bonus riservato a Master e Autonome.':`La tua quota: ${own?.config?.quota??'da impostare'}.`}</p></div>
   <div className="rounded-2xl bg-neutral-50 p-4"><p className="text-xs text-neutral-500">Lavoro fuori turno</p><strong className="mt-2 block text-2xl">{data.rules.offShiftDayPoints>0?`+${fmt(data.rules.offShiftDayPoints)} pt / giorno`:'Da attivare'}</strong><p className="mt-2 text-xs">Se il giorno è segnato Riposo, il sistema verifica entrata e uscita. Una sola volta al giorno.</p></div></div>
   <div className="mt-4 flex flex-wrap gap-3 text-xs"><span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-800">Ritardi ingresso: primi {data.rules.entryGrace} senza penalità, poi −{fmt(data.rules.entryPenalty)} pt ciascuno</span><span className="rounded-full bg-pink-50 px-3 py-2">Rilavorazioni: prime {data.rules.reworkFree} gratuite, poi −{fmt(data.rules.reworkPenalty)} per blocco iniziato di {data.rules.reworkBlock} (dalla {data.rules.reworkFree+1}ª)</span>{data.admin&&<span className="rounded-full bg-neutral-100 px-3 py-2">Euro allo staff: {data.valueVisible?'visibili':'nascosti'}</span>}</div>
   <Link className="mt-4 inline-block text-sm font-bold text-pink-700 underline" href="/points?section=rules">Vedi tutte le regole con esempi</Link>
  </>}
 </section>
}
