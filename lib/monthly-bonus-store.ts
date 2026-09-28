import type { Prisma } from '@prisma/client';
import { blankBonusState, type BonusState } from './monthly-bonus-state';
export const BONUS_SETTING_PREFIX='monthly_bonus:';
export async function loadBonusState(tx:Prisma.TransactionClient,month:string):Promise<BonusState>{
 const row=await tx.setting.findUnique({where:{key:BONUS_SETTING_PREFIX+month}});
 if(row)return row.value as unknown as BonusState;
 const previous=await tx.setting.findFirst({where:{key:{startsWith:BONUS_SETTING_PREFIX,lt:BONUS_SETTING_PREFIX+month}},orderBy:{key:'desc'}});
 const old=previous?.value as unknown as BonusState|undefined;
 return {...blankBonusState(old?.configs??{}),valueVisible:old?.valueVisible===true,...(old?.rules?{rules:old.rules}:{})};
}
