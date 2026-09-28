import assert from 'node:assert/strict';
import test from 'node:test';
import { accountFor, blankBonusState, configureBonus, mayReadBonus, prepareBonusEvent, validateBonusMonth, visibleBonusBalance, setBonusVisibility, type BonusPerson } from '../lib/monthly-bonus-state';
const now=new Date('2026-09-28T12:00:00Z'),month='2026-09';
const admin={id:'admin',name:'Admin',role:'ADMIN',active:true,locationName:null};
const rs={id:'rs',name:'RS',role:'RESPONSABILE',active:true,locationName:null};
const staff:BonusPerson={id:'staff',name:'Staff',role:'DIPENDENTE',active:true,locationName:null};
const people=[admin,rs,staff];
const cfg={userId:'staff',level:'AUTONOMA',quota:5,responsibleIds:['rs'],referenceMasterId:null,reworkPolicy:null};
const configured=()=>configureBonus(blankBonusState(),month,admin,cfg,people,now);
const event={id:'event-one-123456789',sourceId:'event-one-123456789',type:'EXTRA_APPOINTMENT' as const,date:'2026-09-28',evidence:'Appuntamento A'};
test('configuration is explicit, audited and admin only',()=>{const s=configured();assert.equal(s.revision,1);assert.equal(s.audit[0].actorId,admin.id);assert.equal(accountFor(s,month,'staff')?.base,30);assert.equal(accountFor(s,month,'admin'),null);assert.throws(()=>configureBonus(s,month,rs,cfg,people,now));assert.throws(()=>configureBonus(s,month,admin,{...cfg,quota:-1},people,now));assert.throws(()=>configureBonus(s,month,admin,{...cfg,responsibleIds:['admin']},people,now));});
test('scoped read permissions do not expose other staff',()=>{const s=configured();assert.equal(mayReadBonus(rs,s,'staff'),true);assert.equal(mayReadBonus(staff,s,'admin'),false);assert.equal(mayReadBonus({...rs,id:'other'},s,'staff'),false);assert.equal(mayReadBonus(admin,s,'staff'),true);assert.equal(mayReadBonus({...admin,active:false},s,'staff'),false);});
test('extra appointments cannot be claimed before quota or more than available',()=>{const s=configured();assert.throws(()=>prepareBonusEvent(s,month,rs,'staff',event,5,now));assert.throws(()=>prepareBonusEvent(s,month,admin,'staff',event,6,now));const result=prepareBonusEvent(s,month,rs,'staff',event,6,now);assert.equal(result.event.points,.5);const next={...s,accounts:{staff:result.account}};assert.throws(()=>prepareBonusEvent(next,month,rs,'staff',{...event,id:'event-two-123456789',sourceId:'event-two-123456789'},6,now));assert.throws(()=>configureBonus(next,month,admin,{...cfg,quota:10},people,now));assert.throws(()=>configureBonus(next,month,admin,{...cfg,level:'MASTER'},people,now));});
test('new month retains configuration only and resets events',()=>{const s=configured();const result=prepareBonusEvent(s,month,rs,'staff',event,6,now);s.accounts.staff=result.account;const next=blankBonusState(s.configs);assert.equal(accountFor(next,'2026-10','staff')?.events.length,0);assert.equal(accountFor(next,'2026-10','staff')?.base,30);assert.equal(s.accounts.staff.events.length,1);});
test('future months and unconfigured quotas fail closed',()=>{assert.throws(()=>validateBonusMonth('2026-10',now));const s=configureBonus(blankBonusState(),month,admin,{...cfg,quota:null},people,now);assert.throws(()=>prepareBonusEvent(s,month,rs,'staff',event,100,now));});

test('euro amounts are withheld from staff until direction explicitly unlocks them',()=>{
 const s=configured(),account=accountFor(s,month,'staff')!;
 assert.equal('euros' in visibleBonusBalance(account,staff,s),false);
 assert.equal('euros' in visibleBonusBalance(account,rs,s),false);
 assert.equal(visibleBonusBalance(account,admin,s).euros,150);
 assert.throws(()=>setBonusVisibility(s,rs,true,now));
 const unlocked=setBonusVisibility(s,admin,true,now);
 assert.equal(visibleBonusBalance(account,staff,unlocked).euros,150);
 assert.equal(unlocked.visibilityAudit?.[0].actorId,'admin');
 assert.equal('euros' in visibleBonusBalance(account,staff,setBonusVisibility(unlocked,admin,false,now)),false);
});

test('rework counters automatically use completed blocks without configuration',()=>{
 let s=configured();
 assert.equal(s.configs.staff.reworkPolicy,'COMPLETED_BLOCK');
 s.configs.staff.reworkPolicy=null; // Configuration saved before this change.
 const deltas=[];
 for(let i=1;i<=9;i++){
  const input={...event,id:`rework-event-${i}`,sourceId:`rework-event-${i}`,type:'REWORK' as const};
  const result=prepareBonusEvent(s,month,rs,'staff',input,null,now);
  deltas.push(result.event.points);s={...s,accounts:{staff:result.account}};
 }
 assert.deepEqual(deltas,[0,0,0,0,0,-20,0,0,-20]);
 assert.equal(accountFor(blankBonusState(s.configs),'2026-10','staff')?.events.length,0);
});
test('previously recorded rework policy and points are not rewritten',()=>{
 const s=configured();
 const existing=accountFor(s,month,'staff')!;
 existing.reworkPolicy='STARTED_BLOCK';
 existing.events=[{...event,type:'REWORK',recordedAt:now.toISOString(),actorId:rs.id,actorName:rs.name,ordinal:4,points:-20,reason:'Historical rule'}];
 s.accounts.staff=existing;
 assert.equal(accountFor(s,month,'staff')?.reworkPolicy,'STARTED_BLOCK');
 assert.equal(configureBonus(s,month,admin,cfg,people,now).accounts.staff.events[0].points,-20);
});
