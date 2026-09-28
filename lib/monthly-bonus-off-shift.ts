import { BONUS_START_DATE, previewBonusEvent, type BonusAccount } from './monthly-bonus';
import { bonusRules } from './monthly-bonus-rules';
import { isRestSchedule } from './scheduled-attendance';
export type OffShiftDay={userId:string;date:string;schedule:{name:string;code:string}|null;hasApprovedLeave:boolean;logs:Array<{id:string;type:string;timestamp:Date;note?:string|null}>};
export function offShiftSource(day:OffShiftDay){
 if(day.date<BONUS_START_DATE||!day.schedule||!isRestSchedule(day.schedule.name,day.schedule.code)||day.hasApprovedLeave)return null;
 const ordered=[...day.logs].sort((a,b)=>a.timestamp.getTime()-b.timestamp.getTime());
 let entry:typeof ordered[number]|undefined;
 for(const log of ordered){
  if(log.type==='ENTRATA')entry=log;
  if(log.type==='USCITA'&&entry&&log.timestamp>entry.timestamp){
   if(/(?:Modificata|Inserita) manualmente da Admin/i.test(`${entry.note??''} ${log.note??''}`)){entry=undefined;continue;}
   return {id:`off-shift:${day.userId}:${day.date}`,entryId:entry.id,exitId:log.id};
  }
 }
 return null;
}
export function awardOffShiftDay(account:BonusAccount,day:OffShiftDay,now=new Date()):BonusAccount{
 const source=offShiftSource(day);if(!source||account.userId!==day.userId||account.month!==day.date.slice(0,7)||bonusRules(account.rules).offShiftDayPoints<=0||account.events.some(e=>e.sourceId===source.id))return account;
 const input={id:source.id,sourceId:source.id,type:'OFF_SHIFT_WORK' as const,date:day.date,evidence:`Giornata prevista come Riposo. Entrata ${source.entryId}; uscita ${source.exitId}. Bonus automatico, una volta per giornata.`};
 const calculated=previewBonusEvent(account,input,now);
 return {...account,events:[...account.events,{...input,...calculated,recordedAt:now.toISOString(),actorId:'SYSTEM_ATTENDANCE',actorName:'Sistema · timbrature'}]};
}
