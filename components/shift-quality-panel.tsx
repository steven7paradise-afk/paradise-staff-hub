"use client";
import { useCallback, useEffect, useState } from "react";
import { QUALITY_CAUSES, type QualityCase } from "@/lib/shift-quality";
export type QualitySummary={total:number;pending:number};
export function ShiftQualityPanel({day,onSummary}:{day:string;onSummary:(s:QualitySummary|null)=>void}){
 const [data,setData]=useState<{cases:QualityCase[];staff:{id:string;name:string}[]}|null>(null);const [error,setError]=useState("");
 const load=useCallback(async()=>{try{const r=await fetch(`/api/shift-quality?day=${day}`,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);setError("");onSummary({total:d.cases.length,pending:d.cases.filter((c:QualityCase)=>!c.confirmed||!c.saved).length});}catch(e){setError(e instanceof Error?e.message:"Dati non disponibili");onSummary(null);}},[day,onSummary]);
 useEffect(()=>{void load();},[load]);
 return <section className="space-y-4 py-5" aria-label="Sistemazioni di oggi">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-[#392936]">Sistemazioni di oggi{data?` · ${data.cases.length}`:""}</h2><p className="mt-1 text-xs text-neutral-500">Automatiche da appuntamenti e servizi dichiarati nelle schede cliente · Buenos Aires</p></div><button type="button" onClick={()=>void load()} className="min-h-11 rounded-xl border border-[#d4a4b8] px-4 text-sm">Aggiorna</button></div>
  <p className="text-sm leading-relaxed text-neutral-600">Indica chi ha sistemato e la causa. Solo “Lavoro imputabile”, dopo conferma del servizio e verifica, incide sul bonus del lavoro precedente.</p>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {!data&&!error&&<p role="status">Caricamento sistemazioni…</p>}
  {data?.cases.length===0&&<p className="rounded-xl bg-[#f6f0f4] p-5 text-sm">Nessuna sistemazione fasce trovata oggi. Gli appuntamenti annullati sono esclusi.</p>}
  {data?.cases.map(item=><QualityCard key={item.rowId} item={item} staff={data.staff} day={day} onSaved={load}/>)}
  <a href="/tables" className="inline-block py-3 text-sm font-semibold text-[#963b62]">Apri tabella Sistemazione fasce →</a>
 </section>;
}
function QualityCard({item,staff,day,onSaved}:{item:QualityCase;staff:{id:string;name:string}[];day:string;onSaved:()=>Promise<void>}){
 const [performer,setPerformer]=useState(item.performer);const [cause,setCause]=useState(item.cause);const [note,setNote]=useState(item.note);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [saved,setSaved]=useState(false);
 // Keep an unsaved draft on refresh; use the original version to detect conflicts.
 const [version,setVersion]=useState(item.version);
 const dirty=performer!==item.performer||cause!==item.cause||note!==item.note;
 useEffect(()=>{if(!dirty){setPerformer(item.performer);setCause(item.cause);setNote(item.note);setVersion(item.version);}},[item.version]);
 async function save(){setBusy(true);setError("");setSaved(false);try{const r=await fetch("/api/shift-quality",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({day,rowId:item.rowId,version,performer,cause,note})});const d=await r.json();if(!r.ok)throw new Error(d.error);setSaved(true);await onSaved();}catch(e){setError(e instanceof Error?e.message:"Salvataggio non riuscito");}finally{setBusy(false);}}
 return <article className="rounded-2xl border-2 border-[#cb7497] bg-white p-4 sm:p-5">
  <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-base font-bold text-[#392936]">{item.client} <span className="font-normal text-neutral-500">· {item.time}{item.order?` · ordine ${item.order}`:""}</span></h3><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.confirmed?"bg-emerald-50 text-emerald-800":"bg-amber-50 text-amber-800"}`}>{item.confirmed?"Servizio confermato":"Da effettuare / confermare"}</span></div>
  <p className="mt-3 text-sm text-neutral-600">Lavoro precedente: <strong>{item.previous||"Da verificare"}</strong>{item.previousDate?` · ${item.previousDate.split("-").reverse().join("/")}`:""}</p>
  <label className="shift-quality-performer"><span className="shift-quality-performer-title">Ha sistemato</span><span className="shift-quality-performer-control"><select value={performer} disabled={busy} onChange={e=>setPerformer(e.target.value)} className="shift-quality-select mt-2 block min-h-11 w-full rounded-xl border border-[#cb7497] bg-white px-3 sm:max-w-sm"><option value="">Seleziona personale…</option>{performer&&!staff.some(p=>p.name===performer)&&<option>{performer}</option>}{staff.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}</select><span className="shift-quality-performer-arrow" aria-hidden="true">⌄</span></span></label>
  <fieldset className="mt-4"><legend className="mb-2 text-sm font-semibold text-[#654759]">Scegli la causa</legend><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{QUALITY_CAUSES.map(value=><button type="button" key={value} disabled={busy} aria-pressed={cause===value} onClick={()=>setCause(value)} className="shift-quality-cause"><span aria-hidden="true" className="shift-quality-cause-check">{cause===value?"✓":""}</span>{value}</button>)}</div></fieldset>
  {cause && <p className="mt-3 rounded-xl bg-[#faeaf2] p-3 text-sm font-semibold text-[#71304f]">{cause === "Lavoro imputabile" ? "Alla verifica: Controllato, con responsabilità del lavoro precedente." : "Al salvataggio: App. precedente diventa Staff Paradise. Nessuna responsabilità sul lavoratore."}</p>}
  <label className="mt-4 block text-sm font-semibold text-[#654759]">Nota<textarea rows={3} maxLength={5000} value={note} disabled={busy} onChange={e=>setNote(e.target.value)} placeholder="Descrivi il problema riscontrato…" className="mt-2 block w-full rounded-xl border border-[#eadfe5] bg-[#fcf4f8] p-3 text-sm font-normal"/></label>
  {!item.confirmed&&<p className="mt-3 text-xs text-amber-800">Puoi preparare la scheda. L’impatto sul bonus richiede il servizio confermato e una successiva verifica.</p>}
  {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error} <button type="button" onClick={()=>{setPerformer(item.performer);setCause(item.cause);setNote(item.note);setVersion(item.version);setError("");}} className="underline">Ripristina i dati caricati</button></p>}
  <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={busy||!performer||!cause} onClick={()=>void save()} className="min-h-11 rounded-xl bg-[#963b62] px-5 text-sm font-bold text-white disabled:opacity-40">{busy?"Salvataggio…":item.confirmed?"Salva e verifica":"Salva scheda"}</button>{saved&&<span role="status" className="text-sm text-emerald-800">Salvato anche in tabella</span>}</div>
 </article>;
}
