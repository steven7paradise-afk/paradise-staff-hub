import { deriveAttendanceState, type AttendanceStateLog } from './attendance-state';
export const PRESENTABILITY_REASONS = ['Divisa', 'Capelli', 'Igiene personale', 'Altro'] as const;
export type TeamIssue = { key: string; type: 'entry' | 'pause' | 'exit' | 'missing'; label: string };
export type TeamPerson = { id:string; name:string; shift:string; inactive:boolean; entry:string; pause:string; exit:string; issues:TeamIssue[]; sicknessPending:boolean };
export type TeamNotes = { decisions:Record<string,{choice:string;note:string}>; presentation:'all'|'exceptions'|''; exceptions:{userId:string;reason:string;note:string}[] };
export const emptyTeamNotes = ():TeamNotes => ({decisions:{},presentation:'',exceptions:[]});
const clock=(date:Date|string)=>new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(date));
const mins=(s:string)=>{const [h,m]=s.split(':').map(Number);return h*60+m;};
export function buildTeamPerson(input:{id:string;name:string;category:string;start:string|null;end:string|null;logs:AttendanceStateLog[];sicknessPending?:boolean},now:Date):TeamPerson {
 const state=deriveAttendanceState(input.logs); const inactive=/malattia|ferie|riposo|permesso|assenz/i.test(input.category);
 const row:TeamPerson={id:input.id,name:input.name,shift:inactive?input.category:input.start&&input.end?`${input.start}–${input.end}`:input.category, inactive,entry:state.firstEntry?clock(state.firstEntry.timestamp):'—',pause:'—',exit:state.lastExit?clock(state.lastExit.timestamp):'—',issues:[],sicknessPending:!!input.sicknessPending};
 if(inactive)return row;
 if(state.firstEntry&&input.start){const delay=mins(row.entry)-mins(input.start);if(delay>=1){row.entry+=` · +${delay} min`;row.issues.push({key:`${input.id}:entry`,type:'entry',label:`Ritardo ingresso: ${delay} min`});}}
 if(!state.firstEntry&&input.start&&mins(clock(now))>=mins(input.start)){row.entry='Nessuna timbratura';row.issues.push({key:`${input.id}:missing`,type:'missing',label:'Ingresso non registrato'});}
 row.pause=state.breaks.map((b,index)=>{const end=b.rientro?.timestamp || (state.lastExit&&new Date(state.lastExit.timestamp)>new Date(b.pausa.timestamp)?state.lastExit.timestamp:now);const minutes=Math.max(0,Math.floor((new Date(end).getTime()-new Date(b.pausa.timestamp).getTime())/60000)); const extra=Math.max(0,minutes-60);if(extra)row.issues.push({key:`${input.id}:pause:${new Date(b.pausa.timestamp).toISOString()}`,type:'pause',label:`Pausa ${index+1}: ${extra} min oltre i 60`});return `${clock(b.pausa.timestamp)}–${b.rientro?clock(b.rientro.timestamp):'in corso'}${extra?` · +${extra} min`:''}`;}).join(', ')||'—';
 if(state.status==='OUT'&&state.lastExit&&input.end&&mins(row.exit)<mins(input.end)){row.exit+=' · anticipata';row.issues.push({key:`${input.id}:exit`,type:'exit',label:'Motivo uscita anticipata'});}
 return row;
}
export function teamPending(people:TeamPerson[],notes:TeamNotes){
 const issues=people.flatMap(p=>p.issues).filter(i=>{const d=notes.decisions[i.key];return !d||(!d.choice&&i.type!=='exit')||(i.type==='exit'&&!d.note.trim());}).length;
 const presentation=notes.presentation==='all'||notes.presentation==='exceptions'&&notes.exceptions.length>0&&notes.exceptions.every(e=>e.userId&&e.reason&&(e.reason!=='Altro'||e.note.trim()));
 return issues+(presentation?0:1);
}
