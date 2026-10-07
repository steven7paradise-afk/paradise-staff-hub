'use client';
import {useCallback,useEffect,useState} from 'react';
import {cashComplete,emptyCashNotes,type CashNotes} from '@/lib/shift-cash';
type Report={notes:CashNotes;version:string|null;confirmedBy:string|null;confirmedAt:string|null};
export function ShiftCashPanel({day,onComplete}:{day:string;onComplete:(complete:boolean)=>void}){
 const [data,setData]=useState<Report|null>(null),[notes,setNotes]=useState<CashNotes>(emptyCashNotes),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const accept=useCallback((d:Report)=>{setData(d);setNotes(d.notes);setDirty(false);onComplete(cashComplete(d.notes));},[onComplete]);
 const load=useCallback(async()=>{try{const r=await fetch(`/api/shift-cash?day=${day}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);accept(d);setError('');}catch(e){setError(e instanceof Error?e.message:'Caricamento non riuscito');}},[day,accept]);
 useEffect(()=>{void load();},[load]);
 function edit(update:Partial<CashNotes>){setNotes(n=>({...n,...update}));setDirty(true);setMessage('');onComplete(false);}
 async function save(){setBusy(true);setError('');try{const r=await fetch('/api/shift-cash',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({day,notes,version:data?.version})});const d=await r.json();if(!r.ok)throw new Error(d.error);accept(d);setMessage('Cassa salvata');}catch(e){setError(e instanceof Error?e.message:'Salvataggio non riuscito');}finally{setBusy(false);}}
 return <section className="shift-team-panel space-y-5 rounded-2xl bg-white p-4 sm:p-6" aria-label="Controllo cassa">
 <header><p className="text-xs font-bold uppercase tracking-wider text-[#963b62]">Blocco 6 · Obbligatorio</p><h2 className="mt-2 text-xl font-bold">Cassa</h2><p className="mt-2 text-sm text-neutral-600">Solo due cose: se la cassa torna e la conferma che la chiusura è stata fatta.</p></header>
 {error&&<p role="alert" className="text-red-800">{error} <button type="button" className="team-button" onClick={()=>void load()}>Ricarica dati salvati</button></p>}
 {!data?<p>Caricamento cassa…</p>:<div className="space-y-5 rounded-2xl border-2 border-[#bb5e87] p-4 sm:p-5">
 <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Ci sono discrepanze di cassa?</h3><div className="flex gap-2">{[false,true].map(value=><button type="button" className="team-button" key={String(value)} disabled={busy} aria-pressed={notes.discrepancy===value} onClick={()=>edit({discrepancy:value})}>{value?'Sì':'No'}</button>)}</div></div>
 {notes.discrepancy&&<div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
 <label className="text-xs font-semibold">Importo (€)<input className="team-field mt-2" inputMode="decimal" disabled={busy} placeholder="20,00" value={notes.amount} onChange={e=>edit({amount:e.target.value})}/></label>
 <label className="text-xs font-semibold">Tipo<select className="team-field mt-2" disabled={busy} value={notes.kind} onChange={e=>edit({kind:e.target.value})}><option value="">Seleziona</option><option value="MISSING">Manca</option><option value="EXTRA">In più</option></select></label>
 <label className="text-xs font-semibold">Spiegazione (obbligatoria)<textarea className="team-field mt-2" disabled={busy} rows={2} maxLength={5000} placeholder="Descrivi la differenza riscontrata…" value={notes.explanation} onChange={e=>edit({explanation:e.target.value})}/></label>
 </div>}
 <div className="border-t border-[#eadfe5] pt-5"><label className="flex cursor-pointer items-center gap-3 font-semibold"><input type="checkbox" className="size-5 accent-[#654759]" disabled={busy} checked={notes.closed} onChange={e=>edit({closed:e.target.checked})}/>Dichiaro che la chiusura cassa è stata fatta<span className="rounded bg-[#fae3ed] px-2 py-1 text-[10px] font-bold uppercase text-[#963b62]">Obbligatorio</span></label><p className="mt-3 text-xs text-neutral-600">Senza questa spunta la scheda Cassa resta incompleta. Al salvataggio vengono registrati nome e ora della conferma.</p></div>
 {data.confirmedBy&&data.confirmedAt&&notes.closed&&<p className="text-sm text-emerald-800">Confermata da {data.confirmedBy} · {new Date(data.confirmedAt).toLocaleString('it-IT',{timeZone:'Europe/Rome'})}</p>}
 <button type="button" className="team-button" data-primary="true" disabled={busy||!dirty} onClick={()=>void save()}>{busy?'Salvataggio…':'Salva cassa'}</button>
 {message&&<p role="status" className="text-sm text-emerald-800">{message}</p>}
 </div>}
 </section>;
}
