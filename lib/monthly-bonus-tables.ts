import { qualityAffectsPreviousBonus } from "./shift-quality";
import type { AssistanceSheet } from './assistance-tables';
import { BONUS_START_DATE, romeBonusDay } from './monthly-bonus';

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export type TableBonusPerson={id:string;name:string;active:boolean};
export type TableRework={sourceId:string;userId:string;date:string;sheetId:string;rowId:string};
/** Match explicit full names only; never assign a penalty through a fuzzy name match. */
export function tableReworks(sheets:AssistanceSheet[],people:TableBonusPerson[],now=new Date()){
 const events:TableRework[]=[];
 const unresolved:string[]=[];
 for(const sheet of sheets){
  if(!/^sistemazione fasc(e|ia|ie)$/.test(normalize(sheet.name)))continue;
  const previous=sheet.columns.find(c=>/^app(?:untamento)? precedente$/.test(normalize(c.label)));
  if(!previous)continue;
  const performed=sheet.columns.find(c=>normalize(c.label)==='sistemazione');
  for(const row of sheet.rows){
   if(!qualityAffectsPreviousBonus(row.values,row.reviewedAt))continue;
   const raw=row.values[previous.id];
   if(typeof raw!=='string'||!raw.trim()||normalize(raw)==='da verificare')continue;
   // Automatically imported bookings count only once Controllo Cliente confirms the service.
   const performer=performed?row.values[performed.id]:null;
   if(row.id.startsWith('sistemazione-fasce:')&&(typeof performer!=='string'||!performer.trim()||normalize(performer)==='da verificare'))continue;
   const timestamp=new Date(row.createdAt);
   if(!Number.isFinite(timestamp.getTime()))continue;
   const date=romeBonusDay(timestamp);
   if(date<BONUS_START_DATE||date>romeBonusDay(now))continue;
   const names=[...new Set(raw.split(/[,;\n]+/).map(normalize).filter(Boolean))];
   const matched=names.map(name=>people.filter(p=>p.active&&normalize(p.name)===name));
   if(matched.some(matches=>matches.length!==1)){unresolved.push(row.id);continue;}
   for(const matches of matched)events.push({sourceId:`table-rework:${sheet.id}:${row.id}:${matches[0].id}`,userId:matches[0].id,date,sheetId:sheet.id,rowId:row.id});
  }
 }
 return {events,unresolved};
}

import { previewBonusEvent } from './monthly-bonus';
import { accountFor, type BonusState } from './monthly-bonus-state';
/** Import each table row once, sharing the existing REWORK monthly counter. */
export function applyTableReworks(state:BonusState,month:string,entries:TableRework[],now=new Date()){
 let next=state;
 const pending:string[]=[];
 for(const entry of [...entries].filter(e=>e.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date)||a.sourceId.localeCompare(b.sourceId))){
  const account=accountFor(next,month,entry.userId);
  if(!account){pending.push(entry.rowId);continue;}
  if(account.events.some(e=>e.sourceId===entry.sourceId))continue;
  const rowPrefix=`table-rework:${entry.sheetId}:${entry.rowId}:`;
  const previousOwners=Object.values(state.accounts).flatMap(a=>a.events.filter(e=>e.sourceId.startsWith(rowPrefix)).map(()=>a.userId));
  if(previousOwners.length&&!previousOwners.includes(entry.userId)){pending.push(entry.rowId);continue;}
  if(account.events.some(e=>e.type==='ZERO_REWORK')){pending.push(entry.rowId);continue;}
  const input={id:entry.sourceId,sourceId:entry.sourceId,type:'REWORK' as const,date:entry.date,evidence:`Sistemazione fasce · tabella ${entry.sheetId} · riga ${entry.rowId}. Attribuita alla lavoratrice in App precedente.`};
  const calculated=previewBonusEvent(account,input,now);
  const updated={...account,events:[...account.events,{...input,...calculated,recordedAt:now.toISOString(),actorId:'SYSTEM_TABLES',actorName:'Sistema · Sistemazione fasce'}]};
  next={...next,revision:next.revision+1,accounts:{...next.accounts,[entry.userId]:updated}};
 }
 return {state:next,pending};
}
