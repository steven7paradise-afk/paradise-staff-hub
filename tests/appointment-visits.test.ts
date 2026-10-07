import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentVisits, appointmentCustomerPhone } from '../lib/appointment-visits';
const a = {id:'a',customerEmail:'first@example.com',customerPhone:'+393884695825',dateKey:'2026-10-07',inferredSalon:'buenos-aires',startDate:'2026-10-07T15:00:00Z',endDate:'2026-10-07T16:30:00Z'};
const b = {...a,id:'b',customerEmail:'second@example.com',customerPhone:appointmentCustomerPhone(null,{'Numero Telefono':'3884695825'}),startDate:'2026-10-07T16:00:00Z',endDate:'2026-10-07T17:00:00Z'};
test('Francesca: different emails and form phone still identify a single visit',()=>assert.deepEqual(appointmentVisits([b,a]).map(g=>g.map(b=>b.id)),[['a','b']]));
test('separate days, salons, canceled visits and unrelated contacts stay separate',()=>{
 for(const change of [{dateKey:'2026-10-08'},{inferredSalon:'duomo'},{isCanceled:true},{customerPhone:'3330000000'}, {startDate:'2026-10-07T19:00:00Z'}]) assert.equal(appointmentVisits([a,{...b,...change}]).length,2);
});
test('consecutive services join without losing their original records',()=>{
 const second={...b,startDate:a.endDate}; const group=appointmentVisits([a,second])[0]; assert.equal(group.length,2);assert.equal(group[1],second);
});
test('names alone never merge two clients',()=>assert.equal(appointmentVisits([{...a,customerPhone:null,customerEmail:null},{...b,customerPhone:null,customerEmail:null}]).length,2));

test('Shopify note on reapplication is also shown on color with no order', async () => {
 const {shopifyNotesForVisits} = await import('../lib/appointment-visits');
 const notes = {a:'Nota Shopify riapplicazione'};
 assert.deepEqual(shopifyNotesForVisits([a,b],notes),{a:notes.a,b:notes.a});
 assert.deepEqual(notes,{a:'Nota Shopify riapplicazione'});
});
test('visit notes retain distinct notes, deduplicate shared notes and isolate other visits', async () => {
 const {shopifyNotesForVisits} = await import('../lib/appointment-visits');
 const other={...b,id:'other',dateKey:'2026-10-08'};
 assert.deepEqual(shopifyNotesForVisits([a,b,other],{a:'Prima',b:'Seconda',other:'Altra visita'}),{a:'Prima\n\nSeconda',b:'Prima\n\nSeconda',other:'Altra visita'});
 assert.deepEqual(shopifyNotesForVisits([a,b],{a:'Uguale',b:'Uguale'}),{a:'Uguale',b:'Uguale'});
 assert.deepEqual(shopifyNotesForVisits([a,b],{a:''}),{});
});
