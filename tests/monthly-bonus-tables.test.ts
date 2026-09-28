import test from 'node:test';
import assert from 'node:assert/strict';
import { tableReworks } from '../lib/monthly-bonus-tables';
import type { AssistanceSheet } from '../lib/assistance-tables';
const now=new Date('2026-09-28T18:00:00Z');
const people=[{id:'previous',name:'Laura Barreca',active:true},{id:'current',name:'Aurora Dassisti',active:true}];
function sheet(previous='Laura Barreca',id='row'):AssistanceSheet{return {id:'sheet',name:'Sistemazione fasce',createdAt:now.toISOString(),updatedAt:now.toISOString(),columns:[{id:'previous',label:'App precedente',type:'text'},{id:'current',label:'Sistemazione',type:'text'}],rows:[{id,nome:'',cognome:'',testo:'',image:null,file:null,createdAt:now.toISOString(),updatedAt:now.toISOString(),values:{previous,current:'Aurora Dassisti'}}]};}
test('attributes rework to previous worker, not the worker performing the correction',()=>{
 const result=tableReworks([sheet()],people,now);
 assert.equal(result.events.length,1);assert.equal(result.events[0].userId,'previous');
});
test('missing, partial or ambiguous worker names never receive inferred penalties',()=>{
 assert.equal(tableReworks([sheet('Da verificare')],people,now).events.length,0);
 assert.equal(tableReworks([sheet('Laura')],people,now).unresolved.length,1);
 assert.equal(tableReworks([sheet()], [...people,{...people[0],id:'duplicate'}],now).events.length,0);
});
test('uncompleted imported bookings and pre-start rows are excluded',()=>{
 const pending=sheet('Laura Barreca','sistemazione-fasce:1');pending.rows[0].values.current='Da verificare';
 assert.equal(tableReworks([pending],people,now).events.length,0);
 const old=sheet();old.rows[0].createdAt='2026-09-27T12:00:00Z';
 assert.equal(tableReworks([old],people,now).events.length,0);
});

import { applyTableReworks } from '../lib/monthly-bonus-tables';
import { blankBonusState } from '../lib/monthly-bonus-state';
function bonusState(){return blankBonusState({previous:{userId:'previous',level:'MASTER',quota:null,responsibleIds:[],referenceMasterId:null,reworkPolicy:'STARTED_BLOCK'}});}
test('first three free then minus twenty on fourth seventh tenth; reloading is idempotent',()=>{
 const entries=Array.from({length:10},(_,i)=>({...tableReworks([sheet()],people,now).events[0],sourceId:`table-rework:sheet:row${String(i).padStart(2,'0')}:previous`,rowId:`row${i}`}));
 const result=applyTableReworks(bonusState(),'2026-09',entries,now);
 assert.deepEqual(result.state.accounts.previous.events.map(e=>e.points),[0,0,0,-20,0,0,-20,0,0,-20]);
 assert.equal(applyTableReworks(result.state,'2026-09',entries,now).state,result.state);
});
test('missing level remains pending and gets counted when a level is configured',()=>{
 const entries=tableReworks([sheet()],people,now).events;
 assert.equal(applyTableReworks(blankBonusState(),'2026-09',entries,now).pending.length,1);
 assert.equal(applyTableReworks(bonusState(),'2026-09',entries,now).state.accounts.previous.events.length,1);
});
