import test from 'node:test';
import assert from 'node:assert/strict';
import { BONUS_EVENT_LABELS, appendBonusEvent, createBonusAccount, canRegisterBonus, type BonusAccount } from '../lib/monthly-bonus';
import { bonusRules, validateBonusRules, bonusRuleExplanation } from '../lib/monthly-bonus-rules';
import { awardOffShiftDay, offShiftSource, type OffShiftDay } from '../lib/monthly-bonus-off-shift';
import { blankBonusState, setBonusRules, visibleBonusBalance } from '../lib/monthly-bonus-state';
const now=new Date('2026-09-28T20:00:00Z');
const assignment={userId:'employee',level:'AUTONOMA' as const,responsibleIds:['rs'],referenceMasterId:null};
const rs={id:'rs',name:'RS',role:'RESPONSABILE',active:true};
const admin={...rs,id:'admin',role:'ADMIN'};
const entry={id:'entry',type:'ENTRATA',timestamp:new Date('2026-09-28T08:00:00Z')};
const exit={id:'exit',type:'USCITA',timestamp:new Date('2026-09-28T17:00:00Z')};
const day:OffShiftDay={userId:'employee',date:'2026-09-28',schedule:{name:'Riposo',code:'R'},hasApprovedLeave:false,logs:[entry,exit]};
function account():BonusAccount{return {...createBonusAccount('2026-09',assignment,'COMPLETED_BLOCK'),rules:bonusRules({offShiftDayPoints:2})};}
test('rules validate integer tolerances, half-point amounts and nonzero block size',()=>{
 assert.equal(validateBonusRules(bonusRules({extraAppointmentPoints:2.5})).extraAppointmentPoints,2.5);
 for(const changes of [{reworkBlock:0},{entryGrace:1.5},{trainingPoints:NaN},{offShiftDayPoints:-1},{extraAppointmentPoints:0.3}])assert.throws(()=>validateBonusRules(bonusRules(changes)));
});
test('only direction edits rules; audit records previous and new values',()=>{
 const state=blankBonusState();assert.throws(()=>setBonusRules(state,rs,bonusRules()));
 const next=setBonusRules(state,admin,bonusRules({extraAppointmentPoints:1}),now);
 assert.equal(next.rulesAudit?.[0].before.extraAppointmentPoints,.5);assert.equal(next.rulesAudit?.[0].after.extraAppointmentPoints,1);
 assert.equal(next.revision,1);assert.equal(state.rules,undefined);
});
test('custom rules change new events without rewriting historical points',()=>{
 let a=account();a.rules=bonusRules({entryGrace:0,entryPenalty:4,extraAppointmentPoints:2});
 a=appendBonusEvent(a,assignment,rs,{id:'late1',sourceId:'late1',type:'ENTRY_LATE',date:day.date,evidence:'Clock'},now);
 assert.equal(a.events[0].points,-4);
 a={...a,rules:bonusRules({entryGrace:0,entryPenalty:7})};
 a=appendBonusEvent(a,assignment,rs,{id:'late2',sourceId:'late2',type:'ENTRY_LATE',date:day.date,evidence:'Clock2'},now);
 assert.deepEqual(a.events.map(e=>e.points),[-4,-7]);
});
test('rework blocks use configured free count and completed block size',()=>{
 let a=account();a.rules=bonusRules({reworkFree:1,reworkBlock:2,reworkPenalty:5});
 for(let i=1;i<=5;i++)a=appendBonusEvent(a,assignment,rs,{id:`rw${i}`,sourceId:`rw${i}`,type:'REWORK',date:day.date,evidence:'Verified'},now);
 assert.deepEqual(a.events.map(e=>e.points),[0,0,-5,0,-5]);
});
test('off-shift award requires explicit rest and a complete clock pair',()=>{
 assert.ok(offShiftSource(day));
 assert.equal(offShiftSource({...day,schedule:null}),null);
 assert.equal(offShiftSource({...day,schedule:{name:'Mattina',code:'M'}}),null);
 assert.equal(offShiftSource({...day,logs:[entry]}),null);
 assert.equal(offShiftSource({...day,logs:[exit]}),null);
 assert.equal(offShiftSource({...day,hasApprovedLeave:true}),null);
 assert.equal(offShiftSource({...day,logs:[{...entry,note:'Inserita manualmente da Admin'},exit]}),null);
 assert.equal(offShiftSource({...day,logs:[entry,{...exit,timestamp:entry.timestamp}]}),null);
});
test('automatic bonus is awarded once per day, not per clock session',()=>{
 const a=account(),awarded=awardOffShiftDay(a,day,now);
 assert.equal(awarded.events[0].points,2);assert.equal(awarded.events[0].actorId,'SYSTEM_ATTENDANCE');
 assert.equal(awardOffShiftDay(awarded,day,now),awarded);
 assert.equal(awardOffShiftDay(awarded,{...day,logs:[entry,{...exit,id:'exit2'}]},now),awarded);
 assert.equal(awardOffShiftDay({...a,rules:bonusRules()},day,now).events.length,0);
 assert.equal(awardOffShiftDay(a,{...day,userId:'someone-else'},now),a);
 assert.equal(canRegisterBonus(rs,assignment,'OFF_SHIFT_WORK'),false);
});
test('illness does not have a penalty and employee output still excludes euros',()=>{
 assert.equal('SICKNESS' in BONUS_EVENT_LABELS,false);
 assert.equal(bonusRuleExplanation(bonusRules()).some(t=>/malattia/i.test(t)),false);
 const a=awardOffShiftDay(account(),day,now);
 assert.equal('euros' in visibleBonusBalance(a,rs,blankBonusState()),false);
});
