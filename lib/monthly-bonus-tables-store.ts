import type { Prisma } from '@prisma/client';
import { ASSISTANCE_TABLES_KEY, normalizeAssistanceSheets, type AssistanceSheet } from './assistance-tables';
import { BONUS_SETTING_PREFIX, loadBonusState } from './monthly-bonus-store';
import type { BonusState } from './monthly-bonus-state';
import { tableReworks, applyTableReworks } from './monthly-bonus-tables';

export async function syncTableReworks(tx:Prisma.TransactionClient,month:string,sheets?:AssistanceSheet[]){
 const currentSheets=sheets??normalizeAssistanceSheets((await tx.setting.findUnique({where:{key:ASSISTANCE_TABLES_KEY}}))?.value);
 const people=await tx.user.findMany({where:{active:true},select:{id:true,name:true,active:true}});
 const extracted=tableReworks(currentSheets,people);
 const initial=await loadBonusState(tx,month);
 if(!extracted.events.some(e=>e.date.startsWith(month)))return {state:initial,pending:extracted.unresolved.length};
 const key=BONUS_SETTING_PREFIX+month;
 await tx.setting.upsert({where:{key},create:{key,value:initial as unknown as Prisma.InputJsonValue},update:{}});
 const locked=await tx.$queryRaw<Array<{value:unknown}>>`SELECT value FROM settings WHERE key = ${key} FOR UPDATE`;
 const state=locked[0].value as BonusState;
 const result=applyTableReworks(state,month,extracted.events);
 if(result.state!==state)await tx.setting.update({where:{key},data:{value:result.state as unknown as Prisma.InputJsonValue}});
 return {state:result.state,pending:extracted.unresolved.length+result.pending.length};
}
