'use client';
import {useCallback,useEffect,useState} from 'react';
type Note={note:string;assignee:string;rating:number|null;version:string|null;author:string;taskId?:string;readBy?:string;readAt?:string};
type Report={current:Note;prior:Note|null;priorDay:string;staff:{id:string;name:string}[]};
export function ShiftTomorrowPanel({day,editing}:{day:string;editing:boolean}){
 const [data,setData]=useState<Report|null>(null),[note,setNote]=useState(''),[assignee,setAssignee]=useState(''),[rating,setRating]=useState<number|null>(null),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const accept=useCallback((d:Report)=>{setData(d);setNote(d.current.note);setAssignee(d.current.assignee);setRating(d.current.rating);setDirty(false);},[]);
 const load=useCallback(async()=>{try{const r=await fetch(`/api/shift-tomorrow?day=${day}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);accept(d);setError('');}catch(e){setError(e instanceof Error?e.message:'Caricamento non riuscito');}},[day,accept]);useEffect(()=>{void load();},[load]);
 async function save(read=false){setBusy(true);setError('');try{const r=await fetch('/api/shift-tomorrow',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({day,note,assignee,rating,action:read?'read':'save',version:read?data?.prior?.version:data?.current.version})});const d=await r.json();if(!r.ok)throw new Error(d.error);if(read)setData(d);else accept(d);setMessage(read?'Lettura registrata':'Consegne salvate');}catch(e){setError(e instanceof Error?e.message:'Salvataggio non riuscito');}finally{setBusy(false);}}
 return <section className="shift-team-panel space-y-4" aria-label="Passaggio di consegne">
 {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error} <button type="button" className="team-button" onClick={()=>void load()}>Ricarica</button></p>}
 {data?.prior?.note&&<aside className="rounded-2xl border-2 border-[#bb5e87] bg-[#faf0f6] p-5"><h2 className="font-bold text-[#74304e]">Passaggio di consegne per oggi</h2><p className="mt-2 text-xs font-bold uppercase">Nota di {data.prior.author} · {data.priorDay.split('-').reverse().join('/')}</p><p className="mt-3 whitespace-pre-wrap text-sm">{data.prior.note}</p>{data.prior.readAt?<p className="mt-3 text-xs text-emerald-800">Letto da {data.prior.readBy} · {new Date(data.prior.readAt).toLocaleString('it-IT',{timeZone:'Europe/Rome'})}</p>:<button type="button" className="team-button mt-3" disabled={busy} onClick={()=>void save(true)}>Letto</button>}</aside>}
 {editing&&<div className="space-y-5 rounded-2xl bg-white p-5 sm:p-6"><header><p className="text-xs font-bold uppercase tracking-wide text-[#963b62]">Blocco 7 · Facoltativo</p><h2 className="mt-2 text-xl font-bold">Domani</h2><p className="mt-2 text-sm text-neutral-600">Il passaggio di consegne: la nota apparirà all’apertura del verbale di domani.</p></header>
 {!data?<p>Caricamento…</p>:<><label className="block text-xs font-semibold">Cosa serve e cosa va sistemato<textarea className="team-field mt-2" rows={4} maxLength={5000} disabled={busy} placeholder="Scrivi cosa serve per domani…" value={note} onChange={e=>{setNote(e.target.value);setDirty(true);setMessage('');}}/></label>
 <label className="block text-xs font-semibold">Assegna a (diventa una task)<select className="team-field mt-2" disabled={busy} value={assignee} onChange={e=>{setAssignee(e.target.value);setDirty(true);setMessage('');}}><option value="">Nessuna assegnazione</option>{data.staff.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <fieldset><legend className="mb-2 text-xs font-semibold">Valutazione della giornata (su 5)</legend><div className="flex flex-wrap gap-2">{[1,2,3,4,5].map(n=><button type="button" className="team-button" key={n} disabled={busy} aria-pressed={rating===n} onClick={()=>{setRating(rating===n?null:n);setDirty(true);setMessage('');}}>{n}</button>)}</div></fieldset>
 {data.current.taskId&&<a className="inline-block text-sm font-bold text-[#963b62] underline" href={`/tasks?task=${encodeURIComponent(data.current.taskId)}`}>Apri task assegnata</a>}
 <div><button type="button" className="team-button" data-primary="true" disabled={busy||!dirty} onClick={()=>void save()}>{busy?'Salvataggio…':'Salva per domani'}</button></div>
 {note.trim()&&<div className="rounded-xl bg-[#f3edf2] p-4"><h3 className="text-sm font-bold">Anteprima per domani</h3><p className="mt-2 whitespace-pre-wrap text-sm">{note}</p></div>}
 </>}
 </div>}
 {message&&<p role="status" className="text-sm text-emerald-800">{message}</p>}
 </section>;
}
