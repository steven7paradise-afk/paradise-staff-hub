import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { BONUS_START_DATE, romeBonusDay } from './monthly-bonus';
import { accountFor, type BonusState } from './monthly-bonus-state';
import { bonusRules } from './monthly-bonus-rules';
import { loadBonusState, BONUS_SETTING_PREFIX } from './monthly-bonus-store';
import { awardOffShiftDay } from './monthly-bonus-off-shift';
/** Called after a completed clock-out; no bonus on missing schedules or inferred absences. */
export async function syncOffShiftBonus(userId:string,date:Date){
 const day=date.toISOString().slice(0,10),month=day.slice(0,7);
 if(day<BONUS_START_DATE||day>romeBonusDay())return;
 const initial=await loadBonusState(prisma,month);
 if(!initial.configs[userId]||bonusRules(initial.rules).offShiftDayPoints<=0)return;
 return prisma.$transaction(async tx=>{
  const key=BONUS_SETTING_PREFIX+month;
  await tx.setting.upsert({where:{key},create:{key,value:initial as unknown as Prisma.InputJsonValue},update:{}});
  const locked=await tx.$queryRaw<Array<{value:unknown}>>`SELECT value FROM settings WHERE key = ${key} FOR UPDATE`;
  const state=locked[0].value as BonusState;
  const account=accountFor(state,month,userId);if(!account)return;
  const start=new Date(day+'T00:00:00Z'),end=new Date(start.getTime()+86400000);
  const [user,schedule,logs,leave]=await Promise.all([
   tx.user.findUnique({where:{id:userId},select:{active:true}}),
   tx.scheduleEntry.findUnique({where:{user_id_date:{user_id:userId,date:start}},include:{category:true}}),
   tx.attendanceLog.findMany({where:{user_id:userId,date:start},select:{id:true,type:true,timestamp:true,note:true}}),
   tx.leaveRequest.findFirst({where:{user_id:userId,status:'APPROVED',start_date:{lt:end},end_date:{gte:start}},select:{id:true}}),
  ]);
  if(!user?.active)return;
  const next=awardOffShiftDay(account,{userId,date:day,schedule:schedule?{name:schedule.category.name,code:schedule.category.code}:null,logs,hasApprovedLeave:!!leave});
  if(next===account)return;
  await tx.setting.update({where:{key},data:{value:{...state,revision:state.revision+1,accounts:{...state.accounts,[userId]:next}} as unknown as Prisma.InputJsonValue}});
 },{timeout:15000});
}
