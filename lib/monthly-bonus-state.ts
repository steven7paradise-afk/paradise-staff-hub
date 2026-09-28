import { BONUS_LEVELS, BONUS_START_MONTH, bonusBalance, appendBonusEvent, createBonusAccount, extraAppointmentQuota, previewBonusEvent, romeBonusDay, type BonusAccount, type BonusActor, type BonusAssignment, type BonusLevel, type NewBonusEvent, type ReworkPolicy } from './monthly-bonus';

export type BonusConfig = BonusAssignment & { quota: number | null; reworkPolicy: ReworkPolicy | null };
export type BonusAudit = { id: string; at: string; actorId: string; actorName: string; userId: string; before: BonusConfig | null; after: BonusConfig };
export type BonusState = { valueVisible?: boolean; visibilityAudit?: Array<{at:string;actorId:string;visible:boolean}>; version: 1; revision: number; configs: Record<string, BonusConfig>; accounts: Record<string, BonusAccount>; audit: BonusAudit[] };
export type BonusPerson = BonusActor & { locationName: string | null };
export const isBonusAdmin = (role: string) => ['ZERO', 'SUPER_ADMIN', 'ADMIN'].includes(role);
export function validateBonusMonth(month: string, now = new Date()) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || month < BONUS_START_MONTH || month > romeBonusDay(now).slice(0,7)) throw new Error('Mese non valido. Seleziona un mese dalla decorrenza a oggi.');
  return month;
}
export function blankBonusState(configs: Record<string, BonusConfig> = {}): BonusState { return { version: 1, revision: 0, configs, accounts: {}, audit: [], valueVisible:false, visibilityAudit:[] }; }
export function accountFor(state: BonusState, month: string, userId: string) {
  const config = state.configs[userId];
  return state.accounts[userId] ?? (config ? createBonusAccount(month, config, config.reworkPolicy) : null);
}
export function mayReadBonus(actor: BonusActor, state: BonusState, userId: string) {
  const c = state.configs[userId];
  return actor.active && (isBonusAdmin(actor.role) || actor.id === userId || Boolean(c?.responsibleIds.includes(actor.id)) || c?.referenceMasterId === actor.id);
}
export function configureBonus(state: BonusState, month: string, actor: BonusActor, raw: Record<string, unknown>, people: BonusPerson[], now = new Date()): BonusState {
  if (!actor.active || !isBonusAdmin(actor.role)) throw new Error('Solo la direzione può configurare i punti.');
  const userId = String(raw.userId ?? '');
  if (!people.some(p=>p.id===userId && p.active)) throw new Error('Persona non disponibile.');
  const level = raw.level as BonusLevel;
  if (!Object.hasOwn(BONUS_LEVELS, level)) throw new Error('Scegli il livello.');
  const quota = raw.quota;
  if (quota !== null && (typeof quota !== 'number' || !Number.isSafeInteger(quota) || quota < 0 || quota > 100000)) throw new Error('Quota non valida. Usa un intero positivo o lascia il campo vuoto.');
  const policy = raw.reworkPolicy as ReworkPolicy | null;
  if (policy !== null && !['COMPLETED_BLOCK','STARTED_BLOCK'].includes(policy)) throw new Error('Regola rilavorazioni non valida.');
  const responsibleIds = Array.isArray(raw.responsibleIds) ? [...new Set(raw.responsibleIds.map(String))] : [];
  if (responsibleIds.some(id=>!people.some(p=>p.id===id && p.active && p.role==='RESPONSABILE'))) throw new Error('Seleziona una responsabile di sede attiva.');
  const referenceMasterId = raw.referenceMasterId ? String(raw.referenceMasterId) : null;
  if (referenceMasterId && (referenceMasterId===userId || !people.some(p=>p.id===referenceMasterId && p.active && !isBonusAdmin(p.role)) || state.configs[referenceMasterId]?.level!=='MASTER')) throw new Error('Configura prima il livello del Master di riferimento.');
  const old = state.configs[userId];
  const account = state.accounts[userId];
  if (old?.level==='MASTER' && level!=='MASTER' && Object.values(state.configs).some(c=>c.referenceMasterId===userId)) throw new Error('Riassegna prima le Junior collegate a questo Master.');
  if (account?.events.length && account.level !== level) throw new Error('Il livello del mese è bloccato: esistono eventi. La correzione deve essere concordata.');
  if (account?.events.some(e=>e.type==='REWORK') && account.reworkPolicy!==policy) throw new Error('Regola bloccata: esistono rilavorazioni nel mese.');
  if (account?.events.some(e=>e.type==='EXTRA_APPOINTMENT') && old?.quota!==quota) throw new Error('Quota bloccata: esistono bonus extra registrati. La correzione deve essere concordata.');
  const config: BonusConfig = { userId, level, quota: quota as number|null, reworkPolicy: policy, responsibleIds, referenceMasterId };
  const updated = account ? { ...account, ...BONUS_LEVELS[level], level, reworkPolicy: policy } : undefined;
  return { ...state, revision: state.revision+1, configs: { ...state.configs, [userId]:config }, accounts: updated ? {...state.accounts,[userId]:updated} : state.accounts,
    audit:[...state.audit,{id:crypto.randomUUID(),at:now.toISOString(),actorId:actor.id,actorName:actor.name,userId,before:old??null,after:config}] };
}
export function prepareBonusEvent(state: BonusState, month: string, actor: BonusActor, userId: string, input: NewBonusEvent, completedAppointments: unknown, now = new Date()) {
  const c=state.configs[userId], account=accountFor(state,month,userId);
  if (!c || !account) throw new Error('La direzione deve assegnare prima il livello.');
  if (input.type==='EXTRA_APPOINTMENT') {
    if (c.quota===null) throw new Error('Imposta prima la quota in Gestione punti.');
    if (typeof completedAppointments!=='number' || !Number.isSafeInteger(completedAppointments) || completedAppointments<0) throw new Error('Indica il totale verificato degli appuntamenti svolti nel periodo.');
    const quota=extraAppointmentQuota(completedAppointments,c.quota);
    if (account.events.filter(e=>e.type==='EXTRA_APPOINTMENT').length>=quota.extra) throw new Error('Nessun appuntamento extra disponibile oltre quota.');
    input={...input,evidence:`${input.evidence}\nTotale verificato: ${completedAppointments}; quota: ${c.quota}.`};
  }
  // Same authorization and calculation for preview and persistence.
  const result=appendBonusEvent(account,c,actor,input,now);
  return {account:result,event:result.events[result.events.length-1],preview:previewBonusEvent(account,input,now)};
}

export function visibleBonusBalance(account: BonusAccount, actor: BonusActor, state: BonusState): Omit<ReturnType<typeof bonusBalance>, 'euros'> & {euros?:number} {
  const {euros,...points}=bonusBalance(account);
  return isBonusAdmin(actor.role)||state.valueVisible===true ? {...points,euros} : points;
}
export function setBonusVisibility(state:BonusState,actor:BonusActor,visible:unknown,now=new Date()):BonusState {
  if(!actor.active||!isBonusAdmin(actor.role))throw new Error('Solo la direzione può sbloccare il valore economico.');
  if(typeof visible!=='boolean')throw new Error('Impostazione non valida.');
  return {...state,valueVisible:visible,revision:state.revision+1,visibilityAudit:[...(state.visibilityAudit??[]),{at:now.toISOString(),actorId:actor.id,visible}]};
}
