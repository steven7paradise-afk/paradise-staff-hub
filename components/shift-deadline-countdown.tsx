'use client';
import {useEffect,useState} from 'react';
import {Clock3} from 'lucide-react';
import {shiftDeadline} from '@/lib/shift-deadline';
export function ShiftDeadlineCountdown({day}:{day:string}) {
 const [seconds,setSeconds]=useState<number|null>(null);
 useEffect(()=>{const deadline=shiftDeadline(day);const update=()=>setSeconds(Math.max(0,Math.ceil((deadline-Date.now())/1000)));update();const timer=setInterval(update,1000);return()=>clearInterval(timer);},[day]);
 const expired=seconds===0;
 const urgent=seconds!==null&&seconds<=1800;
 const time=seconds===null?'--:--:--':[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
 return <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${expired?'border-red-200 bg-red-50 text-red-800':urgent?'border-amber-300 bg-amber-50 text-amber-900':'border-[#e5c9d6] bg-[#faf0f5] text-[#74304e]'}`}>
 <div className="flex items-center gap-2"><Clock3 className="size-5" aria-hidden="true"/><div><p className="text-sm font-bold">Da compilare entro le 19:30</p><p className="text-xs">Orario italiano · {expired?'Termine di compilazione superato':'Tempo rimanente'}</p></div></div>
 <span role="timer" aria-label={expired?'Tempo scaduto':`Tempo rimanente ${time}`} className="text-2xl font-bold tabular-nums tracking-wide">{expired?'Tempo scaduto':time}</span>
 </div>;
}
