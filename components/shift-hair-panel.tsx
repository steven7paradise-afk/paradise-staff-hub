'use client';
import {useEffect,useState,useCallback,useId} from 'react';
import {type HairNotes,type HairRow} from '@/lib/shift-hair';
type Report={products:{id:string;name:string;category:string|null;sku:string}[];notes:HairNotes;version:string|null};
export function ShiftHairPanel({day,onComplete}:{day:string;onComplete:(complete:boolean)=>void}){
 const [data,setData]=useState<Report|null>(null);const [notes,setNotes]=useState<HairNotes>({lowStock:null,rows:[]});const [dirty,setDirty]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);
 const accept=useCallback((d:Report)=>{setData(d);setNotes(d.notes);setDirty(false);onComplete(d.notes.lowStock!==null);},[onComplete]);
 const load=useCallback(async()=>{try{const r=await fetch(`/api/shift-hair?day=${day}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);accept(d);setError('');}catch(e){setError(e instanceof Error?e.message:'Errore catalogo');onComplete(false);}},[day,accept,onComplete]);
 useEffect(()=>{void load();},[load]);
 function edit(n:HairNotes){setNotes(n);setDirty(true);setSaved(false);}
 function row(index:number,field:keyof HairRow,value:string){edit({...notes,rows:notes.rows.map((r,i)=>i===index?{...r,[field]:value}:r)});}
 async function save(n=notes){setBusy(true);setError('');try{const r=await fetch('/api/shift-hair',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({day,notes:n,version:data?.version})});const d=await r.json();if(!r.ok)throw new Error(d.error);accept(d);setSaved(true);}catch(e){setError(e instanceof Error?e.message:'Salvataggio non riuscito');}finally{setBusy(false);}}
 return <section className="shift-team-panel space-y-4 rounded-2xl border-2 border-[#c786a3] bg-white p-4 sm:p-6" aria-label="Capelli da ordinare">
 <header><p className="text-xs font-bold uppercase text-[#963b62]">Obbligatorio</p><h2 className="mt-1 text-xl font-bold text-[#392936]">Capelli da ordinare</h2><p className="mt-2 text-sm text-neutral-600">Segna solo le tonalità che stanno finendo: quanti grammi ci sono e quanti ordinarne.</p></header>
 {error&&<div role="alert" className="text-sm text-red-800">{error}<button type="button" className="team-button ml-2" onClick={()=>void load()}>Ricarica dati salvati</button></div>}
 {!data?<p>Caricamento Magazzino…</p>:<>
 <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Ci sono capelli in bassa scorta?</h3><div className="flex gap-2"><button type="button" disabled={busy} className="team-button" aria-pressed={notes.lowStock===false} onClick={()=>{const n={lowStock:false,rows:[]};edit(n);void save(n);}}>No, tutto ok</button><button type="button" disabled={busy} className="team-button" aria-pressed={notes.lowStock===true} onClick={()=>edit({lowStock:true,rows:notes.rows.length?notes.rows:[{productId:'',present:'',order:'',note:''}]})}>Sì</button></div></div>
 {notes.lowStock===true&&<>
 {!data.products.length&&<p className="text-sm text-amber-800">Nessuna tonalità attiva nel Magazzino.</p>}
 <div className="space-y-3">{notes.rows.map((r,index)=><div key={index} className="grid gap-3 rounded-xl bg-[#faf3f7] p-3 md:grid-cols-[2fr_1fr_1fr_2fr_auto]">
 <HairShadeInput products={data.products} value={r.productId} disabled={busy} excluded={notes.rows.filter((_,i)=>i!==index).map(other=>other.productId)} onChange={value=>row(index,'productId',value)} />
 <label className="text-xs font-semibold">Quantità presente (g)<input className="team-field mt-1" disabled={busy} inputMode="decimal" placeholder="0" value={r.present} onChange={e=>row(index,'present',e.target.value)}/></label>
 <label className="text-xs font-semibold">Da ordinare (g)<input className="team-field mt-1" disabled={busy} inputMode="decimal" placeholder="Grammi" value={r.order} onChange={e=>row(index,'order',e.target.value)}/></label>
 <label className="text-xs font-semibold">Note<input className="team-field mt-1" disabled={busy} maxLength={1000} placeholder="Es. serve giovedì alle 11:00" value={r.note} onChange={e=>row(index,'note',e.target.value)}/></label>
 <button type="button" disabled={busy} className="team-button self-end" aria-label={`Rimuovi tonalità ${index+1}`} onClick={()=>edit({...notes,rows:notes.rows.filter((_,i)=>i!==index)})}>Rimuovi</button>
 </div>)}</div>
 <button type="button" disabled={busy||notes.rows.length>=100} className="team-button" onClick={()=>edit({...notes,rows:[...notes.rows,{productId:'',present:'',order:'',note:''}]})}>+ Aggiungi tonalità</button>
 <p className="rounded-xl bg-[#f3eef3] p-3 text-sm text-neutral-600">Le righe sono salvate nel verbale come segnalazioni di bassa scorta. Non modificano le giacenze del Magazzino.</p>
 <button type="button" disabled={busy||!dirty} className="team-button" data-primary="true" onClick={()=>void save()}>{busy?'Salvataggio…':'Salva capelli da ordinare'}</button>
 </>}
 {saved&&<p role="status" className="text-sm font-semibold text-emerald-800">{notes.lowStock?'Segnalazioni salvate nel verbale':'Salvato: nessuna bassa scorta'}</p>}
 </>}
 </section>;
}

function HairShadeInput({products,value,disabled,excluded,onChange}:{products:Report['products'];value:string;disabled:boolean;excluded:string[];onChange:(value:string)=>void}) {
 const id=useId();
 const label=(p:Report['products'][number])=>`${p.name} · ${p.sku}`;
 const selected=products.find(p=>p.id===value);
 const [text,setText]=useState(selected?label(selected):'');
 const [focused,setFocused]=useState(false);
 useEffect(()=>{if(selected)setText(label(selected));else if(!focused)setText('');},[value,focused]);
 const available=products.filter(p=>!excluded.includes(p.id));
 return <label className="text-xs font-semibold" htmlFor={id}>Tonalità
  <input id={id} list={`${id}-suggestions`} className="team-field mt-1" disabled={disabled} autoComplete="off" placeholder="Scrivi nome o codice tonalità…" value={text} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onChange={e=>{setText(e.target.value);const match=available.find(p=>label(p).toLocaleLowerCase('it')===e.target.value.toLocaleLowerCase('it'));onChange(match?.id||'');}} aria-describedby={`${id}-hint`} />
  <datalist id={`${id}-suggestions`}>{available.map(p=><option key={p.id} value={label(p)}>{p.category}</option>)}</datalist>
  <span id={`${id}-hint`} className="mt-1 block text-[11px] font-normal text-neutral-500">Scrivi e scegli una tonalità suggerita dal Magazzino.</span>
 </label>;
}
