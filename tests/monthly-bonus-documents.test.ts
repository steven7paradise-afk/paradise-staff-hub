import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDocumentBonus, isDisciplinaryDocument, validateDocumentBonus } from '../lib/monthly-bonus-documents';
import { blankBonusState } from '../lib/monthly-bonus-state';
import { bonusRules } from '../lib/monthly-bonus-rules';
const actor={id:'admin',name:'Direzione',role:'ADMIN',active:true};
const now=new Date('2026-09-28T14:00:00Z');
const document={id:'doc1',title:'Lettera di contestazione',hash:'file-sha256'};
function state(){return {...blankBonusState({employee:{userId:'employee',level:'AUTONOMA',quota:null,responsibleIds:['rs'],referenceMasterId:null,reworkPolicy:'COMPLETED_BLOCK'}}),rules:bonusRules({letterPenalty:7})};}
test('letter recognized by type, title and normalized filename',()=>{
 assert.ok(isDisciplinaryDocument('LETTERA_CONTESTAZIONE','Avviso'));
 assert.ok(isDisciplinaryDocument('DOCUMENTO','Lettera di contestazione'));
 assert.ok(isDisciplinaryDocument('BUSTA_PAGA','Documento','Lettera_di_contestazione.pdf'));
 assert.equal(isDisciplinaryDocument('DOCUMENTO','Contratto'),false);
});
test('letter uses configured penalty and records author, document and upload month',()=>{
 const next=applyDocumentBonus(state(),'employee',actor,document,now);
 assert.equal(next.accounts.employee.events[0].points,-7);
 assert.equal(next.accounts.employee.events[0].date,'2026-09-28');
 assert.equal(next.accounts.employee.events[0].actorId,actor.id);
 assert.match(next.accounts.employee.events[0].evidence,/doc1/);
 assert.equal(next.revision,1);
});
test('same file uploaded twice in month does not charge twice, another file does',()=>{
 const first=applyDocumentBonus(state(),'employee',actor,document,now);
 assert.equal(applyDocumentBonus(first,'employee',actor,{...document,id:'doc2'},now),first);
 const second=applyDocumentBonus(first,'employee',actor,{...document,id:'doc3',hash:'other-file'},now);
 assert.equal(second.accounts.employee.events.length,2);
});
test('unconfigured employee and unauthorized uploader do not change points',()=>{
 assert.throws(()=>validateDocumentBonus(blankBonusState(),'employee',actor),/assegna il livello/);
 assert.throws(()=>applyDocumentBonus(state(),'employee',{...actor,id:'other',role:'RESPONSABILE'},document,now),/autorizzata/);
 assert.throws(()=>applyDocumentBonus(state(),'employee',{...actor,active:false},document,now));
});
