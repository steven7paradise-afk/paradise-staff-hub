import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validCashNotes,cashComplete,emptyCashNotes} from '../lib/shift-cash';
test('cash needs an explicit answer and closure confirmation to be complete',()=>{assert.equal(cashComplete(emptyCashNotes),false);assert.ok(validCashNotes({...emptyCashNotes,discrepancy:false}));assert.equal(cashComplete({...emptyCashNotes,discrepancy:false}),false);assert.ok(cashComplete({...emptyCashNotes,discrepancy:false,closed:true}));});
test('discrepancies require positive amount, direction and explanation',()=>{const n={discrepancy:true,amount:'20,50',kind:'MISSING',explanation:'Resto errato',closed:true};assert.ok(cashComplete(n));assert.ok(cashComplete({...n,kind:'EXTRA'}));for(const amount of ['', '0','-20','NaN','1.234','1000001'])assert.equal(validCashNotes({...n,amount}),false);assert.equal(validCashNotes({...n,explanation:'  '}),false);assert.equal(validCashNotes({...n,kind:''}),false);});
