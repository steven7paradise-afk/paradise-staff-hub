'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
type Review={id:string;rating:number;comment:string|null;reviewer_name:string;created_at:string;reply_text:string|null;staff_ids:string[];staff_names:string[];match_type:string|null};
export function GoogleReviews({reviews,staff,connected,locationSelected}:{reviews:Review[];staff:{id:string;name:string}[];connected:boolean;locationSelected:boolean}) {
 const router=useRouter();const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [locations,setLocations]=useState<{name:string;title:string;address:string}[]>([]);
 async function action(path:string,body?:object) {
  setBusy(true);setMessage('');
  try {const res=await fetch(`/api/google-business/${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const data=await res.json();if(!res.ok)throw new Error(data.error);return data;}
  catch(e){setMessage(e instanceof Error?e.message:'Operazione non riuscita.');return null;}
  finally{setBusy(false);}
 }
 const button='rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50';
 return <>
  <section className="mb-6 flex flex-wrap items-center gap-3 border-b pb-5">
   <form action="/api/google-business/connect" method="post"><button className={button} disabled={busy}>{connected?'Ricollega account Google':'Collega account Google'}</button></form>
   {connected&&<button className={button} disabled={busy} onClick={async()=>{const result=await action('locations');if(result)setLocations(result.locations);}}>Scegli scheda del salone</button>}
   {locationSelected&&<button className={button} disabled={busy} onClick={async()=>{const result=await action('sync',{});if(result){setMessage(result.skipped?'Sincronizzazione già in corso.':'Recensioni aggiornate.');router.refresh();}}}>{busy?'Attendi…':'Sincronizza ora'}</button>}
  </section>
  {message&&<p role="status" className="mb-5 rounded-lg border bg-rose-50 p-4 text-sm text-rose-900">{message}</p>}
  {!!locations.length&&<section className="mb-6 rounded-xl border p-5"><h2 className="mb-3 font-semibold">Seleziona Paradise, Corso Buenos Aires, Milano</h2>{locations.map(l=><button disabled={busy} key={l.name} className="mb-2 block w-full rounded-lg border p-3 text-left hover:bg-rose-50" onClick={async()=>{if(await action('locations',{name:l.name})){setLocations([]);router.refresh();}}}><strong>{l.title}</strong><span className="block text-sm text-slate-600">{l.address}</span></button>)}</section>}
  {!reviews.length?<p className="rounded-xl border bg-white p-8 text-slate-600">{locationSelected?'Nessuna recensione per questo periodo. Se hai appena collegato la scheda, premi “Sincronizza ora”.':'Collega l’account aziendale e seleziona la scheda del salone per importare le recensioni.'}</p>:<div className="divide-y rounded-xl border bg-white">{reviews.map(r=><article key={r.id} className="grid gap-5 p-5 md:grid-cols-[1fr_240px]">
   <div className="min-w-0"><div className="flex flex-wrap items-baseline gap-3"><strong>{r.reviewer_name}</strong><span aria-label={`${r.rating} stelle su 5`} className="text-amber-700">{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span><time className="text-sm text-slate-500">{new Date(r.created_at).toLocaleDateString('it-IT',{timeZone:'Europe/Rome'})}</time></div><p className="mt-3 max-w-prose whitespace-pre-wrap break-words leading-relaxed">{r.comment || 'Valutazione senza commento.'}</p>{r.reply_text&&<details className="mt-4 border-l-2 border-rose-200 pl-4 text-sm"><summary className="cursor-pointer font-semibold">Risposta del salone</summary><p className="mt-2 whitespace-pre-wrap break-words">{r.reply_text}</p></details>}</div>
   <ReviewAssignment key={`${r.id}:${r.staff_ids.join(',')}`} review={r} staff={staff} busy={busy} save={async staff_ids=>{if(await action('assign',{id:r.id,staff_ids})){setMessage('Assegnazione salvata.');router.refresh();}}}/>

  </article>)}</div>}
 </>;
}

function ReviewAssignment({review,staff,busy,save}:{review:Review;staff:{id:string;name:string}[];busy:boolean;save:(ids:string[])=>Promise<void>}) {
 const [selected,setSelected]=useState(review.staff_ids);
 return <fieldset className="min-w-0"><legend className="text-sm font-semibold">Collaboratori citati</legend>
  <details className="mt-2 rounded-lg border p-3"><summary className="cursor-pointer text-sm">{selected.length?`${selected.length} selezionati`:'Nessuno'}</summary>
   <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{staff.map(person=><label key={person.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(person.id)} disabled={busy} onChange={e=>setSelected(e.target.checked?[...selected,person.id]:selected.filter(id=>id!==person.id))}/>{person.name}</label>)}</div>
   <button type="button" disabled={busy} className="mt-3 text-sm underline" onClick={()=>setSelected([])}>Nessuno</button>
  </details>
  {!!review.staff_names.length&&<p className="mt-2 text-sm">{review.staff_names.join(', ')}</p>}
  <p className="mt-2 text-xs text-slate-500">{review.match_type==='testo'?'Riconosciuti dal testo':review.match_type==='manuale'?'Assegnazione manuale':'Da verificare'}</p>
  <button disabled={busy} className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" onClick={()=>void save(selected)}>Salva assegnazione</button>
 </fieldset>;
}
