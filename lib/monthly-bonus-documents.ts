import { previewBonusEvent, canRegisterBonus, romeBonusDay, type BonusActor } from './monthly-bonus';
import { accountFor, isBonusAdmin, type BonusState } from './monthly-bonus-state';

export function isDisciplinaryDocument(type:string,title:string,filename='') {
 const text=`${title} ${filename}`.toLowerCase().replace(/[_\-.]+/g,' ').replace(/\s+/g,' ');
 return type==='LETTERA_CONTESTAZIONE'||/\b(lettera di contestazione|contestazione disciplinare|richiamo disciplinare)\b/.test(text);
}
export function validateDocumentBonus(state:BonusState,userId:string,actor:BonusActor){
 const config=state.configs[userId];
 if(!config)throw new Error('Prima di caricare la lettera di contestazione, assegna il livello del dipendente in Gestione punti.');
 if(!actor.active || (!isBonusAdmin(actor.role) && !canRegisterBonus(actor,config,'DISCIPLINARY_LETTER')))throw new Error('La lettera deve essere caricata dalla direzione o da una responsabile autorizzata per questa persona in Gestione punti.');
}
export function applyDocumentBonus(state:BonusState,userId:string,actor:BonusActor,document:{id:string;title:string;hash:string},now=new Date()){
 validateDocumentBonus(state,userId,actor);
 const date=romeBonusDay(now),month=date.slice(0,7),account=accountFor(state,month,userId)!;
 const sourceId=`disciplinary-document:${userId}:${document.hash}`;
 if(account.events.some(e=>e.sourceId===sourceId))return state;
 const input={
  id:`document:${document.id}`,sourceId,type:'DISCIPLINARY_LETTER' as const,date,
  evidence:`Documento ${document.id}: ${document.title}. Registrazione automatica al caricamento.`,
 };
 const calculated=previewBonusEvent(account,input,now);
 const next={...account,events:[...account.events,{...input,...calculated,recordedAt:now.toISOString(),actorId:actor.id,actorName:actor.name}]};
 return {...state,revision:state.revision+1,accounts:{...state.accounts,[userId]:next}};
}
