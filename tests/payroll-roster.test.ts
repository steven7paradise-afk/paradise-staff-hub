import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPayrollRoster } from '../lib/payroll-roster';
test('keeps workers without attendance or contract and inactive workers visible', () => {
 const result = buildPayrollRoster([{id:'a',name:'Anna',workedMonths:[]},{id:'b',name:'Bea',active:false}],[],10,2026);
 assert.deepEqual(result.map(w=>w.id),['a','b']);
 assert.ok(result.every(w=>w.status==='review'));
});
test('uses document period, keeps archived owners and selects latest duplicate', () => {
 const doc = {type:'BUSTA_PAGA',month:9,year:2026,created_at:'2026-10-13T10:00:00Z',user:{id:'a',name:'Anna'}};
 const docs=[{...doc,id:'old'},{...doc,id:'new',created_at:'2026-10-13T11:00:00Z'}];
 assert.equal(buildPayrollRoster([],docs,10,2026)[0].payslips.length,0);
 const worker=buildPayrollRoster([],docs,9,2026)[0];
 assert.equal(worker.payslips[0].id,'new'); assert.equal(worker.payslips.length,2); assert.equal(worker.status,'uploaded');
});
test('marks an expected but absent payslip as missing', () => {
 assert.equal(buildPayrollRoster([{id:'a',name:'Anna',contractStart:'2026-01-01',workedMonths:['2026-09']}],[],9,2026)[0].status,'missing');
});
