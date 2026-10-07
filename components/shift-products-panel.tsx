'use client';
import {useCallback,useEffect,useId,useState} from 'react';
import {supplyAmounts,type SupplyNotes,type SupplyRow} from '@/lib/shift-products';
type Product={id:string;name:string;sku:string;available:number;salon:number};
type Report={products:Product[];notes:SupplyNotes;version:string|null;stockUpdatedAt:string};
export function ShiftProductsPanel({day,onComplete}:{day:string;onComplete:(v:boolean)=>void}){
 const listId=useId();const [data,setData]=useState<Report|null>(null);const [notes,setNotes]=useState<SupplyNotes>({needed:null,rows:[]});const [dirty,setDirty]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const accept=useCallback((d:Report)=>{setData(d);setNotes(d.notes);setDirty(false);onComplete(d.notes.needed!==null);},[onComplete]);
 const load=useCallback(async()=>{try{const r=await fetch(`/api/shift-products?day=${day}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);accept(d);setError('');}catch(e){setError(e instanceof Error?e.message:'Magazzino non disponibile');}},[day,accept]);
 useEffect(()=>{void load();},[load]);
 function edit(n:SupplyNotes){setNotes(n);setDirty(true);setMessage('');}
 function row(index:number,update:Partial<SupplyRow>){edit({...notes,rows:notes.rows.map((r,i)=>i===index?{...r,...update}:r)});}
 async function save(n=notes){setBusy(true);setError('');try{const r=await fetch('/api/shift-products',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({day,notes:n,version:data?.version})});const d=await r.json();if(!r.ok)throw new Error(d.error);accept(d);setMessage('Richiesta salvata nel verbale');}catch(e){setError(e instanceof Error?e.message:'Salvataggio non riuscito');}finally{setBusy(false);}}
 return <section className="shift-team-panel mt-5 space-y-4 rounded-2xl border-2 border-[#c786a3] bg-white p-4 sm:p-6" aria-label="Prodotti da ordinare">
 <header><h2 className="text-xl font-bold text-[#392936]">Prodotti da ordinare</h2><p className="mt-2 text-sm text-neutral-600">Scrivi cosa manca e quanti pezzi servono al salone. Scegli un suggerimento per vedere le disponibilità.</p></header>
 {error&&<p role="alert" className="text-sm text-red-800">{error} <button className="team-button" type="button" onClick={()=>void load()}>Ricarica dati salvati</button></p>}
 {!data?<p>Caricamento disponibilità…</p>:<>
 <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className="team-button" aria-pressed={notes.needed===false} onClick={()=>{const n={needed:false,rows:[]};edit(n);void save(n);}}>No, tutto ok</button><button type="button" disabled={busy} className="team-button" aria-pressed={notes.needed===true} onClick={()=>edit({needed:true,rows:notes.rows.length?notes.rows:[{productId:'',name:'',quantity:'',note:''}]})}>Sì, manca qualcosa</button></div>
 <datalist id={listId}>{data.products.map(p=><option key={p.id} value={`${p.name} · ${p.sku}`}/>)}</datalist>
 {notes.needed&&<>
 {notes.rows.map((r,index)=>{const product=data.products.find(p=>p.id===r.productId);const qty=Number(r.quantity);const validQty=/^\d+$/.test(r.quantity)&&qty>0;const amounts=product&&validQty?supplyAmounts(qty,product.available):null;return <article key={index} className="space-y-3 rounded-xl bg-[#faf3f7] p-3">
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_2fr_auto]">
 <label className="text-xs font-semibold">Prodotto mancante<input className="team-field mt-1" disabled={busy} list={listId} maxLength={200} placeholder="Scrivi il nome del prodotto…" value={r.name} onChange={e=>{const p=data.products.find(p=>`${p.name} · ${p.sku}`===e.target.value);row(index,{name:e.target.value,productId:p?.id||''});}}/></label>
 <label className="text-xs font-semibold">Quantità richiesta (pezzi)<input className="team-field mt-1" disabled={busy} inputMode="numeric" placeholder="Es. 5" value={r.quantity} onChange={e=>row(index,{quantity:e.target.value})}/></label>
 <label className="text-xs font-semibold">Note<input className="team-field mt-1" disabled={busy} maxLength={1000} placeholder="Quando serve o altre indicazioni" value={r.note} onChange={e=>row(index,{note:e.target.value})}/></label>
 <button type="button" disabled={busy} className="team-button self-end" onClick={()=>edit({...notes,rows:notes.rows.filter((_,i)=>i!==index)})}>Rimuovi</button></div>
 {product?<div className="grid gap-2 text-sm sm:grid-cols-3"><p className="rounded-lg bg-white p-3">Disponibili in Magazzino: <strong>{product.available} pezzi</strong></p><p className="rounded-lg bg-white p-3">Registrati in salone: <strong>{product.salon} pezzi</strong></p><p className="rounded-lg bg-[#f2e3ec] p-3">Da portare al salone: <strong>{amounts?`${amounts.bring} pezzi`:'indica quantità'}</strong>{amounts&&amounts.missing>0&&<span className="mt-1 block font-semibold text-amber-800">Da acquistare: {amounts.missing} pezzi</span>}</p></div>:<p className="text-sm text-amber-800">{r.name?'Prodotto non collegato al catalogo: disponibilità da verificare. Puoi comunque salvare la richiesta.':'Scrivi e scegli un suggerimento per vedere le scorte.'}</p>}
 </article>;})}
 <button type="button" disabled={busy||notes.rows.length>=100} className="team-button" onClick={()=>edit({...notes,rows:[...notes.rows,{productId:'',name:'',quantity:'',note:''}]})}>+ Aggiungi prodotto</button>
 <p className="text-xs text-neutral-500">Disponibilità registrata al {new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(data.stockUpdatedAt))}. Sono esclusi i pezzi prenotati. Le quantità da portare sono una proposta: il salvataggio non sposta né prenota merce.</p>
 <button type="button" className="team-button" data-primary="true" disabled={busy||!dirty} onClick={()=>void save()}>{busy?'Salvataggio…':'Salva prodotti da ordinare'}</button>
 </>}
 {message&&<p role="status" className="text-sm text-emerald-800">{message}</p>}
 </>}
 </section>;
}
