import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BONUS_EVENT_LABELS, bonusBalance, romeBonusDay, type BonusEventType, type NewBonusEvent } from '@/lib/monthly-bonus';
import { accountFor, blankBonusState, configureBonus, isBonusAdmin, mayReadBonus, prepareBonusEvent, validateBonusMonth, visibleBonusBalance, setBonusVisibility, type BonusPerson, type BonusState } from '@/lib/monthly-bonus-state';
export const dynamic='force-dynamic';
const prefix='monthly_bonus:';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function people(tx: Prisma.TransactionClient) {
  const users=await tx.user.findMany({where:{active:true},select:{id:true,name:true,role:true,active:true,location:{select:{name:true}}},orderBy:{name:'asc'}});
  return users.map(u=>({id:u.id,name:u.name,role:u.role,active:u.active,locationName:u.location?.name??null})) satisfies BonusPerson[];
}
async function load(tx: Prisma.TransactionClient, month: string):Promise<BonusState> {
  const row=await tx.setting.findUnique({where:{key:prefix+month}});
  if(row) return row.value as unknown as BonusState;
  const previous=await tx.setting.findFirst({where:{key:{startsWith:prefix,lt:prefix+month}},orderBy:{key:'desc'}});
  const state=blankBonusState(previous ? (previous.value as unknown as BonusState).configs : {});
  state.valueVisible=previous ? (previous.value as unknown as BonusState).valueVisible===true : false;
  return state;
}
export async function GET(request:NextRequest) {
  const session=await auth();if(!session?.user?.id)return json({error:'Accesso richiesto.'},401);
  try {
    const month=validateBonusMonth(request.nextUrl.searchParams.get('month')??romeBonusDay().slice(0,7));
    const [staff,state]=await Promise.all([people(prisma),load(prisma,month)]);
    const actor=staff.find(p=>p.id===session.user.id);if(!actor)return json({error:'Accesso non disponibile.'},403);
    const visible=staff.filter(p=>mayReadBonus(actor,state,p.id));
    return json({month,today:romeBonusDay(),actor,admin:isBonusAdmin(actor.role),revision:state.revision,showValue:isBonusAdmin(actor.role)||state.valueVisible===true,valueVisible:state.valueVisible===true,
      people:visible.map(p=>{const account=accountFor(state,month,p.id);return {...p,config:state.configs[p.id]??null,account,balance:account?visibleBonusBalance(account,actor,state):null};}),
      assignments:isBonusAdmin(actor.role)?staff:[],audit:isBonusAdmin(actor.role)?state.audit:[]});
  } catch(error) { console.error('Bonus read failed',error);return json({error:'Impossibile caricare il mese richiesto.'},400); }
}
export async function POST(request:NextRequest) {
  const session=await auth();if(!session?.user?.id)return json({error:'Accesso richiesto.'},401);
  const origin=request.headers.get('origin');if(origin&&new URL(origin).host!==request.headers.get('host'))return json({error:'Origine non valida.'},403);
  try {
    const body=await request.json();if(!body||typeof body!=='object')return json({error:'Richiesta non valida.'},400);
    const month=validateBonusMonth(String(body.month??''));
    const result=await prisma.$transaction(async tx=>{
      const staff=await people(tx);const actor=staff.find(p=>p.id===session.user.id);if(!actor)throw new Error('Accesso non disponibile.');
      // One row per month, locked before checking thresholds and appending events.
      const initial=await load(tx,month);
      await tx.setting.upsert({where:{key:prefix+month},create:{key:prefix+month,value:initial as unknown as Prisma.InputJsonValue},update:{}});
      const rows=await tx.$queryRaw<Array<{value:unknown}>>`SELECT value FROM settings WHERE key = ${prefix+month} FOR UPDATE`;
      const state=rows[0].value as BonusState;
      let next:BonusState;
      if(body.action==='visibility'){
        if(body.revision!==state.revision)throw new Error('I dati sono cambiati. Ricarica prima di salvare.');
        next=setBonusVisibility(state,actor,body.visible);
      } else if(body.action==='configure'){
        if(body.revision!==state.revision)throw new Error('I dati sono cambiati. Ricarica prima di salvare.');
        next=configureBonus(state,month,actor,body.config??{},staff);
      } else if(body.action==='event'||body.action==='preview') {
        const userId=String(body.userId??'');if(!staff.some(p=>p.id===userId))throw new Error('Persona non disponibile.');
        if(!Object.hasOwn(BONUS_EVENT_LABELS,String(body.type)))throw new Error('Voce non valida.');
        if(typeof body.id!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(body.id))throw new Error('Identificativo non valido.');
        if(typeof body.evidence!=='string'||body.evidence.length>2000||typeof body.date!=='string')throw new Error('Data e riferimento obbligatori (massimo 2000 caratteri).');
        const input:NewBonusEvent={id:body.id,sourceId:body.id,type:body.type as BonusEventType,date:body.date,evidence:body.evidence,namedReviewConfirmed:body.namedReviewConfirmed===true,zeroReworksConfirmed:body.zeroReworksConfirmed===true};
        const prepared=prepareBonusEvent(state,month,actor,userId,input,body.completedAppointments);
        if(body.action==='preview')return {preview:prepared.preview,revision:state.revision};
        if(body.revision!==state.revision)throw new Error('Il conto è cambiato. Ricalcola l’anteprima prima di registrare.');
        next={...state,revision:state.revision+1,accounts:{...state.accounts,[userId]:prepared.account}};
      }else throw new Error('Azione non valida.');
      await tx.setting.update({where:{key:prefix+month},data:{value:next as unknown as Prisma.InputJsonValue}});
      return {success:true,revision:next.revision};
    },{timeout:20000});
    return json(result);
  } catch(error) {return json({error:error instanceof Error?error.message:'Salvataggio non riuscito.'},400);}
}
